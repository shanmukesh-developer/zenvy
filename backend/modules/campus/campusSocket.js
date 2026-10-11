const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getMessageModel } = require('../../models/Message');
const { getConversationModel } = require('../../models/Conversation');
const { getUserModel } = require('../../models/User');
const { getProximityRoomModel, getProximityMessageModel } = require('./models/ProximityRoom');

const parseJsonField = (val, fallback) => {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

// Shown to the client instead of raw database errors.
const SOCKET_ERROR = 'Something went wrong. Please try again.';

// Online presence tracking: userId -> Set of socketIds.
// Module-scoped so REST controllers can read the live count.
const onlineUsers = new Map();

// 1:1 WebRTC call sessions (friends / campus DMs + first-accepter for groups)
const activeCalls = new Map(); // callId -> session
const userCallIndex = new Map(); // userId -> callId
const CALL_RING_MS = 45000;
const DELETE_FOR_EVERYONE_MS = 2 * 24 * 60 * 60 * 1000;

const notifyUsers = (campusNsp, userIds, event, payload) => {
  const seen = new Set();
  for (const uid of userIds) {
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    campusNsp.to(`user:${uid}`).emit(event, payload);
  }
};

const endCallSession = (campusNsp, call, reason) => {
  if (!call || call.ended) return;
  call.ended = true;
  if (call.timeout) clearTimeout(call.timeout);
  const userIds = [call.callerId, ...(call.calleeIds || []), call.acceptedUserId].filter(Boolean);
  notifyUsers(campusNsp, userIds, 'call:ended', { callId: call.callId, reason: reason || 'ended' });
  for (const uid of userIds) {
    if (userCallIndex.get(uid) === call.callId) userCallIndex.delete(uid);
  }
  activeCalls.delete(call.callId);
};

const getCampusOnlineCount = () => onlineUsers.size;

// Live number of sockets in a proximity room (used by the REST room list).
let campusNspRef = null;
const getProximityLiveCount = (slug) => campusNspRef?.adapter?.rooms?.get('proximity:' + slug)?.size || 0;

const initCampusSocket = (io) => {
  const campusNsp = io.of('/campus');
  campusNspRef = campusNsp;

  // Authentication Middleware for /campus
  campusNsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication token required for campus socket'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Server auth configuration error'));
      }

      const decoded = jwt.verify(token, secret);
      const User = getUserModel();
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }
      if (user.isActive === false) {
        return next(new Error('Account suspended'));
      }

      socket.user = {
        id: user.id,
        name: user.name,
        role: user.role,
        hostelBlock: user.hostelBlock,
      };

      next();
    } catch (err) {
      console.warn('[CAMPUS_SOCKET_AUTH_WARN]', err.message);
      next(new Error('Invalid token'));
    }
  });

  campusNsp.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`💬 [CAMPUS_SOCKET] Connected: ${socket.user.name} (${userId})`);

    // Add to presence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal room
    socket.join(`user:${userId}`);

    // Presence is not broadcast to every campus user (privacy); nothing in the app consumes it.

    // Membership: only participants of a conversation may join it or act on its messages.
    const isMember = async (chatId) => {
      if (!chatId) return false;
      try {
        const conversation = await getConversationModel().findByPk(chatId);
        return !!conversation && (conversation.participants || []).includes(userId);
      } catch {
        return false;
      }
    };
    const inChatRoom = (chatId) => !!chatId && socket.rooms.has(`chat:${chatId}`);

    // 1. Join Chat Room (members only). Optional ack: { status: 'joined' } | { error }
    socket.on('chat:join', async (data, ack) => {
      const chatId = data?.chatId;
      if (!chatId) return;
      if (!(await isMember(chatId))) {
        if (typeof ack === 'function') ack({ error: 'Not a member of this chat' });
        return;
      }
      socket.join(`chat:${chatId}`);
      if (typeof ack === 'function') ack({ status: 'joined' });
    });

    // 2. Leave Chat Room
    socket.on('chat:leave', ({ chatId }) => {
      if (!chatId) return;
      socket.leave(`chat:${chatId}`);
    });

    // 3. Message Send (WhatsApp-level message dispatch)
    socket.on('message:send', async (data, ack) => {
      try {
        const {
          chatId,
          text,
          clientMsgId,
          type = 'text',
          mediaUrl,
          mediaMetadata,
          replyTo,
        } = data;

        if (!chatId || (!text && !mediaUrl)) {
          if (ack) ack({ error: 'Message content or attachment is required' });
          return;
        }

        const Conversation = getConversationModel();
        const Message = getMessageModel();

        // Ensure user is participant
        const conversation = await Conversation.findByPk(chatId);
        if (!conversation) {
          if (ack) ack({ error: 'Conversation not found' });
          return;
        }

        const participants = conversation.participants || [];
        if (!participants.includes(userId)) {
          if (ack) ack({ error: 'Not a member of this chat' });
          return;
        }

        // Only admins can send check
        if (conversation.onlyAdminsCanSend) {
          const admins = conversation.adminIds || [];
          if (!admins.includes(userId)) {
            if (ack) ack({ error: 'Only admins can send messages in this group' });
            return;
          }
        }

        // Create message in DB
        const newMsg = await Message.create({
          conversationId: chatId,
          senderId: userId,
          senderName: socket.user.name,
          text: text || '',
          clientMsgId: clientMsgId || null,
          type,
          mediaUrl: mediaUrl || null,
          mediaMetadata: mediaMetadata ? JSON.stringify(mediaMetadata) : '{}',
          replyTo: replyTo ? JSON.stringify(replyTo) : null,
          readBy: [{ userId, readAt: new Date() }],
          deliveredTo: [{ userId, deliveredAt: new Date() }],
        });

        // Update conversation lastMessageAt
        conversation.lastMessageAt = new Date();
        await conversation.save();

        const messagePayload = {
          id: newMsg.id,
          chatId,
          senderId: userId,
          senderName: socket.user.name,
          text: newMsg.text,
          clientMsgId,
          type: newMsg.type,
          mediaUrl: newMsg.mediaUrl,
          mediaMetadata: parseJsonField(newMsg.mediaMetadata, {}),
          replyTo: parseJsonField(newMsg.replyTo, null),
          createdAt: newMsg.createdAt,
          deliveryStatus: 'sent',
          readBy: newMsg.readBy,
          deliveredTo: newMsg.deliveredTo,
        };

        // Broadcast to chat room
        campusNsp.to(`chat:${chatId}`).emit('message:new', messagePayload);

        // Notify individual participant personal rooms (for unread badges in chat list)
        for (const pId of participants) {
          if (pId !== userId) {
            campusNsp.to(`user:${pId}`).emit('chat:updated', {
              chatId,
              lastMessage: newMsg.text || 'Attachment',
              lastSender: socket.user.name,
              time: new Date(),
            });
          }
        }

        // Acknowledge back to sender
        if (ack) {
          ack({
            status: 'sent',
            id: newMsg.id,
            createdAt: newMsg.createdAt,
          });
        }
      } catch (err) {
        console.error('[CAMPUS_MESSAGE_SEND_ERR]', err);
        if (ack) ack({ error: SOCKET_ERROR });
      }
    });

    // 4. Typing indicators
    socket.on('typing:start', ({ chatId } = {}) => {
      if (!inChatRoom(chatId)) return;
      socket.to(`chat:${chatId}`).emit('typing', {
        chatId,
        userId,
        userName: socket.user.name,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ chatId } = {}) => {
      if (!inChatRoom(chatId)) return;
      socket.to(`chat:${chatId}`).emit('typing', {
        chatId,
        userId,
        userName: socket.user.name,
        isTyping: false,
      });
    });

    // 5. Message Reactions
    socket.on('message:react', async ({ messageId, emoji }, ack) => {
      try {
        const Message = getMessageModel();
        const msg = await Message.findByPk(messageId);
        if (!msg || !(inChatRoom(msg.conversationId) || await isMember(msg.conversationId))) {
          if (ack) ack({ error: 'Message not found' });
          return;
        }
        if (typeof emoji !== 'string' || !emoji || emoji.length > 16) {
          if (ack) ack({ error: 'Pick a reaction' });
          return;
        }

        let reactions = {};
        try {
          reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
        } catch {
          reactions = {};
        }

        // One reaction per user: if already exists, replace or toggle off
        if (reactions[userId] === emoji) {
          delete reactions[userId];
        } else {
          reactions[userId] = emoji;
        }

        msg.reactions = JSON.stringify(reactions);
        await msg.save();

        campusNsp.to(`chat:${msg.conversationId}`).emit('message:updated', {
          id: msg.id,
          chatId: msg.conversationId,
          reactions,
        });

        if (ack) ack({ status: 'ok', reactions });
      } catch (err) {
        console.warn('[CAMPUS_REACT_ERR]', err.message);
        if (ack) ack({ error: SOCKET_ERROR });
      }
    });

    // 6. Read Receipts (Batched)
    socket.on('receipt:read', async ({ chatId, messageIds }) => {
      try {
        if (!chatId || !Array.isArray(messageIds) || !messageIds.length) return;
        if (!(inChatRoom(chatId) || await isMember(chatId))) return;
        const Message = getMessageModel();
        const { Op } = require('sequelize');

        const messages = await Message.findAll({
          where: {
            id: { [Op.in]: messageIds },
            conversationId: chatId,
          }
        });

        for (const m of messages) {
          const reads = m.readBy || [];
          if (!reads.some(r => r.userId === userId)) {
            reads.push({ userId, readAt: new Date() });
            m.readBy = reads;
            await m.save();
          }
        }

        // Broadcast to chat room that messages have been read
        socket.to(`chat:${chatId}`).emit('receipt:update', {
          chatId,
          userId,
          messageIds,
          readAt: new Date(),
        });
      } catch (err) {
        console.warn('[RECEIPT_READ_ERR]', err.message);
      }
    });

    // 7. Edit message (Within 15 minutes)
    socket.on('message:edit', async ({ messageId, newText }, ack) => {
      try {
        const Message = getMessageModel();
        const msg = await Message.findByPk(messageId);
        if (!msg || msg.senderId !== userId) {
          if (ack) ack({ error: 'Cannot edit this message' });
          return;
        }

        const ageMs = Date.now() - new Date(msg.createdAt).getTime();
        if (ageMs > 15 * 60 * 1000) {
          if (ack) ack({ error: 'Message can only be edited within 15 minutes' });
          return;
        }

        const cleanText = typeof newText === 'string' ? newText.trim() : '';
        if (!cleanText || msg.isDeletedForEveryone) {
          if (ack) ack({ error: 'Cannot edit this message' });
          return;
        }

        msg.text = cleanText;
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();

        campusNsp.to(`chat:${msg.conversationId}`).emit('message:updated', {
          id: msg.id,
          chatId: msg.conversationId,
          text: cleanText,
          isEdited: true,
          editedAt: msg.editedAt,
        });

        if (ack) ack({ status: 'ok' });
      } catch (err) {
        console.warn('[CAMPUS_EDIT_ERR]', err.message);
        if (ack) ack({ error: SOCKET_ERROR });
      }
    });

    // 8. Delete message (For Everyone within 2 days, or For Me)
    socket.on('message:delete', async ({ messageId, forEveryone }, ack) => {
      try {
        const Message = getMessageModel();
        const msg = await Message.findByPk(messageId);
        if (!msg || !(inChatRoom(msg.conversationId) || await isMember(msg.conversationId))) {
          if (ack) ack({ error: 'Message not found' });
          return;
        }

        if (forEveryone) {
          if (msg.senderId !== userId) {
            if (ack) ack({ error: 'Only the sender can delete for everyone' });
            return;
          }
          if (Date.now() - new Date(msg.createdAt).getTime() > DELETE_FOR_EVERYONE_MS) {
            if (ack) ack({ error: 'Messages can be deleted for everyone only within 2 days' });
            return;
          }

          msg.text = 'This message was deleted';
          msg.isDeletedForEveryone = true;
          msg.mediaUrl = null;
          await msg.save();

          campusNsp.to(`chat:${msg.conversationId}`).emit('message:updated', {
            id: msg.id,
            chatId: msg.conversationId,
            text: 'This message was deleted',
            isDeletedForEveryone: true,
          });
        } else {
          // Delete for me: remembered per user and hidden from this user's history.
          const hiddenFor = parseJsonField(msg.deletedFor, []);
          if (!hiddenFor.includes(userId)) {
            hiddenFor.push(userId);
            msg.deletedFor = JSON.stringify(hiddenFor);
            await msg.save();
          }
        }

        if (ack) ack({ status: 'ok' });
      } catch (err) {
        console.warn('[CAMPUS_DELETE_ERR]', err.message);
        if (ack) ack({ error: SOCKET_ERROR });
      }
    });

    // ── Phase 5: Proximity Rooms (Location-bound Live Chat) ──────────────
    // Track which proximity rooms this socket is in
    const joinedProximityRooms = new Set();

    // Live count = sockets currently in the room (never a stored counter that drifts on restarts).
    const liveProximityCount = (roomSlug) => campusNsp.adapter.rooms.get(`proximity:${roomSlug}`)?.size || 0;
    const announceProximity = (roomSlug, event) => {
      campusNsp.to(`proximity:${roomSlug}`).emit('proximity:presence', {
        roomSlug,
        activeUserCount: liveProximityCount(roomSlug),
        event,
        userName: socket.user.name,
      });
    };

    socket.on('proximity:join', async ({ roomSlug } = {}, ack) => {
      try {
        if (!roomSlug) return;
        const room = await getProximityRoomModel().findOne({ where: { slug: roomSlug } });
        if (!room) {
          if (ack) ack({ error: 'Room not found' });
          return;
        }
        socket.join(`proximity:${roomSlug}`);
        joinedProximityRooms.add(roomSlug);
        announceProximity(roomSlug, 'joined');
        if (ack) ack({ status: 'joined', roomSlug, activeUserCount: liveProximityCount(roomSlug) });
      } catch (err) {
        console.warn('[PROXIMITY_JOIN_ERR]', err.message);
        if (ack) ack({ error: SOCKET_ERROR });
      }
    });

    socket.on('proximity:leave', ({ roomSlug } = {}) => {
      if (!roomSlug) return;
      socket.leave(`proximity:${roomSlug}`);
      joinedProximityRooms.delete(roomSlug);
      announceProximity(roomSlug, 'left');
    });

    socket.on('proximity:message', async ({ roomSlug, text, clientMsgId } = {}, ack) => {
      try {
        if (!roomSlug || typeof text !== 'string' || !text.trim()) {
          if (ack) ack({ error: 'Room slug and text required' });
          return;
        }
        if (!socket.rooms.has(`proximity:${roomSlug}`)) {
          if (ack) ack({ error: 'Join the room first' });
          return;
        }

        const ProximityRoom = getProximityRoomModel();
        const ProximityMessage = getProximityMessageModel();

        const room = await ProximityRoom.findOne({ where: { slug: roomSlug } });
        if (!room) {
          if (ack) ack({ error: 'Room not found' });
          return;
        }

        const msg = await ProximityMessage.create({
          roomId: room.id,
          senderId: userId,
          senderName: socket.user.name,
          text: text.trim().slice(0, 1000),
          type: 'text',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        const payload = {
          id: msg.id,
          roomSlug,
          senderId: msg.senderId,
          senderName: msg.senderName,
          text: msg.text,
          type: msg.type,
          createdAt: msg.createdAt,
          clientMsgId: clientMsgId || null,
        };

        campusNsp.to(`proximity:${roomSlug}`).emit('proximity:newMessage', payload);

        if (ack) ack({ status: 'sent', id: msg.id, createdAt: msg.createdAt });
      } catch (err) {
        console.error('[PROXIMITY_MSG_ERR]', err);
        if (ack) ack({ error: SOCKET_ERROR });
      }
    });

    socket.on('proximity:typing', ({ roomSlug, isTyping } = {}) => {
      if (!roomSlug || !socket.rooms.has(`proximity:${roomSlug}`)) return;
      socket.to(`proximity:${roomSlug}`).emit('proximity:typing', {
        roomSlug,
        userId,
        userName: socket.user.name,
        isTyping: !!isTyping,
      });
    });

    // ── WebRTC 1:1 calls (Friends / Campus chat) ─────────────────────────
    socket.on('call:invite', async ({ chatId, callType }, ack) => {
      try {
        if (!chatId) {
          if (ack) ack({ error: 'chatId required' });
          return;
        }
        if (userCallIndex.has(userId)) {
          if (ack) ack({ error: 'You are already in a call' });
          return;
        }

        const Conversation = getConversationModel();
        const conversation = await Conversation.findByPk(chatId);
        if (!conversation) {
          if (ack) ack({ error: 'Conversation not found' });
          return;
        }
        const participants = conversation.participants || [];
        if (!participants.includes(userId)) {
          if (ack) ack({ error: 'Not a member of this chat' });
          return;
        }

        const calleeIds = participants.filter((p) => p !== userId);
        if (!calleeIds.length) {
          if (ack) ack({ error: 'No one to call' });
          return;
        }

        for (const cid of calleeIds) {
          if (userCallIndex.has(cid)) {
            if (ack) ack({ error: 'User is busy on another call' });
            return;
          }
        }

        const callId = crypto.randomUUID();
        const session = {
          callId,
          chatId,
          chatName: conversation.isGroup ? (conversation.name || 'Group call') : socket.user.name,
          callerId: userId,
          callerName: socket.user.name,
          calleeIds,
          callType: callType === 'video' ? 'video' : 'voice',
          acceptedUserId: null,
          rejected: new Set(),
          createdAt: Date.now(),
          ended: false,
        };
        session.timeout = setTimeout(() => {
          endCallSession(campusNsp, activeCalls.get(callId), 'missed');
        }, CALL_RING_MS);

        activeCalls.set(callId, session);
        userCallIndex.set(userId, callId);
        calleeIds.forEach((cid) => userCallIndex.set(cid, callId));
        socket.activeCallId = callId;

        notifyUsers(campusNsp, calleeIds, 'call:incoming', {
          callId,
          chatId,
          chatName: conversation.isGroup ? (conversation.name || 'Group') : socket.user.name,
          callType: session.callType,
          callerId: userId,
          callerName: socket.user.name,
        });

        if (ack) ack({ callId, status: 'ringing' });
      } catch (err) {
        console.error('[CAMPUS_CALL_INVITE_ERR]', err);
        if (ack) ack({ error: SOCKET_ERROR });
      }
    });

    socket.on('call:accept', ({ callId }, ack) => {
      const call = activeCalls.get(callId);
      if (!call || call.ended) {
        if (ack) ack({ error: 'Call is no longer available' });
        return;
      }
      if (!call.calleeIds.includes(userId)) {
        if (ack) ack({ error: 'Not invited to this call' });
        return;
      }
      if (call.acceptedUserId) {
        if (ack) ack({ error: 'Call already answered' });
        return;
      }
      if (userCallIndex.has(userId) && userCallIndex.get(userId) !== callId) {
        if (ack) ack({ error: 'Already in another call' });
        return;
      }

      call.acceptedUserId = userId;
      userCallIndex.set(userId, callId);
      socket.activeCallId = callId;
      if (call.timeout) {
        clearTimeout(call.timeout);
        call.timeout = null;
      }

      campusNsp.to(`user:${call.callerId}`).emit('call:accepted', {
        callId,
        userId,
        userName: socket.user.name,
      });

      const others = call.calleeIds.filter((id) => id !== userId);
      notifyUsers(campusNsp, others, 'call:ended', { callId, reason: 'answered_elsewhere' });
      others.forEach((id) => {
        if (userCallIndex.get(id) === callId) userCallIndex.delete(id);
      });

      if (ack) ack({ status: 'ok', callId, peerId: call.callerId, peerName: call.callerName });
    });

    socket.on('call:reject', ({ callId, reason }) => {
      const call = activeCalls.get(callId);
      if (!call || call.ended) return;
      if (!call.calleeIds.includes(userId)) return;

      call.rejected.add(userId);
      if (userCallIndex.get(userId) === callId) userCallIndex.delete(userId);
      campusNsp.to(`user:${call.callerId}`).emit('call:rejected', {
        callId,
        userId,
        userName: socket.user.name,
        reason: reason || 'declined',
      });

      const remaining = call.calleeIds.filter((id) => !call.rejected.has(id));
      if (!call.acceptedUserId && remaining.length === 0) {
        endCallSession(campusNsp, call, reason === 'busy' ? 'busy' : 'declined');
      }
    });

    socket.on('call:end', ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;
      const involved = call.callerId === userId || call.acceptedUserId === userId || call.calleeIds.includes(userId);
      if (!involved) return;
      endCallSession(campusNsp, call, 'ended');
    });

    socket.on('call:signal', ({ callId, payload }) => {
      const call = activeCalls.get(callId);
      if (!call || call.ended || !payload) return;

      const involved = userId === call.callerId || userId === call.acceptedUserId;
      if (!involved) return;

      const targetId = userId === call.callerId ? call.acceptedUserId : call.callerId;
      if (!targetId) return;

      campusNsp.to(`user:${targetId}`).emit('call:signal', {
        callId,
        fromUserId: userId,
        payload,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      // Socket.IO already removed this socket from its rooms: tell the others the new live count.
      for (const roomSlug of joinedProximityRooms) announceProximity(roomSlug, 'left');
      console.log(`💬 [CAMPUS_SOCKET] Disconnected: ${socket.user.name}`);
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          const liveCallId = userCallIndex.get(userId);
          if (liveCallId) {
            endCallSession(campusNsp, activeCalls.get(liveCallId), 'disconnect');
          }
        }
      }
    });
  });

  console.log('⚡ [CAMPUS_SOCKET] /campus namespace initialized with full messaging core.');
};

module.exports = { initCampusSocket, getCampusOnlineCount, getProximityLiveCount };
