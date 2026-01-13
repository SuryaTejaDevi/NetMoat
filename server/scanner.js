import { exec } from 'child_process';

/**
 * Executes OS-specific commands to get real Wi-Fi scan data.
 * Hardware Strategy (Admin): Runs BSSID scan + Profile audit.
 */
export function scanNetworks() {
    return new Promise(async (resolve) => {
        const platform = process.platform;

        if (platform !== 'win32') {
            return resolve({ networks: [], profiles: [], error: `Auto-scanning for ${platform} coming soon.` });
        }

        // Run both scans concurrently
        const [liveResult, profiles] = await Promise.all([
            new Promise(res => {
                // TRY BSSID MODE FIRST (More detail)
                exec('netsh wlan show networks mode=bssid', (error, stdout, stderr) => {
                    // Even if there's an 'error' or 'stderr', if we have SSIDs in stdout, we use them!
                    if (stdout && stdout.includes('SSID')) {
                        const networks = parseWindows(stdout);
                        if (networks.length > 0) {
                            return res({
                                networks,
                                scanType: stdout.includes('BSSID') ? 'LIVE_HARDWARE' : 'BASIC_ACTIVE',
                                error: null
                            });
                        }
                    }

                    // FALLBACK: Simple SSID scan
                    exec('netsh wlan show networks', (basicError, basicStdout) => {
                        if (basicStdout && basicStdout.includes('SSID')) {
                            res({
                                networks: parseWindows(basicStdout),
                                scanType: 'BASIC_ACTIVE',
                                error: null
                            });
                        } else {
                            // Ultimate failure
                            let specificError = 'SCAN_RESTRICTED';
                            if ((stderr || '').includes('administrator') || (stdout || '').includes('elevation')) {
                                specificError = 'ELEVATION_REQUIRED';
                            }
                            res({ networks: [], scanType: 'NONE', error: specificError });
                        }
                    });
                });
            }),
            getSavedProfiles()
        ]);

        resolve({
            networks: liveResult.networks,
            profiles: profiles,
            error: liveResult.error,
            scanType: liveResult.scanType
        });
    });
}

/**
 * Reads saved Wi-Fi profiles from the OS.
 * Works without Admin rights.
 */
export function getSavedProfiles() {
    return new Promise((resolve) => {
        exec('netsh wlan show profiles', (error, stdout) => {
            if (error) return resolve([]);

            const profiles = [];
            const lines = stdout.split('\n');

            lines.forEach(line => {
                if (line.includes(':')) {
                    const parts = line.split(':');
                    const profileName = parts[1].trim();

                    // Filter out header text that isn't an actual profile name
                    if (profileName &&
                        profileName !== '' &&
                        !profileName.includes('Profile') &&
                        !line.includes('Profiles on')) {
                        profiles.push(profileName);
                    }
                }
            });

            resolve(profiles);
        });
    });
}

/**
 * Detailed parser for Windows BSSID output
 */
function parseWindows(output) {
    const networks = [];
    const lines = output.split('\n').map(l => l.trim());
    let currentSSID = null;
    let currentAuth = 'Unknown';
    let currentEncryption = 'Unknown';
    let hasBSSIDEntries = false;

    const pushGenericSSID = (name, auth, enc, sig = 50) => {
        if (!name) return;
        // Don't push if it has BSSIDs (those are pushed separately)
        if (hasBSSIDEntries) return;

        // Check for duplicates to avoid double-adding in rollups
        const alreadyAdded = networks.some(n => n.ssid === name && n.isProfileFallback);
        if (!alreadyAdded) {
            networks.push({
                ssid: name,
                bssid: `N/A-${name.replace(/[^a-zA-Z0-9]/g, '-')}`,
                authentication: auth,
                signal: sig,
                encryption: enc,
                isProfileFallback: true
            });
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. New SSID Block
        if (line.startsWith('SSID')) {
            // Before moving to next, push previous generic if needed
            pushGenericSSID(currentSSID, currentAuth, currentEncryption);

            const match = line.match(/SSID \d+\s*:\s*(.*)/);
            currentSSID = match ? match[1].trim() : 'Unknown';
            if (!currentSSID) currentSSID = '<Hidden SSID>';

            hasBSSIDEntries = false;
            currentAuth = 'Unknown';
            currentEncryption = 'Unknown';
        }
        else if (line.startsWith('Authentication')) {
            currentAuth = line.split(':')[1]?.trim() || 'Unknown';
        }
        else if (line.startsWith('Encryption')) {
            currentEncryption = line.split(':')[1]?.trim() || 'Unknown';
        }
        else if (line.startsWith('Signal') && !hasBSSIDEntries) {
            // Signal in basic mode (nested under SSID)
            const signalMatch = line.match(/Signal\s*:\s*(\d+)%/);
            const signal = signalMatch ? parseInt(signalMatch[1]) : 50;
            pushGenericSSID(currentSSID, currentAuth, currentEncryption, signal);
        }
        // 3. BSSID Block (Specific Access Point)
        else if (line.startsWith('BSSID')) {
            hasBSSIDEntries = true;
            const bssidMatch = line.match(/BSSID \d+\s*:\s*([0-9A-Fa-f:]{17})/);
            const bssid = bssidMatch ? bssidMatch[1].toUpperCase() : '00:00:00:00:00:00';

            // Look ahead for signal in BSSID block
            let signal = 0;
            for (let j = i + 1; j < i + 6 && j < lines.length; j++) {
                const nextLine = lines[j];
                if (nextLine.startsWith('Signal')) {
                    const signalMatch = nextLine.match(/Signal\s*:\s*(\d+)%/);
                    signal = signalMatch ? parseInt(signalMatch[1]) : 0;
                    break;
                }
            }

            networks.push({
                ssid: currentSSID,
                bssid: bssid,
                authentication: currentAuth,
                signal: signal,
                encryption: currentEncryption
            });
        }
    }

    // Handle last block
    pushGenericSSID(currentSSID, currentAuth, currentEncryption);

    return networks;
}

/**
 * Gets the currently connected Wi-Fi interface details
 */
export function getCurrentConnection() {
    return new Promise((resolve) => {
        exec('netsh wlan show interfaces', (error, stdout) => {
            if (error) return resolve(null);

            const lines = stdout.split('\n');
            let ssid = null;
            let bssid = null;
            let state = 'disconnected';
            let signal = 0;

            lines.forEach(line => {
                const l = line.trim();
                if (l.startsWith('State')) state = l.split(':')[1].trim();
                if (l.startsWith('SSID') && !l.startsWith('BSSID')) ssid = l.split(':')[1].trim();
                if (l.startsWith('BSSID')) bssid = l.split(':')[1].trim();
                if (l.startsWith('Signal')) signal = parseInt(l.split(':')[1].trim());
            });

            if (state === 'connected' && ssid) {
                resolve({ ssid, bssid, signal, state });
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Disconnects from the current network
 */
export function disconnectFromNetwork() {
    return new Promise((resolve, reject) => {
        exec('netsh wlan disconnect', (error, stdout) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}
