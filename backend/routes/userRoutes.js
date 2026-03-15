const express = require('express');
const { registerUser, authUser, saveFcmToken } = require('../controllers/userController');
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/fcm-token', saveFcmToken);

module.exports = router;
