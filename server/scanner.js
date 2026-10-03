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

        // Run both scans concurrently for maximum coverage
        const [liveBssidResult, liveBasicResult, profiles] = await Promise.all([
            new Promise(res => {
                exec('netsh wlan show networks mode=bssid', { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                    res(parseWindows(stdout || ''));
                });
            }),
            new Promise(res => {
                exec('netsh wlan show networks', { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                    res(parseWindows(stdout || ''));
                });
            }),
            getSavedProfiles()
        ]);

        // Merge and Deduplicate
        const mergedMap = new Map();

        // Prefer BSSID results for precision
        liveBssidResult.forEach(n => mergedMap.set(n.bssid, n));

        // Add basic results if not already present
        liveBasicResult.forEach(n => {
            if (!mergedMap.has(n.bssid)) {
                mergedMap.set(n.bssid, n);
            }
        });

        const networks = Array.from(mergedMap.values());
        console.log(`[Scanner] Discovery complete. BSSID: ${liveBssidResult.length}, Basic: ${liveBasicResult.length}, Unique Total: ${networks.length}`);

        resolve({
            networks,
            profiles: profiles,
            error: networks.length === 0 ? 'NO_NETWORKS_FOUND' : null,
            scanType: liveBssidResult.length > 0 ? 'LIVE_HARDWARE' : 'BASIC_ACTIVE'
        });
    });
}

/**
 * Reads saved Wi-Fi profiles from the OS.
 * Works without Admin rights.
 */
export function getSavedProfiles() {
    return new Promise((resolve) => {
        exec('netsh wlan show profiles', { maxBuffer: 1024 * 1024 }, (error, stdout) => {
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
 * Uses Regex for maximum robustness across different Windows versions/locales.
 */
function parseWindows(output) {
    const networks = [];
    const sections = output.split(/SSID \d+\s*:/g);

    // Skip index 0 (header text before first SSID)
    for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        const lines = section.split('\n').map(l => l.trim());

        let ssid = lines[0] || 'Hidden Network';
        let authentication = 'Unknown';
        let encryption = 'Unknown';

        // Extract metadata for this SSID block
        lines.forEach(line => {
            if (line.match(/^Authentication\s*:/i)) authentication = line.split(':')[1].trim();
            if (line.match(/^Encryption\s*:/i)) encryption = line.split(':')[1].trim();
        });

        // Extract BSSID blocks
        const bssidParts = section.split(/BSSID \d+\s*:/g);

        if (bssidParts.length > 1) {
            // Found specific APs
            for (let j = 1; j < bssidParts.length; j++) {
                const bssidText = bssidParts[j];
                const bssidMatch = bssidText.match(/([0-9A-Fa-f:]{17})/);
                const signalMatch = bssidText.match(/Signal\s*:\s*(\d+)%/i);

                if (bssidMatch) {
                    networks.push({
                        ssid,
                        bssid: bssidMatch[1].toUpperCase(),
                        authentication,
                        encryption,
                        signal: signalMatch ? parseInt(signalMatch[1]) : 0
                    });
                }
            }
        } else {
            // Basic mode (no BSSID detail)
            const signalMatch = section.match(/Signal\s*:\s*(\d+)%/i);
            networks.push({
                ssid,
                bssid: `N/A-${ssid.replace(/[^a-zA-Z0-9]/g, '-')}`,
                authentication,
                encryption,
                signal: signalMatch ? parseInt(signalMatch[1]) : 50,
                isProfileFallback: true
            });
        }
    }

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
