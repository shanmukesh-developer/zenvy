const { Sequelize } = require('sequelize');
const path = require('path');
const crypto = require('crypto');

const seq = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'local_dev.sqlite'),
  logging: false,
});

async function seed() {
  console.log('--- SEEDING REAL FRIENDSHIPS & CONVERSATIONS ---');

  // 1. Get or create real campus users
  const [users] = await seq.query('SELECT id, name, phone FROM Users');
  console.log('Existing users count:', users.length);

  const shanmukh = users.find(u => u.phone === '1276981697' || u.name?.toLowerCase().includes('shanmukesh'));
  if (!shanmukh) {
    console.error('Shanmukh user not found in Users table!');
    return;
  }
  const myId = shanmukh.id;
  console.log('Shanmukh ID:', myId);

  // Candidate friends from existing users
  const candidates = users.filter(u => u.id !== myId && !u.name?.toLowerCase().includes('simuser') && !u.name?.toLowerCase().includes('rider'));
  console.log(`Found ${candidates.length} candidate friends to link.`);

  for (let i = 0; i < candidates.length; i++) {
    const friend = candidates[i];
    const friendId = friend.id;

    // Check if friendship already exists
    const [existingFs] = await seq.query(
      `SELECT * FROM Friendships WHERE (requesterId = '${myId}' AND recipientId = '${friendId}') OR (requesterId = '${friendId}' AND recipientId = '${myId}')`
    );

    let fsId;
    const streak = 3 + (i * 4) + Math.floor(Math.random() * 5);
    const now = new Date();
    const lastInteraction = new Date(Date.now() - (i * 3600000 * 4)).toISOString();

    if (existingFs.length === 0) {
      fsId = crypto.randomUUID();
      await seq.query(
        `INSERT INTO Friendships (id, requesterId, recipientId, status, streakCount, lastInteractionAt, theme, nickname, createdAt, updatedAt)
         VALUES ('${fsId}', '${myId}', '${friendId}', 'accepted', ${streak}, '${lastInteraction}', 'friendship', NULL, '${now.toISOString()}', '${now.toISOString()}')`
      );
      console.log(`+ Created Friendship with ${friend.name} (streak: ${streak})`);
    } else {
      fsId = existingFs[0].id;
      await seq.query(
        `UPDATE Friendships SET status = 'accepted', streakCount = ${streak}, lastInteractionAt = '${lastInteraction}' WHERE id = '${fsId}'`
      );
      console.log(`~ Updated Friendship with ${friend.name}`);
    }

    // Ensure Conversation exists
    const p1 = JSON.stringify([myId, friendId]);
    const p2 = JSON.stringify([friendId, myId]);
    const [existingConv] = await seq.query(
      `SELECT * FROM Conversations WHERE (isGroup = 0 AND (participants = '${p1}' OR participants = '${p2}'))`
    );

    let convId;
    if (existingConv.length === 0) {
      convId = crypto.randomUUID();
      await seq.query(
        `INSERT INTO Conversations (id, isGroup, name, participants, lastMessageAt, callActive, callParticipantCount, createdAt, updatedAt)
         VALUES ('${convId}', 0, NULL, '${p1}', '${now.toISOString()}', 0, 0, '${now.toISOString()}', '${now.toISOString()}')`
      );
      console.log(`+ Created Conversation with ${friend.name}`);
    } else {
      convId = existingConv[0].id;
    }

    // Ensure at least 2 real messages exist
    const [msgs] = await seq.query(`SELECT id FROM Messages WHERE conversationId = '${convId}'`);
    if (msgs.length === 0) {
      const msg1Id = crypto.randomUUID();
      const msg2Id = crypto.randomUUID();
      const t1 = new Date(Date.now() - 3600000 * 2).toISOString();
      const t2 = new Date(Date.now() - 3600000 * 1).toISOString();

      await seq.query(
        `INSERT INTO Messages (id, conversationId, senderId, senderName, text, isSystemMessage, createdAt, updatedAt)
         VALUES ('${msg1Id}', '${convId}', '${friendId}', '${friend.name}', 'Hey Shanmukh! Ready for canteen snacks later? 🍕', 0, '${t1}', '${t1}'),
                ('${msg2Id}', '${convId}', '${myId}', '${shanmukh.name}', 'Hey! Yes absolutely, let us meet after class! ⚡', 0, '${t2}', '${t2}')`
      );
      console.log(`+ Seeded real conversation messages with ${friend.name}`);
    }
  }

  console.log('✅ Real friendships and conversations successfully seeded!');
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
