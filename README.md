# AI Deviation Detective

> **MVP built to apply for the AI Product Builder (Digital PO) role at Sanofi M&S Accelerator.**

**Live demo → [frontend-nine-lemon-74.vercel.app](https://frontend-nine-lemon-74.vercel.app)**

Upload a pharmaceutical production batch log (CSV) and get an automated deviation analysis in seconds — no manual threshold-tuning, no spreadsheets.

---

## What it does

1. **Detects** — Isolation Forest (scikit-learn) flags statistically unusual readings across all process parameters simultaneously, including subtle multivariate anomalies that single-threshold rules miss
2. **Explains** — A large language model (Llama 3.3 70B via Groq) explains each deviation in business language, identifies probable root causes, and assigns a risk level (HIGH / MEDIUM / LOW)
3. **Reports** — One click generates a structured non-conformity PDF ready for the batch record
4. **Investigates** — An investigation copilot answers follow-up questions about the batch in natural language

---

## Demo

Click **"▶ Launch this demo →"** on the homepage to analyze a pre-built sterile injectable batch log (Batch B441) with 5 injected deviations:

| Deviation | Type | Expected risk |
|---|---|---|
| Temperature spike during HEATING | Univariate, limit breach | HIGH |
| Temp + pressure simultaneously near upper limit | Multivariate, subtle | MEDIUM |
| pH sensor drift during FILLING | Progressive, 25-min window | HIGH |
| Agitator running during HEATING step | Out-of-context parameter | HIGH |
| 15-min data gap during COOLING | SCADA/sensor outage | MEDIUM |

---

## Architecture

```
Next.js 16 (Vercel)
  └── Upload CSV
  └── Results dashboard (sortable by risk, filterable)
  └── Deviation detail panel
  └── Investigation copilot (chat)
  └── Export PDF

FastAPI (Hugging Face Spaces)
  └── POST /analyze  →  pandas + Isolation Forest + LLM
  └── POST /chat     →  LLM with batch context
  └── POST /report   →  fpdf2 PDF generation
```

```
CSV
 ↓
pandas -- parse + validate
 ↓
Isolation Forest -- statistical anomaly detection
 + explicit rules (limit breaches, multivariate co-occurrence, context errors, data gaps)
 ↓
Llama 3.3 70B (Groq) -- explain, root cause, prioritize
 ↓
JSON -> UI + PDF
```

---

## Stack decisions

**Why Isolation Forest + LLM, not LLM alone?**
An LLM is a reasoner, not a statistical detector. On 260 rows with subtle multivariate anomalies, pure LLM detection would miss or hallucinate. IF finds what's statistically unusual; the LLM explains why it matters -- each tool doing what it does well.

**Why Groq (Llama 3.3 70B)?**
Fast inference, generous free tier, structured JSON output. Swappable -- the agent is provider-agnostic.

**Why FastAPI on HF Spaces?**
scikit-learn is Python-native. Keeping ML logic in a proper Python backend is cleaner than JS wrappers. HF Spaces gives a free Docker runtime with no cold-start penalty for this use case.

---

## Limitations (honest)

- Isolation Forest works well on batches up to ~1000 rows. For millions of readings, a pre-filtering step would be needed before LLM analysis.
- The LLM occasionally produces false positives on borderline IF flags -- the LOW filter hides these by default.
- No authentication, no persistent storage -- this is a demo, not a production system.

---

## Run locally

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
GROQ_API_KEY=your_key uvicorn main:app --port 8000
```

**Frontend**
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```
