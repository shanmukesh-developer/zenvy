// Renter's driving licence: uploaded once (images are private media), verified by an admin.
const { getModel } = require('../index');
const E = require('../enums');
const { fail, cleanText, hit } = require('../services/util');
const { checkRefs } = require('../services/media');
const S = require('../services/serialize');
const notify = require('../services/notify');
const { istYmd } = require('../../../utils/istTime');
const istYmdNow = () => istYmd(new Date());
const istYmdOf = (d) => istYmd(new Date(d));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Classes that allow driving this vehicle (Indian DL classes). */
const classesFor = (listing) => {
  if (listing.vehicleType === 'CAR') return ['LMV', 'LMV-NT', 'TRANS'];
  if (listing.vehicleType === 'SCOOTER') return ['MCWG', 'MCWOG'];
  // Geared motorcycles need MCWG; a gearless (automatic / most EV) bike also accepts MCWOG.
  return listing.transmission === 'AUTOMATIC' ? ['MCWG', 'MCWOG'] : ['MCWG'];
};

/** The classes we trust for this licence: what the admin verified, else what the student declared. */
const effectiveClasses = (lic) => {
  if (!lic) return [];
  if (lic.status === E.LICENCE_STATUS.VERIFIED && Array.isArray(lic.verifiedClasses) && lic.verifiedClasses.length) return lic.verifiedClasses;
  return Array.isArray(lic.classes) ? lic.classes : [];
};

const classLabel = (listing) => (listing.vehicleType === 'CAR' ? 'a car (LMV)' : listing.vehicleType === 'SCOOTER' ? 'a scooter (MCWG or MCWOG)' : listing.transmission === 'AUTOMATIC' ? 'this bike (MCWG or MCWOG)' : 'a geared bike (MCWG)');

/**
 * Throws when `lic` cannot be used for `listing`.
 * opts.requireVerified: the owner accepting needs an admin-verified licence.
 * at: the trip end (licence must still be valid then).
 */
const assertLicenceFor = (lic, listing, { requireVerified = false, at = new Date() } = {}) => {
  if (!lic) throw fail(428, 'LICENCE_REQUIRED', 'Add your driving licence once before renting a vehicle.');
  if (lic.status === E.LICENCE_STATUS.REJECTED) {
    throw fail(403, 'LICENCE_REJECTED', `Your driving licence was not accepted${lic.rejectionReason ? `: ${lic.rejectionReason}` : ''}. Upload it again.`);
  }
  if (requireVerified && lic.status !== E.LICENCE_STATUS.VERIFIED) {
    throw fail(409, 'LICENCE_NOT_VERIFIED', "The renter's driving licence is still being verified by Zenvy. You can accept once it is verified.");
  }
  // Calendar dates in IST (B22): a licence valid "until 31 May" covers the whole IST day.
  if (lic.expiresOn && String(lic.expiresOn) < istYmdOf(at)) {
    throw fail(403, 'LICENCE_EXPIRED', 'Your driving licence expires before this trip ends. Upload your renewed licence.');
  }
  const have = effectiveClasses(lic);
  const need = classesFor(listing);
  if (!need.some((c) => have.includes(c))) {
    throw fail(403, 'LICENCE_CLASS_MISMATCH', `Your licence does not cover ${classLabel(listing)}.`, { required: need, have });
  }
};

// GET /api/rentals/licence
const getMine = async (req, res) => {
  const Licence = getModel('RentalLicence');
  const row = await Licence.findOne({ where: { userId: req.user.id } });
  res.json({ licence: S.licenceOwn(req, row) });
};

// PUT /api/rentals/licence { licenceNumber, classes[], frontImage, backImage?, expiresOn? }
const upsert = async (req, res) => {
  hit('licence', req.user.id);
  const Licence = getModel('RentalLicence');
  const b = req.body || {};
  const number = String(b.licenceNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{2}[0-9A-Z]{8,18}$/.test(number)) {
    throw fail(400, 'INVALID_INPUT', 'Enter the licence number as printed, e.g. AP07 20190012345.', { field: 'licenceNumber' });
  }
  const classes = Array.isArray(b.classes) ? [...new Set(b.classes.map((c) => String(c).toUpperCase().trim()))] : [];
  if (!classes.length || classes.some((c) => !E.LICENCE_CLASSES.includes(c))) {
    throw fail(400, 'INVALID_INPUT', `Pick the vehicle classes on your licence (${E.LICENCE_CLASSES.join(', ')}).`, { field: 'classes' });
  }
  let expiresOn = null;
  if (b.expiresOn) {
    const e = String(b.expiresOn).slice(0, 10);
    if (!DATE_RE.test(e) || Number.isNaN(Date.parse(e))) throw fail(400, 'INVALID_INPUT', 'Expiry date must look like 2030-05-31.', { field: 'expiresOn' });
    if (e < istYmdNow()) throw fail(400, 'LICENCE_EXPIRED', 'This licence has already expired.', { field: 'expiresOn' });
    expiresOn = e;
  }
  const existing = await Licence.findOne({ where: { userId: req.user.id } });
  const keep = existing ? [existing.frontImage, existing.backImage].filter(Boolean) : [];
  const [front] = await checkRefs(req.user.id, [b.frontImage], { purposes: ['rental_licence'], field: 'frontImage', min: 1, max: 1, keep, label: 'licence photo' });
  const back = b.backImage ? (await checkRefs(req.user.id, [b.backImage], { purposes: ['rental_licence'], field: 'backImage', min: 1, max: 1, keep, label: 'licence photo' }))[0] : null;
  const data = {
    licenceNumber: number,
    classes,
    verifiedClasses: null,
    frontImage: front,
    backImage: back,
    expiresOn,
    status: E.LICENCE_STATUS.PENDING,
    rejectionReason: null,
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
  let row;
  if (existing) row = await existing.update(data);
  else {
    try {
      row = await Licence.create({ ...data, userId: req.user.id });
    } catch (err) {
      // A double tap raced the unique index: update the row that won.
      if (!/unique|constraint/i.test(String(err && (err.name || err.message)))) throw err;
      row = await Licence.findOne({ where: { userId: req.user.id } });
      await row.update(data);
    }
  }
  notify.admin('rental_licence', existing ? 'updated' : 'created', row.id);
  res.json({ licence: S.licenceOwn(req, row), message: 'Licence sent for verification. You can request vehicles meanwhile; owners can accept once it is verified.' });
};

module.exports = { getMine, upsert, assertLicenceFor, classesFor, effectiveClasses, cleanText };
