const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'c:\\hostel-bite\\frontend\\src\\components\\PushNotificationManager.tsx',
    'c:\\hostel-bite\\delivery-app\\src\\app\\page.tsx',
    'c:\\hostel-bite\\delivery-app\\src\\components\\PushNotificationManager.tsx',
    'c:\\hostel-bite\\delivery-app\\src\\components\\GlobalAnnouncement.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\config\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\finance\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\components\\PushNotificationManager.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\components\\SOSAlertModal.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\vault\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\users\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\restaurants\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\orders\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\fleet\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\components\\NetworkStatus.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\blocks\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\audit\\page.tsx',
    'c:\\hostel-bite\\admin-dashboard\\src\\app\\analytics\\page.tsx',
    'c:\\hostel-bite\\backend\\blast_test.js',
    'c:\\hostel-bite\\backend\\migrate_ports.js',
    'c:\\hostel-bite\\backend\\scripts\\check_api.js',
    'c:\\hostel-bite\\backend\\scripts\\debug_order.js',
    'c:\\hostel-bite\\delivery-app\\simulate_driver.js',
    'c:\\hostel-bite\\backend\\verify_fallback.js',
    'c:\\hostel-bite\\backend\\test_nexus_flow.js',
    'c:\\hostel-bite\\backend\\test_login.js',
    'c:\\hostel-bite\\backend\\test_e2e.js',
    'c:\\hostel-bite\\backend\\test_delivery.js',
    'c:\\hostel-bite\\frontend\\src\\app\\page.tsx'
];

filesToUpdate.forEach(filePath => {
    try {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('5001')) {
                const updated = content.replace(/5001/g, '5005');
                fs.writeFileSync(filePath, updated);
                console.log(`Updated: ${filePath}`);
            }
        }
    } catch (err) {
        console.error(`Failed to update ${filePath}: ${err.message}`);
    }
});
