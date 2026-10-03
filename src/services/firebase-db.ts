import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, addDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';

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
    try {
        const userRef = doc(db, 'users', uid, 'security_policy', 'settings');
        await setDoc(userRef, settings, { merge: true });
    } catch (e) {
        console.error("Error saving settings:", e);
    }
};

export const getUserSettings = async (uid: string) => {
    try {
        const userRef = doc(db, 'users', uid, 'security_policy', 'settings');
        const snap = await getDoc(userRef);
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        console.error("Error loading settings:", e);
        return null;
    }
};

// --- ACTIVE DEFENSE: GLOBAL BLACKLIST ---
export async function addToBlacklist(uid: string, bssid: string, reason: string) {
    try {
        const ref = doc(db, 'users', uid, 'security_policy', 'blacklist', bssid, 'meta');
        await setDoc(ref, {
            bssid,
            reason,
            addedAt: new Date().toISOString(),
            active: true
        });
        console.log(`[Blacklist] Blocked ${bssid}`);
    } catch (e) {
        console.error('Error adding to blacklist:', e);
    }
}

export async function removeFromBlacklist(uid: string, bssid: string) {
    try {
        const ref = doc(db, 'users', uid, 'security_policy', 'blacklist', bssid, 'meta');
        await deleteDoc(ref);
        console.log(`[Blacklist] Unblocked ${bssid}`);
    } catch (e) {
        console.error('Error removing from blacklist:', e);
    }
}

export async function getBlacklist(uid: string): Promise<Set<string>> {
    try {
        // We are storing items in a subcollection 'blacklist' where each doc ID is the BSSID (parent of 'meta')
        // This is a bit tricky structure: users/{uid}/security_policy/blacklist/{bssid}/meta
        // To get all BSSIDs, we actually need to correct this.
        // Simpler structure: users/{uid}/blacklist_items/{bssid}

        // Changing structure to simpler logic for queryability
        const q = collection(db, 'users', uid, 'blacklist_items');
        const snapshot = await getDocs(q);
        const blocked = new Set<string>();
        snapshot.forEach(doc => blocked.add(doc.id));
        return blocked;
    } catch (e) {
        return new Set();
    }
}

// Updated addToBlacklist to use simpler structure
export async function addToBlacklistSimple(uid: string, bssid: string, reason: string) {
    try {
        const ref = doc(db, 'users', uid, 'blacklist_items', bssid);
        await setDoc(ref, {
            bssid,
            reason,
            addedAt: new Date().toISOString()
        });
    } catch (e) { console.error(e); }
}

export async function removeFromBlacklistSimple(uid: string, bssid: string) {
    try {
        await deleteDoc(doc(db, 'users', uid, 'blacklist_items', bssid));
    } catch (e) { console.error(e); }
}
