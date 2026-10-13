// /api/campus/mod — Friends moderation and admin (admins only). Phase 1 adds scoped
// community-moderator endpoints under /mod/community/* in its own router.
const express = require('express');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { wrap } = require('../services/http');
const c = require('../controllers/modController');

const router = express.Router();
const w = (fn) => wrap(fn, 'FRIENDS_MOD');

router.use(protect, admin);

router.get('/queue', w(c.getQueue));
router.get('/reports/:id', w(c.getReport));
router.post('/reports/:id/assign', w(c.assignReport));
router.post('/reports/:id/resolve', w(c.resolveReport));
router.post('/reveal-author', w(c.revealAuthor));

router.get('/appeals', w(c.listAppeals));
router.post('/appeals/:id/decide', w(c.decideAppeal));

router.get('/sanctions', w(c.listSanctions));
router.post('/sanctions', w(c.createSanction));
router.post('/sanctions/:id/lift', w(c.liftSanction));

router.get('/actions', w(c.listActions));

router.get('/config', w(c.getConfig));
router.put('/config', w(c.putConfig));

router.get('/entities', w(c.listEntities));
router.post('/entities', w(c.createEntity));
router.put('/entities/:id', w(c.updateEntity));

router.post('/badges', w(c.grantBadge));
router.delete('/badges/:id', w(c.revokeBadge));

module.exports = router;
