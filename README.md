# BLOODO — WhatsApp-First Blood Donor Mobilisation Platform

BLOODO is a WhatsApp-first blood donor mobilisation and coordination platform specifically engineered for licensed blood centres and transfusion teams.

## Clinical Safety Disclaimer
> **Bloodo must never independently approve donor eligibility, determine final transfusion compatibility, or replace clinical crossmatching. Licensed blood-centre professionals retain all clinical responsibilities.**

---

## Architecture Overview

```
BLOODO/
├── prototype/
│   └── bloodo-console.html      # Original reference prototype (preserved untouched)
│
├── frontend/                    # Vite + Vanilla JS (100% preservation of visual identity & UX)
│   ├── src/
│   │   ├── components/          # Bubble fields, overlays, radar map
│   │   ├── engine/              # Eligibility, compatibility matrices, wave logic
│   │   ├── lib/                 # Helpers, icons, formatting
│   │   ├── state/               # State store & persistence
│   │   ├── styles/              # Design system & responsive layouts
│   │   └── views/               # Today, Bookings, Request, Patients, Stock, Donors, Camps, Centre
│   └── package.json
│
├── backend/                     # Node.js + Express + Firebase Admin
│   ├── src/
│   │   ├── middleware/          # Firebase Auth token verification, RBAC (admin/staff/viewer)
│   │   ├── routes/              # WhatsApp webhook, Requests, Donors, Patients, Stock
│   │   ├── services/            # Wave Engine, WhatsApp Cloud API, Eligibility, Audit logs
│   │   └── lib/                 # Firestore init, medical constants
│   └── package.json
│
├── firestore.rules              # Multi-centre isolation & tamper-proof audit rules
└── firebase.json                # Firebase Hosting and Firestore configuration
```

---

## Core Capabilities

1. **Automated Request Waves:**
   - Rule-based donor matching using blood group, component compatibility (RBC, platelets, plasma), location, availability, and recovery rules (90 days for males, 120 days for females).
   - WhatsApp responses supported: `YES`, `NOT NOW`, and `PAUSE`.
   - Quiet-hours queuing with Critical override.

2. **Patient Transfusion Planning & Care Circles:**
   - Dedicated Care Circles for chronic transfusion patients (Thalassemia major, Sickle cell disease).
   - Automated donor rotation so families never have to scramble for donors.

3. **Multi-Centre Isolation & Stock Management:**
   - Isolated records per licensed blood centre.
   - Proactive shelf-life tracking (platelets 5 days, red cells 35 days, plasma 1 year).
   - Inter-centre authorized transfer coordination before units expire.

4. **Security, Privacy & DPDP Compliance:**
   - Global donor deduplication using SHA-256 hashed phone lookups (raw phone numbers never exposed across centres).
   - Tamper-proof, append-only audit trail for all clinical actions.
   - Masked phone numbers in staff views.

---

## Running Locally

### 1. Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

### 2. Backend (Express API)
```bash
cd backend
npm install
npm run dev
```
Runs on [http://localhost:4000](http://localhost:4000).

---

## Repository
GitHub: [https://github.com/mahibalavelusamy-ai/BLOODO-SEVA](https://github.com/mahibalavelusamy-ai/BLOODO-SEVA)

