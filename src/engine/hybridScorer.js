/**
 * PATH 2: Hybrid Intelligence Layer
 * Enhances decisions from Path 1 with risk scoring and natural language explanations.
 * NEVER overrides Path 1 status.
 */

export function calculateHybridIntelligence(data) {
    const { status, reasons, rssi, encryption, ssidSeenCount, rssiVariance } = data;

    let riskScore = 0;
    let pointReasons = [];

    // 1. Base Score from Status
    if (status === 'Rogue') {
        riskScore += 50;
        pointReasons.push("High-severity rule match");
    } else if (status === 'Suspicious') {
        riskScore += 25;
        pointReasons.push("Heuristic anomaly detected");
    }

    // 2. Specific Intelligence Rules (Deterministic Scoring)

    // Duplicate SSID Check (Evil Twin indicator)
    if (reasons.some(r => r.includes('Duplicate SSID'))) {
        riskScore += 40;
        pointReasons.push("SSID duplication");
    }

    // Encryption Risk
    const encLower = (encryption || '').toLowerCase();
    if (encLower.includes('open')) {
        riskScore += 25;
        pointReasons.push("unencrypted traffic");
    } else if (encLower.includes('wep') || encLower.includes('wpa1')) {
        riskScore += 15;
        pointReasons.push("legacy encryption");
    }

    // Signal Power Analysis
    if (rssi > -45) {
        riskScore += 15;
        pointReasons.push("exceptionally strong signal");
    }

    // Variance/Stability
    if (rssiVariance > 12) {
        riskScore += 10;
        pointReasons.push("signal instability");
    }

    // Persistence Check
    if (ssidSeenCount > 100 && status !== 'Safe') {
        riskScore += 10;
        pointReasons.push("prolonged unauthorized presence");
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    // 3. Confidence Mapping
    let confidence = "Low";
    if (riskScore >= 80) {
        confidence = "High";
    } else if (riskScore >= 50) {
        confidence = "Medium";
    }

    // 4. Explanation Generator
    let explanation = "Network appears within normal safety parameters.";
    if (riskScore > 0) {
        const primaryDrivers = pointReasons.slice(0, 2).join(" and ");
        if (riskScore >= 70) {
            explanation = `Multiple high-risk indicators detected, primarily ${primaryDrivers}. High probability of malicious intent.`;
        } else if (riskScore >= 40) {
            explanation = `Potential security risk identified due to ${primaryDrivers}. Targeted monitoring recommended.`;
        } else {
            explanation = `Subtle anomalies detected (${pointReasons[0]}). Low immediate threat.`;
        }
    }

    return {
        riskScore,
        confidence,
        explanation
    };
}
