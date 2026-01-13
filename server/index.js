import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { scanNetworks, getCurrentConnection } from './scanner.js';
import { evaluateNetwork } from './engine.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

const app = express();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// STATE & MEMORY
let networkHistory = new Map();
let currentEvaluations = [];
let lastScanError = null;
let lastScanType = 'NONE';
let currentConnection = null;

// Notification State to avoid spamming
const alertedBSSIDs = new Set();

/**
 * Main Update Loop
 * Runs every 5 seconds, pulling from the hybrid scanner.
 */
async function updateLoop() {
    console.log(`[${new Date().toLocaleTimeString()}] Starting advanced hardware scan cycle...`);
    try {
        const [{ networks: rawNetworks, profiles, error, scanType }, connection] = await Promise.all([
            scanNetworks(),
            getCurrentConnection()
        ]);

        lastScanError = error;
        lastScanType = scanType;
        currentConnection = connection;

        console.log(`[Scan] Cycle complete. Type: ${scanType}, Found: ${rawNetworks.length} networks`);
        if (error) console.warn(`[Scan] Warning/Error: ${error}`);

        const liveBSSIDs = new Set(rawNetworks.map(n => n.bssid));
        const liveSSIDs = new Set(rawNetworks.map(n => n.ssid));
        const savedSSIDs = new Set(profiles);

        // Track results for this cycle
        const mergedResults = [];

        // 1. Process Live Networks
        rawNetworks.forEach(raw => {
            let h = networkHistory.get(raw.bssid);
            if (!h) {
                h = {
                    ssid: raw.ssid,
                    rssiTimeline: [],
                    seenCount: 0,
                    firstSeen: new Date().toISOString()
                };
                networkHistory.set(raw.bssid, h);
            }

            h.seenCount++;
            const evaluation = evaluateNetwork(raw, networkHistory);
            h.rssiTimeline.push(evaluation.rssi);
            if (h.rssiTimeline.length > 50) h.rssiTimeline.shift();

            mergedResults.push({
                ...evaluation,
                firstSeen: h.firstSeen,
                seenCount: h.seenCount,
                scanType: scanType, // Use actual scan type (HARDWARE or BASIC)
                isSaved: savedSSIDs.has(raw.ssid),
                isActive: true
            });
        });

        // 2. Process Saved Profiles that are OFFLINE
        profiles.forEach((ssid, index) => {
            if (!liveSSIDs.has(ssid)) {
                const syntheticBssid = `SAVED-PROFILE-${index}`;
                mergedResults.push({
                    id: syntheticBssid,
                    ssid: ssid,
                    bssid: '---',
                    status: 'Safe',
                    severity: 'Low',
                    reasons: ['Stored system profile (currently out of range)'],
                    rssi: -100, // Minimal signal for offline
                    encryption: 'WPA2-Personal',
                    scanType: 'SYSTEM_PROFILE',
                    isSaved: true,
                    isActive: false,
                    lastUpdated: new Date().toISOString()
                });
            }
        });

        currentEvaluations = mergedResults;

        // 3. Security Notifications Engine
        mergedResults.forEach(network => {
            if (network.status === 'Rogue' && !alertedBSSIDs.has(network.bssid)) {
                sendSecurityAlert(network);
                alertedBSSIDs.add(network.bssid);
            } else if (network.status === 'Safe' || !network.isActive) {
                // Remove from alerted set if it becomes safe or goes offline
                alertedBSSIDs.delete(network.bssid);
            }
        });

    } catch (err) {
        console.error('Fatal engine error:', err);
        lastScanError = err.message;
    }

    setTimeout(updateLoop, 5000);
}

// API Endpoints
app.get('/api/networks', (req, res) => {
    res.json({
        networks: currentEvaluations,
        connectedNetwork: currentConnection,
        error: lastScanError,
        scanType: lastScanType,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/elevate', (req, res) => {
    console.log('[UAC] Sending elevation trigger to Windows...');
    // Standard Windows elevation trick: Start a new instance with 'RunAs'
    const command = `powershell -Command "Start-Process node -ArgumentList 'server/index.js' -Verb RunAs -WorkingDirectory '${process.cwd()}'"`;

    exec(command, (err) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Elevation cancelled' });
        }
        res.json({ success: true, message: 'UAC Prompt sent.' });
    });
});

app.post('/api/disconnect', async (req, res) => {
    try {
        const { disconnectFromNetwork } = await import('./scanner.js');
        await disconnectFromNetwork();
        console.log('[Network] Disconnected from AP');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

// EMAIL VERIFICATION ENDPOINT
app.post('/api/send-otp', async (req, res) => {
    const { email, otp, name } = req.body;
    console.log('[Email Debug] Received request body:', req.body);

    if (!email || !otp) {
        console.error('[Email Debug] Missing email or otp:', { email, otp });
        return res.status(400).json({ error: 'Email and OTP are required', received: { email, otp } });
    }

    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">NetMoat Identity Verification</h2>
            <p>Hello ${name || 'User'},</p>
            <p>Your security verification code is:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e40af;">${otp}</span>
            </div>
            <p style="margin-top: 20px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #6b7280;">Protected by NetMoat Global Security Stack</p>
        </div>
    `;

    try {
        if (resend) {
            console.log(`[Email] Sending OTP via Resend to ${email}...`);
            await resend.emails.send({
                from: 'NetMoat <onboarding@resend.dev>',
                to: email,
                subject: 'Your NetMoat Verification Code',
                html: htmlContent
            });
            return res.json({ success: true, message: 'OTP sent via Resend' });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: `"NetMoat Security" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Your NetMoat Verification Code',
            html: htmlContent,
        };

        // If credentials are not set
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_USER.includes('your-email')) {
            console.warn('[Email] SMTP credentials NOT SET in .env. Logging OTP instead:');
            console.log(`[Email OTP for ${email}]: ${otp}`);
            return res.json({
                success: true,
                message: 'OTP logged to server console (SMTP not configured)',
                simulated: true
            });
        }

        await transporter.sendMail(mailOptions);
        console.log(`[Email] OTP successfully sent via SMTP to ${email}`);
        res.json({ success: true, message: 'OTP sent via SMTP' });

    } catch (error) {
        console.error('[Email] Failed to send email:', error);
        res.status(500).json({ error: 'Failed to send verification email', details: error.message });
    }
});

/**
 * sendSecurityAlert
 * Triggers an email alert for Rogue networks
 */
async function sendSecurityAlert(network) {
    const alertEmail = process.env.ALERT_EMAIL || process.env.SMTP_USER;
    if (!alertEmail || alertEmail.includes('your-email')) {
        console.warn(`[Security Alert] Found Rogue Network: ${network.ssid} (${network.bssid}). BUT no alert email configured in .env.`);
        return;
    }

    console.log(`[Security Alert] Sending urgent alert for Rogue network: ${network.ssid} to ${alertEmail}...`);

    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 2px solid #ef4444; border-radius: 10px;">
            <h2 style="color: #ef4444;">🚨 URGENT: Rogue Network Detected</h2>
            <p>NetMoat has detected a high-severity security threat in your vicinity.</p>
            <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>SSID:</strong> ${network.ssid}</p>
                <p><strong>BSSID:</strong> ${network.bssid}</p>
                <p><strong>Threat Type:</strong> ${network.reasons.join(', ')}</p>
                <p><strong>Signal Strength:</strong> ${network.rssi} dBm</p>
            </div>
            <p><strong>Recommendation:</strong> Do NOT connect to this network. If you are currently connected, disconnect immediately and enable your VPN.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #6b7280;">This is an automated security alert from NetMoat Hybrid Engine.</p>
        </div>
    `;

    try {
        if (resend) {
            await resend.emails.send({
                from: 'NetMoat Security <alerts@resend.dev>',
                to: alertEmail,
                subject: '🚨 SECURITY ALERT: Rogue Network Detected',
                html: htmlContent
            });
        } else {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587'),
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
            await transporter.sendMail({
                from: `"NetMoat Security" <${process.env.SMTP_USER}>`,
                to: alertEmail,
                subject: '🚨 SECURITY ALERT: Rogue Network Detected',
                html: htmlContent
            });
        }
        console.log(`[Security Alert] Email successfully dispatched to ${alertEmail}`);
    } catch (err) {
        console.error(`[Security Alert] Failed to send alert email:`, err.message);
    }
}

app.listen(PORT, () => {
    console.log('================================================');
    console.log(`🚀 NetMoat Hybrid Engine started on port ${PORT}`);
    console.log(`   Initial Scan Mode: ${lastScanType}`);
    console.log('================================================');
    updateLoop();
});
