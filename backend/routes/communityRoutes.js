const express = require('express');
const router = express.Router();
const { getCommunityPostModel } = require('../models/CommunityPost');
const { protect } = require('../middleware/authMiddleware');

// GET /api/community - Fetch root posts, then attach replies manually
router.get('/', async (req, res) => {
  try {
    const CommunityPost = getCommunityPostModel();
    if (!CommunityPost) return res.status(500).json({ message: 'DB disconnected.' });

    const { Op } = require('sequelize');
    const now = new Date();

    let rootPosts;
    try {
      rootPosts = await CommunityPost.findAll({
        where: {
          parentId: null,
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gt]: now } }
          ]
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      });
    } catch {
      rootPosts = await CommunityPost.findAll({
        order: [['createdAt', 'DESC']],
        limit: 50
      });
      return res.json(rootPosts.map(p => ({ ...p.toJSON(), replies: [] })));
    }

    const rootIds = rootPosts.map(p => p.id);
    let allReplies = [];
    if (rootIds.length > 0) {
      try {
        allReplies = await CommunityPost.findAll({
          where: {
            parentId: { [Op.in]: rootIds },
            [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }]
          },
          order: [['createdAt', 'ASC']]
        });
      } catch { /* parentId column missing, no replies */ }
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

    // The author is always the signed-in account (a client-sent authorName is ignored).
    const { content, parentId, imageUrl, postType, starRating, restaurantId, restaurantName, productName } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ message: 'Content or image is required.' });

    // Field checks (community-n18 / n21)
    if (content !== undefined && content !== null && typeof content !== 'string') return res.status(400).json({ message: 'Post text must be text.' });
    if (typeof content === 'string' && content.trim().length > 500) return res.status(400).json({ code: 'CONTENT_TOO_LONG', message: 'Posts can be at most 500 characters.' });
    const tooLong = (v, n) => v !== undefined && v !== null && String(v).trim().length > n;
    if (tooLong(restaurantName, 60)) return res.status(400).json({ message: 'Restaurant name can be at most 60 characters.' });
    if (tooLong(productName, 60)) return res.status(400).json({ message: 'Dish name can be at most 60 characters.' });
    let reviewStars = null;
    if (postType === 'review' && !parentId) {
      reviewStars = Number(starRating);
      if (!Number.isInteger(reviewStars) || reviewStars < 1 || reviewStars > 5) {
        return res.status(400).json({ code: 'INVALID_RATING', message: 'Pick a rating from 1 to 5 stars.' });
      }
      // A review tied to a store needs a delivered order from it.
      if (restaurantId) {
        const { getOrderModel } = require('../models/Order');
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const delivered = UUID_RE.test(String(restaurantId))
          ? await getOrderModel().count({ where: { userId: req.user.id, restaurantId: String(restaurantId), status: 'Delivered' } })
          : 0;
        if (!delivered) return res.status(403).json({ code: 'REVIEW_NEEDS_ORDER', message: 'You can review a place once an order from it has been delivered to you.' });
      }
    }

    // Photo: sniffed and stored in the media table; the post keeps only the short URL.
    let cleanImage = null;
    if (imageUrl) {
      const { storeImageRef, sendImageError } = require('../utils/imageStore');
      const img = await storeImageRef(imageUrl, { req, ownerId: req.user.id, purpose: 'post' });
      if (!img.ok) return sendImageError(res, img);
      cleanImage = img.value;
    }

    if (parentId) {
      const parent = await CommunityPost.findByPk(parentId);
      if (!parent) return res.status(404).json({ message: 'Parent post not found.' });
      const { literal } = require('sequelize');
      await CommunityPost.update({ replyCount: literal('COALESCE("replyCount", 0) + 1') }, { where: { id: parent.id } });
    }

    // Reviews don't expire; regular posts expire in 48h
    const isReview = postType === 'review';
    const expiresAt = isReview ? null : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const { getUserModel: getAuthorModel } = require('../models/User');
    const author = await getAuthorModel().findByPk(req.user.id, { attributes: ['name', 'profileImage'] });

    const newPost = await CommunityPost.create({
      userId: req.user.id,
      userName: author?.name || req.user.name || 'Zenvy member',
      // Inline base64 avatars are never copied into posts: the short avatar URL is used instead.
      userAvatar: author ? require('../modules/campus/campusHelpers').avatarUrlFor(req, { id: req.user.id, profileImage: author.profileImage }) : null,
      content: typeof content === 'string' ? content.trim() : '',
      imageUrl: cleanImage,
      parentId: parentId || null,
      likes: 0,
      likedBy: [],
      expiresAt,
      postType: postType || 'post',
      starRating: isReview ? reviewStars : null,
      restaurantId: isReview ? (restaurantId || null) : null,
      restaurantName: isReview ? (String(restaurantName || '').trim() || null) : null,
      productName: isReview ? (String(productName || '').trim() || null) : null
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('community_new_post', newPost);
    }

    // Birthday pushes go out only for admin-approved celebrations (POST /api/birthdays/:id/approve),
    // never because a post contains "hbd" / "happy birthday".

    res.status(201).json(newPost);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Failed to post to nexus.' });
  }
});

// GET /api/community/reviews - Fetch food reviews only
router.get('/reviews', async (req, res) => {
  try {
    const CommunityPost = getCommunityPostModel();
    if (!CommunityPost) return res.status(500).json({ message: 'DB disconnected.' });

    const { Op } = require('sequelize');
    const now = new Date();

    let reviews;
    try {
      reviews = await CommunityPost.findAll({
        where: {
          postType: 'review',
          parentId: null,
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gt]: now } }
          ]
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      });
    } catch {
      // postType column may not exist yet or expiresAt fails
      try {
        reviews = await CommunityPost.findAll({
          where: { parentId: null },
          order: [['createdAt', 'DESC']],
          limit: 50
        });
      } catch {
        reviews = [];
      }
    }

    const reviewIds = reviews.map(p => p.id);
    let allReplies = [];
    if (reviewIds.length > 0) {
      try {
        allReplies = await CommunityPost.findAll({
          where: {
            parentId: { [Op.in]: reviewIds },
            [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }]
          },
          order: [['createdAt', 'ASC']]
        });
      } catch { /* parentId column missing, no replies */ }
    }

    const reviewsJSON = reviews.map(p => {
      const pj = p.toJSON();
      pj.replies = allReplies.filter(r => r.parentId === pj.id).map(r => r.toJSON());
      return pj;
    });

    res.json(reviewsJSON);
  } catch (error) {
    console.error('Fetch reviews error:', error);
    res.status(500).json({ message: 'Failed to fetch reviews.' });
  }
});


// DELETE /api/community/:id - Delete a post
router.delete('/:id', protect, async (req, res) => {
  try {
    const CommunityPost = getCommunityPostModel();
    if (!CommunityPost) return res.status(500).json({ message: 'DB disconnected.' });

    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    if (String(post.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this post.' });
    }

    if (post.parentId) {
      const parent = await CommunityPost.findByPk(post.parentId);
      if (parent) {
        parent.replyCount = Math.max((parent.replyCount || 1) - 1, 0);
        await parent.save();
      }
    }

    // Optional: Destroy children replies
    await CommunityPost.destroy({ where: { parentId: post.id } });
    const postId = post.id;
    const parentId = post.parentId;
    await post.destroy();

    const io = req.app.get('io');
    if (io) {
      io.emit('community_post_deleted', { id: postId, parentId });
    }

    res.json({ message: 'Post deleted successfully.' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Failed to delete post.' });
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

    const io = req.app.get('io');
    if (io) {
      io.emit('community_post_liked', { id: post.id, likes: post.likes, likedBy: post.likedBy });
    }

    res.json(post);
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Failed to like post.' });
  }
});

module.exports = router;
