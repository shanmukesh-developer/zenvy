// Friends events on the authenticated /campus namespace. campusSocket.js calls
// registerFriendsSocket(campusNsp, socket) once per connection, after its own handlers.
const spaces = require('./spaces');

const registerFriendsSocket = (campusNsp, socket) => {
  try {
    spaces.register(campusNsp, socket);
  } catch (err) {
    console.error('[FRIENDS_SOCKET_REGISTER_ERR]', err.message);
  }
};

module.exports = { registerFriendsSocket };
