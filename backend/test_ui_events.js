const { io } = require('socket.io-client');
const socket = io('http://localhost:5005');

socket.on('connect', () => {
  console.log('Connected to backend');
  
  // Trigger Surge
  socket.emit('admin_trigger_surge', { multiplier: 1.5, orderCount: 24 });
  console.log('Triggered Surge Banner');
  
  // Trigger Announcement
  socket.emit('admin_trigger_announcement', { 
    message: 'Welcome to the new Zenvy Nexus! 🚀 Live filters and dynamic banners are now active.',
    type: 'promo'
  });
  console.log('Triggered Global Announcement');

  setTimeout(() => {
    process.exit(0);
  }, 2000);
});
