/**
 * The ISNet cut-out model file (owner approved its look, 24 Nov 2026). It is ~179 MB, too big for git, so the server
 * downloads it once, on first need, from the rembg project's GitHub release into assets/ml (temp file + rename, size
 * checked), and utils/cutout uses the small u2netp (in the repo) until it is there.
 *
 *   CUTOUT_MODEL_PATH        where the ISNet file is / goes (default assets/ml/isnet-general-use.onnx)
 *   CUTOUT_MODEL_URL         download address (default the rembg v0.0.0 release asset)
 *   CUTOUT_MODEL_DOWNLOAD    'off' = never download (u2netp unless the file is already there)
 *
 * Never downloads under NODE_ENV=test. A failed download is retried at most once an hour. Never throws.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'assets', 'ml', 'isnet-general-use.onnx');
const DEFAULT_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx';
const MIN_BYTES = 100 * 1024 * 1024; // the real file is ~179 MB; anything smaller is an error page or a cut-off download
const TIMEOUT_MS = 15 * 60 * 1000;
const RETRY_AFTER_MS = 60 * 60 * 1000;

const isnetPath = () => process.env.CUTOUT_MODEL_PATH || DEFAULT_PATH;

/** True when a usable ISNet file is on disk. */
const isnetReady = () => {
  try { return fs.statSync(isnetPath()).size > MIN_BYTES; } catch { return false; }
};

const downloadAllowed = () => process.env.NODE_ENV !== 'test' && String(process.env.CUTOUT_MODEL_DOWNLOAD || '').toLowerCase() !== 'off';

let inFlight = null;
let lastFailAt = 0;
let lastError = null;

const download = async () => {
  const target = isnetPath();
  const tmp = `${target}.${process.pid}.download`;
  const started = Date.now();
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    console.log(`[CUTOUT_MODEL] downloading ISNet to ${target} ...`);
    const res = await fetch(process.env.CUTOUT_MODEL_URL || DEFAULT_URL, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'ZenWe-cutout-model/1.0' } });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const { Readable } = require('stream');
    const { pipeline } = require('stream/promises');
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    const size = fs.statSync(tmp).size;
    if (size < MIN_BYTES) throw new Error(`file too small (${size} bytes)`);
    fs.renameSync(tmp, target);
    lastError = null;
    console.log(`[CUTOUT_MODEL] ISNet ready (${Math.round(size / 1e6)} MB in ${Math.round((Date.now() - started) / 1000)} s)`);
    return true;
  } catch (err) {
    lastFailAt = Date.now();
    lastError = String(err && err.message || err).slice(0, 200);
    console.warn('[CUTOUT_MODEL_WARN] ISNet download failed; using u2netp for now:', lastError);
    try { fs.unlinkSync(tmp); } catch { /* not there */ }
    return false;
  } finally {
    inFlight = null;
  }
};

/**
 * Starts the download when the file is missing (once; never twice at the same time). Resolves at once.
 * Returns 'ready' | 'downloading' | 'unavailable' (not allowed here, or the last try failed under an hour ago).
 */
const ensureIsnet = () => {
  if (isnetReady()) return 'ready';
  if (inFlight) return 'downloading';
  if (!downloadAllowed() || (lastFailAt && Date.now() - lastFailAt < RETRY_AFTER_MS)) return 'unavailable';
  inFlight = download();
  return 'downloading';
};

/** For the admin page / logs. */
const modelStatus = () => ({ isnet: isnetReady() ? 'ready' : inFlight ? 'downloading' : 'missing', lastError });

/** Tests: wait for a running download. */
const _waitForDownload = () => inFlight || Promise.resolve(isnetReady());

module.exports = { ensureIsnet, isnetReady, isnetPath, modelStatus, _waitForDownload, MIN_BYTES, DEFAULT_URL };
