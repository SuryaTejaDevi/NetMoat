🛡️ NetMoat — Rogue Wi-Fi Detection & Network Surveillance
🚀 Project Overview

NetMoat is a modern network security application designed to detect, monitor, and analyze rogue Wi-Fi access points in real time. It acts as a lightweight security perimeter for local environments, providing visibility into nearby wireless networks and alerting users to suspicious or unauthorized activity through an intuitive dashboard.

The platform combines real-time scanning, visual analytics, and alerting mechanisms to help users maintain wireless network integrity and security.

✨ Key Features

🔴 Real-Time Security Dashboard
Centralized view of detected networks, risk levels, and system status.

📡 Network Scanning Engine
Manual and automated scans of nearby Wi-Fi access points.

🚨 Alert & Notification System
Instant alerts when suspicious or rogue access points are detected.

🕒 Historical Activity Logs
Persistent records of scans, detections, and alerts for auditing.

📄 Security Reporting
Generate detailed reports for analysis, documentation, and review.

🧰 Tech Stack
Frontend

Vite — Next-generation frontend tooling

React — Component-based UI framework

TypeScript — Strongly typed JavaScript

Tailwind CSS — Utility-first styling

shadcn/ui — Accessible, reusable UI components

Lucide React — Clean and consistent icon set

📡 Real-World Wi-Fi Scanning Setup

To enable live Wi-Fi scanning from your physical environment, follow the steps below carefully:

1️⃣ Enable Location Services (Windows)

Open Settings → Privacy & Security → Location

Turn Location services ON

Enable Let desktop apps access your location

⚠️ Location access is required by the OS to retrieve Wi-Fi network metadata.

2️⃣ Run Terminal as Administrator

Close any existing terminal

Open PowerShell / Command Prompt

Select Run as Administrator

3️⃣ Start the Security Engine
npm run engine

4️⃣ Launch the Dashboard
npm run dev


If any of the above requirements are not met, NetMoat will display a red “Scanner System Issue” banner on the dashboard with clear instructions to resolve the problem.

🛠️ Getting Started
Prerequisites

Node.js v18.0.0 or higher

npm or yarn

Development Mode

Start the development server:

npm run dev


The application will be available at:

http://localhost:5173

🔐 Security & Ethical Use Notice

NetMoat is intended strictly for educational, research, and authorized security testing purposes.
Always ensure you have explicit permission before scanning or monitoring networks that you do not own or manage.

Unauthorized scanning of networks may violate local laws or organizational policies

