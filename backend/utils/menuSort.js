// Menu order set by the admin / partner (MenuItem.specs.sortOrder: 10, 20, …).
// Items are grouped by category; categories follow their lowest item sortOrder; inside a category
// items follow sortOrder, then name. Items without a sortOrder go last (then alphabetical).
// Works on model rows or plain objects; returns a new array.

const readSpecs = (item) => {
  let specs = item && (typeof item.get === 'function' ? item.get('specs') : item.specs);
  if (typeof specs === 'string') { try { specs = JSON.parse(specs); } catch { specs = null; } }
  return specs && typeof specs === 'object' ? specs : {};
};

const sortOrderOf = (item) => {
  const n = Number(readSpecs(item).sortOrder);
  return Number.isFinite(n) ? n : Infinity;
};

const field = (item, key) => (item && (typeof item.get === 'function' ? item.get(key) : item[key]));

const sortMenuItems = (items) => {
  const list = Array.isArray(items) ? items.slice() : [];
  const catRank = new Map();
  for (const it of list) {
    const cat = String(field(it, 'category') || '');
    const so = sortOrderOf(it);
    if (!catRank.has(cat) || so < catRank.get(cat)) catRank.set(cat, so);
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return list.sort((a, b) => {
    const ca = String(field(a, 'category') || '');
    const cb = String(field(b, 'category') || '');
    if (ca !== cb) {
      const ra = catRank.get(ca);
      const rb = catRank.get(cb);
      if (ra !== rb) return ra === Infinity ? 1 : rb === Infinity ? -1 : ra - rb;
      return cmp(ca.toLowerCase(), cb.toLowerCase());
    }
    const sa = sortOrderOf(a);
    const sb = sortOrderOf(b);
    if (sa !== sb) return sa === Infinity ? 1 : sb === Infinity ? -1 : sa - sb;
    return cmp(String(field(a, 'name') || '').toLowerCase(), String(field(b, 'name') || '').toLowerCase());
  });
};

module.exports = { sortMenuItems, sortOrderOf };
