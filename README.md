🛡️ NetMoat

 Intelligent Wi-Fi Security Monitoring & Rogue Access Point Detection

NetMoat is a Windows-focused network security platform designed to discover nearby Wi-Fi networks, analyze their security characteristics and behavioral patterns, identify suspicious or rogue access points, and provide real-time security monitoring through a web-based dashboard.

The platform combines Windows wireless discovery, rule-based threat analysis, temporal signal analysis, Evil Twin detection, machine-learning inference, Firebase persistence, security alerts, and active network defense into a single security monitoring workflow.

> Educational & Authorized Security Testing
>
> NetMoat is intended for defensive security research, education, and authorized network monitoring. Only scan or interact with networks and systems you own or have explicit permission to assess.

---

 ✨ Features

 📡 Wireless Network Discovery

NetMoat integrates directly with Windows wireless networking utilities to obtain information about nearby Wi-Fi networks.

The scanner can collect:

- SSID
- BSSID
- Signal strength
- Authentication type
- Encryption information
- Current connection details
- Saved Wi-Fi profiles
- Network discovery state

The backend uses Windows `netsh wlan` commands to perform wireless discovery and parse BSSID-level information.

---

 🚨 Rogue Access Point Detection

NetMoat evaluates discovered networks using multiple security heuristics rather than relying on a single indicator.

Detection logic includes:

- Weak or missing encryption detection
- WEP/Open network identification
- BSSID and SSID consistency analysis
- Signal behavior analysis
- Spatial consistency analysis
- Vendor/OUI consistency checks
- Duplicate SSID detection
- Evil Twin detection
- Historical network behavior
- Machine-learning inference support

Networks are classified into:

```text
Safe
Suspicious
Rogue
````

Each detection can include an explanation describing why the network was classified as suspicious or rogue.

---

 🕵️ Evil Twin Detection

NetMoat tracks BSSIDs associated with the same SSID.

When multiple access points advertise the same SSID using different BSSIDs, NetMoat can flag the situation as a potential Evil Twin configuration.

Additional signal-strength comparison is used to provide further context when a duplicate SSID has a significantly stronger signal.

---

 📈 Behavioral & Signal Analysis

NetMoat maintains historical RSSI information for discovered networks.

The detection engine analyzes:

* RSSI trends
* Signal volatility
* Signal changes over time
* Estimated distance
* Spatial consistency
* Historical observations
* Network appearance frequency

A log-distance path-loss model is used to estimate approximate distance from RSSI measurements.

Temporal analysis also examines signal volatility and trend behavior to identify unusual patterns.

---

 🤖 Machine Learning Support

NetMoat includes an ML inference layer designed to complement the deterministic security engine.

The repository contains ML artifacts including:

* KNN model
* Isolation Forest model artifacts
* ONNX inference support
* Feature scaler metadata
* Feature extraction logic

The feature extraction pipeline considers characteristics such as:

* Mean RSSI
* RSSI variance
* RSSI standard deviation
* RSSI trend
* Network appearance count
* Scan consistency
* Channel switching
* Channel entropy
* Encryption strength
* Duplicate SSID indicators
* SSID similarity
* Vendor identity
* Distance deviation

The backend exposes an ML prediction endpoint:

```text
POST /api/predict
```

This allows numerical network features to be evaluated by the inference engine.

---

 🧠 Hybrid Threat Evaluation

NetMoat is designed around a layered detection approach:

```text
                    Wi-Fi Discovery
                          │
                          ▼
                 Network Normalization
                          │
                          ▼
              ┌────────────────────────┐
              │ Rule-Based Evaluation  │
              └────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
      Security Rules              Behavioral Analysis
            │                           │
            └─────────────┬─────────────┘
                          ▼
                 ML / Anomaly Analysis
                          │
                          ▼
                  Hybrid Classification
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
            SAFE      SUSPICIOUS     ROGUE
              │           │           │
              └───────────┴───────────┘
                          │
                          ▼
                Alerts / Active Defense
```

---

 🛡️ Active Defense

NetMoat includes defensive response mechanisms for detected rogue networks.

 Automatic protection

When enabled, NetMoat can automatically disconnect the current Wi-Fi connection if the connected access point is classified as rogue.

 Manual network blocking

Users can also place a network BSSID on a personal blacklist.

Blacklisted networks are treated as rogue by the frontend security layer.

 Windows network disconnect

The backend can execute:

```text
netsh wlan disconnect
```

to disconnect from the currently connected wireless network.

---

 🔔 Security Alerts

NetMoat can generate security alerts when rogue networks are detected.

Alerts can include:

* SSID
* BSSID
* Threat classification
* Detection reasons
* Signal strength
* Security information

Email notifications are supported through:

* Resend
* SMTP / Nodemailer

The backend also prevents repeated alerts for the same BSSID during the same monitoring period.

---

 📊 Security Dashboard

The React dashboard provides a centralized view of the wireless security environment.

The application includes dedicated interfaces for:

* Dashboard
* Networks
* Network Scanning
* Alerts
* Reports
* Settings
* Authentication

The dashboard also provides scanner diagnostics and hardware-access status.

---

 🌐 Application Pages

 Dashboard

Provides an overview of:

* Current network environment
* Security status
* Threat levels
* Scanner state
* Current connection
* Hardware scanning status

---

 Networks

Provides a searchable and filterable list of detected networks.

Network filters include:

```text
All
Active
Saved
Safe
Suspicious
Rogue
```

Network information includes:

* SSID
* BSSID
* Signal
* Encryption
* Security status
* Detection reasons
* Activity state

---

 Network Scanning

Provides the operational scanning interface.

Users can:

* Start monitoring
* Pause monitoring
* Resume monitoring
* View active networks
* View saved profiles
* Monitor scan state
* Check scanner errors

---

 Alerts

The Alerts interface converts detected suspicious and rogue network conditions into security events.

It provides:

* Severity classification
* Threat descriptions
* Investigation state
* Search
* Filtering
* Security event visibility

---

 Reports

The Reports section combines live and historical network information stored in Firebase.

It supports filtering and report generation workflows.

Supported export formats include:

```text
PDF
CSV
JSON
```

---

 Settings

Security and application settings include:

* Scan interval
* Automatic disconnect behavior
* Alert preferences
* Sensitivity configuration
* Theme preferences
* Email verification workflow
* Security configuration

---

 🔐 Authentication

NetMoat uses Firebase Authentication for user identity management.

The authentication layer supports:

* User registration
* Email/password login
* Logout
* Password recovery
* Email verification workflows
* Protected application routes
* User-specific security data

Authenticated users are routed through the protected application layout.

---

 ☁️ Firebase Integration

Firebase Firestore is used to persist security-related information.

Stored information can include:

 User sessions

```text
users/{uid}/sessions/
```

 Discovered networks

```text
users/{uid}/discovered_networks/
```

 Security events

```text
users/{uid}/security_events/
```

 Security settings

```text
users/{uid}/security_policy/
```

 Network blacklist

```text
users/{uid}/blacklist_items/
```

This allows users to retain network discovery history and security information across monitoring sessions.

---

 🔒 Firestore Security

Firestore rules isolate user data using the authenticated Firebase UID.

The security model follows:

```text
Authenticated User
        │
        ▼
request.auth.uid
        │
        ▼
users/{userId}/...
        │
        ▼
Access allowed only when:
request.auth.uid == userId
```

Global configuration is read-only for authenticated users, while user-specific data is isolated by user ID.

---

 🏗️ Architecture

NetMoat uses a React + TypeScript frontend with an Express-based local security engine.

```text
┌─────────────────────────────────────────────┐
│                 React Frontend              │
│                                             │
│ Dashboard │ Networks │ Scanning │ Alerts    │
│ Reports   │ Settings │ Authentication       │
└──────────────────────┬──────────────────────┘
                       │
                       │ REST API
                       ▼
┌─────────────────────────────────────────────┐
│              Express Security Engine        │
│                                             │
│ API Layer                                   │
│ ├── Network Discovery                       │
│ ├── Connection Monitoring                   │
│ ├── Threat Evaluation                      │
│ ├── ML Inference                            │
│ ├── Email Alerts                            │
│ └── Active Defense                          │
└──────────────────────┬──────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Windows      ML Models    Firebase
       netsh       ONNX/Models   Firestore
          │            │            │
          ▼            ▼            ▼
       Wi-Fi       Detection      Persistent
       Hardware    Analysis       Security Data
```

---

 🔄 Monitoring Pipeline

The monitoring process follows this workflow:

```text
1. Discover nearby Wi-Fi networks
                ↓
2. Parse SSID / BSSID / signal / encryption
                ↓
3. Track network history
                ↓
4. Evaluate security characteristics
                ↓
5. Analyze RSSI and behavioral patterns
                ↓
6. Detect duplicate SSIDs / Evil Twins
                ↓
7. Apply ML inference where available
                ↓
8. Produce Safe / Suspicious / Rogue classification
                ↓
9. Persist security information
                ↓
10. Generate alerts when required
                ↓
11. Apply defensive response when configured
```

---

 🛠️ Technology Stack

 Frontend

* React 18
* TypeScript
* Vite
* React Router
* Tailwind CSS
* Radix UI
* shadcn/ui components
* Lucide React
* Recharts
* React Hook Form
* TanStack React Query
* Framer Motion

 Backend

* Node.js
* Express 5
* CORS
* dotenv
* Nodemailer
* Resend

 Security & ML

* ONNX Runtime
* KNN inference
* Isolation Forest artifacts
* Custom feature extraction
* RSSI behavioral analysis
* OUI/vendor analysis
* Evil Twin detection
* Network blacklist
* Active disconnect response

 Cloud / Persistence

* Firebase Authentication
* Firebase Firestore

 Development

* TypeScript
* ESLint
* PostCSS
* Tailwind CSS
* Vite

---

 📁 Project Structure

```text
NetMoat/
│
├── public/
│   └── Static public assets
│
├── server/
│   ├── index.js
│   ├── scanner.js
│   ├── engine.js
│   └── ml/
│       └── featureExtractor.js
│
├── src/
│   ├── components/
│   │   ├── auth/
│   │   ├── layout/
│   │   └── ui/
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── WiFiScanContext.tsx
│   │
│   ├── data/
│   │   └── mockData.ts
│   │
│   ├── engine/
│   │   └── Security / scoring / ML logic
│   │
│   ├── lib/
│   │   └── Firebase configuration
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Networks.tsx
│   │   ├── Scanning.tsx
│   │   ├── Alerts.tsx
│   │   ├── Reports.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   │
│   ├── services/
│   │   └── firebase-db.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── firestore.rules
│
├── knn_model.onnx
├── knn_model.pkl
├── isolation_forest.pkl
├── scaler.pkl
├── model_final_meta.json
├── model_params.json
│
├── package.json
├── package-lock.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

 ⚙️ Requirements

 Operating System

NetMoat's live hardware scanner currently targets:

```text
Windows
```

The scanner invokes Windows wireless commands such as:

```text
netsh wlan show networks mode=bssid
netsh wlan show networks
netsh wlan show profiles
netsh wlan show interfaces
```

Non-Windows platforms currently do not provide the same hardware scanning implementation.

---

 Software

Install:

* Node.js 18+
* npm
* Git

For live hardware scanning, Windows administrative privileges may be required.

---

 🚀 Installation

 1. Clone the repository

```bash
git clone https://github.com/SuryaTejaDevi/NetMoat.git
```

```bash
cd NetMoat
```

---

 2. Install dependencies

```bash
npm install
```

---

 🔐 Environment Configuration

Create a local environment file:

```text
.env
```

Configure the required Firebase and notification credentials according to your environment.

Typical backend configuration includes:

```env
PORT=3001

RESEND_API_KEY=your_resend_api_key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password

ALERT_EMAIL=your_alert_email
```

Firebase client configuration should also be configured through the application's expected Vite environment variables.

> Never commit production credentials, SMTP passwords, API keys, or Firebase secrets to Git.

---

 ▶️ Running NetMoat

NetMoat consists of two development processes:

```text
React/Vite Dashboard
        +
Express Security Engine
```

 Terminal 1 — Start the security engine

```bash
npm run engine
```

The backend runs on:

```text
http://localhost:3001
```

---

 Terminal 2 — Start the React dashboard

```bash
npm run dev
```

Vite will provide the development URL, normally:

```text
http://localhost:5173
```

Open that address in your browser.

---

 🏭 Production Build

Build the React application:

```bash
npm run build
```

Then start the Express engine:

```bash
npm start
```

The Express server is configured to serve the generated frontend build from the `dist` directory.

---

 🧪 Development Validation

Run ESLint:

```bash
npm run lint
```

Run the complete validation command:

```bash
npm run validate
```

The validation command performs:

```text
ESLint
+
TypeScript type checking
```

---

 🔌 API Endpoints

 Get Network State

```http
GET /api/networks
```

Returns:

* Detected networks
* Current connection
* Scanner error state
* Scan type
* Timestamp

---

 Request Windows Elevation

```http
POST /api/elevate
```

Requests elevated execution for the security engine through Windows UAC.

---

 Disconnect Current Network

```http
POST /api/disconnect
```

Disconnects the current Wi-Fi connection using the Windows wireless interface.

---

 Send OTP

```http
POST /api/send-otp
```

Used by the authentication/email verification workflow.

---

 ML Prediction

```http
POST /api/predict
```

Accepts a numerical feature vector and returns the available ML prediction and anomaly information.

Example:

```json
{
  "features": [
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0
  ]
}
```

---

 📡 Scanner Modes

NetMoat distinguishes between different levels of wireless visibility.

 Live Hardware Mode

Provides BSSID-level information from the Windows wireless interface.

```text
LIVE_HARDWARE
```

This mode provides the most detailed network visibility.

---

 Basic Active Mode

Uses available Windows wireless discovery information when full BSSID-level visibility is unavailable.

```text
BASIC_ACTIVE
```

---

 Profile Discovery

Saved Windows Wi-Fi profiles can still be discovered when hardware-level scanning is restricted.

```text
PROFILE_DISCOVERY
```

This mode does not provide the same visibility as live radio scanning.

---

 📊 Threat Classification

NetMoat uses three primary classifications.

 Safe

No currently detected security indicators meet the configured threat conditions.

 Suspicious

One or more indicators require investigation.

Examples include:

* Open networks
* WEP networks
* Behavioral anomalies
* Vendor inconsistencies
* ML anomaly indicators

 Rogue

The network has stronger indicators of unauthorized or deceptive behavior.

Examples include:

* Duplicate SSID / Evil Twin detection
* Significant spatial inconsistency
* ML rogue classification
* Active blacklist match

---

 🧮 RSSI & Distance Analysis

NetMoat converts Windows signal percentage into an approximate RSSI value.

It then estimates distance using a log-distance path-loss model.

Conceptually:

```text
RSSI
 ↓
Estimated distance
 ↓
Historical distance
 ↓
Spatial consistency analysis
 ↓
Threat evaluation
```

Distance estimates are approximate and should not be interpreted as physical positioning data.

---

 💾 Data Persistence

NetMoat maintains both live and historical network information.

The application can persist:

* Network discovery history
* Scan sessions
* Security events
* User settings
* Network blacklist entries
* ML-related network metadata

Firebase listeners are used to keep historical information synchronized with the application.

---

 🧩 Security Design

NetMoat uses several defensive controls:

* Firebase authenticated access
* User-specific Firestore paths
* Protected React routes
* Network blacklist
* Automatic disconnect option
* Security event logging
* Email security alerts
* Environment-based credentials
* Windows UAC integration

Firestore rules restrict user data access to the authenticated user's UID.

---

 ⚠️ Current Implementation Notes

NetMoat is an actively developed security research project rather than a production-grade enterprise wireless IDS.

Some capabilities are implemented as supporting infrastructure rather than fully integrated production pipelines.

 ML integration

The repository contains ML artifacts and ONNX inference support. The main monitoring loop also contains an ML inference integration path, while some of that path is currently disabled/commented during normal network-cycle processing.

The standalone `/api/predict` endpoint remains available for ML inference.

 Platform support

The hardware scanner is currently implemented around Windows `netsh wlan` commands.

Linux and macOS wireless scanning are not currently implemented through the same scanner.

 Distance estimation

RSSI-based distance calculations are approximate and affected by:

* Walls
* Interference
* Antenna characteristics
* Access point transmit power
* Device orientation
* Environmental conditions

Therefore distance should be treated as a security-analysis signal rather than precise physical positioning.

---

 🔒 Responsible Use

NetMoat is intended for:

* Cybersecurity education
* Wireless security research
* Defensive network monitoring
* Authorized security assessments
* Personal network auditing
* Security engineering experimentation

Do not scan, disconnect from, interfere with, or otherwise interact with networks without appropriate authorization.

---

🔮 Future Improvements

Potential development directions include:

* [ ] Cross-platform Wi-Fi scanning
* [ ] More robust ML inference integration
* [ ] Automated model retraining pipeline
* [ ] Improved Evil Twin confidence scoring
* [ ] More accurate vendor/OUI database
* [ ] Wireless channel analysis
* [ ] Network topology visualization
* [ ] Stronger historical analytics
* [ ] Real security-event timeline
* [ ] Improved report generation
* [ ] Background Windows service
* [ ] Hardware capability detection
* [ ] Advanced anomaly detection
* [ ] Dockerized backend for supported environments
* [ ] Automated security testing
* [ ] Expanded audit logging

---

👨‍💻 Author

Surya Teja Devi

GitHub:

[https://github.com/SuryaTejaDevi](https://github.com/SuryaTejaDevi)

Repository:

[https://github.com/SuryaTejaDevi/NetMoat](https://github.com/SuryaTejaDevi/NetMoat)

---

📄 License

This project is currently provided as a personal/educational cybersecurity project.

Add an explicit open-source license to the repository if you intend to permit reuse, modification, and redistribution.

---

⭐ Project Summary

NetMoat combines:

```text
Windows Wi-Fi Discovery
        +
Behavioral Security Analysis
        +
Rogue AP Detection
        +
Evil Twin Detection
        +
ML Inference
        +
Firebase Persistence
        +
Security Alerts
        +
Active Defense
```
