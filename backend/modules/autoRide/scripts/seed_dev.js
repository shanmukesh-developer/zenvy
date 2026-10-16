// DEV-ONLY Auto-Ride fixtures for building the apps locally: one route + pickup point, one verified
// driver (password printed once) with an approved 8-seat auto, and AUTO_RIDE_ENABLED on.
// Refused on production (utils/seedGuard: NODE_ENV=production, RENDER, or a Postgres DATABASE_URL).
// Everything it creates is labelled "DEV" so it can never pass for real data.
//   node modules/autoRide/scripts/seed_dev.js
const crypto = require('crypto');
const { seedAllowed } = require('../../../utils/seedGuard');

const main = async () => {
  if (!seedAllowed('modules/autoRide/scripts/seed_dev.js')) process.exit(1);
  require('dotenv').config();
  const { connectDB, getSequelize } = require('../../../config/db');
  await connectDB();
  const db = getSequelize();
  if (db.getDialect() !== 'sqlite') { console.error('Refusing: dev seed runs on the local SQLite database only.'); process.exit(1); }
  const M = (n) => db.models[n];
  const bcrypt = require('bcryptjs');
  const { defaultLayout } = require('../services/layout');
  const [route] = await M('AutoRoute').findOrCreate({
    where: { name: 'DEV SRM AP to Mangalagiri' },
    defaults: { originLabel: 'SRM University-AP (DEV)', destinationLabel: 'Mangalagiri (DEV)', seatFareMin: 10, seatFareMax: 100, fullFareMin: 100, fullFareMax: 800, isActive: true },
  });
  await M('AutoPickupPoint').findOrCreate({ where: { routeId: route.id, name: 'DEV Main Gate Stand' }, defaults: { landmark: 'DEV fixture', sequence: 1, isActive: true } });
  const phone = '9000099901';
  const password = `Dev${crypto.randomBytes(4).toString('hex')}1`;
  let driver = await M('AutoDriver').findOne({ where: { phone } });
  if (!driver) {
    driver = await M('AutoDriver').create({ name: 'DEV Driver', phone, password: await bcrypt.hash(password, 10), status: 'VERIFIED', reviewedAt: new Date(), licenceNumber: 'DEV0000000000', licenceExpiresOn: '2030-12-31', emergencyContactPhone: '9000099902' });
    console.log(`DEV driver ${phone} / ${password}`);
  }
  await M('AutoVehicle').findOrCreate({
    where: { registrationNumber: 'DEV00AA0001' },
    defaults: { driverId: driver.id, make: 'DEV', model: 'Fixture', rcSeatingCapacity: 8, requestedCapacity: 8, approvedCapacity: 8, seatLayout: defaultLayout(8), permitExpiresOn: '2030-12-31', insuranceExpiresOn: '2030-12-31', status: 'APPROVED' },
  });
  await require('../services/flag').writeFlag(true);
  console.log('Auto-Ride DEV fixtures ready.');
  await db.close();
};

main().catch((err) => { console.error(err); process.exit(1); });
