/**
 * Log-Distance Path Loss Model
 * d = 10^((Pt - RSSI) / (10 * n))
 */
function calculateDistance(rssi) {
    const Pt = -30; // Reference power at 1m
    const n = 2.7;  // Indoor path loss exponent
    return Math.pow(10, (Pt - rssi) / (10 * n));
}

// Vendor OUI Map (Common trusted prefixes)
const VENDOR_OUI = {
    'apple': ['00:03:93', '00:05:02', '00:0a:27', '00:0d:93', '00:10:fa'],
    'cisco': ['00:01:42', '00:01:43', '00:01:63', '00:01:64', '00:01:96'],
    'tp-link': ['00:0a:eb', '00:14:78', '00:1d:0f', '00:21:27', '00:23:69'],
    'netgear': ['00:09:5b', '00:0f:b5', '00:14:6c', '00:18:4d', '00:1b:2f'],
    'd-link': ['00:0d:88', '00:0f:3d', '00:13:46', '00:15:e9', '00:17:9a']
};

function calculateRSSIDBm(signalPercentage) {
    return (signalPercentage / 2) - 100;
}

/**
 * SEQUENCE-BASED ANOMALY DETECTION (Time-Series AI)
 * Analyzes temporal patterns using sliding window statistics.
 * Detects: "Low and Slow" approaches (Creep) and Hardware Jitter.
 */
function analyzeSequence(timeline) {
    if (timeline.length < 5) return { score: 0, label: 'Insufficient Data' };

    // 1. Calculate Volatility (Standard Deviation of first-order differences)
    // High volatility = Cheap hardware / Interference / Active Attack
    let deltas = [];
    for (let i = 1; i < timeline.length; i++) {
        deltas.push(Math.abs(timeline[i] - timeline[i - 1]));
    }
    const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const volatility = Math.sqrt(deltas.map(x => Math.pow(x - meanDelta, 2)).reduce((a, b) => a + b, 0) / deltas.length);

    // 2. Trend Analysis (Simple Linear Regression Slope)
    // Positive Slope = Device moving closer (Physical approach)
    // Negative Slope = Device moving away
    const n = timeline.length;
    const xSum = (n * (n - 1)) / 2; // Sum of 0..n-1
    const ySum = timeline.reduce((a, b) => a + b, 0);
    const xySum = timeline.reduce((sum, val, idx) => sum + (idx * val), 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = ((n * xySum) - (xSum * ySum)) / ((n * xSquaredSum) - (Math.pow(xSum, 2)));

    // Decision Logic
    if (volatility > 8.0) {
        return {
            score: 0.85,
            label: 'Volatile',
            reason: `High signal jitter (Vol: ${volatility.toFixed(1)}) - Characteristic of cheap attack hardware`
        };
    }

    if (slope > 0.5 && timeline[n - 1] > -60) {
        return {
            score: 0.75,
            label: 'Approaching',
            reason: `Rapid signal increase (Slope: ${slope.toFixed(2)}) - Device physically closing in`
        };
    }

    return { score: 0.1, label: 'Stable' };
}

export function evaluateNetwork(network, history, settings = {}) {
    const { ssid, bssid, signal, authentication } = network;
    const rssi = calculateRSSIDBm(signal);
    const estimatedDistance = calculateDistance(rssi);

    let status = 'Safe';
    let severity = 'Low';
    let reasons = [];

    // Get historical data for this BSSID
    const networkHistory = history.get(bssid) || { rssiTimeline: [], distanceHistory: [], seenCount: 0 };

    // 0. Profile/Fallback Handling
    if (network.isProfileFallback) {
        reasons.push('Discovered via System Profile (Hardware scan restricted)');
    }

    // 1. Weak Encryption Check
    const authLower = (authentication || '').toLowerCase();
    if (authLower.includes('open') || authLower.includes('wep')) {
        status = 'Suspicious';
        severity = 'Medium';
        reasons.push('Weak or no encryption detected');
    }

    // 2. SPATIAL CONSISTENCY (RAIM-inspired)
    const distHistory = networkHistory.distanceHistory || [];
    if (distHistory.length > 5) {
        const avgDist = distHistory.reduce((a, b) => a + b, 0) / distHistory.length;
        const deviation = Math.abs(estimatedDistance - avgDist);

        if (deviation > 5) {
            status = 'Rogue';
            severity = 'High';
            reasons.push(`[Spatial] Position deviation detected: ${deviation.toFixed(1)}m (Possible portable spoofer)`);
        }
    }
    // Update history locally for next cycle
    distHistory.push(estimatedDistance);
    if (distHistory.length > 20) distHistory.shift();
    networkHistory.distanceHistory = distHistory;

    // 3. VENDOR OUI CONSISTENCY
    const macPrefix = bssid.toUpperCase().substring(0, 8);
    for (const [vendor, prefixes] of Object.entries(VENDOR_OUI)) {
        if (ssid.toLowerCase().includes(vendor)) {
            const isMatch = prefixes.some(p => macPrefix.startsWith(p));
            if (!isMatch) {
                if (status === 'Safe') status = 'Suspicious';
                reasons.push(`[Vendor] BSSID prefix ${macPrefix} does not match ${vendor.toUpperCase()} hardware profile`);
            }
        }
    }

    // 4. SEQUENCE AI ANALYSIS
    const recentHistory = (networkHistory.rssiTimeline || []).slice(-10);
    const analysisWindow = [...recentHistory, rssi];
    const seqAnalysis = analyzeSequence(analysisWindow);

    if (seqAnalysis.score > 0.6) {
        if (status !== 'Rogue') {
            status = 'Suspicious';
            severity = 'High';
        }
        reasons.push(`[AI] ${seqAnalysis.reason}`);
    }

    // 5. Evil Twin Detection
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

        const otherRSSIs = otherBSSIDsForSameSSID.map(b => {
            const h = history.get(b);
            return h.rssiTimeline[h.rssiTimeline.length - 1] || -100;
        });

        const maxOtherRSSI = Math.max(...otherRSSIs);

        if (rssi > maxOtherRSSI + 5) {
            reasons.push('Stronger signal than legitimate AP for the same SSID');
        }
    }

    // 6. SSID Cleanup
    let displaySSID = ssid || 'Hidden Network';
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (macRegex.test(displaySSID.trim())) {
        displaySSID = 'Hidden Network';
    }

    return {
        ssid: displaySSID,
        bssid: bssid,
        status,
        severity,
        reasons,
        rssi,
        estimatedDistance: parseFloat(estimatedDistance.toFixed(1)),
        encryption: authentication,
        lastUpdated: new Date().toISOString()
    };
}
