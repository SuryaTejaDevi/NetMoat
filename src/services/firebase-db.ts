import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

export interface FirebaseNetwork {
    id: string;
    ssid: string;
    bssid: string;
    rssi: number;
    status: 'Safe' | 'Suspicious' | 'Rogue';
    encryption: string;
    reasons?: string[];
    scanType: string;
    lastUpdated: string;
}

export const createSession = async (userId: string) => {
    const sessionRef = await addDoc(collection(db, `users/${userId}/sessions`), {
        createdAt: serverTimestamp(),
        status: 'active'
    });
    return sessionRef.id;
};

export const getLastActiveSession = async (userId: string) => {
    const { getDocs, limit } = await import('firebase/firestore');
    const q = query(collection(db, `users/${userId}/sessions`), orderBy('createdAt', 'desc'), limit(1));

    try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }
    } catch (e) {
        console.warn("Failed to fetch last session", e);
    }
    return null;
};

export const saveScanResults = async (userId: string, sessionId: string, networks: any[]) => {
    // Filter out networks that don't have a valid BSSID (like profile fallbacks) to save quota
    const validNetworks = networks.filter(n => n.bssid && n.bssid !== '---' && !n.isProfileFallback);

    if (validNetworks.length === 0) return;

    const batchProms = validNetworks.flatMap((network) => {
        // Sanitize docId: Remove colons and slashes (invalid document path segments)
        const docId = network.bssid.replace(/[:\/.]/g, '_');

        // A. Save to Session History
        const sessionNetRef = doc(db, `users/${userId}/sessions/${sessionId}/networks/${docId}`);
        const p1 = setDoc(sessionNetRef, {
            ...network,
            lastUpdated: serverTimestamp()
        }, { merge: true });

        // B. Save to User's Global Discovered Library
        const globalNetRef = doc(db, `users/${userId}/discovered_networks/${docId}`);
        const p2 = setDoc(globalNetRef, {
            ssid: network.ssid,
            bssid: network.bssid,
            status: network.status,
            encryption: network.encryption || 'Unknown',
            firstSeen: network.firstSeen || new Date().toISOString(),
            lastSeen: serverTimestamp(),
            scanType: network.scanType,
            reasons: network.reasons || [],
            // PATH 2 PERSISTENCE
            riskScore: network.riskScore || 0,
            confidence: network.confidence || 'Low',
            explanation: network.explanation || '',
            // PATH 3 PERSISTENCE
            knnPrediction: network.knnPrediction || 'Safe',
            knnConfidence: network.knnConfidence || 0,
            isolationScore: network.isolationScore || 0,
            isAnomalous: network.isAnomalous || false
        }, { merge: true });

        return [p1, p2];
    });

    await Promise.all(batchProms);
};

export const logSecurityEvent = async (userId: string, event: {
    type: 'Rogue' | 'Suspicious',
    ssid: string,
    bssid: string,
    details: string[]
}) => {
    const eventRef = collection(db, `users/${userId}/security_events`);
    await addDoc(eventRef, {
        ...event,
        timestamp: serverTimestamp(),
        resolved: false
    });
};

export const subscribeToSessionNetworks = (userId: string, sessionId: string, callback: (networks: FirebaseNetwork[]) => void) => {
    const q = query(collection(db, `users/${userId}/sessions/${sessionId}/networks`));

    return onSnapshot(q, (snapshot) => {
        const networks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseNetwork));
        callback(networks);
    });
};

export const createUserProfile = async (userId: string, data: { name: string, email: string, phone: string, password?: string }) => {
    // 1. Create Profile - All data strictly under /users/{uid}
    await setDoc(doc(db, `users/${userId}/profile/info`), {
        ...data,
        language: navigator.language,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        resolution: `${window.screen.width}x${window.screen.height}`,
        createdAt: serverTimestamp()
    });
};

export const logUserLogin = async (userId: string, email: string) => {
    const loginRef = collection(db, `users/${userId}/login_history`);
    await addDoc(loginRef, {
        email,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        resolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language
    });
};

// --- SETTINGS MANAGEMENT ---
export const saveUserSettings = async (uid: string, settings: any) => {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { settings }, { merge: true });
};

export const getUserSettings = async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    return snap.exists() ? snap.data().settings : null;
};
