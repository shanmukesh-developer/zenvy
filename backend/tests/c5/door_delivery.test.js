// Door delivery (owner, 24 Nov 2026; utils/orderPricing DOOR_DELIVERY_FEE): an optional ₹10 on the delivery charge
// (₹19 delivery + ₹4 platform = ₹23 -> ₹33) for SRM AP only; Amrita and stall orders never pay it. The order keeps
// it in its delivery fee and breakdown, and the rider sees it in the delivery notes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

test.before(async () => { await H.setup(); });
test.after(async () => { await H.teardown(); });

const quote = (u, item, extra) => H.api('POST', '/api/orders/quote', u.token, { items: [{ menuItemId: item.id, quantity: 1 }], ...extra });

test('SRM AP: ₹10 only when chosen; Amrita: never', async () => {
  const { item } = await H.mkStore({ price: 100 });
  const u = await H.mkUser();
  const plain = await quote(u, item, { campus: 'srmap' });
  assert.equal(plain.status, 200, JSON.stringify(plain.body));
  assert.equal(plain.body.doorDeliveryAvailable, true);
  assert.equal(plain.body.doorDeliveryFee, 0);
  assert.equal(plain.body.deliveryFee + plain.body.platformFee, 23);
  const door = await quote(u, item, { campus: 'srmap', doorDelivery: true });
  assert.equal(door.body.doorDeliveryFee, 10);
  assert.equal(door.body.deliveryFee + door.body.platformFee + door.body.doorDeliveryFee, 33);
  assert.equal(door.body.finalPrice, plain.body.finalPrice + 10);
  const amrita = await quote(u, item, { campus: 'amrita', doorDelivery: true });
  assert.equal(amrita.status, 200, JSON.stringify(amrita.body));
  assert.equal(amrita.body.doorDeliveryAvailable, false);
  assert.equal(amrita.body.doorDeliveryFee, 0);
  assert.equal(amrita.body.finalPrice, plain.body.finalPrice);
});

test('the placed order carries the ₹10 and tells the rider', async () => {
  const { item } = await H.mkStore({ price: 100 });
  const u = await H.mkUser();
  const r = await H.api('POST', '/api/orders', u.token, H.orderBody(item.id, 'COD', { doorDelivery: true }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.id || r.body._id;
  const o = await H.ctx.M('Order').findByPk(id);
  assert.equal(Number(o.deliveryFee), 29, 'delivery fee includes door delivery');
  const pb = typeof o.priceBreakdown === 'string' ? JSON.parse(o.priceBreakdown) : o.priceBreakdown;
  assert.equal(pb.doorDeliveryFee, 10);
  const notes = typeof o.deliveryInstructions === 'string' ? JSON.parse(o.deliveryInstructions) : o.deliveryInstructions;
  assert.ok(Array.isArray(notes) && notes.some((n) => /door delivery/i.test(n)), JSON.stringify(notes));
  const plain = await H.api('POST', '/api/orders', u.token, H.orderBody(item.id, 'COD'));
  assert.equal(Number(plain.body.finalPrice) + 10, Number(r.body.finalPrice));
});
