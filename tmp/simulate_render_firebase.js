const k6271 = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCs3R5N9k/8u5x8
... (simulated junk) ...
${'A'.repeat(4000)}
...
-----END PRIVATE KEY-----`;

const cleanKey = (k) => {
    if (!k) return null;
    console.log(`Input length: ${k.length}`);
    
    // 1. JSON extraction
    if (k.includes('{')) {
        try {
            const start = k.indexOf('{');
            const end = k.lastIndexOf('}') + 1;
            const jsonStr = k.substring(start, end);
            const p = JSON.parse(jsonStr);
            const extracted = p.private_key || p.privateKey;
            if (extracted) return cleanKey(extracted);
        } catch(e) { /* ignore */ }
    }

    // 2. PEM extraction
    const header = '-----BEGIN PRIVATE KEY-----';
    const footer = '-----END PRIVATE KEY-----';
    if (k.includes(header) && k.includes(footer)) {
        const start = k.indexOf(header);
        const end = k.indexOf(footer) + footer.length;
        let core = k.substring(start, end);
        // Normalize newlines in case they are literals
        return core.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
    }

    return k;
};

console.log('Result length:', cleanKey(k6271)?.length);
