/**
 * Anonymous aliases for Pulse and Forum: one alias per (thread, user), stable inside a thread and
 * different across threads. alias = words[HMAC(secret, threadKey|userId|salt)], where the secret is
 * FRIENDS_ALIAS_SECRET (or a value derived from JWT_SECRET). Without the secret an alias cannot be
 * linked to a user id. Stored in FriendsAlias so it never changes for a thread, even if the secret does.
 * Nothing here is ever serialized except the alias string itself.
 */
const crypto = require('crypto');
const { getModel } = require('../index');
const { isUniqueError } = require('./http');

const ADJECTIVES = [
  'Amber', 'Azure', 'Bold', 'Brisk', 'Calm', 'Clever', 'Cosmic', 'Crimson', 'Curious', 'Dapper', 'Dreamy', 'Eager',
  'Electric', 'Fearless', 'Fuzzy', 'Gentle', 'Golden', 'Happy', 'Hidden', 'Jolly', 'Kind', 'Lively', 'Lucky', 'Lunar',
  'Mellow', 'Merry', 'Misty', 'Mystic', 'Neon', 'Nimble', 'Noble', 'Olive', 'Peppy', 'Plucky', 'Polar', 'Quiet',
  'Quirky', 'Rapid', 'Rosy', 'Rustic', 'Sage', 'Scarlet', 'Silent', 'Silver', 'Sleepy', 'Snowy', 'Solar', 'Sparky',
  'Spicy', 'Steady', 'Stormy', 'Sunny', 'Swift', 'Teal', 'Tidy', 'Tiny', 'Velvet', 'Vivid', 'Wandering', 'Witty',
  'Zesty', 'Zippy', 'Breezy', 'Chill',
];
const NOUNS = [
  'Otter', 'Falcon', 'Panda', 'Tiger', 'Koala', 'Lynx', 'Heron', 'Gecko', 'Mango', 'Comet', 'Maple', 'Pebble',
  'Badger', 'Dolphin', 'Fox', 'Hawk', 'Ibis', 'Jaguar', 'Kiwi', 'Lemur', 'Moose', 'Narwhal', 'Owl', 'Parrot',
  'Quokka', 'Raven', 'Seal', 'Toucan', 'Walrus', 'Yak', 'Zebra', 'Bison', 'Crane', 'Dingo', 'Egret', 'Ferret',
  'Gazelle', 'Hedgehog', 'Iguana', 'Jackal', 'Kestrel', 'Llama', 'Marmot', 'Nightjar', 'Ocelot', 'Puffin', 'Robin',
  'Sparrow', 'Tapir', 'Urchin', 'Vulture', 'Wombat', 'Coyote', 'Beetle', 'Cobra', 'Mantis', 'Orca', 'Pelican',
  'Squirrel', 'Turtle', 'Peacock', 'Mongoose', 'Cheetah', 'Kingfisher',
];

let derivedSecret = null;
const secret = () => {
  const own = String(process.env.FRIENDS_ALIAS_SECRET || '').trim();
  if (own) return own;
  if (!derivedSecret) {
    const base = String(process.env.JWT_SECRET || '');
    derivedSecret = crypto.createHmac('sha256', base || 'zenvy-friends-alias').update('friends-alias-v1').digest('hex');
  }
  return derivedSecret;
};

const THREAD_KEY_RE = /^(pulse|forum|space|task):[0-9a-f-]{36}$/i;

/** Deterministic alias for (threadKey, userId, salt). Pure; used by getAlias and tests. */
const computeAlias = (threadKey, userId, salt = 0) => {
  const h = crypto.createHmac('sha256', secret()).update(`${threadKey}|${userId}|${salt}`).digest();
  const adj = ADJECTIVES[h.readUInt16BE(0) % ADJECTIVES.length];
  const noun = NOUNS[h.readUInt16BE(2) % NOUNS.length];
  // Salted retries add a number so a collision can always be resolved.
  return salt === 0 ? `${adj} ${noun}` : `${adj} ${noun} ${(h.readUInt16BE(4) % 90) + 10}`;
};

/**
 * Alias for this user in this thread, creating it on first use. Collisions inside a thread retry with
 * a salt (fal_alias_uq); a concurrent first post by the same user returns the row that won.
 */
const getAlias = async (threadKey, userId, { transaction } = {}) => {
  if (!THREAD_KEY_RE.test(String(threadKey || ''))) throw new Error('bad thread key');
  const FriendsAlias = getModel('FriendsAlias');
  const existing = await FriendsAlias.findOne({ where: { threadKey, userId }, transaction });
  if (existing) return existing.alias;
  for (let salt = 0; salt < 12; salt++) {
    const alias = computeAlias(threadKey, userId, salt);
    try {
      // Savepoint-free: on Postgres a failed insert would abort an outer transaction, so check first.
      const taken = await FriendsAlias.findOne({ where: { threadKey, alias }, attributes: ['userId'], transaction });
      if (taken) {
        if (taken.userId === userId) return alias;
        continue;
      }
      const row = await FriendsAlias.create({ threadKey, userId, alias }, { transaction });
      return row.alias;
    } catch (err) {
      if (!isUniqueError(err) || transaction) throw err;
      const mine = await FriendsAlias.findOne({ where: { threadKey, userId } });
      if (mine) return mine.alias;
    }
  }
  throw new Error('alias space exhausted');
};

module.exports = { computeAlias, getAlias, THREAD_KEY_RE };
