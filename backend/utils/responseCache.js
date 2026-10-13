// Short-lived in-memory cache for hot PUBLIC GET endpoints (no per-user data).
//
// • cacheGet(group, { ttlMs }) → route middleware. On a miss the handler runs as usual; its 200
//   res.json body is serialised ONCE, hashed into a weak ETag and gzipped once, then kept for ttlMs.
//   Hits (and every later request) are served from those bytes: no DB, no JSON.stringify, no gzip.
// • Every response carries `Cache-Control: no-cache` + ETag, so clients revalidate and get a 304
//   (empty body) when nothing changed.
// • invalidate(group) drops a group at once. Store / product / config / vault / campus writes call it
//   (adminController.clearRestaurantsCache, utils/realtime.publish, vault claim). The TTL is only the
//   backstop for writes that do not announce themselves (open/closed by the clock, rating roll-ups).
//
// Only use on handlers that never read req.user / cookies / Authorization: the key is the URL alone.

const crypto = require('crypto');
const zlib = require('zlib');
const { URLSearchParams } = require('url');

const MAX_ENTRIES = 1000;
const GZIP_MIN_BYTES = 1024;

const store = new Map(); // key -> { body, gz, etag, at, ttl, gen }
const generations = new Map(); // group -> number (bumped by invalidate)

const genOf = (group) => generations.get(group) || 0;

const invalidate = (...groups) => {
  for (const group of groups) {
    generations.set(group, genOf(group) + 1);
    const prefix = `${group}|`;
    for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
  }
};

const invalidateAll = () => {
  for (const key of store.keys()) {
    const group = key.slice(0, key.indexOf('|'));
    generations.set(group, genOf(group) + 1);
  }
  store.clear();
};

// Path + query with parameters sorted, so ?a=1&b=2 and ?b=2&a=1 share an entry.
const canonicalUrl = (req) => {
  const url = req.originalUrl || req.url || '';
  const q = url.indexOf('?');
  const path = (q === -1 ? url : url.slice(0, q)).replace(/\/+$/, '') || '/';
  if (q === -1) return path;
  const params = new URLSearchParams(url.slice(q + 1));
  params.sort();
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

const buildEntry = (payload, ttl, gen) => {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json === undefined ? 'null' : json, 'utf8');
  const hash = crypto.createHash('sha1').update(body).digest('base64').slice(0, 27);
  const etag = `W/"${body.length.toString(16)}-${hash}"`;
  let gz = null;
  if (body.length >= GZIP_MIN_BYTES) {
    try { gz = zlib.gzipSync(body, { level: 6 }); } catch { gz = null; }
  }
  return { body, gz, etag, at: Date.now(), ttl, gen };
};

const put = (key, entry) => {
  if (store.has(key)) store.delete(key);
  else if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // oldest first
  store.set(key, entry);
};

const acceptsGzip = (req) => /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));

const sendEntry = (req, res, entry, status) => {
  res.status(200);
  res.set('Cache-Control', 'no-cache');
  res.set('ETag', entry.etag);
  res.set('X-Cache', status);
  res.vary('Accept-Encoding');
  if (req.fresh) {
    res.status(304);
    return res.end();
  }
  res.set('Content-Type', 'application/json; charset=utf-8');
  // Pre-compressed bytes: the compression middleware skips responses that already have a
  // Content-Encoding, so the gzip work happened once when the entry was built.
  if (entry.gz && acceptsGzip(req)) {
    res.set('Content-Encoding', 'gzip');
    res.set('Content-Length', String(entry.gz.length));
    return res.end(req.method === 'HEAD' ? undefined : entry.gz);
  }
  res.set('Content-Length', String(entry.body.length));
  return res.end(req.method === 'HEAD' ? undefined : entry.body);
};

const cacheGet = (group, { ttlMs = 30 * 1000, key } = {}) => (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const cacheKey = `${group}|${key ? key(req) : canonicalUrl(req)}`;
  const gen = genOf(group);
  const hit = store.get(cacheKey);
  if (hit && hit.gen === gen && Date.now() - hit.at < hit.ttl) return sendEntry(req, res, hit, 'HIT');
  if (hit) store.delete(cacheKey);

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    res.json = originalJson;
    const code = res.statusCode || 200;
    if (code !== 200) return originalJson(payload);
    let entry;
    try {
      entry = buildEntry(payload, ttlMs, gen);
    } catch {
      return originalJson(payload);
    }
    // A write that landed while this response was being built bumped the generation: serve this
    // response, but do not keep it.
    if (genOf(group) === gen) put(cacheKey, entry);
    return sendEntry(req, res, entry, 'MISS');
  };
  next();
};

const stats = () => ({ entries: store.size, groups: Object.fromEntries(generations) });

module.exports = { cacheGet, invalidate, invalidateAll, canonicalUrl, stats };
