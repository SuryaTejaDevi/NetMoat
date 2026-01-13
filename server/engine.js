/**
 * Rules for network classification:
 * Safe: WPA2/WPA3, Stable RSSI, Known BSSID for SSID
 * Suspicious: Open, High RSSI variance, Unknown BSSID for familiar SSID
 * Rogue: SSID Spoofing (Evil Twin), MAC Spoofing (Vendor mismatch/Pattern)
 */

function calculateRSSIDBm(signalPercentage) {
    return (signalPercentage / 2) - 100;
}

export function evaluateNetwork(network, history, settings = {}) {
    const { ssid, bssid, signal, authentication } = network;
    const rssi = calculateRSSIDBm(signal);

    let status = 'Safe';
    let severity = 'Low';
    let reasons = [];

    // Get historical data for this BSSID
    const networkHistory = history.get(bssid) || { rssiTimeline: [], seenCount: 0 };

    // 0. Profile/Fallback Handling
    if (network.isProfileFallback) {
        reasons.push('Discovered via System Profile (Hardware scan restricted)');
    }

    // 1. Weak Encryption Check
    const authLower = authentication.toLowerCase();
    if (authLower.includes('open') || authLower.includes('wep')) {
        status = 'Suspicious';
        severity = 'Medium';
        reasons.push('Weak or no encryption detected');
    }

    // 2. RSSI Variance Check (Maintain history)
    if (networkHistory.rssiTimeline.length > 2) {
        const lastRSSI = networkHistory.rssiTimeline[networkHistory.rssiTimeline.length - 1];
        const variance = Math.abs(rssi - lastRSSI);
        if (variance > 15) {
            if (status !== 'Rogue') status = 'Suspicious';
            reasons.push(`High RSSI variance (${variance} dBm) detected`);
        }
    }

    // 3. Evil Twin Detection (Duplicate SSID with different BSSID)
    let otherBSSIDsForSameSSID = [];
    for (let [otherBssid, h] of history.entries()) {
        if (h.ssid === ssid && otherBssid.toLowerCase() !== bssid.toLowerCase()) {
            otherBSSIDsForSameSSID.push(otherBssid);
        }
    }

    if (otherBSSIDsForSameSSID.length > 0) {
        status = 'Rogue';
        severity = 'High';
        reasons.push('Duplicate SSID (Evil Twin) detected with different BSSID');

        // Check for power level (Rogue often stronger)
        const otherRSSIs = otherBSSIDsForSameSSID.map(b => {
            const h = history.get(b);
            return h.rssiTimeline[h.rssiTimeline.length - 1] || -100;
        });

        const maxOtherRSSI = Math.max(...otherRSSIs);

        if (rssi > maxOtherRSSI + 5) {
            reasons.push('Stronger signal than legitimate AP for the same SSID');
        }
    }

    // 4. MAC Spoofing / Unusual appearance
    if (networkHistory.seenCount < 2 && rssi > -40) {
        // A brand new very strong network is suspicious
        if (status === 'Safe') {
            status = 'Suspicious';
            reasons.push('Sudden strong signal from a new network');
        }
    }

    return {
        ssid,
        bssid,
        status,
        severity,
        reasons,
        rssi,
        encryption: authentication,
        lastUpdated: new Date().toISOString()
    };
}
