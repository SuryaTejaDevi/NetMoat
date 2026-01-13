import { useWiFiScan } from '@/contexts/WiFiScanContext';

/**
 * useWiFiEngine Hook
 * 
 * Now acts as a bridge to the global WiFiScanContext.
 * This ensures all components requesting scanner data get the same
 * synchronized global state.
 */
export function useWiFiEngine() {
    return useWiFiScan();
}
