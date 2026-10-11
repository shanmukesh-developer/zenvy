const { getCampusPollModel } = require('../models/CampusPoll');
const { requireMember, sendAccessError } = require('../membership');

// @desc    Create a poll in a conversation
// @route   POST /api/campus/polls
const createPoll = async (req, res) => {
  try {
    const { conversationId, question, options, isMulti, isAnonymous } = req.body;
    if (!conversationId || !question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'Conversation, question, and at least 2 options are required' });
    }
    const cleanOptions = options.map((o) => String(o).trim()).filter(Boolean);
    if (typeof question !== 'string' || !question.trim() || question.length > 200) {
      return res.status(400).json({ message: 'Please keep the question under 200 characters.' });
    }
    if (cleanOptions.length < 2 || cleanOptions.length > 10 || cleanOptions.some((o) => o.length > 100)) {
      return res.status(400).json({ message: 'Polls need 2 to 10 options of up to 100 characters each.' });
    }
    await requireMember(conversationId, req.user);

    const CampusPoll = getCampusPollModel();
    const poll = await CampusPoll.create({
      conversationId,
      creatorId: req.user.id,
      question: question.trim(),
      options: cleanOptions,
      isMulti: !!isMulti,
      isAnonymous: !!isAnonymous,
      votes: {},
    });

    res.status(201).json({ message: 'Poll created', poll });
  } catch (err) {
    if (sendAccessError(res, err)) return;
    console.error('[CREATE_POLL_ERR]', err);
    res.status(500).json({ message: 'Failed to create poll' });
  }
};

// @desc    List polls for a conversation
// @route   GET /api/campus/polls/:conversationId
const getPolls = async (req, res) => {
  try {
    await requireMember(req.params.conversationId, req.user);
    const CampusPoll = getCampusPollModel();
    const polls = await CampusPoll.findAll({
      where: { conversationId: req.params.conversationId },
      order: [['createdAt', 'DESC']],
    });
    res.json({ polls });
  } catch (err) {
    if (sendAccessError(res, err)) return;
    console.error('[GET_POLLS_ERR]', err);
    res.status(500).json({ message: 'Failed to load polls' });
  }
};

// @desc    Cast a vote on a poll
// @route   POST /api/campus/polls/:id/vote
const votePoll = async (req, res) => {
  try {
    const { optionIndexes } = req.body;
    const CampusPoll = getCampusPollModel();
    const poll = await CampusPoll.findByPk(req.params.id);
    if (!poll) return res.status(404).json({ message: 'Poll not found' });
    await requireMember(poll.conversationId, req.user);
    if (poll.closed) return res.status(400).json({ message: 'Poll is closed' });

    const idxs = (Array.isArray(optionIndexes) ? optionIndexes : [optionIndexes])
      .map((i) => parseInt(i, 10))
      .filter((i) => Number.isInteger(i) && i >= 0 && i < poll.options.length);
    if (!idxs.length) return res.status(400).json({ message: 'Invalid option' });

    const votes = poll.votes || {};
    const userId = req.user.id;
    const chosen = poll.isMulti ? idxs : [idxs[0]];

    // Remove the user's previous votes, then apply the new selection.
    for (const key of Object.keys(votes)) {
      votes[key] = (votes[key] || []).filter((uid) => uid !== userId);
    }
    for (const i of chosen) {
      votes[String(i)] = [...(votes[String(i)] || []), userId];
    }
    poll.votes = votes;
    await poll.save();

    res.json({ message: 'Vote recorded', poll });
  } catch (err) {
    if (sendAccessError(res, err)) return;
    console.error('[VOTE_POLL_ERR]', err);
    res.status(500).json({ message: 'Failed to vote' });
  }
};

module.exports = { createPoll, getPolls, votePoll };
