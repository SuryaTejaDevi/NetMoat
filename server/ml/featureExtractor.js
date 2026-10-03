import crypto from 'crypto';

class FeatureExtractor {
    constructor(windowSize = 10) {
        this.windowSize = windowSize;

        // Vendor OUI simplified map
        this.vendorMap = {
            'cisco': 1, 'aruba': 2, 'ubiquiti': 3, 'ruckus': 4, 'intel': 5,
            'apple': 6, 'samsung': 7, 'espressif': 8, 'tp-link': 9, 'netgear': 10
        };
    }

    _encodeEncryption(encStr) {
        const e = String(encStr || '').toLowerCase();
        if (e.includes('wpa3')) return 5;
        if (e.includes('wpa2')) return 4;
        if (e.includes('wpa')) return 3;
        if (e.includes('wep')) return 1;
        return 0; // Open/None
    }

    _getVendorId(bssid) {
        // Mock OUI lookup - same hash logic as Python
        // Python: hash(bssid[:8]) % 20. 
        // JS doesn't have builtin 'hash'. We'll use a simple string hash.
        const header = (bssid || '').substring(0, 8);
        let hash = 0;
        for (let i = 0; i < header.length; i++) {
            hash = ((hash << 5) - hash) + header.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash) % 20;
    }

    _calculateTrend(series) {
        if (!series || series.length < 2) return 0.0;

        const n = series.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += series[i];
            sumXY += i * series[i];
            sumXX += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return isNaN(slope) ? 0.0 : slope;
    }

    _calculateEntropy(series) {
        const counts = {};
        for (const x of series) {
            counts[x] = (counts[x] || 0) + 1;
        }

        const total = series.length;
        let entropy = 0;

        for (const key in counts) {
            const p = counts[key] / total;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    extractFeatures(history) {
        // History: Array of { rssi, timestamp (ms), channel, encryption, bssid, is_duplicate_ssid, ssid_similarity }
        if (!history || history.length === 0) return null;

        // 1. RSSI Stats
        const rssiSeries = history.map(h => h.rssi);
        const meanRssi = rssiSeries.reduce((a, b) => a + b, 0) / rssiSeries.length;
        const minRssi = Math.min(...rssiSeries);
        const maxRssi = Math.max(...rssiSeries);

        // Std Dev & Var
        const variance = rssiSeries.reduce((a, b) => a + Math.pow(b - meanRssi, 2), 0) / rssiSeries.length;
        const stdRssi = Math.sqrt(variance);

        const rssiTrend = this._calculateTrend(rssiSeries);

        // 2. Temporal Stability
        let scanConsistency = 0;
        let disappearanceRate = 0;

        if (history.length > 1) {
            const timestamps = history.map(h => h.timestamp / 1000); // Seconds
            const deltas = [];
            for (let i = 1; i < timestamps.length; i++) {
                deltas.push(timestamps[i] - timestamps[i - 1]);
            }

            const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            const varDelta = deltas.reduce((a, b) => a + Math.pow(b - meanDelta, 2), 0) / deltas.length;
            scanConsistency = Math.sqrt(varDelta);

            disappearanceRate = deltas.filter(d => d > 30).length / deltas.length;
        }

        const appearanceCount = history.length;

        // 3. Channel Behavior
        const channelSeries = history.map(h => h.channel);
        let chanSwitches = 0;
        if (channelSeries.length > 1) {
            for (let i = 1; i < channelSeries.length; i++) {
                if (channelSeries[i] !== channelSeries[i - 1]) chanSwitches++;
            }
        }
        const chanEntropy = this._calculateEntropy(channelSeries);

        // 4. Identity
        const lastRow = history[history.length - 1]; // Most recent
        const encScore = this._encodeEncryption(lastRow.encryption);
        const vendorId = this._getVendorId(lastRow.bssid);

        // These flags must be passed in from the scan aggregator
        const ssidSim = lastRow.ssid_similarity || 0.0;
        const dupSsid = lastRow.is_duplicate_ssid ? 1 : 0;

        // 5. PRD 5.2: Spatial & Distance Metrics
        const distanceSeries = history.map(h => h.estimatedDistance || 0);
        let distDev = 0;
        if (distanceSeries.length > 2) {
            const meanDist = distanceSeries.reduce((a, b) => a + b, 0) / distanceSeries.length;
            distDev = Math.sqrt(distanceSeries.reduce((a, b) => a + Math.pow(b - meanDist, 2), 0) / distanceSeries.length);
        }

        return [
            meanRssi, stdRssi, variance, rssiTrend,
            appearanceCount, scanConsistency,
            chanSwitches, chanEntropy,
            encScore, dupSsid, ssidSim, vendorId,
            distDev
        ];
    }
}

export default FeatureExtractor;
