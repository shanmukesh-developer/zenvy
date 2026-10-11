const { getLostAndFoundModel } = require('../models/LostAndFound');

// @desc    Post a lost or found item to the campus board
// @route   POST /api/campus/lost-found
const createLostFound = async (req, res) => {
  try {
    const { type, title, description, location, imageUrl, claimContact } = req.body;
    if (!type || !['lost', 'found'].includes(type)) {
      return res.status(400).json({ message: "type must be 'lost' or 'found'" });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'A short title is required' });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ message: 'Where it was lost/found is required' });
    }

    const LostAndFound = getLostAndFoundModel();
    const item = await LostAndFound.create({
      userId: req.user.id,
      userName: req.user.name || 'A student',
      type,
      title: title.trim(),
      description: description ? description.trim() : null,
      location: location.trim(),
      imageUrl: imageUrl || null,
      claimContact: claimContact ? claimContact.trim() : null,
      status: 'open',
    });

    console.log(`🔎 [CAMPUS_LNF] ${req.user.name} posted ${type}: "${item.title}"`);
    res.status(201).json({ message: 'Posted to the campus board', item });
  } catch (err) {
    console.error('[CREATE_LNF_ERR]', err);
    res.status(500).json({ message: 'Failed to post item' });
  }
};

// @desc    List board items (optionally filter by type/status)
// @route   GET /api/campus/lost-found
const getLostFound = async (req, res) => {
  try {
    const LostAndFound = getLostAndFoundModel();
    const where = {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.status) where.status = req.query.status;
    else where.status = 'open';

    const items = await LostAndFound.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    res.json({ items });
  } catch (err) {
    console.error('[GET_LNF_ERR]', err);
    res.status(500).json({ message: 'Failed to load board' });
  }
};

// @desc    Mark an item resolved/claimed (poster only)
// @route   POST /api/campus/lost-found/:id/resolve
const resolveLostFound = async (req, res) => {
  try {
    const LostAndFound = getLostAndFoundModel();
    const item = await LostAndFound.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the poster can resolve this item' });
    }

    const { status = 'resolved' } = req.body;
    item.status = ['claimed', 'resolved'].includes(status) ? status : 'resolved';
    await item.save();

    res.json({ message: 'Item marked as resolved', item });
  } catch (err) {
    console.error('[RESOLVE_LNF_ERR]', err);
    res.status(500).json({ message: 'Failed to update item' });
  }
};

module.exports = { createLostFound, getLostFound, resolveLostFound };
