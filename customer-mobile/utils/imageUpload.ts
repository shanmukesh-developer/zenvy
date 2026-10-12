/**
 * One image pipeline for the student / friends / community section.
 *
 *   pick (expo-image-picker)  ->  compress (expo-image-manipulator, long edge <= 1280 px, JPEG 0.7)
 *   ->  upload multipart { uri, name, type } to POST /api/campus/media  ->  short URL
 *
 * Never sends base64 over a socket and never puts a Blob in React Native FormData
 * (RN cannot serialise Blob parts). On web the compressed photo is sent as JSON base64,
 * which the same endpoint accepts.
 */
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { API_URL } from '../constants/api';
import { getToken } from './auth';

export type MediaPurpose = 'id_card' | 'chat' | 'lost_found' | 'avatar' | 'post' | 'other';

export interface UploadedImage {
  /** Short relative path, e.g. /api/campus/media/<id>. Store this for campus features. */
  url: string;
  /** Absolute https URL. Use for features that only accept http(s) links (posts, wall, birthdays, profile). */
  absoluteUrl: string;
  /** Local compressed file, handy for an instant preview. */
  localUri: string;
}

export interface PickOptions {
  source?: 'library' | 'camera';
  /** Let the user crop before upload. */
  allowsEditing?: boolean;
  aspect?: [number, number];
  /** Long edge in px after compression. ID cards use 1600 so the text stays readable. */
  maxEdge?: number;
  quality?: number;
}

const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_QUALITY = 0.7;
const UPLOAD_TIMEOUT_MS = 60000;

export class ImageUploadError extends Error {
  code: string;
  retryable: boolean;
  constructor(message: string, code = 'UPLOAD_FAILED', retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

/** Relative /api/... media paths must be prefixed with the API host before <Image> can load them. */
export const resolveMediaUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (/^(https?:|data:|file:|content:|blob:|ph:|assets-library:)/i.test(u)) return u;
  if (u.startsWith('/')) return `${API_URL}${u}`;
  return null;
};

/** Ask for the right permission and open the gallery or camera. Returns null when cancelled or denied. */
export const pickImageAsset = async (opts: PickOptions = {}): Promise<ImagePicker.ImagePickerAsset | null> => {
  const source = opts.source || 'library';
  try {
    if (Platform.OS !== 'web') {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          source === 'camera' ? 'Camera access needed' : 'Photo access needed',
          source === 'camera'
            ? 'Allow camera access in your phone settings to take a photo.'
            : 'Allow photo access in your phone settings to choose a picture.'
        );
        return null;
      }
    }
    const pickerOpts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: !!opts.allowsEditing,
      aspect: opts.aspect,
      // Full quality here: the manipulator does the real compression in one pass.
      quality: 1,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOpts)
        : await ImagePicker.launchImageLibraryAsync(pickerOpts);
    if (result.canceled || !result.assets || !result.assets[0]) return null;
    return result.assets[0];
  } catch {
    Alert.alert(
      source === 'camera' ? "Couldn't open the camera" : "Couldn't open your photos",
      'Please try again.'
    );
    return null;
  }
};

/** Resize to a long edge of maxEdge px and re-encode as JPEG. Falls back to the original on failure. */
export const compressImage = async (
  uri: string,
  opts: { width?: number; height?: number; maxEdge?: number; quality?: number } = {}
): Promise<{ uri: string; base64?: string }> => {
  const maxEdge = opts.maxEdge || DEFAULT_MAX_EDGE;
  const wantBase64 = Platform.OS === 'web';
  try {
    let width = opts.width || 0;
    let height = opts.height || 0;
    let ctx = ImageManipulator.manipulate(uri);
    if (!width || !height) {
      const probe = await ctx.renderAsync();
      width = probe.width;
      height = probe.height;
      ctx = ImageManipulator.manipulate(probe);
    }
    if (Math.max(width, height) > maxEdge) {
      ctx = width >= height ? ctx.resize({ width: maxEdge }) : ctx.resize({ height: maxEdge });
    }
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({
      compress: opts.quality ?? DEFAULT_QUALITY,
      format: SaveFormat.JPEG,
      base64: wantBase64,
    });
    return { uri: out.uri, base64: out.base64 };
  } catch {
    return { uri };
  }
};

const friendlyStatusMessage = (status: number, json: any): ImageUploadError => {
  const code = String(json?.code || '');
  if (status === 401) return new ImageUploadError('Please sign in again to upload photos.', 'AUTH', false);
  if (status === 413 || code === 'FILE_TOO_LARGE') {
    return new ImageUploadError('That photo is too large. Please choose a smaller one.', 'FILE_TOO_LARGE', false);
  }
  if (status === 415 || code === 'UNSUPPORTED_TYPE') {
    return new ImageUploadError('Please choose a JPG, PNG or WEBP photo.', 'UNSUPPORTED_TYPE', false);
  }
  if (status === 429) {
    return new ImageUploadError('You have uploaded a lot of photos. Please wait a little and try again.', 'RATE_LIMIT');
  }
  if (status >= 502 && status <= 504) {
    return new ImageUploadError('Zenvy is waking up. Please try again in a few seconds.', 'SERVER_BUSY');
  }
  const msg = typeof json?.message === 'string' && json.message.length < 160 ? json.message : '';
  return new ImageUploadError(msg || "Couldn't upload the photo. Please try again.", code || 'UPLOAD_FAILED');
};

/** Upload an already-compressed local image to /api/campus/media. */
export const uploadImageFile = async (
  file: { uri: string; base64?: string },
  purpose: MediaPurpose = 'other'
): Promise<UploadedImage> => {
  const token = await getToken();
  if (!token) throw new ImageUploadError('Please sign in to upload photos.', 'AUTH', false);

  let body: any;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (Platform.OS === 'web' || /^data:/i.test(file.uri)) {
    const dataUrl = /^data:/i.test(file.uri)
      ? file.uri
      : file.base64
      ? `data:image/jpeg;base64,${file.base64}`
      : null;
    if (!dataUrl) throw new ImageUploadError("Couldn't read that photo. Please pick another one.", 'READ_FAILED', false);
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ image: dataUrl, purpose });
  } else {
    const form = new FormData();
    form.append('image', { uri: file.uri, name: `${purpose}-${Date.now()}.jpg`, type: 'image/jpeg' } as any);
    form.append('purpose', purpose);
    body = form;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/campus/media`, { method: 'POST', headers, body, signal: controller.signal });
  } catch {
    throw new ImageUploadError("Couldn't upload. Check your internet and try again.", 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
  const json: any = await res.json().catch(() => null);
  if (!res.ok) throw friendlyStatusMessage(res.status, json);
  const url: string = json?.url || '';
  if (!url) throw new ImageUploadError("Couldn't upload the photo. Please try again.");
  // Build the absolute link from the API host this app talks to (always https in production).
  const absoluteUrl: string = (url.startsWith('/') ? resolveMediaUrl(url) : null) || json.absoluteUrl || json.imageUrl || url;
  return { url, absoluteUrl, localUri: file.uri };
};

/** Compress + upload a local image (for example one picked earlier for a preview). */
export const prepareAndUploadImage = async (
  asset: { uri: string; width?: number; height?: number },
  purpose: MediaPurpose = 'other',
  opts: { maxEdge?: number; quality?: number } = {}
): Promise<UploadedImage> => {
  const compressed = await compressImage(asset.uri, {
    width: asset.width,
    height: asset.height,
    maxEdge: opts.maxEdge,
    quality: opts.quality,
  });
  return uploadImageFile(compressed, purpose);
};

/**
 * Pick -> compress -> upload in one call. Returns null if the user cancelled.
 * Throws ImageUploadError with a friendly message on failure.
 */
export const pickAndUploadImage = async (
  purpose: MediaPurpose,
  opts: PickOptions = {}
): Promise<UploadedImage | null> => {
  const asset = await pickImageAsset(opts);
  if (!asset) return null;
  return prepareAndUploadImage(asset, purpose, { maxEdge: opts.maxEdge, quality: opts.quality });
};

/** Standard error alert with a Retry button (only when retrying can help). */
export const alertUploadError = (err: any, retry?: () => void, title = "Photo didn't upload") => {
  const message =
    err instanceof ImageUploadError || (err && typeof err.message === 'string' && err.message.length < 160)
      ? err.message
      : "Couldn't upload the photo. Please try again.";
  const canRetry = !!retry && !(err instanceof ImageUploadError && !err.retryable);
  Alert.alert(title, message, canRetry ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Retry', onPress: retry }] : undefined);
};
