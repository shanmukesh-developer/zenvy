const fetch = require('node-fetch');

const checkApi = async () => {
    try {
        const res = await fetch('http://localhost:5005/api/users/restaurants');
        const data = await res.json();
        console.log('--- API Restaurants ---');
        console.log(JSON.stringify(data, (key, value) => key === 'menu' ? (value.length > 0 ? `[${value.length} items]` : []) : value, 2));
        
        if (data.length > 0) {
            console.log('--- First Restaurant Menu Sample ---');
            console.log(JSON.stringify(data[0].menu?.[0] || 'NO_MENU_ITEMS', null, 2));
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkApi();
