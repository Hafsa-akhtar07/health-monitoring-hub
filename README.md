# Health Monitoring Hub (HMH)

Health Monitoring Hub (HMH) is a web‑based system that turns CBC lab reports into
clear, patient‑friendly insights. It can:

- extract values from uploaded CBC reports (image/PDF) using OCR or manual entry
- compare values against reference ranges and flag abnormalities
- provide a basic severity assessment (normal / mild / critical)
- show detailed explanations per parameter
- generate lifestyle, diet and medicine (informational) suggestions
- store reports in PostgreSQL and visualize health trends over time

> **Clinical Disclaimer:** All outputs are for educational/awareness purposes only and
> **not** a substitute for professional medical advice, diagnosis, or treatment.

---

## Features (Sprint‑1 Working Build)

- **Report Upload & OCR**
  - Upload CBC report as image/PDF (JPG, PNG, PDF)
  - Python PaddleOCR + custom parsers extract CBC text and convert to structured JSON
  - Fallback manual entry form if OCR fails

- **Abnormality Detection & Severity**
  - Reference ranges for key CBC parameters (Hb, WBC, RBC, Platelets, Hct, MCV, MCH, MCHC, RDW)
  - Classifies each value as normal / mild / abnormal / critical
  - Overall severity badge + counts (normal / abnormal / critical)

- **AI‑Assisted Results Page**
  - Rich, themed **Analysis Results** view with parameter cards
  - Natural‑language explanation per parameter
  - AI‑style recommendations card (diet, lifestyle, medicines – informational only)
  - Uses backend `openAIService` when `OPENAI_API_KEY` is configured, otherwise
    falls back to rule‑based suggestions mapped from detected conditions

- **Storage & History**
  - All reports stored in PostgreSQL `reports` table with `extracted_data` (JSONB) and `created_at`
  - Placeholder History/Trends components and routes in the frontend (graphs planned next)

- **User Experience**
  - Modern React/Tailwind UI for upload, results, and navigation
  - Logout confirmation modal instead of browser `confirm()`

---

## Tech Stack

- **Frontend**
  - React + Vite
  - Tailwind/CSS + custom components

- **Backend (API)**
  - Node.js, Express
  - PostgreSQL (via `pg`)

- **OCR & Parsing**
  - Python, PaddleOCR
  - Custom parsers for lab‑specific and universal formats

- **AI & ML**
  - OpenAI Chat Completions API (diet/lifestyle/medicine suggestions)
  - Rule‑based CBC analysis + mock ML block (real ML model planned)

---

## Repository Structure

```text
HMH-Project/
├── backend/               # Node/Express API + DB initializer
│   ├── routes/            # upload, reports, analyze, history, etc.
│   ├── services/          # OCR, rule detection, OpenAI, reference ranges
│   ├── ocr-code/          # PaddleOCR + parsers (Python)
│   ├── ocr-service/       # Python API wrapper around OCR (optional)
│   ├── server.js          # Express server entry
│   └── package.json
├── frontend/              # React + Vite client
│   ├── src/components/    # UploadReport, ResultsDisplay, Dashboard, History, etc.
│   ├── src/App.js
│   └── package.json
├── README.md              # Project summary and setup
└── ...                    # Docs, scripts, etc.
```

---

## Setup & Running (Local)

### 1. Clone the Repository

```bash
git clone https://github.com/Hafsa-akhtar07/health-monitoring-hub.git
cd health-monitoring-hub
```

### 2. Backend API (Node + PostgreSQL)

#### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (running locally)

#### Install dependencies
```bash
cd backend
npm install
```

#### Configure environment
Create `backend/.env` (or copy from `.env.example` if present):

```env
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/health_monitoring_hub

# Optional: ML service URL
ML_SERVICE_URL=http://localhost:5001


#### Initialize DB & run server
On first start, the backend will create `users`, `reports`, and `analyses` tables.

```bash
cd backend
npm start          # or: npm run dev
```

Backend runs at `http://localhost:5000`.

---

### 3. OCR Service (Python + PaddleOCR)

> You can either run OCR via `backend/ocr-code` directly or use the small `ocr-service`
> wrapper. The Node backend expects an OCR HTTP service when configured.

#### Option A – Direct OCR script (batch, for testing)
```bash
cd backend/ocr-code
pip install -r requirements.txt
python ocr_processor.py      # Processes images in ocr-code/images/
```

#### Option B – OCR HTTP service (recommended)
If using the separate OCR API (e.g., `backend/ocr-service`):

```bash
cd backend/ocr-service
pip install -r requirements.txt
python app.py        # or python ocr-service.py depending on your setup
```

Configure the OCR service URL in `backend/routes/upload.js` (via `OCR_SERVICE_URL`
env if needed).

---

### 4. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open the app at the URL printed by Vite (`http://localhost:3000`).

Make sure the backend (`http://localhost:5000`) and OCR service are running first.

---

## CI/CD & Branching (Planned)

- Branches
  - `main` – release‑ready, protected
  - `develop` – integration branch
  - `feature/<name>` – feature work (e.g., `feature/ocr-parser`)

- Planned GitHub Actions pipeline (from D1/D2):
  - Trigger on push/PR to `develop` and `main`
  - Steps:
    - Checkout repo
    - Install backend & frontend dependencies
    - Run lint/tests (to be added)
    - Build frontend bundle
    - (Later) deploy to staging/production

Currently, tests and builds are run manually; CI implementation is scheduled for
next sprints.

---

## Known Issues / TODOs

- PaddleOCR accuracy can vary across lab formats; additional parser tuning needed.
- ML severity block is currently rule‑based + mock; real trained model and service
  integration are pending.
- History & Trends graphs are partially implemented (data stored, visualization WIP).
- OpenAI suggestions may fall back to rule‑based mock if API key is missing or
  the request fails.

---

## License / Usage

This project is developed as an academic Final Year Design Project (FYDP) at
FCIT, University of the Punjab. Clinical use requires validation and approval by
qualified healthcare professionals and relevant authorities.
