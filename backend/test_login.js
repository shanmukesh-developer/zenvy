fetch('http://localhost:5005/api/delivery/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '1234567890', password: 'password123' })
})
.then(r => r.json())
.then(data => console.log('Login Response:', data))
.catch(console.error);
