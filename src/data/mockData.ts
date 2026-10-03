export type NetworkStatus = 'Safe' | 'Suspicious' | 'Rogue';
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';
export type AlertStatus = 'Investigating' | 'Resolved' | 'Blocked' | 'Monitoring' | 'Pending' | 'Completed';

export interface Network {
  id: string;
  ssid: string;
  bssid: string;
  rssi: number;
  encryption?: string;
  status: NetworkStatus;
  severity?: string;
  reasons?: string[];
  firstSeen?: string;
  lastUpdated?: string;
  channel?: number;
  scanType?: 'SYSTEM_PROFILE' | 'LIVE_HARDWARE';
  isProfileFallback?: boolean;
  isActive?: boolean;
  isSaved?: boolean;
  lastSeen?: string;
  riskScore?: number;
  confidence?: 'Low' | 'Medium' | 'High';
  explanation?: string;
  rssiHistory?: number[];
  seenCount?: number;
  knnPrediction?: 'Safe' | 'Suspicious' | 'Rogue';
  knnConfidence?: number;
  isolationScore?: number;
  isAnomalous?: boolean;
  channelHistory?: number[];
  estimatedDistance?: number;
}

export interface Alert {
  id: string;
  timestamp: string;
  alertType: string;
  severity: AlertSeverity;
  description: string;
  status: AlertStatus;
}

export interface RogueAPHistory {
  id: string;
  location: string;
  mac: string;
  timestamp: string;
}

export const mockNetworks: Network[] = [
  { id: '1', ssid: 'OfficeWiFi_Main', bssid: 'A4:12:F8:3D:9C:1E', rssi: -45, encryption: 'WPA3', status: 'Safe', channel: 36 },
  { id: '2', ssid: 'GuestNetwork_2025', bssid: 'B8:27:EB:5A:2F:D3', rssi: -52, encryption: 'WPA2', status: 'Safe', channel: 6 },
  { id: '3', ssid: 'OfficeWiFi_Main', bssid: 'C2:45:D7:8B:1A:3F', rssi: -38, encryption: 'WPA2', status: 'Rogue', channel: 11 },
  { id: '4', ssid: 'Conference_Room_5G', bssid: 'D4:6E:0E:9B:C2:7A', rssi: -60, encryption: 'WPA3', status: 'Safe', channel: 44 },
  { id: '5', ssid: 'FreeWiFi_Public', bssid: 'E8:94:F6:2D:5B:8C', rssi: -55, encryption: 'Open', status: 'Suspicious', channel: 1 },
  { id: '6', ssid: 'SecureNet_IoT', bssid: 'F2:3A:8E:6C:D1:4B', rssi: -48, encryption: 'WPA2', status: 'Safe', channel: 3 },
  { id: '7', ssid: 'GuestNetwork_2025', bssid: 'A9:5B:3C:7D:E2:1F', rssi: -42, encryption: 'WPA2', status: 'Rogue', channel: 9 },
  { id: '8', ssid: 'Building_A_WiFi', bssid: 'C6:7D:2E:9A:B4:5C', rssi: -58, encryption: 'WPA3', status: 'Safe', channel: 7 },
  { id: '9', ssid: 'HomeNetwork_5G', bssid: 'A4:12:E5:8F:23:D1', rssi: -42, encryption: 'WPA3', status: 'Safe', channel: 36 },
  { id: '10', ssid: 'OfficeWiFi', bssid: 'B8:27:EB:4C:91:A2', rssi: -58, encryption: 'WPA2', status: 'Safe', channel: 6 },
  { id: '11', ssid: 'GuestNetwork', bssid: 'C4:6E:1F:7A:B3:55', rssi: -65, encryption: 'WEP', status: 'Suspicious', channel: 11 },
  { id: '12', ssid: 'CafePublic', bssid: 'D2:3A:8F:1B:C9:77', rssi: -72, encryption: 'Open', status: 'Suspicious', channel: 1 },
  { id: '13', ssid: 'SecureNet_2.4', bssid: 'E8:94:F6:2D:A1:C8', rssi: -48, encryption: 'WPA3', status: 'Safe', channel: 3 },
  { id: '14', ssid: 'Neighbor_WiFi', bssid: 'F4:5C:89:E2:3B:D9', rssi: -81, encryption: 'WPA2', status: 'Safe', channel: 9 },
  { id: '15', ssid: 'Mobile_Hotspot', bssid: 'A2:8D:3C:F7:91:4E', rssi: -55, encryption: 'WPA2', status: 'Safe', channel: 44 },
  { id: '16', ssid: 'Library_Free', bssid: 'B6:1F:4A:D8:2C:93', rssi: -68, encryption: 'Open', status: 'Suspicious', channel: 7 },
];

export const mockAlerts: Alert[] = [
  { id: '1', timestamp: '2025-01-15 14:32:18', alertType: 'Rogue AP Detected', severity: 'Critical', description: 'Unauthorized access point detected in Building A', status: 'Investigating' },
  { id: '2', timestamp: '2025-01-15 14:28:45', alertType: 'Authentication Failure', severity: 'Warning', description: 'Multiple failed login attempts from IP 192.168.1.45', status: 'Resolved' },
  { id: '3', timestamp: '2025-01-15 14:15:22', alertType: 'Bandwidth Spike', severity: 'Info', description: 'Unusual traffic pattern detected on network segment 3', status: 'Monitoring' },
  { id: '4', timestamp: '2025-01-15 13:58:11', alertType: 'Firmware Update', severity: 'Info', description: 'Device AP-05 requires firmware update to v2.4.1', status: 'Pending' },
  { id: '5', timestamp: '2025-01-15 13:42:33', alertType: 'Configuration Change', severity: 'Warning', description: 'Unauthorized configuration change detected on AP-12', status: 'Investigating' },
  { id: '6', timestamp: '2025-01-15 13:28:09', alertType: 'Device Offline', severity: 'Critical', description: 'Access point AP-08 is not responding', status: 'Resolved' },
  { id: '7', timestamp: '2025-01-15 13:15:47', alertType: 'Security Scan', severity: 'Info', description: 'Scheduled security scan completed successfully', status: 'Completed' },
  { id: '8', timestamp: '2025-01-15 12:58:26', alertType: 'Client Connection', severity: 'Warning', description: 'Suspicious device attempting to connect to network', status: 'Blocked' },
];

export const mockRogueAPHistory: RogueAPHistory[] = [
  { id: '1', location: 'Building A - Floor 3', mac: '00:1A:2B:3C:4D:5E', timestamp: '2025-01-15 14:32' },
  { id: '2', location: 'Building B - Lobby', mac: '00:2B:3C:4D:5E:6F', timestamp: '2025-01-15 11:18' },
  { id: '3', location: 'Building A - Floor 1', mac: '00:3C:4D:5E:6F:7A', timestamp: '2025-01-14 16:45' },
  { id: '4', location: 'Building C - Parking', mac: '00:4D:5E:6F:7A:8B', timestamp: '2025-01-14 09:22' },
];

export const threatTrendData = [
  { day: 'Mon', threats: 1 },
  { day: 'Tue', threats: 0 },
  { day: 'Wed', threats: 2 },
  { day: 'Thu', threats: 1 },
  { day: 'Fri', threats: 1 },
  { day: 'Sat', threats: 0 },
  { day: 'Sun', threats: 2 },
];

export const rssiDistributionData = [
  { range: '-30 to -40', count: 6 },
  { range: '-41 to -50', count: 8 },
  { range: '-51 to -60', count: 5 },
  { range: '-61 to -70', count: 3 },
  { range: '-71+', count: 2 },
];

export const monthlyThreatData = [
  { month: 'Jan', threats: 12 },
  { month: 'Feb', threats: 8 },
  { month: 'Mar', threats: 15 },
  { month: 'Apr', threats: 10 },
  { month: 'May', threats: 18 },
  { month: 'Jun', threats: 22 },
];
