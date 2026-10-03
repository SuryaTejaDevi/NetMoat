import numpy as np
import pandas as pd
from scipy.stats import entropy, linregress

class FeatureExtractor:
    """
    Industrial-Grade Feature Extractor for Wi-Fi Security.
    Converts raw time-series AP logs into fixed-length feature vectors.
    """
    
    def __init__(self, window_size=10):
        self.window_size = window_size
        
        # Vendor OUI simplified map (Top 10 common vendors + 'Other')
        # In real prod, this comes from a massive DB.
        self.vendor_map = {
            'Cisco': 1, 'Aruba': 2, 'Ubiquiti': 3, 'Ruckus': 4, 'Intel': 5,
            'Apple': 6, 'Samsung': 7, 'Espressif': 8, 'TP-Link': 9, 'Netgear': 10
        }
        
    def _encode_encryption(self, enc_str):
        """Map encryption strings to ordinal levels of security."""
        e = str(enc_str).lower()
        if 'wpa3' in e: return 5
        if 'wpa2' in e: return 4
        if 'wpa' in e: return 3
        if 'wep' in e: return 1
        return 0 # Open/None

    def _get_vendor_id(self, bssid):
        """Mock OUI lookup. In prod, look up first 3 octets."""
        # For simulation, we hash the OUI to a bucket if unknown
        return hash(bssid[:8]) % 20

    def _calculate_trend(self, series):
        """Calculate linear regression slope of RSSI."""
        if len(series) < 2: return 0.0
        slope, _, _, _, _ = linregress(range(len(series)), series)
        return slope

    def _calculate_entropy(self, series):
        """Calculate Shannon entropy of a sequence."""
        value, counts = np.unique(series, return_counts=True)
        return entropy(counts)

    def extract_features(self, history_df):
        """
        Expects a DataFrame representing ONE AP's history in the time window.
        Columns: [timestamp, rssi, channel, ssid, bssid, encryption]
        """
        if history_df.empty:
            return None

        # 1. RSSI Statistics
        rssi_series = history_df['rssi'].values
        mean_rssi = np.mean(rssi_series)
        std_rssi = np.std(rssi_series)
        min_rssi = np.min(rssi_series)
        max_rssi = np.max(rssi_series)
        rssi_var = np.var(rssi_series)
        rssi_trend = self._calculate_trend(rssi_series)

        # 2. Temporal Stability
        # Scan Interval Consistency (Variance in time deltas)
        timestamps = pd.to_datetime(history_df['timestamp']).values.astype(np.int64) // 10**9
        if len(timestamps) > 1:
            deltas = np.diff(timestamps)
            scan_consistency = np.std(deltas)
            disappearance_rate = np.sum(deltas > 30) / len(deltas) # Probes missing for >30s
        else:
            scan_consistency = 0
            disappearance_rate = 0
            
        appearance_count = len(history_df)

        # 3. Channel Behavior
        channel_series = history_df['channel'].values
        # Count actual switches (diff != 0)
        chan_switches = np.sum(np.diff(channel_series) != 0) if len(channel_series) > 1 else 0
        chan_entropy = self._calculate_entropy(channel_series)

        # 4. Identity & Security
        # We take the most recent state for static identities
        last_row = history_df.iloc[-1]
        
        enc_score = self._encode_encryption(last_row['encryption'])
        vendor_id = self._get_vendor_id(last_row['bssid'])
        
        # SSID Similarity/Duplicate needs context of OTHER APs. 
        # Here we assume these flags are passed in or pre-calculated in the 'raw' row 
        # based on the global snapshot at that time.
        # If not present, default to 0.
        ssid_sim = last_row.get('ssid_similarity', 0.0)
        dup_ssid = last_row.get('is_duplicate_ssid', 0)

        return np.array([
            mean_rssi, std_rssi, min_rssi, max_rssi, rssi_var, rssi_trend,
            appearance_count, disappearance_rate, scan_consistency,
            chan_switches, chan_entropy,
            enc_score, dup_ssid, ssid_sim, vendor_id
        ])

    def get_feature_names(self):
        return [
            'mean_rssi', 'std_rssi', 'min_rssi', 'max_rssi', 'rssi_var', 'rssi_trend',
            'appearance_count', 'disappearance_rate', 'scan_consistency',
            'chan_switch_count', 'chan_entropy',
            'enc_score', 'duplicate_ssid_flag', 'ssid_similarity', 'vendor_id'
        ]
