const { io } = require('socket.io-client');
const socket = io('http://localhost:5000');
const orderId = '4e357865-a55b-4428-8db1-b3b28e4ed26a';

socket.on('connect', () => {
  console.log('Simulated Driver Connected to Socket');
  let i = 0;
  const interval = setInterval(() => {
    const lat = 16.4632 + (i * 0.0001);
    const lng = 80.5064 + (i * 0.0001);
    socket.emit('updateLocation', {
      orderId,
      lat,
      lng,
      riderName: 'Simulated Rider',
      riderId: 'sim-rider-1'
    });
    console.log(`[SIM] Location Emitted: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    i++;
  }, 2000);
});

socket.on('disconnect', () => {
  console.log('Simulated Driver Disconnected');
});
