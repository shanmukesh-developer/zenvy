const { Op } = require('sequelize');
const { getMessageModel } = require('../models/Message');
const { getRoomModel } = require('../models/Room');

// Hourly ('0 * * * *', server clock), scheduled by jobs/index.js through utils/jobs.runExclusive.
// Returns { messages, rooms } (rows hard-deleted / archived). Errors are logged, never thrown.
const runEphemeralPurge = async () => {
  const out = { messages: 0, rooms: 0 };
  try {
    const Message = getMessageModel();
    const Room = getRoomModel();
    
    const now = new Date();

    if (Message) {
      // Hard delete all messages that have expired (TTL) OR are older than 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const deletedMessages = await Message.destroy({
        where: {
          [Op.or]: [
            {
              expiresAt: {
                [Op.lt]: now
              }
            },
            {
              createdAt: {
                [Op.lt]: thirtyDaysAgo
              }
            }
          ]
        }
      });
      out.messages = deletedMessages;
      if (deletedMessages > 0) {
        console.log(`[EPHEMERAL PURGE] Hard-deleted ${deletedMessages} expired/old messages.`);
      }
    }

    if (Room) {
      // Archive or delete expired rooms
      // We set them to inactive instead of hard deleting to prevent zombie rooms
      // while maintaining the ability for admins to recreate or audit if absolutely necessary
      const archivedRooms = await Room.update(
        { isActive: false },
        {
          where: {
            expiresAt: {
              [Op.lt]: now
            },
            isActive: true
          }
        }
      );
      out.rooms = archivedRooms[0];
      if (archivedRooms[0] > 0) {
        console.log(`[EPHEMERAL PURGE] Archived ${archivedRooms[0]} expired rooms.`);
      }
    }

  } catch (error) {
    console.error('[EPHEMERAL PURGE] Error during purge cycle:', error);
  }
  return out;
};

module.exports = { runEphemeralPurge };
