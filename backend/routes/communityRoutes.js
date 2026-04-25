const express = require('express');
const router = express.Router();
const { getCommunityPostModel } = require('../models/CommunityPost');
const { protect } = require('../middleware/authMiddleware');

// GET /api/community - Fetch root posts, then attach replies manually
router.get('/', async (req, res) => {
  try {
    const CommunityPost = getCommunityPostModel();
    if (!CommunityPost) return res.status(500).json({ message: 'DB disconnected.' });

    let rootPosts;
    try {
      // Try threaded query (parentId column exists)
      rootPosts = await CommunityPost.findAll({
        where: { parentId: null },
        order: [['createdAt', 'DESC']],
        limit: 50
      });
    } catch (_e) {
      // Fallback: parentId column may not exist yet — fetch all
      rootPosts = await CommunityPost.findAll({
        order: [['createdAt', 'DESC']],
        limit: 50
      });
      return res.json(rootPosts.map(p => ({ ...p.toJSON(), replies: [] })));
    }

    // Fetch all replies in one query
    const rootIds = rootPosts.map(p => p.id);
    let allReplies = [];
    if (rootIds.length > 0) {
      try {
        const { Op } = require('sequelize');
        allReplies = await CommunityPost.findAll({
          where: { parentId: { [Op.in]: rootIds } },
          order: [['createdAt', 'ASC']]
        });
      } catch (_e) { /* parentId column missing, no replies */ }
    }

    const postsJSON = rootPosts.map(p => {
      const pj = p.toJSON();
      pj.replies = allReplies.filter(r => r.parentId === pj.id).map(r => r.toJSON());
      return pj;
    });

    res.json(postsJSON);
  } catch (error) {
    console.error('Fetch posts error:', error);
    res.status(500).json({ message: 'Failed to fetch community threads.' });
  }
});

// POST /api/community - Create a new post or reply
router.post('/', protect, async (req, res) => {
  try {
    const CommunityPost = getCommunityPostModel();
    if (!CommunityPost) return res.status(500).json({ message: 'DB disconnected.' });

    const { content, parentId, imageUrl } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ message: 'Content or image is required.' });

    // If reply, increment parent's replyCount
    if (parentId) {
      const parent = await CommunityPost.findByPk(parentId);
      if (!parent) return res.status(404).json({ message: 'Parent post not found.' });
      parent.replyCount = (parent.replyCount || 0) + 1;
      await parent.save();
    }

    const newPost = await CommunityPost.create({
      userId: req.user.id,
      userName: req.user.name || 'Anonymous Operative',
      userAvatar: req.user.profileImage || null,
      content: content || '',
      imageUrl: imageUrl || null,
      parentId: parentId || null,
      likes: 0,
      likedBy: []
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Failed to post to nexus.' });
  }
});

// PUT /api/community/:id/like - Like/unlike a post
router.put('/:id/like', protect, async (req, res) => {
  try {
    const CommunityPost = getCommunityPostModel();
    if (!CommunityPost) return res.status(500).json({ message: 'DB disconnected.' });

    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    let likedBy = post.likedBy || [];
    const userId = String(req.user.id);
    
    if (likedBy.includes(userId)) {
      likedBy = likedBy.filter(id => id !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      likedBy.push(userId);
      post.likes += 1;
    }
    
    post.likedBy = likedBy;
    await post.save();

    res.json(post);
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Failed to like post.' });
  }
});

module.exports = router;
