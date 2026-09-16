const admin = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');

// ── Helpers ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const buildMessage = (data, extraFCMOptions) => ({
  data: Object.fromEntries(
    Object.entries(data || {}).map(([k, v]) => [k, v !== undefined && v !== null ? String(v) : ''])
  ),
  android: {
    priority: 'high',
    notification: {
      sound: 'alert',
      channelId: 'delivery-alerts-v2',
    },
    ...(extraFCMOptions.android || {})
  },
  apns: {
    payload: {
      aps: {
        sound: 'alert.wav',
      },
      ...(extraFCMOptions.apns?.payload || {})
    },
    ...(extraFCMOptions.apns || {})
  },
  ...Object.fromEntries(Object.entries(extraFCMOptions).filter(([k]) => k !== 'android' && k !== 'apns'))
});

// ── Multicast Push ──────────────────────────────────────────────────────
const sendPushToTokens = async (tokens, title, body, data = {}, extraFCMOptions = {}) => {
  const apps = (admin.getApps ? admin.getApps() : admin.apps) || [];
  if (!apps.length) return console.log('[FCM_SEND] Firebase not initialized — skipping push');
  let tokenList = tokens;
  if (typeof tokens === 'string') {
    try {
      tokenList = JSON.parse(tokens);
    } catch {
      tokenList = [];
    }
  }
  if (!tokenList || !Array.isArray(tokenList) || tokenList.length === 0) return;

  const validTokens = tokenList.map(t => typeof t === 'string' ? t : t.token).filter(Boolean);
  if (validTokens.length === 0) return;

  const message = {
    notification: { title, body },
    tokens: validTokens,
    ...buildMessage(data, extraFCMOptions)
  };

  const attemptSend = async (attempt = 1) => {
    try {
      const response = await getMessaging().sendEachForMulticast(message);
      const successCount = response.successCount || 0;
      const failureCount = response.failureCount || 0;
      console.log(`[FCM_SEND] Multicast: ${successCount} sent, ${failureCount} failed (attempt ${attempt})`);

      // Clean up stale/invalid tokens
      if (response.responses) {
        const staleTokens = [];
        response.responses.forEach((resp, idx) => {
          if (resp.error) {
            const code = resp.error.code || '';
            if (code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token') {
              staleTokens.push(validTokens[idx]);
            }
          }
        });
        if (staleTokens.length > 0) {
          console.log(`[FCM_SEND] ${staleTokens.length} stale token(s) detected — should be pruned from user records`);
        }
      }

      return response;
    } catch (error) {
      const statusCode = error?.httpResponse?.status || error?.code || '';
      const isTransient = typeof statusCode === 'number'
        ? statusCode >= 500
        : String(statusCode).includes('unavailable') || String(statusCode).includes('internal');

      if (isTransient && attempt < 2) {
        console.warn(`[FCM_SEND] Transient error (${statusCode}), retrying in 2s...`);
        await sleep(2000);
        return attemptSend(attempt + 1);
      }
      console.error(`[FCM_SEND] Failed after ${attempt} attempt(s):`, error.message || error);
    }
  };

  await attemptSend();
};

// ── Topic Push ──────────────────────────────────────────────────────────
const sendPushToTopic = async (topic, title, body, data = {}, extraFCMOptions = {}) => {
  const apps = (admin.getApps ? admin.getApps() : admin.apps) || [];
  if (!apps.length) return console.log('[FCM_TOPIC] Firebase not initialized — skipping push');

  const message = {
    notification: { title, body },
    topic,
    ...buildMessage(data, extraFCMOptions)
  };

  const attemptSend = async (attempt = 1) => {
    try {
      const response = await getMessaging().send(message);
      console.log(`[FCM_TOPIC] Sent to "${topic}" (attempt ${attempt}):`, response);
      return response;
    } catch (error) {
      const statusCode = error?.httpResponse?.status || error?.code || '';
      const isTransient = typeof statusCode === 'number'
        ? statusCode >= 500
        : String(statusCode).includes('unavailable') || String(statusCode).includes('internal');

      if (isTransient && attempt < 2) {
        console.warn(`[FCM_TOPIC] Transient error (${statusCode}), retrying in 2s...`);
        await sleep(2000);
        return attemptSend(attempt + 1);
      }
      console.error(`[FCM_TOPIC] Failed to send to "${topic}" after ${attempt} attempt(s):`, error.message || error);
    }
  };

  await attemptSend();
};

module.exports = { sendPushToTokens, sendPushToTopic };
