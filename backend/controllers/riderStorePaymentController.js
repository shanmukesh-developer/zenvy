// Paid amount at pay-before-pickup restaurants (owner, 24 Nov 2026).
//
// Some restaurants are paid before the rider picks the food up. ZenWe gives the rider hand cash for that; the rider
// pays at the counter and records it here: the order, the amount and a photo of the restaurant's bill. The record
// is shown to the rider ("Paid to restaurants") and to the admin. It NEVER changes the rider's COD cash
// (utils/riderCash), earnings (utils/riderEarnings) or what the customer pays: ZenWe settles it with the rider
// separately. Stored on the order: riderStorePaidPaise, riderStorePaidBillUrl, riderStorePaidAt.
const { Op } = require('sequelize');
const { getOrderModel } = require('../models/Order');
const { getRestaurantModel } = require('../models/Restaurant');
const { toPaise } = require('../utils/riderEarnings');
const { istStartOfDay } = require('../utils/istTime');
const orderNumbers = require('../utils/orderNumbers');

const MAX_RUPEES = 100000;
const BILL_FIELDS = ['billUrl'];

const isPayBeforePickup = (o) => !!o && (o.storePaidByRider === true || o.storePaidByRider === 1 || o.storePaidByRider === '1')
  && String(o.fulfilment || '').toUpperCase() !== 'VENDOR';

const rupees = (p) => Math.round(Number(p) || 0) / 100;

/** Signed links for the private bill photos (only the uploader and admins can open them). */
const signBills = async (req, rows) => {
  const { signMediaFields, ORDER_PURPOSES } = require('../utils/mediaAccess');
  await signMediaFields(req, rows, BILL_FIELDS, { purposes: ORDER_PURPOSES });
  return rows;
};

const paymentRow = (o, store) => ({
  orderId: o.id,
  ...orderNumbers.fields(o),
  restaurant: store ? store.name : null,
  orderStatus: o.status,
  foodTotal: Number(o.totalPrice) || 0,
  amount: o.riderStorePaidPaise === null || o.riderStorePaidPaise === undefined ? null : rupees(o.riderStorePaidPaise),
  billUrl: o.riderStorePaidBillUrl || null,
  paidAt: o.riderStorePaidAt || null,
  createdAt: o.createdAt,
});

const storesFor = async (orders) => {
  const ids = [...new Set(orders.map((o) => o.restaurantId).filter(Boolean))];
  if (!ids.length) return {};
  const rows = await getRestaurantModel().findAll({ where: { id: ids }, attributes: ['id', 'name'], raw: true });
  return Object.fromEntries(rows.map((r) => [r.id, r]));
};

// @desc   Rider records what they paid the restaurant for a pay-before-pickup order (amount + bill photo).
// @route  PUT /api/delivery/orders/:orderId/store-payment   { amount, billPhoto }
const recordStorePayment = async (req, res) => {
  try {
    const amount = Number((req.body || {}).amount);
    const billPhoto = (req.body || {}).billPhoto;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_RUPEES) {
      return res.status(400).json({ code: 'BAD_AMOUNT', message: 'Enter the amount you paid the restaurant.' });
    }
    if (!billPhoto || typeof billPhoto !== 'string') {
      return res.status(400).json({ code: 'BILL_REQUIRED', message: 'Take a photo of the restaurant bill.' });
    }
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.orderId);
    if (!order || String(order.deliveryPartnerId) !== String(req.user.id)) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (!isPayBeforePickup(order)) {
      return res.status(400).json({ code: 'NOT_PAY_BEFORE_PICKUP', message: 'This restaurant is not paid at pickup. Nothing to record.' });
    }
    if (order.status === 'Cancelled') return res.status(409).json({ code: 'ORDER_CANCELLED', message: 'This order was cancelled.' });

    const { storeImageRef, sendImageError } = require('../utils/imageStore');
    const img = await storeImageRef(billPhoto, { req, ownerId: req.user.id, purpose: 'bill', allowExternal: false });
    if (!img.ok || !img.value) return sendImageError(res, img.ok ? { status: 400, message: 'Take a photo of the restaurant bill.' } : img);

    const paidAt = new Date();
    const [saved] = await Order.update(
      { riderStorePaidPaise: toPaise(amount), riderStorePaidBillUrl: img.value, riderStorePaidAt: paidAt },
      { where: { id: order.id, deliveryPartnerId: req.user.id, status: { [Op.ne]: 'Cancelled' } } }
    );
    if (!saved) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });
    await order.reload();
    const stores = await storesFor([order]);
    const row = paymentRow(order, stores[order.restaurantId]);
    await signBills(req, row);
    return res.json({ payment: row });
  } catch (error) {
    console.error('[RIDER_STORE_PAYMENT_ERROR]', error);
    return res.status(500).json({ message: 'Could not save the payment. Please try again.' });
  }
};

// @desc   Today's (IST) pay-before-pickup orders of this rider: recorded payments + orders still to record, and the total.
// @route  GET /api/delivery/store-payments
const getMyStorePayments = async (req, res) => {
  try {
    const since = istStartOfDay();
    const orders = await getOrderModel().findAll({
      where: {
        deliveryPartnerId: req.user.id,
        storePaidByRider: true,
        status: { [Op.ne]: 'Cancelled' },
        [Op.or]: [{ createdAt: { [Op.gte]: since } }, { riderStorePaidAt: { [Op.gte]: since } }, { status: { [Op.notIn]: ['Delivered', 'Cancelled'] } }],
      },
      attributes: ['id', 'orderNumber', 'restaurantId', 'status', 'totalPrice', 'fulfilment', 'storePaidByRider', 'riderStorePaidPaise', 'riderStorePaidBillUrl', 'riderStorePaidAt', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    const rows = orders.filter(isPayBeforePickup);
    const stores = await storesFor(rows);
    const list = rows.map((o) => paymentRow(o, stores[o.restaurantId]));
    await signBills(req, list);
    const paid = list.filter((p) => p.amount !== null);
    const totalPaise = rows.reduce((s, o) => s + (Number(o.riderStorePaidPaise) || 0), 0);
    res.set('Cache-Control', 'no-store');
    return res.json({ total: rupees(totalPaise), totalPaise, paid, toRecord: list.filter((p) => p.amount === null) });
  } catch (error) {
    console.error('[RIDER_STORE_PAYMENTS_ERROR]', error);
    return res.status(500).json({ message: 'Could not load your payments. Please try again.' });
  }
};

// @desc   Admin: recorded restaurant payments by riders (newest first), optional ?riderId=&from=&to= (ISO dates).
// @route  GET /api/admin/rider-store-payments
const adminListStorePayments = async (req, res) => {
  try {
    const where = { riderStorePaidPaise: { [Op.ne]: null } };
    if (req.query.riderId) where.deliveryPartnerId = String(req.query.riderId);
    const range = {};
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    if (from && !Number.isNaN(from.getTime())) range[Op.gte] = from;
    if (to && !Number.isNaN(to.getTime())) range[Op.lt] = to;
    if (Object.keys(range).length) where.riderStorePaidAt = range;
    const orders = await getOrderModel().findAll({
      where,
      attributes: ['id', 'orderNumber', 'restaurantId', 'deliveryPartnerId', 'status', 'totalPrice', 'riderStorePaidPaise', 'riderStorePaidBillUrl', 'riderStorePaidAt', 'createdAt'],
      order: [['riderStorePaidAt', 'DESC']],
      limit: 500,
    });
    const stores = await storesFor(orders);
    const riderIds = [...new Set(orders.map((o) => o.deliveryPartnerId).filter(Boolean))];
    const riders = riderIds.length
      ? await require('../models/DeliveryPartner').getDeliveryPartnerModel().findAll({ where: { id: riderIds }, attributes: ['id', 'name', 'phone'], raw: true })
      : [];
    const riderMap = Object.fromEntries(riders.map((r) => [String(r.id), r]));
    const list = orders.map((o) => ({ ...paymentRow(o, stores[o.restaurantId]), rider: riderMap[String(o.deliveryPartnerId)] || null }));
    await signBills(req, list);
    const totalPaise = orders.reduce((s, o) => s + (Number(o.riderStorePaidPaise) || 0), 0);
    res.set('Cache-Control', 'no-store');
    return res.json({ total: rupees(totalPaise), count: list.length, payments: list });
  } catch (error) {
    console.error('[ADMIN_RIDER_STORE_PAYMENTS_ERROR]', error);
    return res.status(500).json({ message: 'Could not load rider payments.' });
  }
};

module.exports = { recordStorePayment, getMyStorePayments, adminListStorePayments, isPayBeforePickup };
