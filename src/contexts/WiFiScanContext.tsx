import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { createSession, saveScanResults, subscribeToSessionNetworks, getLastActiveSession, logSecurityEvent, saveUserSettings, getUserSettings, getBlacklist, addToBlacklistSimple } from '@/services/firebase-db';
import { Network } from '@/data/mockData';
import { toast } from 'sonner';
import { calculateHybridIntelligence } from '@/engine/hybridScorer';
import { predictRiskML } from '@/engine/ml/mlInference';
import { getApiUrl } from '@/config/apiConfig';

interface WiFiScanContextType {
    networks: Network[];
    allNetworks: Network[];
    isScanning: boolean;
    startScanning: () => void;
    stopScanning: () => void;
    lastUpdate: string | null;
    scanError: string | null;
    scanType: 'LIVE_HARDWARE' | 'BASIC_ACTIVE' | 'PROFILE_DISCOVERY' | 'NONE';
    sessionId: string | null;
    unreadThreatCount: number;
    markAllThreatsAsViewed: () => void;
    connectedNetwork: { ssid: string; bssid: string; signal: number } | null;
    disconnectNetwork: () => Promise<void>;
    settings: any;
    updateUserSettings: (newSettings: any) => Promise<void>;
    blockNetwork: (network: Network) => Promise<void>;
    blacklist: Set<string>;
}

const WiFiScanContext = createContext<WiFiScanContextType | null>(null);

export const useWiFiScan = () => {
    const context = useContext(WiFiScanContext);
    if (!context) throw new Error('useWiFiScan must be used within a WiFiScanProvider');
    return context;
};

export const WiFiScanProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();

    // State - Initialize from Cache if available
    const [networks, setNetworks] = useState<Network[]>(() => {
        const cached = localStorage.getItem('bg_last_networks');
        return cached ? JSON.parse(cached) : [];
    });
    const [isScanning, setIsScanning] = useState(true); // Default to Auto-Start
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanType, setScanType] = useState<'LIVE_HARDWARE' | 'BASIC_ACTIVE' | 'PROFILE_DISCOVERY' | 'NONE'>('NONE');
    const [connectedNetwork, setConnectedNetwork] = useState<{ ssid: string; bssid: string; signal: number } | null>(null);
    const [settings, setSettings] = useState<any>({
        scanInterval: 2,
        autoDisconnect: true,
        muteOnLogin: true,
        sensitivity: 'medium'
    });
    const [blacklist, setBlacklist] = useState<Set<string>>(new Set());

    const errorShown = useRef<string | null>(null);

    // 1. Session Init (Resume or Create) & Load Blacklist
    useEffect(() => {
        if (user) {
            // Load Blacklist
            getBlacklist(user.uid).then(setBlacklist);

            if (!sessionId && isScanning) {
                const initSession = async () => {
                    try {
                        const lastId = await getLastActiveSession(user.uid);
                        if (lastId) {
                            console.log("Resumed Session:", lastId);
                            setSessionId(lastId);
                        } else {
                            const newId = await createSession(user.uid);
                            console.log("Created New Session:", newId);
                            setSessionId(newId);
                        }
                    } catch (err) {
                        console.error("Session Init Failed:", err);
                        createSession(user.uid).then(setSessionId);
                    }
                };
                initSession();
            }
        }
    }, [user, isScanning, sessionId]);

    // 1.1 Load Settings
    useEffect(() => {
        if (user) {
            const loadSettings = async () => {
                try {
                    const saved = await getUserSettings(user.uid);
                    if (saved) setSettings(saved);
                } catch (e) {
                    console.error("Failed to load settings:", e);
                }
            };
            loadSettings();
        }
    }, [user]);

    const updateUserSettings = async (newSettings: any) => {
        setSettings(newSettings);
        if (user) {
            await saveUserSettings(user.uid, newSettings);
            toast.success("Settings saved successfully");
        }
    };

    // --- ACTIVE DEFENSE ACTION ---
    const blockNetwork = async (network: Network) => {
        if (!user) return;
        try {
            await addToBlacklistSimple(user.uid, network.bssid, "Manually Blocked by User");
            toast.error(`Blocked ${network.ssid}. Active countermeasures engaged.`);

            // Immediate local update
            const newBlacklist = new Set(blacklist);
            newBlacklist.add(network.bssid);
            setBlacklist(newBlacklist);

            // Disconnect if connected
            if (connectedNetwork && network.bssid === connectedNetwork.bssid) {
                disconnectNetwork();
            }
        } catch (e) { console.error(e); }
    };

    // Persistence Buffer: Map<BSSID, Network>
    const networkBuffer = useRef(new Map<string, Network>());
    const lastSyncedSnapshot = useRef<string>("");

    // 2. Data Sync Loop (Engine -> Firestore)
    const fetchAndSync = useCallback(async () => {
        if (!user || !sessionId || !isScanning) return;

        try {
            const response = await fetch(getApiUrl('/api/networks'));
            if (!response.ok) throw new Error('Backend engine unreachable');

            const data = await response.json();
            const { networks: rawData, connectedNetwork: activeConn, error, scanType: engineScanType, timestamp } = data;

            setScanError(error);
            setScanType(engineScanType);
            setConnectedNetwork(activeConn);
            setLastUpdate(timestamp);

            if (error && error !== errorShown.current) {
                errorShown.current = error;
            }

            // 1. Process New Data
            const now = new Date();

            rawData.forEach((n: Network, idx: number) => {
                const bssid = n.bssid || `scan-${idx}`;

                // Only add to the active buffer if the individual network is marked as active
                if (n.isActive && (engineScanType === 'LIVE_HARDWARE' || engineScanType === 'BASIC_ACTIVE')) {
                    const existing = networkBuffer.current.get(bssid);
                    networkBuffer.current.set(bssid, {
                        ...n,
                        id: bssid,
                        isActive: true,
                        lastSeen: now.toISOString(),
                        firstSeen: existing?.firstSeen || n.firstSeen || now.toISOString(),
                        status: existing?.status || n.status,
                        seenCount: (existing?.seenCount || 0) + 1,
                        rssiHistory: [...(existing?.rssiHistory || []).slice(-19), n.rssi],
                        channelHistory: [...(existing?.channelHistory || []).slice(-19), n.channel || 0]
                    });
                }
            });

            // 2. Prune Old Data
            // Smoothing: Retain networks for 2 minutes even if missed in current scan cycle
            const ACTIVE_WINDOW_MS = 120000;
            const activeList: Network[] = [];

            networkBuffer.current.forEach((net, bssid) => {
                const seenTime = new Date(net.lastSeen).getTime();
                if (now.getTime() - seenTime < ACTIVE_WINDOW_MS) {

                    // --- ACTIVE DEFENSE: CHECK BLACKLIST ---
                    const isBlacklisted = blacklist.has(bssid);

                    // RUN PATH 2: Hybrid Intelligence Layer
                    const rssiHistory = net.rssiHistory || [net.rssi];
                    const variance = rssiHistory.length > 1
                        ? Math.max(...rssiHistory) - Math.min(...rssiHistory)
                        : 0;

                    // FR-05: Log-Distance Path Loss Model implementation
                    const PTX = -35; // Rough RSSI at 1 meter
                    const N = 3.0;   // Path loss exponent for indoor environments
                    const currentDist = Math.pow(10, (PTX - net.rssi) / (10 * N));
                    const rssiMean = rssiHistory.reduce((a, b) => a + b, 0) / rssiHistory.length;
                    const meanDist = Math.pow(10, (PTX - rssiMean) / (10 * N));

                    // FR-06: Spatial Consistency Validation (RAIM-Inspired)
                    const spatialDeviation = Math.abs(currentDist - meanDist);
                    const isSpatiallyInconsistent = spatialDeviation > 5.0; // 5 meter threshold

                    const hybridResult = calculateHybridIntelligence({
                        status: net.status,
                        reasons: [
                            ...(net.reasons || []),
                            ...(isSpatiallyInconsistent ? ["Spatial inconsistency detected (>5m signal shift)"] : [])
                        ],
                        rssi: net.rssi,
                        encryption: net.encryption || 'Unknown',
                        ssidSeenCount: net.seenCount || 1,
                        rssiVariance: variance
                    });

                    // PATH 3: Continuous ML Inference (Industrial ONNX)
                    // We trust the Server-Side calculation over client heuristics
                    const serverMLLabel = (net as any).ml_prediction || 'Unknown';
                    const serverAnomaly = (net as any).ml_anomaly_score || 0;

                    // HYBRID FUSION LOGIC (Rules Decide, ML Validates)
                    let finalStatus = net.status;

                    // If ML specifically flags 'Rogue' with high confidence, we escalate.
                    if (serverMLLabel === 'Rogue') {
                        finalStatus = 'Rogue';
                        hybridResult.reasons.push('🤖 ML CONFIRMED: High-Confidence Threat Pattern');
                    }

                    // Anomaly Score (Isolation Forest)
                    // Server returns standard score. If very negative, it's anomalous.
                    if (serverAnomaly < -0.15) {
                        if (finalStatus === 'Safe') finalStatus = 'Suspicious';
                        hybridResult.reasons.push('📉 ML ANOMALY: Zero-Day Behavior Detected');
                    }

                    const mlResult = {
                        knnPrediction: serverMLLabel,
                        isAnomalous: serverAnomaly < -0.15,
                        riskScore: serverMLLabel === 'Rogue' ? 95 : (serverMLLabel === 'Safe' ? 10 : 50)
                    };

                    // ACTIVE DEFENSE OVERRIDE
                    if (isBlacklisted) {
                        finalStatus = 'Rogue';
                        const existingReasons = hybridResult.reasons || [];
                        if (!existingReasons.some(r => r.includes('Blacklist'))) {
                            hybridResult.reasons = ['⛔ ACTIVE DEFENSE: Global Blacklist Match', ...existingReasons];
                        }
                    }

                    const finalNet = {
                        ...net,
                        ...hybridResult,
                        ...mlResult,
                        status: finalStatus,
                        estimatedDistance: parseFloat(currentDist.toFixed(1))
                    };

                    // FR-07: Post-Connection Protection (Auto-Disconnect)
                    if (settings.autoDisconnect && connectedNetwork && finalNet.bssid === connectedNetwork.bssid && finalStatus === 'Rogue') {
                        console.warn("⚠️ AUTO-DISCONNECT: Connected to Rogue AP!", finalNet.ssid);
                        toast.error(`Security Incident: Auto-disconnecting from Rogue AP ${finalNet.ssid}`);
                        disconnectNetwork();
                    }

                    activeList.push(finalNet);
                } else {
                    networkBuffer.current.delete(bssid);
                }
            });

            // 3. Ensure Connected Network is INJECTED into the list
            if (activeConn && activeConn.ssid) {
                const connBssid = activeConn.bssid;
                const alreadyPresent = activeList.some(n => n.bssid === connBssid);

                if (!alreadyPresent) {
                    activeList.unshift({
                        id: connBssid || `conn-${activeConn.ssid}`,
                        ssid: activeConn.ssid,
                        bssid: connBssid || '---',
                        rssi: activeConn.signal ? (activeConn.signal / 2 - 100) : -50,
                        status: 'Safe',
                        isActive: true,
                        lastSeen: now.toISOString(),
                        reasons: ['Currently Connected']
                    });
                }
            }

            // PRIMARY SOURCE: Update Local State from Buffer
            setNetworks(activeList);

            // Cache for persistence "Forever"
            if (activeList.length > 0) {
                localStorage.setItem('bg_last_networks', JSON.stringify(activeList));
            }

            // Secondary: Sync to Firestore
            try {
                if (activeList.length > 0) {
                    const currentSnapshot = activeList.map(n => `${n.bssid}-${n.status}-${n.isActive}`).sort().join('|');

                    if (currentSnapshot !== lastSyncedSnapshot.current) {
                        console.log("[Sync] Intelligence change detected. Uploading to Firestore...");
                        await saveScanResults(user.uid, sessionId, activeList);
                        lastSyncedSnapshot.current = currentSnapshot;
                    }
                }
            } catch (dbErr) {
                console.warn("Cloud Sync Paused (Quota/Network):", dbErr);
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.warn("Engine Sync Error:", errorMessage);
            setScanError('Engine offline. Run "npm run engine"');
        }
    }, [user, sessionId, isScanning, blacklist]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isScanning && sessionId) {
            fetchAndSync(); // Initial call
            const freq = (settings.scanInterval || 5) * 1000;
            interval = setInterval(fetchAndSync, freq);
        }
        return () => clearInterval(interval);
    }, [isScanning, sessionId, fetchAndSync, settings.scanInterval]);


    // Alert Tracking State
    const [viewedThreats, setViewedThreats] = useState<Set<string>>(new Set());

    // Identify active threats
    const activeThreats = networks.filter(n => n.status === 'Rogue' || n.status === 'Suspicious');

    // Calculate unread threats
    const unreadThreatCount = activeThreats.filter(t => !viewedThreats.has(t.bssid)).length;

    const notifiedThreats = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (settings.muteOnLogin && window.location.pathname === '/login') return;

        activeThreats.forEach(threat => {
            if (!notifiedThreats.current.has(threat.bssid)) {
                // New Threat Detected
                if (threat.status === 'Rogue' || threat.status === 'Suspicious') {
                    // Log specific security event to Firestore
                    logSecurityEvent(user.uid, {
                        type: threat.status,
                        ssid: threat.ssid,
                        bssid: threat.bssid,
                        details: threat.reasons || []
                    }).catch(err => console.error("Failed to log security event:", err));

                    if (threat.status === 'Rogue') {
                        toast.error(`Security Alert: Rogue AP Detected!`, {
                            description: `SSID: ${threat.ssid} (${threat.bssid})`,
                            duration: 5000,
                            action: {
                                label: 'View',
                                onClick: () => window.location.href = '/alerts'
                            }
                        });
                    } else if (threat.status === 'Suspicious') {
                        toast.warning(`Suspicious Network Detected`, {
                            description: `${threat.ssid} shows anomalies.`,
                            duration: 4000
                        });
                    }
                }
                notifiedThreats.current.add(threat.bssid);
            }
        });
    }, [activeThreats, networks]);

    const markAllThreatsAsViewed = () => {
        if (unreadThreatCount > 0) {
            const newViewed = new Set(viewedThreats);
            activeThreats.forEach(t => newViewed.add(t.bssid));
            setViewedThreats(newViewed);
        }
    };

    const disconnectNetwork = async () => {
        try {
            await fetch('http://localhost:3001/api/disconnect', { method: 'POST' });
            toast.success("Disconnected from network");
            setConnectedNetwork(null); // Optimistic update
        } catch (e) {
            toast.error("Failed to disconnect");
        }
    };

    // STRICTLY Active-Only. No history fallback.
    const exposedNetworks = networks;

    const value = {
        networks: exposedNetworks,
        allNetworks: networks,
        isScanning,
        startScanning: () => setIsScanning(true),
        stopScanning: () => setIsScanning(false),
        lastUpdate,
        scanError,
        scanType,
        sessionId,
        unreadThreatCount,
        markAllThreatsAsViewed,
        connectedNetwork,
        disconnectNetwork,
        settings,
        updateUserSettings,
        blockNetwork,
        blacklist
    };

    return (
        <WiFiScanContext.Provider value={value}>
            {children}
        </WiFiScanContext.Provider>
    );
};
