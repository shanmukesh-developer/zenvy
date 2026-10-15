// Store ratings from real customer ratings on delivered orders (Order.rating, 1-5).
// Used for CampusBites stalls, whose stored Restaurant.rating is not fed by reviews.
const { Op } = require('sequelize');

/** Map storeId -> { rating (1 decimal), ratingCount } for the stores that have at least one rating. */
const realRatingsFor = async (storeIds) => {
  const out = new Map();
  const ids = [...new Set((storeIds || []).map(String))].filter(Boolean);
  if (!ids.length) return out;
  const { getOrderModel } = require('../models/Order');
  const Order = getOrderModel();
  if (!Order) return out;
  const fn = Order.sequelize.fn;
  const col = Order.sequelize.col;
  const rows = await Order.findAll({
    where: { restaurantId: { [Op.in]: ids }, rating: { [Op.ne]: null } },
    attributes: ['restaurantId', [fn('AVG', col('rating')), 'avg'], [fn('COUNT', col('id')), 'count']],
    group: ['restaurantId'],
    raw: true,
  });
  for (const r of rows) {
    const count = Number(r.count) || 0;
    const avg = Number(r.avg);
    if (count > 0 && Number.isFinite(avg)) out.set(String(r.restaurantId), { rating: Math.round(avg * 10) / 10, ratingCount: count });
  }
  return out;
};

module.exports = { realRatingsFor };
