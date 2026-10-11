// Store (non-food) vendor types. Stores are Restaurant rows whose products are MenuItem rows;
// they are browsed through /api/catalogue, not through the restaurant listing.
const STORE_VENDOR_TYPES = [
  'GROCERY', 'ELECTRONICS', 'HOME_ESSENTIALS', 'STATIONERY', 'PHARMACY', 'TOYS', 'SEEDS',
  'RENTALS', 'REPAIRS', 'PRINT', 'LAUNDRY', 'TAILORING', 'EXTRAS',
  // spellings used by older rows
  'STATIONARY', 'RENTAL'
];

// App category ids / friendly names → vendorType(s)
const TYPE_ALIASES = {
  grocery: ['GROCERY'], groceries: ['GROCERY'], kirana: ['GROCERY'], mart: ['GROCERY'], 'mega-basket': ['GROCERY'], megabasket: ['GROCERY'],
  electronics: ['ELECTRONICS'], tech: ['ELECTRONICS'],
  mattresses: ['HOME_ESSENTIALS'], bedding: ['HOME_ESSENTIALS'], home: ['HOME_ESSENTIALS'], home_essentials: ['HOME_ESSENTIALS'],
  stationary: ['STATIONERY', 'STATIONARY'], stationery: ['STATIONERY', 'STATIONARY'],
  pharmacy: ['PHARMACY'], medicine: ['PHARMACY'],
  toys: ['TOYS'], games: ['TOYS'],
  seeds: ['SEEDS'], gardening: ['SEEDS'],
  rentals: ['RENTALS', 'RENTAL'], rental: ['RENTALS', 'RENTAL'],
  repairs: ['REPAIRS'], print: ['PRINT'], xerox: ['PRINT'], laundry: ['LAUNDRY'], tailoring: ['TAILORING'],
  extras: ['EXTRAS'], addons: ['EXTRAS'], 'add-ons': ['EXTRAS'],
  local: ['LOCAL_VENDOR'], stalls: ['LOCAL_VENDOR'], local_vendor: ['LOCAL_VENDOR']
};

const resolveVendorTypes = (type) => {
  if (!type || typeof type !== 'string') return null;
  const key = type.trim().toLowerCase();
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
  const upper = type.trim().toUpperCase().replace(/[^A-Z_]/g, '');
  return upper ? [upper] : null;
};

const isStoreVendorType = (vendorType) => STORE_VENDOR_TYPES.includes(String(vendorType || '').toUpperCase());

// CampusBites local vendors are DISPLAY-ONLY listings: customers order directly with the stall
// (call / WhatsApp) and the vendor delivers. Zenvy takes no order, payment or rider for them.
const LOCAL_VENDOR_TYPES = ['LOCAL_VENDOR', 'LOCAL', 'STALL'];
const isLocalVendorStore = (store) => !!store && (
  LOCAL_VENDOR_TYPES.includes(String(store.vendorType || '').toUpperCase()) || store.isLocalVendor === true
);

module.exports = { STORE_VENDOR_TYPES, resolveVendorTypes, isStoreVendorType, LOCAL_VENDOR_TYPES, isLocalVendorStore };
