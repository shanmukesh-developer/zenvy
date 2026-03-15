const express = require('express');
const { registerPartner, authPartner, acceptOrder } = require('../controllers/deliveryPartnerController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', registerPartner);
router.post('/login', authPartner);
router.put('/accept/:orderId', protect, acceptOrder);

module.exports = router;
