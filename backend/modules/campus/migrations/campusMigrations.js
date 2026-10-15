/**
 * Campus Buddy Self-Healing Database Migrations
 * Ensures all required columns exist across SQLite and PostgreSQL
 */
const runCampusMigrations = async (sequelize) => {
  if (!sequelize) return;
  const dialect = sequelize.getDialect();
  // The column types below are written for SQLite; Postgres needs its own spelling.
  const pgType = (t) => (dialect === 'sqlite' ? t : t.replace(/\bDATETIME\b/g, 'TIMESTAMP WITH TIME ZONE').replace(/BOOLEAN DEFAULT 0\b/g, 'BOOLEAN DEFAULT false'));

  const conversationCols = [
    { name: 'type', type: "VARCHAR(20) DEFAULT 'dm'" },
    { name: 'groupAvatar', type: "VARCHAR(255)" },
    { name: 'description', type: "TEXT" },
    { name: 'joinCode', type: "VARCHAR(10)" },
    { name: 'adminIds', type: "TEXT DEFAULT '[]'" },
    { name: 'pinnedMessageIds', type: "TEXT DEFAULT '[]'" },
    { name: 'onlyAdminsCanSend', type: "BOOLEAN DEFAULT 0" },
    // Zenvy Friends linked chats (task / connect) and closing.
    { name: 'refType', type: "VARCHAR(16)" },
    { name: 'refId', type: "UUID" },
    { name: 'closedAt', type: "DATETIME" },
  ];

  for (const col of conversationCols) {
    try {
      if (dialect === 'sqlite') {
        await sequelize.query(`ALTER TABLE "Conversations" ADD COLUMN "${col.name}" ${col.type};`);
      } else {
        await sequelize.query(`ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "${col.name}" ${pgType(col.type)};`);
      }
      console.log(`✅ [CAMPUS_MIGRATION] Added ${col.name} to Conversations.`);
    } catch (_err) {
      // Column already exists
    }
  }

  const messageCols = [
    { name: 'clientMsgId', type: "VARCHAR(255)" },
    { name: 'type', type: "VARCHAR(20) DEFAULT 'text'" },
    { name: 'mediaUrl', type: "TEXT" },
    { name: 'mediaMetadata', type: "TEXT DEFAULT '{}'" },
    { name: 'readBy', type: "TEXT DEFAULT '[]'" },
    { name: 'deliveredTo', type: "TEXT DEFAULT '[]'" },
    { name: 'isEdited', type: "BOOLEAN DEFAULT 0" },
    { name: 'editedAt', type: "DATETIME" },
    { name: 'isDeletedForEveryone', type: "BOOLEAN DEFAULT 0" },
    { name: 'isPinned', type: "BOOLEAN DEFAULT 0" },
  ];

  for (const col of messageCols) {
    try {
      if (dialect === 'sqlite') {
        await sequelize.query(`ALTER TABLE "Messages" ADD COLUMN "${col.name}" ${col.type};`);
      } else {
        await sequelize.query(`ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "${col.name}" ${pgType(col.type)};`);
      }
      console.log(`✅ [CAMPUS_MIGRATION] Added ${col.name} to Messages.`);
    } catch (_err) {
      // Column already exists
    }
  }

  // Campus spots (proximity_rooms) are admin-managed: emoji + sort order, and coordinates optional.
  for (const col of [{ name: 'emoji', type: 'VARCHAR(16)' }, { name: 'sortOrder', type: 'INTEGER DEFAULT 0' }]) {
    try {
      if (dialect === 'sqlite') {
        await sequelize.query(`ALTER TABLE "proximity_rooms" ADD COLUMN "${col.name}" ${col.type};`);
      } else {
        await sequelize.query(`ALTER TABLE "proximity_rooms" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};`);
      }
    } catch (_err) {
      // Column already exists
    }
  }
  if (dialect === 'sqlite') {
    // Local dev only: SQLite cannot drop NOT NULL in place; Sequelize rebuilds this small table.
    try {
      const qi = sequelize.getQueryInterface();
      const desc = await qi.describeTable('proximity_rooms');
      for (const col of ['latitude', 'longitude']) {
        if (desc[col] && desc[col].allowNull === false) {
          await qi.changeColumn('proximity_rooms', col, { type: require('sequelize').DataTypes.DOUBLE, allowNull: true });
        }
      }
    } catch (err) {
      console.warn('⚠️ [CAMPUS_MIGRATION_WARN] proximity_rooms coordinates nullable (sqlite):', err.message);
    }
  } else {
    for (const col of ['latitude', 'longitude']) {
      try {
        await sequelize.query(`ALTER TABLE "proximity_rooms" ALTER COLUMN "${col}" DROP NOT NULL;`);
      } catch (err) {
        console.warn(`⚠️ [CAMPUS_MIGRATION_WARN] proximity_rooms.${col} nullable:`, err.message);
      }
    }
  }
  try {
    await require('../controllers/proximityController').retireLegacyDefaultSpots();
  } catch (err) {
    console.warn('⚠️ [CAMPUS_MIGRATION_WARN] retire default campus spots:', err.message);
  }
};

module.exports = { runCampusMigrations };
