const { connectDB, getSequelize } = require('../config/db');
const { initServiceBookingModel, getServiceBookingModel } = require('../models/ServiceBooking');
const { initUserModel, getUserModel } = require('../models/User');

async function testServiceFlow() {
  console.log('🧪 Starting Service Booking Flow Test...');
  await connectDB();
  const ServiceBooking = getServiceBookingModel();
  const User = getUserModel();

  if (!ServiceBooking || !User) {
    throw new Error('Models not found');
  }

  // Find or create test user
  let user = await User.findOne();
  if (!user) {
    user = await User.create({
      name: 'Test Student',
      phone: '9999999999',
      hostelBlock: 'Vedha',
      roomNumber: '304',
      role: 'customer'
    });
  }

  console.log(`👤 Using test user: ${user.name} (${user.id})`);

  // 1. Create a Laptop Repair Booking
  const laptopBooking = await ServiceBooking.create({
    userId: user.id,
    serviceType: 'LAPTOP_REPAIR',
    title: 'MacBook Air M1 Screen & Thermal Clean',
    description: 'Flickering display and heating up during coding',
    specifications: { device: 'MacBook Air M1', ram: '16GB' },
    quotedAmount: 99,
    status: 'REQUESTED',
    hostelBlock: user.hostelBlock || 'Vedha',
    roomNumber: user.roomNumber || '304',
    contactPhone: user.phone,
    deliveryAddress: 'Hostel Vedha, Room 304',
    trackingHistory: [{ stage: 'REQUESTED', note: 'Doorstep diagnosis scheduled', timestamp: new Date().toISOString() }]
  });

  console.log(`✅ [1/3] Created Laptop Repair booking: ${laptopBooking.id} (Status: ${laptopBooking.status})`);

  // 2. Create a Printout Express Booking
  const printBooking = await ServiceBooking.create({
    userId: user.id,
    serviceType: 'PRINTOUT',
    title: 'Final Year Capstone Project (120 Pages)',
    description: 'Black & white with spiral coil binding',
    specifications: { pages: 120, isColor: false, hasBinding: true },
    quotedAmount: 120 * 2 + 35, // 275
    finalAmount: 275,
    status: 'IN_PROGRESS',
    hostelBlock: user.hostelBlock || 'Vedha',
    roomNumber: user.roomNumber || '304',
    contactPhone: user.phone,
    deliveryAddress: 'Hostel Vedha, Room 304',
    trackingHistory: [{ stage: 'IN_PROGRESS', note: 'Printing 120 pages and spiral binding', timestamp: new Date().toISOString() }]
  });

  console.log(`✅ [2/3] Created Printout booking: ${printBooking.id} (Amount: ₹${printBooking.finalAmount})`);

  // 3. Query all user bookings
  const userBookings = await ServiceBooking.findAll({ where: { userId: user.id } });
  console.log(`✅ [3/3] Successfully queried ${userBookings.length} bookings for student.`);

  console.log('\n🎉 ALL SERVICE BOOKING TESTS PASSED!');
  process.exit(0);
}

testServiceFlow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
