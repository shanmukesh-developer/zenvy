const { getConversationModel } = require('../../../models/Conversation');
const { getUserModel } = require('../../../models/User');
const { cleanImageRef } = require('../campusHelpers');

const crypto = require('crypto');

// Generate unambiguous 6-character code (No 0/O/1/I/L) per Section 3.3. crypto.randomInt, not
// Math.random (predictable), and re-drawn on collision so two groups never share a code.
const JOIN_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const randomJoinCode = () => {
  let code = '';
  for (let i = 0; i < 6; i++) code += JOIN_CHARS.charAt(crypto.randomInt(JOIN_CHARS.length));
  return code;
};
const generateJoinCode = async () => {
  const Conversation = getConversationModel();
  for (let i = 0; i < 8; i++) {
    const code = randomJoinCode();
    // eslint-disable-next-line no-await-in-loop
    const taken = Conversation ? await Conversation.findOne({ where: { joinCode: code }, attributes: ['id'] }) : null;
    if (!taken) return code;
  }
  return randomJoinCode();
};

// Code guessing guard: a code lookup (preview or join) is limited per user / per IP.
const codeLimiter = require('../../friends/services/limiter');
codeLimiter.define('group_code_lookup', 30, 15 * 60 * 1000);
const codeLookupAllowed = (req) => {
  const key = req.user && req.user.id ? `u:${req.user.id}` : `ip:${req.ip || (req.connection && req.connection.remoteAddress) || 'unknown'}`;
  return codeLimiter.take(key, 'group_code_lookup').ok;
};
const validCode = (v) => typeof v === 'string' && /^[A-Za-z0-9]{4,12}$/.test(v.trim());

// @desc    Create a new group (Class, Club, Study, Ride)
// @route   POST /api/campus/groups
const createGroup = async (req, res) => {
  try {
    const { name, description, type = 'study', groupAvatar, onlyAdminsCanSend, discoverable } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }
    // groupAvatar column is 255 chars: only a /api/campus/media/<id> path or a short https URL.
    let cleanAvatar = null;
    if (groupAvatar) {
      cleanAvatar = cleanImageRef(groupAvatar, { maxDataUrlChars: 0 });
      if (!cleanAvatar || cleanAvatar.length > 255) {
        return res.status(400).json({ code: 'BAD_IMAGE', message: 'Upload the group photo first (POST /api/campus/media).' });
      }
    }

    const Conversation = getConversationModel();
    const joinCode = await generateJoinCode();

    const group = await Conversation.create({
      name: name.trim().slice(0, 80),
      description: description ? String(description).trim().slice(0, 250) : '',
      isGroup: true,
      type: ['class', 'club', 'study', 'ride', 'group', 'hostel', 'secret'].includes(type) ? type : 'study',
      groupAvatar: cleanAvatar,
      joinCode,
      participants: [req.user.id],
      adminIds: [req.user.id],
      onlyAdminsCanSend: !!onlyAdminsCanSend,
    });

    if (discoverable) {
      try {
        const { getCampusGroupSettingModel } = require('../models/CampusGroupSetting');
        const { getCampusProfileModel } = require('../models/CampusProfile');
        const mine = await getCampusProfileModel().findOne({ where: { userId: req.user.id }, attributes: ['campusId', 'verificationStatus'] });
        // Only a verified student lists a club in their campus directory (see setGroupDiscoverable).
        if (mine && mine.campusId && mine.verificationStatus === 'verified') await getCampusGroupSettingModel().create({
          conversationId: group.id,
          campusId: mine ? mine.campusId : null,
          discoverable: true,
          updatedBy: req.user.id,
        });
      } catch (e) {
        console.warn('[CREATE_GROUP_DISCOVERABLE_WARN]', e.message);
      }
    }

    console.log(`👥 [CAMPUS_GROUP] Created "${group.name}" (Code: ${joinCode}) by ${req.user.name}`);

    res.status(201).json({
      message: 'Group created successfully',
      group,
    });
  } catch (err) {
    console.error('[CREATE_GROUP_ERR]', err);
    res.status(500).json({ message: 'Failed to create group' });
  }
};

// @desc    Preview group details before joining
// @route   GET /api/campus/groups/preview/:code
const previewGroupByCode = async (req, res) => {
  try {
    if (!validCode(req.params.code)) return res.status(404).json({ message: 'Code not found. Please check and try again.' });
    if (!codeLookupAllowed(req)) return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many tries. Please wait a few minutes.' });
    const code = req.params.code.trim().toUpperCase();
    const Conversation = getConversationModel();

    const group = await Conversation.findOne({ where: { joinCode: code } });
    if (!group) {
      return res.status(404).json({ message: 'Code not found. Please check and try again.' });
    }

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      memberCount: (group.participants || []).length,
      groupAvatar: group.groupAvatar,
    });
  } catch (err) {
    console.error('[PREVIEW_GROUP_ERR]', err);
    res.status(500).json({ message: 'Failed to preview group' });
  }
};

// @desc    Join group using code
// @route   POST /api/campus/groups/join
const joinGroupByCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Join code is required' });
    }
    if (!validCode(code)) return res.status(404).json({ message: 'Code not found. Please check and try again.' });
    if (!codeLookupAllowed(req)) return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many tries. Please wait a few minutes.' });

    const cleanCode = code.trim().toUpperCase();
    const Conversation = getConversationModel();

    // Read-modify-write of the participants list under a row lock, so when a whole class joins
    // at once nobody's membership is overwritten.
    const { getSequelize } = require('../../../config/db');
    const { group, alreadyMember } = await getSequelize().transaction(async (t) => {
      const g = await Conversation.findOne({ where: { joinCode: cleanCode }, transaction: t, lock: t.LOCK.UPDATE });
      if (!g) return { group: null };
      const participants = g.participants || [];
      if (participants.includes(req.user.id)) return { group: g, alreadyMember: true };
      g.participants = [...participants, req.user.id];
      await g.save({ transaction: t });
      return { group: g, alreadyMember: false };
    });
    if (!group) {
      return res.status(404).json({ message: 'Code not found' });
    }
    if (alreadyMember) {
      return res.json({
        message: 'You are already a member of this group',
        group,
      });
    }

    console.log(`👥 [CAMPUS_GROUP_JOIN] ${req.user.name} joined "${group.name}" via code ${cleanCode}`);

    res.json({
      message: `Successfully joined ${group.name}!`,
      group,
    });
  } catch (err) {
    console.error('[JOIN_GROUP_ERR]', err);
    res.status(500).json({ message: 'Failed to join group' });
  }
};

// @desc    Reset join code (owner/admin only)
// @route   POST /api/campus/groups/:id/code/reset
const resetJoinCode = async (req, res) => {
  try {
    const Conversation = getConversationModel();
    const group = await Conversation.findByPk(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const adminIds = group.adminIds || [];
    if (!adminIds.includes(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only group admins can reset the join code' });
    }

    const newCode = await generateJoinCode();
    group.joinCode = newCode;
    await group.save();

    res.json({
      message: 'Join code has been reset immediately. Old code is now invalid.',
      joinCode: newCode,
    });
  } catch (err) {
    console.error('[RESET_JOIN_CODE_ERR]', err);
    res.status(500).json({ message: 'Failed to reset code' });
  }
};

// @desc    List groups the current user belongs to
// @route   GET /api/campus/groups/mine
const getMyGroups = async (req, res) => {
  try {
    const Conversation = getConversationModel();
    const { Op } = require('sequelize');

    const groups = await Conversation.findAll({
      where: {
        isGroup: true,
        participants: { [Op.like]: `%${req.user.id}%` },
      },
      order: [['createdAt', 'DESC']],
    });

    const mine = groups.filter((g) => (g.participants || []).includes(req.user.id));

    // Which of my admin groups are public on campus (for the "Public on campus" switch).
    let publicIds = new Set();
    try {
      const adminIds = mine.filter((g) => (g.adminIds || []).includes(req.user.id)).map((g) => g.id);
      if (adminIds.length) {
        const { getCampusGroupSettingModel } = require('../models/CampusGroupSetting');
        const rows = await getCampusGroupSettingModel().findAll({
          where: { conversationId: adminIds, discoverable: true },
          attributes: ['conversationId'],
        });
        publicIds = new Set(rows.map((r) => String(r.conversationId)));
      }
    } catch (e) {
      console.warn('[GET_MY_GROUPS_DISCOVERABLE_WARN]', e.message);
    }

    res.json({
      groups: mine.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        type: g.type,
        groupAvatar: g.groupAvatar,
        joinCode: (g.adminIds || []).includes(req.user.id) ? g.joinCode : undefined,
        isAdmin: (g.adminIds || []).includes(req.user.id),
        memberCount: (g.participants || []).length,
        discoverable: publicIds.has(String(g.id)),
      })),
    });
  } catch (err) {
    console.error('[GET_MY_GROUPS_ERR]', err);
    res.status(500).json({ message: 'Failed to load groups' });
  }
};

module.exports = {
  createGroup,
  previewGroupByCode,
  joinGroupByCode,
  resetJoinCode,
  getMyGroups,
};
