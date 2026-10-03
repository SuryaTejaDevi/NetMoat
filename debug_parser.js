import fs from 'fs';

function parseWindows(output) {
    const networks = [];
    const lines = output.split('\n').map(l => l.trim());
    let currentSSID = null;
    let currentAuth = 'Unknown';
    let currentEncryption = 'Unknown';
    let hasBSSIDEntries = false;

    const pushGenericSSID = (name, auth, enc, sig = 50) => {
        if (!name) return;
        if (hasBSSIDEntries) return;

        const alreadyAdded = networks.some(n => n.ssid === name && n.isProfileFallback);
        if (!alreadyAdded) {
            networks.push({
                ssid: name,
                bssid: `N/A-${name.replace(/[^a-zA-Z0-9]/g, '-')}`,
                authentication: auth,
                signal: sig,
                encryption: enc,
                isProfileFallback: true
            });
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('SSID')) {
            pushGenericSSID(currentSSID, currentAuth, currentEncryption);

            const match = line.match(/SSID \d+\s*:\s*(.*)/);
            currentSSID = match ? match[1].trim() : 'Unknown';
            if (!currentSSID) currentSSID = '<Hidden SSID>';

            hasBSSIDEntries = false;
            currentAuth = 'Unknown';
            currentEncryption = 'Unknown';
        }
        else if (line.startsWith('Authentication')) {
            currentAuth = line.split(':')[1]?.trim() || 'Unknown';
        }
        else if (line.startsWith('Encryption')) {
            currentEncryption = line.split(':')[1]?.trim() || 'Unknown';
        }
        else if (line.startsWith('Signal') && !hasBSSIDEntries) {
            const signalMatch = line.match(/Signal\s*:\s*(\d+)%/);
            const signal = signalMatch ? parseInt(signalMatch[1]) : 50;
            pushGenericSSID(currentSSID, currentAuth, currentEncryption, signal);
        }
        else if (line.startsWith('BSSID')) {
            hasBSSIDEntries = true;
            const bssidMatch = line.match(/BSSID \d+\s*:\s*([0-9A-Fa-f:]{17})/);
            const bssid = bssidMatch ? bssidMatch[1].toUpperCase() : '00:00:00:00:00:00';

            let signal = 0;
            for (let j = i + 1; j < i + 6 && j < lines.length; j++) {
                const nextLine = lines[j];
                if (nextLine.startsWith('Signal')) {
                    const signalMatch = nextLine.match(/Signal\s*:\s*(\d+)%/);
                    signal = signalMatch ? parseInt(signalMatch[1]) : 0;
                    break;
                }
            }

            networks.push({
                ssid: currentSSID,
                bssid: bssid,
                authentication: currentAuth,
                signal: signal,
                encryption: currentEncryption
            });
        }
    }

    pushGenericSSID(currentSSID, currentAuth, currentEncryption);
    return networks;
}

const data = fs.readFileSync('netsh_utf8.txt', 'utf8');
const result = parseWindows(data);
console.log(JSON.stringify(result, null, 2));
console.log('Total found:', result.length);
