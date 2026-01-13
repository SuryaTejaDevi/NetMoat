/**
 * PATH 3: Continuous ML Intelligence
 * Supervised KNN + Unsupervised Isolation Forest
 */

// --- MODEL PARAMETERS (Simulated "Loaded" State) ---
// In a production environment, these would be loaded from .json or .bin files.
const KNN_CENTROIDS = {
    'Safe': { rssi: -64.9, rssiStd: 1.5, enc: 4.5, ssidSim: 0.1, bssidUniq: 0, chanStab: 0.9 },
    'Suspicious': { rssi: -50.3, rssiStd: 7.9, enc: 2.0, ssidSim: 0.45, bssidUniq: 0.5, chanStab: 0.5 },
    'Rogue': { rssi: -35.1, rssiStd: 15.0, enc: 1.5, ssidSim: 0.9, bssidUniq: 1.0, chanStab: 0.2 }
};

const IF_SPLITS = [
    { feature: 'rssiVar', value: 12 },
    { feature: 'distDev', value: 0.6 },
    { feature: 'chanSwitch', value: 2 }
];

/**
 * Supervised KNN Classification
 */
function runKNN(features) {
    let minDistance = Infinity;
    let prediction = 'Safe';

    // Euclidean distance in feature space
    for (const [label, target] of Object.entries(KNN_CENTROIDS)) {
        let dist = Math.sqrt(
            Math.pow(features.rssi - target.rssi, 2) +
            Math.pow(features.rssiStd - target.rssiStd, 2) +
            Math.pow(features.enc - target.enc, 2) +
            Math.pow(features.ssidSim - target.ssidSim, 2) +
            Math.pow(features.bssidUniq - target.bssidUniq, 2) +
            Math.pow(features.chanStab - target.chanStab, 2)
        );

        if (dist < minDistance) {
            minDistance = dist;
            prediction = label;
        }
    }

    // Convert distance to confidence (inverted sigmoid/gaussian)
    const confidence = Math.max(0, 1 - (minDistance / 100));
    return { prediction, confidence };
}

/**
 * Unsupervised Isolation Forest (Simplified Path-Length Logic)
 */
function runIsolationForest(features) {
    let score = 0;

    // Add "depth" logic - anomalous points are "isolated" quickly (shorter paths)
    // Here we count how many split thresholds are exceeded
    if (features.rssiVar > 12) score += 0.4;
    if (features.distDev > 0.6) score += 0.3;
    if (features.chanSwitch > 2) score += 0.3;

    // Normalize to -1.0 to 1.0 (Higher is more anomalous)
    const isolationScore = (score * 2) - 1.0;
    const isAnomalous = isolationScore > 0.2; // Threshold for anomaly

    return { isolationScore, isAnomalous };
}

/**
 * Main Entry Point for Path 3 Inference
 */
export function predictRiskML(data) {
    try {
        // 1. Feature Encoding
        const features = {
            // KNN Features
            rssi: data.rssi || -100,
            rssiStd: data.rssiStd || 0,
            enc: encodeEncryption(data.encryption),
            ssidSim: data.ssidSimilarity || 0,
            bssidUniq: data.bssidUniqueness || 0,
            chanStab: data.channelStability || 1.0,

            // Isolation Forest Features
            rssiVar: data.rssiVariance || 0,
            distDev: data.distanceDeviation || 0,
            chanSwitch: data.channelSwitchFreq || 0
        };

        // 2. Inference
        const knn = runKNN(features);
        const iforest = runIsolationForest(features);

        return {
            knnPrediction: knn.prediction,
            knnConfidence: parseFloat(knn.confidence.toFixed(2)),
            isolationScore: parseFloat(iforest.isolationScore.toFixed(2)),
            isAnomalous: iforest.isAnomalous
        };
    } catch (err) {
        console.error("ML Inference Failed:", err);
        return null; // Fallback handled by caller
    }
}

function encodeEncryption(enc) {
    const e = (enc || '').toLowerCase();
    if (e.includes('wpa3')) return 5;
    if (e.includes('wpa2')) return 4;
    if (e.includes('wpa')) return 3;
    if (e.includes('wep')) return 1;
    return 0; // Open/Unknown
}
