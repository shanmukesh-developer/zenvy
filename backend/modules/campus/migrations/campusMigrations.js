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
};

module.exports = { runCampusMigrations };
