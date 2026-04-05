const { io } = require('socket.io-client');
const socket = io('http://localhost:5001');
const orderId = 'e9f39852-7f96-464f-a239-d45a01e93b22';

socket.on('connect', () => {
  console.log('Simulated Driver Connected to Socket');
  let i = 0;
  const interval = setInterval(() => {
    const lat = 16.4674 - (i * 0.0002);
    const lng = 80.5042 + (i * 0.0001);
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
