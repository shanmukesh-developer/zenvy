const http = require('http');

const SERVICES = [
  { name: 'Backend API', port: 5005, path: '/' },
  { name: 'Frontend Portal', port: 3000, path: '/' },
  { name: 'Rider Portal', port: 3001, path: '/' },
  { name: 'Admin Command Center', port: 3002, path: '/' },
  { name: 'Restaurant Terminal', port: 3003, path: '/' }
];

const checkService = (service) => {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${service.port}${service.path}`, (res) => {
      resolve({ name: service.name, port: service.port, status: 'ONLINE', statusCode: res.statusCode });
    });

    req.on('error', (err) => {
      resolve({ name: service.name, port: service.port, status: 'OFFLINE', error: err.code });
    });

    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ name: service.name, port: service.port, status: 'TIMEOUT' });
    });
  });
};

const verifySystem = async () => {
  console.log('🔍 Initiating Zenvy Ecosystem Health Check...\n');
  const results = await Promise.all(SERVICES.map(checkService));
  
  let allHealthy = true;
  console.table(results.map(r => {
    if (r.status !== 'ONLINE') allHealthy = false;
    return {
      Service: r.name,
      Port: r.port,
      Status: r.status === 'ONLINE' ? '🟢 ONLINE' : '🔴 OFFLINE',
      Detail: r.statusCode ? `HTTP ${r.statusCode}` : (r.error || 'Connection Failed')
    };
  }));

  console.log('\n=======================================');
  if (allHealthy) {
    console.log('✅ SYSTEM VERIFICATION PASSED: All microservices are active.');
  } else {
    console.log('⚠️ SYSTEM VERIFICATION WARNING: One or more services are offline.');
  }
  console.log('=======================================\n');
};

verifySystem();
