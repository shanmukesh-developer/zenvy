/**
 * ICE servers for Spaces (plain WebRTC). Free public STUN always; TURN only when the owner sets env:
 *   TURN_URLS="turn:host:3478,turns:host:5349"  plus either
 *   TURN_USERNAME + TURN_CREDENTIAL               (static long-term credentials), or
 *   TURN_SECRET                                   (TURN REST API: credential valid TURN_TTL_SEC, default 1 h)
 * REST credentials: username = "<unix expiry>:<userId>", credential = base64(HMAC-SHA1(secret, username)).
 * Minted per join on the server; nothing is shipped in the app bundle.
 */
const crypto = require('crypto');

const PUBLIC_STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

const turnUrls = () => String(process.env.TURN_URLS || '')
  .split(',').map((s) => s.trim()).filter((s) => /^turns?:[^\s]+$/i.test(s));

const iceServersFor = (userId, now = Date.now()) => {
  const servers = [{ urls: PUBLIC_STUN }];
  const urls = turnUrls();
  if (!urls.length) return { iceServers: servers, turn: false };
  const sharedSecret = String(process.env.TURN_SECRET || '').trim();
  if (sharedSecret) {
    const ttl = Math.min(Math.max(parseInt(process.env.TURN_TTL_SEC, 10) || 3600, 300), 86400);
    const username = `${Math.floor(now / 1000) + ttl}:${userId}`;
    const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64');
    servers.push({ urls, username, credential });
    return { iceServers: servers, turn: true, expiresAt: new Date(now + ttl * 1000).toISOString() };
  }
  const username = String(process.env.TURN_USERNAME || '').trim();
  const credential = String(process.env.TURN_CREDENTIAL || '').trim();
  if (username && credential) {
    servers.push({ urls, username, credential });
    return { iceServers: servers, turn: true };
  }
  return { iceServers: servers, turn: false };
};

module.exports = { iceServersFor, PUBLIC_STUN };
