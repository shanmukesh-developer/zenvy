// Push-token hygiene shared by every "save my device token" endpoint.
// FCM registration tokens and Expo push tokens ("ExponentPushToken[...]") only use these
// characters. Rejecting anything else keeps LIKE wildcards ('%') and huge blobs out of the
// DB and out of the "detach this device from other accounts" LIKE lookups.
const FCM_TOKEN_RE = /^[A-Za-z0-9:_\-.[\]]{20,4096}$/;

const cleanFcmToken = (value) => {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return FCM_TOKEN_RE.test(t) ? t : null;
};

// Pattern for "row's JSON token list contains exactly this token". '%' can never appear in a
// validated token; '_' (a single-char wildcard) only widens the candidate set, and callers
// re-filter rows by exact equality before writing.
const tokenLikePattern = (token) => `%"${token}"%`;

const cleanAppVersion = (v) => (typeof v === 'string' ? v.slice(0, 40) : null);
const cleanPlatform = (v) => (typeof v === 'string' && /^(ios|android|web)$/i.test(v) ? v.toLowerCase() : null);

module.exports = { cleanFcmToken, tokenLikePattern, cleanAppVersion, cleanPlatform, FCM_TOKEN_RE };
