const { getFriendshipModel } = require('../models/Friendship');
const { getUserModel } = require('../models/User');
const { getConversationModel } = require('../models/Conversation');
const { getMessageModel } = require('../models/Message');
const { normalizePhone } = require('../utils/phoneUtils');
const { encryptText, decryptText } = require('../utils/crypto');
const { sendPushToTokens } = require('../utils/push');
const { Op } = require('sequelize');

// Campus friends list cap (was 10 "close friends", which blocked normal classmates from connecting).
const MAX_FRIENDS = 200;

// Helper to calculate / update streaks
const updateFriendshipStreak = async (friendship) => {
  const now = new Date();
  const lastInteraction = friendship.lastInteractionAt;

  if (!lastInteraction) {
    // First interaction ever -> starts streak at 1
    friendship.streakCount = 1;
  } else {
    const diffMs = now.getTime() - new Date(lastInteraction).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours >= 24 && diffHours <= 48) {
      // Clean 24-48 hours window -> increment streak
      friendship.streakCount = (friendship.streakCount || 0) + 1;
    } else if (diffHours > 48) {
      // Missed the 48-hour window -> reset streak to 1
      friendship.streakCount = 1;
    }
    // If diffHours < 24 -> keep streak count identical (same day chat), but update interaction timestamp below
  }

  friendship.lastInteractionAt = now;
  await friendship.save();
};

// Friend chats live in the same Conversations as Campus Chats. Mirror REST events to the /campus
// socket namespace so the Campus Chats screen updates live (plain text only, never ciphertext).
const emitToCampus = (req, rooms, event, payload) => {
  try {
    const io = req.app.get('io');
    if (!io) return;
    const nsp = io.of('/campus');
    rooms.forEach((room) => nsp.to(room).emit(event, payload));
  } catch (err) {
    console.warn('[FRIEND_CAMPUS_EMIT_WARN]', err.message);
  }
};

// Helper to push notifications to specific user ID
const sendPushToUser = async (userId, title, body, data = {}) => {
  try {
    const User = getUserModel();
    if (!User) return;
    const user = await User.findByPk(userId);
    if (!user) return;

    let tokenList = user.fcmTokens || [];
    if (typeof tokenList === 'string') {
      try { tokenList = JSON.parse(tokenList); } catch { tokenList = [tokenList]; }
    }
    const tokens = Array.isArray(tokenList) ? tokenList.map(t => typeof t === 'string' ? t : t?.token).filter(Boolean) : [];
    // Also saved in the user's in-app notification list, even without a device token.
    await sendPushToTokens(tokens, title, body, data, { recipients: [user.id] });
  } catch (err) {
    console.error(`[PUSH_ERROR] Failed sending user push to ${userId}:`, err.message);
  }
};

// 1. Scan/Search contacts
const CONTACT_SYNC_MAX = 500;
const CONTACT_SYNC_DAILY = 3000;
const contactBudget = new Map(); // userId -> { day, used }
const takeContactBudget = (userId, n) => {
  const day = new Date().toISOString().slice(0, 10);
  const key = String(userId);
  const cur = contactBudget.get(key);
  const rec = cur && cur.day === day ? cur : { day, used: 0 };
  if (rec.used + n > CONTACT_SYNC_DAILY) return false;
  rec.used += n;
  contactBudget.set(key, rec);
  if (contactBudget.size > 50000) {
    for (const [k, v] of contactBudget) if (v.day !== day) contactBudget.delete(k);
  }
  return true;
};

exports.searchContacts = async (req, res) => {
  try {
    const { contacts, query } = req.body;

    const User = getUserModel();
    const Friendship = getFriendshipModel();
    if (!User || !Friendship) return res.status(500).json({ message: 'Models not loaded' });

    let matchedUsers = [];

    let exactPhone = null;
    if (typeof query === 'string' && query.trim().length > 0) {
      // LIKE wildcards in the query are literal characters, not patterns.
      const searchStr = query.trim().slice(0, 40).replace(/[\\%_]/g, (c) => `\\${c}`);
      if (searchStr.length < 2) return res.json([]);
      const isPostgres = User.sequelize.options.dialect === 'postgres';
      const matchOp = isPostgres ? Op.iLike : Op.like;
      // Phone lookup only by the FULL number (partial digits would let anyone harvest numbers).
      const digits = query.replace(/\D/g, '');
      const normalized = digits.length >= 10 ? normalizePhone(digits) : null;
      if (normalized && /^\d{10}$/.test(normalized)) exactPhone = normalized;

      matchedUsers = await User.findAll({
        where: {
          id: { [Op.ne]: req.user.id }, // Exclude self
          role: 'student',
          [Op.or]: [
            { name: { [matchOp]: `%${searchStr}%` } },
            ...(exactPhone ? [{ phone: exactPhone }] : []),
            { friendCode: { [matchOp]: `%${searchStr}%` } }
          ]
        },
        attributes: ['id', 'name', 'phone', 'profileImage', 'friendCode'],
        limit: 15
      });
    } else if (Array.isArray(contacts)) {
      // Normalize phone numbers
      // Bounded: at most CONTACT_SYNC_MAX numbers per call and CONTACT_SYNC_DAILY per account per
      // day, so one account cannot map the whole number range to Zenvy identities.
      if (contacts.length > CONTACT_SYNC_MAX) {
        return res.status(400).json({ code: 'TOO_MANY_CONTACTS', message: `Send at most ${CONTACT_SYNC_MAX} contacts at a time.` });
      }
      const cleanNumbers = [...new Set(contacts.filter((n) => typeof n === 'string' || typeof n === 'number').map(num => normalizePhone(String(num))).filter(Boolean))];
      if (cleanNumbers.length === 0) {
        return res.json([]);
      }
      if (!takeContactBudget(req.user.id, cleanNumbers.length)) {
        return res.status(429).json({ code: 'CONTACT_SYNC_LIMIT', message: 'Contact sync limit reached for today. Try again tomorrow.' });
      }

      // Query matching users (students only: rider / admin / staff accounts are never discoverable)
      matchedUsers = await User.findAll({
        where: {
          phone: { [Op.in]: cleanNumbers },
          role: 'student',
          id: { [Op.ne]: req.user.id } // Exclude self
        },
        attributes: ['id', 'name', 'phone', 'profileImage', 'friendCode']
      });
    } else {
      return res.status(400).json({ message: 'Either contacts array or query string is required.' });
    }

    // Check friendship status for each matched user
    // One batched friendship lookup instead of one query per match.
    const results = [];
    const matchedIds = matchedUsers.map((u) => u.id);
    const friendships = matchedIds.length ? await Friendship.findAll({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, recipientId: { [Op.in]: matchedIds } },
          { requesterId: { [Op.in]: matchedIds }, recipientId: req.user.id }
        ]
      }
    }) : [];
    const friendshipByPeer = new Map();
    for (const f of friendships) {
      const peer = String(f.requesterId) === String(req.user.id) ? f.recipientId : f.requesterId;
      if (!friendshipByPeer.has(String(peer))) friendshipByPeer.set(String(peer), f);
    }
    for (const matchedUser of matchedUsers) {
      const friendship = friendshipByPeer.get(String(matchedUser.id)) || null;

      // Full number only for accepted friends, synced contacts (the caller already has it)
      // or an exact-number search; everyone else sees the last 4 digits.
      const showPhone = !!(friendship && friendship.status === 'accepted') || !query || (exactPhone && matchedUser.phone === exactPhone);
      results.push({
        id: matchedUser.id,
        name: matchedUser.name,
        phone: showPhone ? matchedUser.phone : (matchedUser.phone ? `•••••• ${String(matchedUser.phone).slice(-4)}` : null),
        friendCode: matchedUser.friendCode,
        profileImage: matchedUser.profileImage,
        friendshipStatus: friendship ? friendship.status : 'none',
        friendshipId: friendship ? friendship.id : null
      });
    }

    res.json(results);
  } catch (error) {
    console.error('[FRIEND_CONTACT_SEARCH_ERROR]', error);
    res.status(500).json({ message: 'Server error searching contacts.' });
  }
};

// 2. Send Friend Request (Supports direct recipientId, Friend Code, QR Code, and Variable Vibe Options)
exports.sendFriendRequest = async (req, res) => {
  try {
    let { recipientId, friendCode, vibe, icebreaker } = req.body;

    const User = getUserModel();
    const Friendship = getFriendshipModel();
    if (!User || !Friendship) return res.status(500).json({ message: 'Model not loaded' });

    // Support connecting via friendCode or raw QR payload (e.g. zenvy://orbit?code=ZNV-XXXXX or ZNV-XXXXX)
    if (!recipientId && friendCode) {
      let codeToFind = friendCode.trim();
      if (codeToFind.toUpperCase().includes('CODE=')) {
        const match = codeToFind.match(/code=([A-Za-z0-9_-]+)/i);
        if (match) codeToFind = match[1];
      }
      const isPostgres = User.sequelize.options.dialect === 'postgres';
      const matchOp = isPostgres ? Op.iLike : Op.like;
      const targetUser = await User.findOne({
        where: {
          friendCode: { [matchOp]: codeToFind }
        }
      });
      if (!targetUser) {
        return res.status(404).json({ code: 'USER_NOT_FOUND', message: `No one found with friend code ${codeToFind}. Check the code and try again.` });
      }
      recipientId = targetUser.id;
    }

    if (!recipientId) return res.status(400).json({ message: 'recipientId or valid friendCode is required.' });

    if (recipientId === req.user.id) {
      return res.status(400).json({ message: 'That is your own friend code.' });
    }

    const recipient = await User.findByPk(recipientId, { attributes: ['id', 'isActive'] });
    if (!recipient || recipient.isActive === false) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'This student is not on Zenvy.' });
    }

    // Check existing
    const existing = await Friendship.findOne({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, recipientId },
          { requesterId: recipientId, recipientId: req.user.id }
        ]
      }
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ code: 'ALREADY_FRIENDS', message: 'You are already friends.', friendshipId: existing.id });
      }
      if (existing.status === 'pending' && existing.requesterId === req.user.id) {
        return res.status(409).json({ code: 'REQUEST_ALREADY_SENT', message: 'Request already sent. Waiting for them to accept.', friendshipId: existing.id });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ code: 'REQUEST_INCOMING', message: 'They already sent you a request. Accept it to connect.', friendshipId: existing.id });
      }
      // Blocked (either side): do not reveal who blocked whom.
      return res.status(403).json({ code: 'CANNOT_REQUEST', message: 'You cannot send a request to this person.' });
    }

    // Strict check: count accepted friends for sender
    const requesterFriendsCount = await Friendship.count({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: req.user.id },
          { recipientId: req.user.id }
        ]
      }
    });
    if (requesterFriendsCount >= MAX_FRIENDS) {
      return res.status(400).json({ code: 'FRIEND_LIMIT', message: `You can have up to ${MAX_FRIENDS} friends. Remove someone to add more.` });
    }

    const friendship = await Friendship.create({
      requesterId: req.user.id,
      recipientId,
      status: 'pending',
      vibe: vibe || 'Roomie',
      icebreaker: icebreaker ? icebreaker.trim() : null
    });

    // Socket emission & push notification to recipient
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipientId}`).emit('incoming_friend_request', {
        friendshipId: friendship.id,
        vibe: friendship.vibe,
        icebreaker: friendship.icebreaker,
        requester: {
          id: req.user.id,
          name: req.user.name,
          profileImage: req.user.profileImage,
          friendCode: req.user.friendCode
        }
      });
    }

    await sendPushToUser(
      recipientId,
      `🎉 Orbit Link Request [${friendship.vibe || 'Roomie'}]`,
      `${req.user.name} wants to connect with vibe "${friendship.vibe || 'Roomie'}"!`,
      { type: 'FRIEND_REQUEST', requesterId: req.user.id, friendshipId: friendship.id, screen: 'friend_requests' }
    );

    res.status(201).json({ message: 'Friend request sent.', friendship });
  } catch (error) {
    console.error('[SEND_FRIEND_REQUEST_ERROR]', error);
    res.status(500).json({ message: 'Server error sending request.' });
  }
};

// 3. Accept Friend Request
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.body;
    if (!friendshipId) return res.status(400).json({ message: 'friendshipId is required.' });

    const Friendship = getFriendshipModel();
    const Conversation = getConversationModel();
    if (!Friendship || !Conversation) return res.status(500).json({ message: 'Models not loaded' });

    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ message: 'Friend request not found.' });

    if (friendship.recipientId !== req.user.id) {
      return res.status(403).json({ message: 'Only recipient can accept friend requests.' });
    }
    if (friendship.status !== 'pending') {
      // Never let "accept" turn a blocked pair back into friends.
      return res.status(400).json({ code: 'NOT_PENDING', message: friendship.status === 'accepted' ? 'You are already friends.' : 'This request is no longer available.' });
    }

    // Strict check: count accepted friends for requester
    const requesterFriendsCount = await Friendship.count({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: friendship.requesterId },
          { recipientId: friendship.requesterId }
        ]
      }
    });
    if (requesterFriendsCount >= MAX_FRIENDS) {
      return res.status(400).json({ code: 'FRIEND_LIMIT', message: `They already have ${MAX_FRIENDS} friends, so this request can't be accepted.` });
    }

    // Strict check: count accepted friends for recipient (current user)
    const recipientFriendsCount = await Friendship.count({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: req.user.id },
          { recipientId: req.user.id }
        ]
      }
    });
    if (recipientFriendsCount >= MAX_FRIENDS) {
      return res.status(400).json({ code: 'FRIEND_LIMIT', message: `You can have up to ${MAX_FRIENDS} friends. Remove someone to add more.` });
    }

    friendship.status = 'accepted';
    await friendship.save();

    // Create 1-on-1 Conversation
    const participants = [friendship.requesterId, friendship.recipientId];
    let conversation = await Conversation.findOne({
      where: {
        isGroup: false,
        refType: null, // never reuse a Friends task / Connect chat as the friend DM
        participants: JSON.stringify(participants) // Keep order check simple
      }
    });

    if (!conversation) {
      // Try reversed participants sequence search
      conversation = await Conversation.findOne({
        where: {
          isGroup: false,
          refType: null,
          participants: JSON.stringify([friendship.recipientId, friendship.requesterId])
        }
      });
    }

    if (!conversation) {
      conversation = await Conversation.create({
        isGroup: false,
        type: 'dm',
        participants
      });
    }

    // Auto-deliver initial icebreaker note if provided during QR/code connection
    if (friendship.icebreaker) {
      try {
        const Message = getMessageModel();
        if (Message) {
          const requester = await getUserModel().findByPk(friendship.requesterId, { attributes: ['name'] });
          const encrypted = encryptText(`⚡ [Orbit Link • ${friendship.vibe || 'Roomie'}] ${friendship.icebreaker}`);
          await Message.create({
            conversationId: conversation.id,
            senderId: friendship.requesterId,
            senderName: requester ? requester.name : null,
            text: encrypted
          });
        }
      } catch (err) {
        console.error('[AUTO_ICEBREAKER_ERROR]', err.message);
      }
    }

    // Trigger alerts to requester
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${friendship.requesterId}`).emit('friend_request_accepted', {
        friendshipId: friendship.id,
        friendName: req.user.name,
        vibe: friendship.vibe,
        conversationId: conversation.id
      });
    }

    // Both chat lists in Campus get the new conversation without a refresh.
    emitToCampus(req, [`user:${friendship.requesterId}`, `user:${friendship.recipientId}`], 'chat:updated', {
      chatId: conversation.id,
      lastMessage: friendship.icebreaker ? 'Orbit link note' : 'You are now friends',
      lastSender: null,
      time: new Date(),
    });

    await sendPushToUser(
      friendship.requesterId,
      '🤝 Friend Request Accepted',
      `${req.user.name} accepted your Orbit request [${friendship.vibe || 'Roomie'}]!`,
      { type: 'FRIEND_ACCEPTED', friendId: req.user.id, chatId: conversation.id, conversationId: conversation.id, screen: 'campus_chat' }
    );

    res.json({ message: 'Friend request accepted.', friendship, conversationId: conversation.id });
  } catch (error) {
    console.error('[ACCEPT_FRIEND_REQUEST_ERROR]', error);
    res.status(500).json({ message: 'Server error accepting request.' });
  }
};

// 4. Get Friends List
const friendsAvatarUrl = (req, user) => {
  try {
    return require('../modules/campus/campusHelpers').avatarUrlFor(req, user);
  } catch {
    return null;
  }
};

exports.getFriends = async (req, res) => {
  try {
    const Friendship = getFriendshipModel();
    const User = getUserModel();
    const Conversation = getConversationModel();
    if (!Friendship || !User || !Conversation) return res.status(500).json({ message: 'Models not loaded' });

    const friendships = await Friendship.findAll({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: req.user.id },
          { recipientId: req.user.id }
        ]
      }
    });

    const list = [];
    for (const fs of friendships) {
      const friendId = fs.requesterId === req.user.id ? fs.recipientId : fs.requesterId;
      const friend = await User.findByPk(friendId, {
        attributes: ['id', 'name', 'phone', 'friendCode', 'profileImage', 'statusText', 'statusEmoji', 'statusSeenBy']
      });

      if (!friend) continue;

      // Find conversation ID
      let conversation = await Conversation.findOne({
        where: {
          isGroup: false,
          refType: null,
          participants: JSON.stringify([req.user.id, friendId])
        }
      });
      if (!conversation) {
        conversation = await Conversation.findOne({
          where: {
            isGroup: false,
            refType: null,
            participants: JSON.stringify([friendId, req.user.id])
          }
        });
      }

      list.push({
        friendshipId: fs.id,
        friendId: friend.id,
        name: fs.nickname || friend.name,
        originalName: friend.name,
        nickname: fs.nickname || null,
        vibe: fs.vibe || 'Roomie',
        icebreaker: fs.icebreaker || null,
        friendCode: friend.friendCode || null,
        phone: friend.phone,
        // Base64 photos made this list several MB; send a short avatar link instead.
        profileImage: friend.profileImage && !String(friend.profileImage).startsWith('data:') ? friend.profileImage : null,
        avatarUrl: friendsAvatarUrl(req, friend),
        streakCount: fs.streakCount || 0,
        lastInteractionAt: fs.lastInteractionAt,
        theme: fs.theme || 'friendship',
        conversationId: conversation ? conversation.id : null,
        statusText: friend.statusText || null,
        statusEmoji: friend.statusEmoji || null,
        statusSeenBy: friend.statusSeenBy || []
      });
    }

    res.json(list);
  } catch (error) {
    console.error('[GET_FRIENDS_ERROR]', error);
    res.status(500).json({ message: 'Server error fetching friends.' });
  }
};

// 5. Get Incoming Pending Requests
exports.getPendingRequests = async (req, res) => {
  try {
    const Friendship = getFriendshipModel();
    const User = getUserModel();
    if (!Friendship || !User) return res.status(500).json({ message: 'Models not loaded' });

    const pending = await Friendship.findAll({
      where: {
        recipientId: req.user.id,
        status: 'pending'
      }
    });

    const list = [];
    for (const p of pending) {
      const requester = await User.findByPk(p.requesterId, {
        attributes: ['id', 'name', 'phone', 'friendCode', 'profileImage']
      });
      if (requester) {
        list.push({
          friendshipId: p.id,
          vibe: p.vibe || 'Roomie',
          icebreaker: p.icebreaker || null,
          createdAt: p.createdAt,
          requester
        });
      }
    }

    return res.json(list);
  } catch (error) {
    console.error('[GET_PENDING_ERROR]', error);
    res.status(500).json({ message: 'Server error fetching requests.' });
  }
};

// 6. Update theme
exports.updateFriendshipTheme = async (req, res) => {
  try {
    const { id } = req.params;
    const { theme } = req.body;

    const VALID_THEMES = ['friendship', 'crazy', 'love', 'graphite', 'grove', 'autumn', 'blossom', 'nightfall'];
    if (!VALID_THEMES.includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme selected.' });
    }

    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Model not loaded' });

    const friendship = await Friendship.findByPk(id);
    if (!friendship) return res.status(404).json({ message: 'Friendship not found.' });

    if (friendship.requesterId !== req.user.id && friendship.recipientId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    friendship.theme = theme;
    await friendship.save();

    // Broadcast theme update via socket
    const io = req.app.get('io');
    if (io) {
      const otherUserId = friendship.requesterId === req.user.id ? friendship.recipientId : friendship.requesterId;
      io.to(`user_${otherUserId}`).emit('friendship_theme_updated', { friendshipId: friendship.id, theme });
    }

    res.json({ message: 'Theme updated.', theme });
  } catch (error) {
    console.error('[UPDATE_THEME_ERROR]', error);
    res.status(500).json({ message: 'Server error updating theme.' });
  }
};

// 7. Send Encrypted Message
exports.sendFriendMessage = async (req, res) => {
  try {
    let { conversationId, text, friendshipId } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Type a message first.' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ message: 'Messages can be at most 2000 characters.' });
    }

    const Conversation = getConversationModel();
    const Message = getMessageModel();
    const Friendship = getFriendshipModel();
    if (!Conversation || !Message || !Friendship) return res.status(500).json({ message: 'Models not loaded' });

    let conversation;
    if (conversationId) {
      conversation = await Conversation.findByPk(conversationId);
    }

    // Fallback: If conversationId is missing or null, resolve/create conversation via friendshipId
    if (!conversation && friendshipId) {
      const friendship = await Friendship.findByPk(friendshipId);
      // Only one of the two friends may open / use their chat.
      const isMember = friendship && (friendship.requesterId === req.user.id || friendship.recipientId === req.user.id);
      if (friendship && isMember && friendship.status === 'accepted') {
        const participants = [friendship.requesterId, friendship.recipientId];
        // Find or create conversation
        conversation = await Conversation.findOne({
          where: { isGroup: false, refType: null, participants: JSON.stringify(participants) }
        });
        if (!conversation) {
          conversation = await Conversation.findOne({
            where: { isGroup: false, refType: null, participants: JSON.stringify([friendship.recipientId, friendship.requesterId]) }
          });
        }
        if (!conversation) {
          conversation = await Conversation.create({
            isGroup: false,
            participants
          });
        }
        conversationId = conversation.id;
      }
    }

    if (!conversation) {
      return res.status(400).json({ message: 'Valid conversationId or friendshipId is required.' });
    }
    conversationId = conversation.id;

    // Sender must be in the conversation (no posting into other people's chats by id).
    const members = Array.isArray(conversation.participants) ? conversation.participants : [];
    if (!members.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not a participant of this conversation.' });
    }
    // Friends task / Connect chats and closed chats are only reachable through the guarded campus socket.
    if (conversation.refType || conversation.closedAt) {
      return res.status(403).json({ code: 'CHAT_CLOSED', message: 'You cannot message this chat from here.' });
    }
    // 1:1 chats need a live (accepted, not blocked) friendship.
    if (!conversation.isGroup) {
      const peerId = members.find(p => p !== req.user.id);
      const live = peerId && await Friendship.findOne({
        where: {
          status: 'accepted',
          [Op.or]: [
            { requesterId: req.user.id, recipientId: peerId },
            { requesterId: peerId, recipientId: req.user.id }
          ]
        }
      });
      if (!live) return res.status(403).json({ message: 'You can only message people in your circle.' });
    }

    // Encrypt cleartext
    const encryptedText = encryptText(text);

    // Save message with 30-day TTL (vanish)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const message = await Message.create({
      conversationId,
      senderId: req.user.id,
      senderName: req.user.name,
      text: encryptedText,
      expiresAt
    });

    // Update conversation lastMessageAt
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Update daily streak
    const parts = conversation.participants;
    const otherUserId = parts.find(p => p !== req.user.id);
    const friendship = await Friendship.findOne({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: req.user.id, recipientId: otherUserId },
          { requesterId: otherUserId, recipientId: req.user.id }
        ]
      }
    });

    if (friendship) {
      await updateFriendshipStreak(friendship);
    }

    // Broadcast message via socket to room
    const decryptedMessage = {
      ...message.toJSON(),
      text // Decrypted on sender's response
    };

    // Campus Chats (same conversation) see the plain text live too.
    emitToCampus(req, [`chat:${conversationId}`], 'message:new', {
      id: message.id,
      chatId: conversationId,
      senderId: req.user.id,
      senderName: req.user.name,
      text,
      type: 'text',
      createdAt: message.createdAt,
      deliveryStatus: 'sent',
    });
    if (otherUserId) {
      emitToCampus(req, [`user:${otherUserId}`], 'chat:updated', {
        chatId: conversationId,
        lastMessage: text.length > 80 ? `${text.slice(0, 80)}...` : text,
        lastSender: req.user.name,
        time: new Date(),
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`conversation-${conversationId}`).emit('new_friend_message', decryptedMessage);
      // Push notification to recipient with actual message content preview
      if (otherUserId) {
        const previewText = text ? (text.length > 50 ? text.substring(0, 50) + '...' : text) : '💬 Sent a sticker';
        await sendPushToUser(
          otherUserId,
          `${req.user.name}`,
          previewText,
          { type: 'NEW_CHAT_MESSAGE', conversationId, chatId: conversationId, screen: 'campus_chat' }
        );
      }
    }

    res.status(201).json(decryptedMessage);
  } catch (error) {
    console.error('[SEND_CHAT_MESSAGE_ERROR]', error);
    res.status(500).json({ message: 'Server error sending message.' });
  }
};

// 8. Get chat history (Decrypted)
exports.getFriendMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query; // Added pagination support
    const Conversation = getConversationModel();
    const Message = getMessageModel();
    if (!Conversation || !Message) return res.status(500).json({ message: 'Models not loaded' });

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not a participant of this conversation.' });
    }

    const messages = await Message.findAll({
      where: { conversationId },
      order: [['createdAt', 'DESC']], // Fetch latest first for pagination
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)),
      offset: Math.max(0, parseInt(offset, 10) || 0)
    });

    const decrypted = messages.map(m => ({
      ...m.toJSON(),
      text: decryptText(m.text)
    })).reverse(); // Reverse back to ASC for the client UI

    res.json(decrypted);
  } catch (error) {
    console.error('[GET_CHAT_MESSAGES_ERROR]', error);
    res.status(500).json({ message: 'Server error fetching messages.' });
  }
};

exports.updateFriendshipNickname = async (req, res) => {
  try {
    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Models not loaded' });

    const friendship = await Friendship.findByPk(req.params.id);
    if (!friendship) return res.status(404).json({ message: 'Friendship not found' });
    if (friendship.requesterId !== req.user.id && friendship.recipientId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const nickname = String((req.body || {}).nickname || '').replace(/[<>]/g, '').trim().slice(0, 40);
    friendship.nickname = nickname || null;
    await friendship.save();

    res.json({ message: 'Nickname updated successfully', nickname: friendship.nickname });
  } catch (error) {
    console.error('[UPDATE_NICKNAME_ERROR]', error);
    res.status(500).json({ message: 'Server error updating nickname.' });
  }
};

// 9. Remove friend from circle
exports.removeFriend = async (req, res) => {
  try {
    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Models not loaded' });

    const friendship = await Friendship.findByPk(req.params.id);
    if (!friendship) return res.status(404).json({ message: 'Friendship not found' });

    if (friendship.requesterId !== req.user.id && friendship.recipientId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to remove this friend' });
    }
    if (friendship.status === 'blocked') {
      // Removing a blocked row would silently lift the block; only the blocker may unblock.
      return res.status(400).json({ code: 'BLOCKED', message: 'Use unblock to change a blocked contact.' });
    }

    await friendship.destroy();
    res.json({ message: 'Friend removed from circle successfully' });
  } catch (error) {
    console.error('[REMOVE_FRIEND_ERROR]', error);
    res.status(500).json({ message: 'Server error removing friend.' });
  }
};

// 9b. Decline a pending friend request
exports.declineFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.body;
    if (!friendshipId) return res.status(400).json({ message: 'friendshipId is required.' });

    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Model not loaded' });

    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ message: 'Friend request not found.' });

    if (friendship.recipientId !== req.user.id) {
      return res.status(403).json({ message: 'Only the recipient can decline a friend request.' });
    }
    if (friendship.status !== 'pending') {
      return res.status(400).json({ message: `Cannot decline — request status is already '${friendship.status}'.` });
    }

    await friendship.destroy();

    // Notify the requester via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${friendship.requesterId}`).emit('friend_request_declined', {
        friendshipId,
        declinedBy: { id: req.user.id, name: req.user.name }
      });
    }

    res.json({ message: 'Friend request declined.' });
  } catch (error) {
    console.error('[DECLINE_FRIEND_REQUEST_ERROR]', error);
    res.status(500).json({ message: 'Server error declining request.' });
  }
};

// Friends list queries cache block sets for 30 s; drop them so a block / unblock applies at once.
const clearFriendsBlockCache = (...ids) => {
  try { require('../modules/friends/services/blocks').clearBlocks(...ids); } catch { /* optional */ }
};

// 9c. Block a user
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'userId is required.' });
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(400).json({ message: 'userId is not valid.' });
    }
    if (userId === req.user.id) return res.status(400).json({ message: 'You cannot block yourself.' });

    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Model not loaded' });

    // Check for existing friendship/request
    let friendship = await Friendship.findOne({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, recipientId: userId },
          { requesterId: userId, recipientId: req.user.id }
        ]
      }
    });

    if (friendship && friendship.status === 'blocked' && friendship.blockedBy && friendship.blockedBy !== req.user.id) {
      // Already blocked by the other person: the block applies both ways; keep their row as is.
      clearFriendsBlockCache(req.user.id, userId);
      return res.json({ message: 'User blocked successfully.', friendshipId: friendship.id });
    }
    if (friendship) {
      friendship.status = 'blocked';
      friendship.blockedBy = req.user.id;
      await friendship.save();
    } else {
      friendship = await Friendship.create({
        requesterId: req.user.id,
        recipientId: userId,
        status: 'blocked',
        blockedBy: req.user.id
      });
    }

    clearFriendsBlockCache(req.user.id, userId);
    res.json({ message: 'User blocked successfully.', friendshipId: friendship.id });
  } catch (error) {
    console.error('[BLOCK_USER_ERROR]', error);
    res.status(500).json({ message: 'Server error blocking user.' });
  }
};

// 9d. Unblock a user
exports.unblockUser = async (req, res) => {
  try {
    // { userId } or { friendshipId } (Connect blocks are listed without an account id).
    const { userId, friendshipId } = req.body || {};
    if (!userId && !friendshipId) return res.status(400).json({ message: 'userId is required.' });
    if ((userId && typeof userId !== 'string') || (friendshipId && typeof friendshipId !== 'string')) {
      return res.status(400).json({ message: 'userId is not valid.' });
    }
    if (!userId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(friendshipId)) {
      return res.status(404).json({ message: 'Blocked user not found in your block list.' });
    }

    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Model not loaded' });

    const friendship = await Friendship.findOne({
      where: userId
        ? {
          status: 'blocked',
          blockedBy: req.user.id,
          [Op.or]: [
            { requesterId: req.user.id, recipientId: userId },
            { requesterId: userId, recipientId: req.user.id }
          ]
        }
        : {
          id: friendshipId,
          status: 'blocked',
          blockedBy: req.user.id,
          [Op.or]: [{ requesterId: req.user.id }, { recipientId: req.user.id }],
        }
    });

    if (!friendship) {
      return res.status(404).json({ message: 'Blocked user not found in your block list.' });
    }

    const otherId = friendship.requesterId === req.user.id ? friendship.recipientId : friendship.requesterId;
    await friendship.destroy();
    clearFriendsBlockCache(req.user.id, otherId);

    res.json({ message: 'User unblocked successfully.' });
  } catch (error) {
    console.error('[UNBLOCK_USER_ERROR]', error);
    res.status(500).json({ message: 'Server error unblocking user.' });
  }
};

// 9e. Get blocked users
exports.getBlockedUsers = async (req, res) => {
  try {
    const Friendship = getFriendshipModel();
    const User = getUserModel();
    if (!Friendship || !User) return res.status(500).json({ message: 'Models not loaded' });

    const blocked = await Friendship.findAll({
      where: {
        status: 'blocked',
        blockedBy: req.user.id
      }
    });

    // Never phone numbers here. People blocked through Zenvy Friends Connect (a Connect swipe or
    // match exists between the pair) are shown by their Connect name only: no account id, real name
    // or avatar, so a Connect block never reveals who is behind a Connect profile.
    const otherIds = blocked.map((b) => (b.requesterId === req.user.id ? b.recipientId : b.requesterId));
    const connectNames = new Map();
    try {
      const { getModel } = require('../modules/friends');
      const Swipe = getModel('ConnectSwipe');
      const Match = getModel('ConnectMatch');
      const Profile = getModel('ConnectProfile');
      if (otherIds.length && Swipe && Profile) {
        const me = String(req.user.id);
        const [swipes, matches] = await Promise.all([
          Swipe.findAll({
            where: { [Op.or]: [
              { fromUserId: me, toUserId: { [Op.in]: otherIds } },
              { toUserId: me, fromUserId: { [Op.in]: otherIds } },
            ] },
            attributes: ['fromUserId', 'toUserId'],
          }),
          Match ? Match.findAll({
            where: { [Op.or]: [
              { userLowId: me, userHighId: { [Op.in]: otherIds } },
              { userHighId: me, userLowId: { [Op.in]: otherIds } },
            ] },
            attributes: ['userLowId', 'userHighId'],
          }) : [],
        ]);
        const viaConnect = new Set();
        swipes.forEach((s) => viaConnect.add(String(String(s.fromUserId) === me ? s.toUserId : s.fromUserId)));
        matches.forEach((m) => viaConnect.add(String(String(m.userLowId) === me ? m.userHighId : m.userLowId)));
        if (viaConnect.size) {
          const profiles = await Profile.findAll({ where: { userId: { [Op.in]: [...viaConnect] } }, attributes: ['userId', 'displayName'] });
          const names = new Map(profiles.map((p) => [String(p.userId), p.displayName]));
          viaConnect.forEach((id) => connectNames.set(id, names.get(id) || 'Connect user'));
        }
      }
    } catch (err) {
      // Fail closed: if Connect status cannot be checked, show no identity at all for non-friends.
      console.warn('[GET_BLOCKED_CONNECT_WARN]', err.message);
      otherIds.forEach((id) => connectNames.set(String(id), 'Blocked person'));
    }

    const list = [];
    for (const b of blocked) {
      const blockedUserId = b.requesterId === req.user.id ? b.recipientId : b.requesterId;
      if (connectNames.has(String(blockedUserId))) {
        list.push({
          friendshipId: b.id,
          source: 'connect',
          user: { id: null, name: connectNames.get(String(blockedUserId)), profileImage: null },
        });
        continue;
      }
      const user = await User.findByPk(blockedUserId, {
        attributes: ['id', 'name', 'profileImage']
      });
      if (user) {
        list.push({
          friendshipId: b.id,
          user
        });
      }
    }

    res.json(list);
  } catch (error) {
    console.error('[GET_BLOCKED_ERROR]', error);
    res.status(500).json({ message: 'Server error fetching blocked users.' });
  }
};

// 10. Send Orbit Nudge
const NUDGE_DAILY_LIMIT = 3;
const nudgeLog = new Map(); // "<friendshipId>:<senderId>" -> [timestamps]
// Sweep keys whose timestamps are all older than a day (the map must not grow forever).
setInterval(() => {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [k, list] of nudgeLog) if (!list.length || list[list.length - 1] <= dayAgo) nudgeLog.delete(k);
}, 60 * 60 * 1000).unref?.();
exports.sendFriendNudge = async (req, res) => {
  try {
    const { friendshipId } = req.body;
    if (!friendshipId) return res.status(400).json({ message: 'friendshipId is required.' });

    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Models not loaded' });

    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ message: 'Friendship not found.' });
    // Only one of the two friends, on an accepted friendship, can nudge.
    if (![friendship.requesterId, friendship.recipientId].includes(req.user.id) || friendship.status !== 'accepted') {
      return res.status(403).json({ message: 'You can only nudge your friends.' });
    }

    // At most NUDGE_DAILY_LIMIT nudges per friend per day (keeps pushes friendly, not spammy).
    const nudgeKey = `${friendshipId}:${req.user.id}`;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentNudges = (nudgeLog.get(nudgeKey) || []).filter((t) => t > dayAgo);
    if (recentNudges.length >= NUDGE_DAILY_LIMIT) {
      return res.status(429).json({ message: 'You have nudged this friend enough for today. Try again tomorrow!' });
    }
    recentNudges.push(Date.now());
    nudgeLog.set(nudgeKey, recentNudges);

    const otherUserId = friendship.requesterId === req.user.id ? friendship.recipientId : friendship.requesterId;
    await updateFriendshipStreak(friendship);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${otherUserId}`).emit('friend_nudge', {
        friendshipId,
        senderId: req.user.id,
        senderName: req.user.name,
        streakCount: friendship.streakCount
      });
    }

    await sendPushToUser(
      otherUserId,
      `⚡ ${req.user.name} (Nudge!)`,
      `🔥 Sent a flame nudge! Your streak is ${friendship.streakCount} days.`,
      { type: 'FRIEND_NUDGE', friendshipId }
    );

    res.json({ message: 'Nudge transmitted!', streakCount: friendship.streakCount });
  } catch (error) {
    console.error('[SEND_NUDGE_ERROR]', error);
    res.status(500).json({ message: 'Server error sending nudge.' });
  }
};

// 11. Update User Status (Story/Status feature)
exports.updateUserStatus = async (req, res) => {
  try {
    const { statusText, statusEmoji } = req.body;
    const User = getUserModel();
    const Friendship = getFriendshipModel();
    if (!User || !Friendship) return res.status(500).json({ message: 'Models not loaded' });

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.statusText = statusText || null;
    user.statusEmoji = statusEmoji || null;
    user.statusSeenBy = [];
    await user.save();

    // Broadcast status change ONLY to accepted friends (scoped, not global)
    const io = req.app.get('io');
    if (io) {
      const friendships = await Friendship.findAll({
        where: {
          status: 'accepted',
          [Op.or]: [
            { requesterId: req.user.id },
            { recipientId: req.user.id }
          ]
        }
      });
      const friendIds = friendships.map(fs =>
        fs.requesterId === req.user.id ? fs.recipientId : fs.requesterId
      );
      const payload = {
        userId: req.user.id,
        statusText: user.statusText,
        statusEmoji: user.statusEmoji
      };
      friendIds.forEach(friendId => {
        io.to(`user_${friendId}`).emit('friend_status_updated', payload);
      });
    }

    res.json({ message: 'Status updated successfully.', statusText: user.statusText, statusEmoji: user.statusEmoji });
  } catch (error) {
    console.error('[UPDATE_STATUS_ERROR]', error);
    res.status(500).json({ message: 'Server error updating status.' });
  }
};

// 12. Mark Status As Seen
exports.markStatusAsSeen = async (req, res) => {
  try {
    const { friendId } = req.body;
    const User = getUserModel();
    const Friendship = getFriendshipModel();
    if (!User || !Friendship) return res.status(500).json({ message: 'Models not loaded' });

    const friend = await User.findByPk(friendId);
    if (!friend) return res.status(404).json({ message: 'User not found' });

    if (!friend.statusText && !friend.statusEmoji) {
      return res.json({ message: 'No status to mark as seen' });
    }

    // Add req.user.id to statusSeenBy list if not already there
    const seenBy = Array.isArray(friend.statusSeenBy) ? [...friend.statusSeenBy] : [];
    if (!seenBy.includes(req.user.id)) {
      seenBy.push(req.user.id);
      friend.statusSeenBy = seenBy;
      friend.changed('statusSeenBy', true);
      await friend.save();
    }

    // Find all accepted friends of the friend to see if everyone has seen it
    // Op already imported at top of file
    const friendships = await Friendship.findAll({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: friendId },
          { recipientId: friendId }
        ]
      }
    });

    const friendIds = friendships.map(fs => fs.requesterId === friendId ? fs.recipientId : fs.requesterId);

    // Check if everyone has seen it
    const allSeen = friendIds.every(id => seenBy.includes(id));
    if (allSeen && friendIds.length > 0) {
      // Clear status!
      friend.statusText = null;
      friend.statusEmoji = null;
      friend.statusSeenBy = [];
      await friend.save();

      // Broadcast status change (cleared) via socket
      const io = req.app.get('io');
      if (io) {
        // Only the friends who can see this status (and the owner) are told it was cleared.
        const clearedPayload = { userId: friendId, statusText: null, statusEmoji: null };
        for (const id of [friendId, ...friendIds]) io.to('user_' + id).emit('friend_status_updated', clearedPayload);
      }
    }

    res.json({ message: 'Status marked as seen successfully', allSeen });
  } catch (error) {
    console.error('[MARK_STATUS_SEEN_ERROR]', error);
    res.status(500).json({ message: 'Server error marking status as seen.' });
  }
};

// ── Request inbox (consistent REST shape) ──────────────────────────────────
// GET /api/friends/requests -> { incoming: [...], outgoing: [...] }
exports.getFriendRequests = async (req, res) => {
  try {
    const Friendship = getFriendshipModel();
    const User = getUserModel();
    if (!Friendship || !User) return res.status(500).json({ message: 'Models not loaded' });

    const rows = await Friendship.findAll({
      where: {
        status: 'pending',
        [Op.or]: [{ recipientId: req.user.id }, { requesterId: req.user.id }]
      },
      order: [['createdAt', 'DESC']],
      limit: 200
    });
    const otherIds = [...new Set(rows.map(r => (r.requesterId === req.user.id ? r.recipientId : r.requesterId)))];
    const users = otherIds.length
      ? await User.findAll({ where: { id: { [Op.in]: otherIds } }, attributes: ['id', 'name', 'profileImage', 'friendCode'] })
      : [];
    const byId = {};
    users.forEach(u => { byId[u.id] = u; });
    let avatarUrlFor = null;
    try { avatarUrlFor = require('../modules/campus/campusHelpers').avatarUrlFor; } catch { /* optional */ }

    const shape = (r, other) => ({
      friendshipId: r.id,
      vibe: r.vibe || 'Roomie',
      icebreaker: r.icebreaker || null,
      createdAt: r.createdAt,
      user: other ? {
        id: other.id,
        name: other.name,
        friendCode: other.friendCode || null,
        avatarUrl: avatarUrlFor ? avatarUrlFor(req, other) : null
      } : null
    });

    const incoming = [];
    const outgoing = [];
    for (const r of rows) {
      const mine = r.requesterId === req.user.id;
      const other = byId[mine ? r.recipientId : r.requesterId];
      if (!other) continue;
      (mine ? outgoing : incoming).push(shape(r, other));
    }
    res.json({ incoming, outgoing });
  } catch (error) {
    console.error('[GET_FRIEND_REQUESTS_ERROR]', error);
    res.status(500).json({ message: 'Server error fetching requests.' });
  }
};

// POST /api/friends/requests/:id/accept  and  /requests/:id/decline
exports.acceptFriendRequestById = (req, res) => {
  req.body = { ...(req.body || {}), friendshipId: req.params.id };
  return exports.acceptFriendRequest(req, res);
};
exports.declineFriendRequestById = (req, res) => {
  req.body = { ...(req.body || {}), friendshipId: req.params.id };
  return exports.declineFriendRequest(req, res);
};

// DELETE /api/friends/requests/:id -> the sender withdraws their own pending request
exports.cancelFriendRequest = async (req, res) => {
  try {
    const Friendship = getFriendshipModel();
    if (!Friendship) return res.status(500).json({ message: 'Model not loaded' });
    const friendship = await Friendship.findByPk(req.params.id);
    if (!friendship || friendship.requesterId !== req.user.id || friendship.status !== 'pending') {
      return res.status(404).json({ message: 'Request not found.' });
    }
    const recipientId = friendship.recipientId;
    await friendship.destroy();
    const io = req.app.get('io');
    if (io) io.to(`user_${recipientId}`).emit('friend_request_cancelled', { friendshipId: req.params.id });
    res.json({ message: 'Request withdrawn.' });
  } catch (error) {
    console.error('[CANCEL_FRIEND_REQUEST_ERROR]', error);
    res.status(500).json({ message: 'Server error withdrawing request.' });
  }
};
