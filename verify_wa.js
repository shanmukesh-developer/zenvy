
const { formatOrderMessage, sendWhatsAppMessage } = require('./backend/utils/whatsappUtil');

const mockOrder = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  items: [
    { name: 'Paneer Butter Masala', quantity: 1 },
    { name: 'Butter Naan', quantity: 2 }
  ],
  totalPrice: 280,
  finalPrice: 310,
  deliveryFee: 30,
  deliveryAddress: 'Hostel Block-C, RM 302',
  restaurant: { name: 'Royal Spice' },
  status: 'Accepted'
};

async function testNotifications() {
  console.log('--- STARTING WHATSAPP BRIDGE VERIFICATION ---\n');

  // Test Customer Confirmation
  const confirmMsg = formatOrderMessage(mockOrder, 'CUSTOMER_CONFIRMATION');
  await sendWhatsAppMessage('919876543210', confirmMsg, 'CUSTOMER_CONFIRMATION');

  // Test Status Update (Rider Picked Up)
  mockOrder.status = 'PickedUp';
  const statusMsg = formatOrderMessage(mockOrder, 'STATUS_UPDATE');
  await sendWhatsAppMessage('919876543210', statusMsg, 'STATUS_UPDATE');

  // Test Rider Alert
  const riderMsg = formatOrderMessage(mockOrder, 'RIDER_ALERT');
  await sendWhatsAppMessage('917778889990', riderMsg, 'RIDER_ALERT');

  console.log('\n--- VERIFICATION COMPLETED ---');
}

testNotifications();
