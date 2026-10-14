// One rule for "rider-purchase" (buy-at-store) shops, used by pricing (COD only), order creation
// (orders skip store acceptance and go straight to riders) and the rider app payload (buyAtStore).
//
// A store is rider-purchase when it is marked offline (no phone at the shop) OR it has no partner
// login (no password, so nobody can tap Accept). Callers must load BOTH `isOffline` and `password`
// (a full row, or attributes including them). A row loaded without `password` cannot be judged on it:
// that is logged once per call site and only `isOffline` is used.
const warned = new Set();

const readField = (store, key) => {
  if (!store) return undefined;
  if (typeof store.get === 'function') return store.get(key);
  return store[key];
};

const isRiderPurchaseStore = (store, where = 'unknown') => {
  if (!store) return false;
  if (readField(store, 'isOffline')) return true;
  const password = readField(store, 'password');
  if (password === undefined) {
    if (!warned.has(where)) {
      warned.add(where);
      console.warn(`[RIDER_PURCHASE_WARN] ${where}: store loaded without "password"; buy-at-store judged on isOffline only.`);
    }
    return false;
  }
  return !password;
};

// Attributes every query feeding isRiderPurchaseStore must include.
const RIDER_PURCHASE_ATTRIBUTES = ['isOffline', 'password'];

module.exports = { isRiderPurchaseStore, RIDER_PURCHASE_ATTRIBUTES };
