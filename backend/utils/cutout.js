/**
 * Dish photo cut-outs (owner, 24 Nov 2026: the Home slideshow dishes should float "like the basket in Groceries").
 * Removes a photo's background on this server with the small open-source U²-Net (u2netp, Apache-2.0, from the rembg
 * project; assets/ml/u2netp.onnx) through onnxruntime-node, and returns a transparent WebP of the dish cropped to its
 * edges. Nothing leaves the server. Never throws: null when it cannot make a usable cut-out (the app keeps the round
 * photo then).
 */
const path = require('path');

// Two models (both open source, from the rembg project): the small u2netp (4.6 MB, in the repo) and the more accurate
// ISNet general-use (~179 MB, too big for git: utils/cutoutModel downloads it once to assets/ml, or CUTOUT_MODEL_PATH
// points at it). ISNet is used as soon as its file is there, else u2netp. Checked on every call, so the worker
// switches to ISNet the moment the download finishes.
const MODELS = {
  isnet: { size: 1024, mean: [0.5, 0.5, 0.5], std: [1, 1, 1] },
  u2netp: { size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
};
const U2NETP_PATH = path.join(__dirname, '..', 'assets', 'ml', 'u2netp.onnx');
const pickModel = () => {
  const cm = require('./cutoutModel');
  if (cm.isnetReady()) return { name: 'isnet', path: cm.isnetPath(), ...MODELS.isnet };
  return { name: 'u2netp', path: U2NETP_PATH, ...MODELS.u2netp };
};
const MAX_SIDE = 800; // output size cap (the slideshow shows it at ~170 pt)
// Mask cut-off: below LOW is background (fully transparent), above HIGH is the dish; a narrow soft edge between.
const LOW = 0.35;
const HIGH = 0.75;

// One loaded model at a time (ISNet holds ~1 GB while it runs): switching models drops the old session.
let loaded = { path: null, promise: null };
const session = (model) => {
  if (loaded.path !== model.path || !loaded.promise) {
    const ort = require('onnxruntime-node');
    const prev = loaded.promise;
    if (prev) prev.then((s) => s.release && s.release()).catch(() => {});
    const promise = ort.InferenceSession.create(model.path, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' })
      .catch((err) => { if (loaded.promise === promise) loaded = { path: null, promise: null }; throw err; });
    loaded = { path: model.path, promise };
  }
  return loaded.promise;
};

/** Model input (1x3x320x320, normalised like rembg) from any image buffer. */
const toTensor = async (sharp, input, { size: SIZE, mean: MEAN, std: STD }) => {
  const { data } = await sharp(input).removeAlpha().resize(SIZE, SIZE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let max = 1e-6;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  const out = new Float32Array(3 * SIZE * SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) {
    for (let c = 0; c < 3; c++) out[c * SIZE * SIZE + p] = (data[p * 3 + c] / max - MEAN[c]) / STD[c];
  }
  return out;
};

/**
 * Buffer (JPEG / PNG / WebP) -> { buffer: WebP with transparency, width, height, coverage } or null.
 * coverage = share of the picture kept as the dish (a cut-out that kept almost nothing or almost everything failed).
 */
const makeCutout = async (input) => {
  try {
    const sharp = require('sharp');
    const ort = require('onnxruntime-node');
    const model = pickModel();
    const SIZE = model.size;
    const s = await session(model);
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return null;
    const feeds = { [s.inputNames[0]]: new ort.Tensor('float32', await toTensor(sharp, input, model), [1, 3, SIZE, SIZE]) };
    const result = await s.run(feeds);
    const pred = result[s.outputNames[0]].data; // 1x1x320x320
    let lo = Infinity; let hi = -Infinity;
    for (let i = 0; i < pred.length; i++) { if (pred[i] < lo) lo = pred[i]; if (pred[i] > hi) hi = pred[i]; }
    const range = hi - lo || 1;
    const mask = Buffer.alloc(SIZE * SIZE);
    let kept = 0;
    for (let i = 0; i < pred.length; i++) {
      // Soft edges, but a clean background: weak predictions become fully transparent.
      const v = (pred[i] - lo) / range;
      const a = v < LOW ? 0 : v > HIGH ? 255 : Math.round(((v - LOW) / (HIGH - LOW)) * 255);
      mask[i] = a;
      if (a > 128) kept++;
    }
    const coverage = kept / (SIZE * SIZE);
    if (coverage < 0.04 || coverage > 0.97) return null;
    const w = meta.width; const h = meta.height;
    const alpha = await sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } }).resize(w, h, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer();
    // RGBA built by hand (sharp's joinChannel with a raw buffer silently dropped the mask here).
    const rgb = await sharp(input).rotate().removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer();
    const px = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = rgb[i * 3]; px[i * 4 + 1] = rgb[i * 3 + 1]; px[i * 4 + 2] = rgb[i * 3 + 2]; px[i * 4 + 3] = alpha[i];
    }
    const rgba = await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    // Crop to the dish (transparent edges trimmed), small margin, capped size.
    const trimmed = await sharp(rgba).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const pad = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 0.03);
    const out = await sharp(trimmed.data)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: out.data, width: out.info.width, height: out.info.height, coverage, model: model.name };
  } catch (err) {
    console.warn('[CUTOUT_WARN]', err && err.message);
    return null;
  }
};

/** Name of the model the next cut-out uses ('isnet' | 'u2netp'). */
const modelName = () => pickModel().name;

module.exports = { makeCutout, modelName };
