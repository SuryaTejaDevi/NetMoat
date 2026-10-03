/**
 * PATH 3: Continuous ML Intelligence
 * Supervised KNN + Unsupervised Isolation Forest
 */

import { getApiUrl } from '../../config/apiConfig';

/**
 * PATH 3: Continuous ML Intelligence
 * Client-Side wrapper for Industrial ONNX Inference (via /api/predict)
 */

// Fallback Heuristics (Offline Mode)
const KNN_CENTROIDS = {
    'Safe': { rssi: -64.9, rssiStd: 1.54, enc: 4.49, ssidSim: 0.1, bssidUniq: 0, chanStab: 0.9 },
    'Suspicious': { rssi: -50.26, rssiStd: 7.92, enc: 1.99, ssidSim: 0.45, bssidUniq: 0.51, chanStab: 0.5 },
    'Rogue': { rssi: -35.12, rssiStd: 15.0, enc: 1.5, ssidSim: 0.89, bssidUniq: 1.0, chanStab: 0.2 }
};

const IF_SPLITS = [
    { feature: 'rssiVar', value: 10.0 },
    { feature: 'distDev', value: 0.4 },
    { feature: 'chanSwitch', value: 1 }
];

function runKNNFallback(features) {
    let minDistance = Infinity;
    let prediction = 'Safe';
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
    const confidence = Math.max(0, 1 - (minDistance / 100));
    return { prediction, confidence };
}

function runIsolationForestFallback(features) {
    let score = 0;
    if (features.rssiVar > 12) score += 0.4;
    if (features.distDev > 0.6) score += 0.3;
    if (features.chanSwitch > 2) score += 0.3;
    const isolationScore = (score * 2) - 1.0;
    const isAnomalous = isolationScore > 0.2;
    return { isolationScore, isAnomalous };
}

/**
 * Main Entry Point for Path 3 Inference
 * Now supports Industrial ONNX Backend
 */
export async function predictRiskML(data) {
    // 1. Feature Encoding
    const featuresObj = {
        rssi: data.rssi || -100,
        rssiStd: data.rssiStd || 0,
        enc: encodeEncryption(data.encryption),
        ssidSim: data.ssidSimilarity || 0,
        bssidUniq: data.bssidUniqueness || 0,
        chanStab: data.channelStability || 1.0,
        rssiVar: data.rssiVariance || 0,
        distDev: data.distanceDeviation || 0,
        chanSwitch: data.channelSwitchFreq || 0
    };

    // Vector for ONNX (Order must match training columns)
    // ['rssi', 'rssi_std', 'enc', 'ssid_sim', 'bssid_uniq', 'chan_stab', 'rssi_var', 'dist_dev', 'chan_switch']
    const featureVector = [
        featuresObj.rssi,
        featuresObj.rssiStd,
        featuresObj.enc,
        featuresObj.ssidSim,
        featuresObj.bssidUniq,
        featuresObj.chanStab,
        featuresObj.rssiVar,
        featuresObj.distDev,
        featuresObj.chanSwitch
    ];

    try {
        // 2. Try Industrial Engine (Server-Side ONNX)
        const response = await fetch(getApiUrl('/api/predict'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features: featureVector })
        });

        if (response.ok) {
            const result = await response.json();
            // console.debug('[ML] Industrial Inference Success:', result);
            return {
                knnPrediction: result.prediction,
                knnConfidence: 0.95, // High confidence in ONNX model
                isolationScore: parseFloat(result.anomaly_score.toFixed(2)),
                isAnomalous: result.anomaly_score < 0, // IF negative score = anomaly
                mode: 'INDUSTRIAL_ONNX'
            };
        }
    } catch (e) {
        // console.warn('[ML] Server inference offline, using embedded heuristics.');
    }

    // 3. Fallback to Client-Side Logic
    const knn = runKNNFallback(featuresObj);
    const iforest = runIsolationForestFallback(featuresObj);

    return {
        knnPrediction: knn.prediction,
        knnConfidence: parseFloat(knn.confidence.toFixed(2)),
        isolationScore: parseFloat(iforest.isolationScore.toFixed(2)),
        isAnomalous: iforest.isAnomalous,
        mode: 'EMBEDDED_HEURISTIC'
    };
}


function encodeEncryption(enc) {
    const e = (enc || '').toLowerCase();
    if (e.includes('wpa3')) return 5;
    if (e.includes('wpa2')) return 4;
    if (e.includes('wpa')) return 3;
    if (e.includes('wep')) return 1;
    return 0; // Open/Unknown
}
