import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { scanNetworks, getCurrentConnection } from './scanner.js';
import { evaluateNetwork } from './engine.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import ort from 'onnxruntime-node';
import FeatureExtractor from './ml/featureExtractor.js';

dotenv.config();

const app = express();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
const buildPath = path.join(__dirname, 'dist');

// Serve static files from the React app
app.use(express.static(buildPath));

// ML STATE
let knnSession = null;
let ifSession = null;
let scalerParams = null;
const featureExtractor = new FeatureExtractor();

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
/**
 * Main Update Loop
 * Runs every 5 seconds, pulling from the hybrid scanner, validating via ML.
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
        console.log(`[Scan] SSIDs: ${rawNetworks.map(n => n.ssid).join(', ')}`);
        if (error) console.warn(`[Scan] Warning/Error: ${error}`);

        const liveBSSIDs = new Set(rawNetworks.map(n => n.bssid));
        const liveSSIDs = new Set(rawNetworks.map(n => n.ssid));
        const savedSSIDs = new Set(profiles);

        // Track results for this cycle
        const mergedResults = [];

        // 1. Process Live Networks
        for (const raw of rawNetworks) {
            let h = networkHistory.get(raw.bssid);
            if (!h) {
                h = {
                    ssid: raw.ssid,
                    rssiTimeline: [],
                    seenCount: 0,
                    firstSeen: new Date().toISOString(),
                    // Slotted Buffer for Feature Extractor
                    featureBuffer: []
                };
                networkHistory.set(raw.bssid, h);
            }

            h.seenCount++;

            // Push Raw Log for ML
            h.featureBuffer.push({
                rssi: raw.rssi,
                timestamp: Date.now(),
                channel: raw.channel,
                encryption: raw.encryption || 'Open',
                bssid: raw.bssid,
                is_duplicate_ssid: false, // Need global context for this in future
                ssid_similarity: 0.0 // Placeholder
            });
            // Keep buffer size = 10 (Window Size)
            if (h.featureBuffer.length > 15) h.featureBuffer.shift();

            // Rule-Based Evaluation
            const evaluation = evaluateNetwork(raw, networkHistory);
            h.rssiTimeline.push(evaluation.rssi);
            if (h.rssiTimeline.length > 50) h.rssiTimeline.shift();

            // --- ML INFERENCE STEP ---
            let mlResult = { label: 'Unknown', confidence: 0, anomaly: 0 };

            /*
                        if (knnSession && scalerParams && h.featureBuffer.length >= 3) {
                            try {
                                // Extract
                                const rawFeatures = featureExtractor.extractFeatures(h.featureBuffer);
            
                                if (rawFeatures) {
                                    // Scale
                                    const scaledFeatures = rawFeatures.map((val, i) => {
                                        return (val - scalerParams.mean[i]) / scalerParams.scale[i];
                                    });
            
                                    // Infer
                                    const inputTensor = new ort.Tensor('float32', Float32Array.from(scaledFeatures), [1, 15]);
                                    const feeds = { float_input: inputTensor };
            
                                    const knnOut = await knnSession.run(feeds);
                                    const label = knnOut.output_label ? knnOut.output_label.data[0] : 'Unknown';
            
                                    // Anomaly
                                    let anomaly = 0;
                                    if (ifSession) {
                                        const ifOut = await ifSession.run(feeds);
                                        if (ifOut.decision_function) anomaly = ifOut.decision_function.data[0];
                                        // IsoForest: < 0 is anomaly. We want positive score for risk.
                                        // Convert standard IF (1=norm, -1=anom) to Risk (0..1)
                                        // A very negative score means HIGH anomaly.
                                    }
            
                                    mlResult = { label, confidence: 100, anomaly };
                                }
                            } catch (e) {
                                console.error(`[Inference Fail] ${raw.ssid}:`, e.message);
                            }
                        }
                        */

            mergedResults.push({
                ...evaluation,
                firstSeen: h.firstSeen,
                seenCount: h.seenCount,
                scanType: scanType,
                isSaved: savedSSIDs.has(raw.ssid),
                isActive: true,
                // Attach ML Insights
                ml_prediction: mlResult.label,
                ml_anomaly_score: mlResult.anomaly
            });
        }

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

        // 3. Security Notifications & Active Defense Engine
        mergedResults.forEach(network => {
            const isMLRogue = network.ml_prediction === 'Rogue';
            const isRuleRogue = network.status === 'Rogue';
            const isSuspicious = network.status === 'Suspicious';

            // Rogue Alert & Response
            if ((isRuleRogue || isMLRogue) && !alertedBSSIDs.has(network.bssid)) {
                sendSecurityAlert({
                    ...network,
                    reasons: [...(network.reasons || []), isMLRogue ? 'ML Model Confirmed Rogue' : '']
                });
                alertedBSSIDs.add(network.bssid);

                // Active Defense: Automatic Disconnect if connected
                if (currentConnection && currentConnection.bssid === network.bssid) {
                    console.warn(`[DEFENSE] Automatic check failed for ${network.ssid}. Disconnecting from ROGUE AP...`);
                    exec('netsh wlan disconnect', (err) => {
                        if (!err) console.log(`[DEFENSE] Successfully neutralized connection to ${network.bssid}`);
                    });
                }
            } else if (network.status === 'Safe' || !network.isActive) {
                alertedBSSIDs.delete(network.bssid);
            }

            // 4. Post-Connection Verification (Verification of active connection)
            if (currentConnection && currentConnection.bssid === network.bssid) {
                // Perform RAIM-inspired position cross-reference (simplified)
                const stability = network.reasons?.some(r => r.includes('Spatial') || r.includes('jitter'));
                if (stability && isSuspicious) {
                    console.error(`[POST-CONN] Critical validation failure on ${network.ssid}. Active MITM risk.`);
                    // Trigger another alert or force disconnect if high severity
                }
            }
        });

    } catch (err) {
        console.error('Fatal engine error:', err);
        lastScanError = err.message;
    }

    setTimeout(updateLoop, 2000);
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

// INDUSTRIAL ML INFERENCE ENGINE (ONNX)


async function loadMLModels() {
    try {
        const knnPath = path.resolve('./knn_model.onnx');
        const ifPath = path.resolve('./isolation_forest.onnx');
        const metaPath = path.resolve('./model_final_meta.json');

        if (fs.existsSync(knnPath)) {
            knnSession = await ort.InferenceSession.create(knnPath);
            console.log('✅ [ML Engine] KNN ONNX Model Loaded');
        } else {
            console.warn('⚠️ [ML Engine] KNN ONNX Model not found. Training required.');
        }

        if (fs.existsSync(ifPath)) {
            ifSession = await ort.InferenceSession.create(ifPath);
            console.log('✅ [ML Engine] Isolation Forest ONNX Model Loaded');
        } else {
            console.warn('⚠️ [ML Engine] Isolation Forest ONNX Model not found.');
        }

        if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            scalerParams = {
                mean: meta.scaler_mean,
                scale: meta.scaler_scale
            };
            console.log('✅ [ML Engine] Scaler Metadata Loaded');
        } else {
            console.warn('⚠️ [ML Engine] Scaler Metadata not found.');
        }

    } catch (e) {
        console.error('❌ [ML Engine] Failed to load ONNX models:', e);
    }
}

// Initialize models on start
loadMLModels();

app.post('/api/predict', async (req, res) => {
    if (!knnSession) return res.status(503).json({ error: 'ML Models not ready' });

    try {
        const { features } = req.body; // Expect array of 9 numerical features
        if (!features || features.length !== 9) {
            return res.status(400).json({ error: 'Invalid feature vector. Expected 9 floats.' });
        }

        const inputTensor = new ort.Tensor('float32', Float32Array.from(features), [1, 9]);
        const feeds = { float_input: inputTensor };

        const knnResults = await knnSession.run(feeds);
        const ifResults = ifSession ? await ifSession.run(feeds) : null;

        // Extract outputs (Output names depend on export, usually 'label' and 'probabilities')
        // For KNN classifier from sklearn-onnx: output_label, output_probability
        const predictedLabel = knnResults.output_label ? knnResults.output_label.data[0] : 'Unknown';

        // Isolation Forest usually outputs decision_function value or label (-1/1)
        // If export failed, we ignore IF result
        let anomalyScore = 0;
        if (ifResults && ifResults.decision_function) {
            anomalyScore = ifResults.decision_function.data[0];
        }

        res.json({
            prediction: predictedLabel,
            anomaly_score: anomalyScore,
            model_version: '1.0.0-ONNX-INDUSTRIAL'
        });

    } catch (err) {
        console.error('[ML Inference Error]', err);
        res.status(500).json({ error: 'Inference failed' });
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

// CATCH-ALL FOR SPA (Production)
app.get(/^((?!\/api).)*$/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log('================================================');
    console.log(`🚀 NetMoat Hybrid Engine started on port ${PORT}`);
    console.log(`   Initial Scan Mode: ${lastScanType}`);
    console.log('================================================');
    updateLoop();
});
