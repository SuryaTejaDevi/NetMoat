/**
 * PATH 1: Rule-Based Detection Engine
 * Authoritative decisions for network classification.
 */

export function classifyNetwork(network, history) {
    const { ssid, bssid, rssi, encryption, isProfileFallback } = network;
    const networkHistory = history[bssid] || { rssiTimeline: [], seenCount: 0 };

    let status = 'Safe';
    let reasons = [];

    // 0. Profile/Fallback Handling
    if (isProfileFallback) {
        reasons.push('Discovered via System Profile (Hardware scan restricted)');
    }

    // 1. Weak Encryption Check
    const encLower = (encryption || '').toLowerCase();
    if (encLower.includes('open') || encLower.includes('wep')) {
        status = 'Suspicious';
        reasons.push('Weak or no encryption detected');
    }

    // 2. RSSI Variance Check
    if (networkHistory.rssiTimeline && networkHistory.rssiTimeline.length > 2) {
        const lastRSSI = networkHistory.rssiTimeline[networkHistory.rssiTimeline.length - 1];
        const variance = Math.abs(rssi - lastRSSI);
        if (variance > 15) {
            if (status !== 'Rogue') status = 'Suspicious';
            reasons.push(`High RSSI variance (${variance} dBm) detected`);
        }
    }

    // 3. Evil Twin Detection
    let otherBSSIDsForSameSSID = Object.keys(history).filter(otherBssid =>
        history[otherBssid].ssid === ssid && otherBssid.toLowerCase() !== bssid.toLowerCase()
    );

    if (otherBSSIDsForSameSSID.length > 0) {
        status = 'Rogue';
        reasons.push('Duplicate SSID (Evil Twin) detected with different BSSID');

        const otherRSSIs = otherBSSIDsForSameSSID.map(b => {
            const h = history[b];
            return h.rssiTimeline[h.rssiTimeline.length - 1] || -100;
        });

        const maxOtherRSSI = Math.max(...otherRSSIs);
        if (rssi > maxOtherRSSI + 5) {
            reasons.push('Stronger signal than legitimate AP for the same SSID');
        }
    }

    // 4. Unusual appearance
    if (networkHistory.seenCount < 2 && rssi > -40) {
        if (status === 'Safe') {
            status = 'Suspicious';
            reasons.push('Sudden strong signal from a new network');
        }
    }

    return { status, reasons };
}
