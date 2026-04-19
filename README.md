<<<<<<< HEAD
<p align="center">
  <img src="https://img.shields.io/badge/TruthLens-v2.0-8b5cf6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiLz48bGluZSB4MT0iMjEiIHkxPSIyMSIgeDI9IjE2LjY1IiB5Mj0iMTYuNjUiLz48L3N2Zz4=&labelColor=1e1e2e" alt="TruthLens v2.0"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=1e1e2e" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=1e1e2e" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Python-LangGraph-3776AB?style=for-the-badge&logo=python&logoColor=white&labelColor=1e1e2e" alt="Python"/>
</p>

# 🔍 TruthLens — Hallucination Audit System

**TruthLens** is a self-correcting agentic verification suite that detects factual hallucinations in LLM-generated text. It cross-references every claim against Wikipedia, Wikidata, CrossRef, and web sources to produce a verified audit report.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Standard Mode** | Fast deterministic verification via Wikipedia & CrossRef |
| **Agent Mode** | LLM-powered 4-node LangGraph pipeline (Miner → Researcher → Auditor → Fixer) |
| **Atomic Claim Splitting** | Breaks complex sentences into independently verifiable facts |
| **Semantic Matching** | Fuzzy matching with synonym support, bigram similarity & numeric tolerance |
| **Multi-Source Consensus** | Aggregates evidence from 5+ sources before classifying claims |
| **Document Upload** | Supports PDF, DOCX, TXT files up to 10MB |
| **PDF Report Export** | Download a full audit trail as a formatted PDF |
| **Live Agent Path** | Visual thinking-step trace showing the agent's decision process |

---

## 📁 Project Structure

```
TruthLens/
├── frontend/                 # React 19 + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/       # UI components (InputPanel, AuditSummary, etc.)
│   │   ├── api/              # API client functions
│   │   ├── utils/            # Report generator, helpers
│   │   ├── App.jsx           # Main application
│   │   └── index.css         # Design system
│   ├── package.json
│   └── vite.config.js
│
├── backend/                  # Node.js + Express API
│   ├── services/             # Core verification pipeline
│   │   ├── claimExtraction.js    # NLP sentence segmentation
│   │   ├── verification.js       # Wikipedia matching + semantic scoring
│   │   ├── scoring.js            # Confidence calculation & classification
│   │   ├── atomicSplitter.js     # Complex sentence decomposition
│   │   ├── semanticMatcher.js    # Fuzzy matching engine
│   │   ├── multiSourceVerifier.js # Cross-source consensus
│   │   ├── citationVerifier.js   # Ghost citation detection
│   │   └── audit.js              # Pipeline orchestrator
│   ├── integrations/         # External API connectors
│   │   ├── wikipedia.js
│   │   ├── wikidata.js
│   │   ├── crossRefClaims.js
│   │   ├── googleSearch.js
│   │   └── newsapi.js
│   ├── server.js             # Express server entry
│   ├── package.json
│   └── .env.example
│
├── agent/                    # Python LangGraph Agent
│   ├── graph/
│   │   ├── nodes/            # LangGraph nodes
│   │   │   ├── miner.py          # Claim extraction via Node.js API
│   │   │   ├── researcher.py     # Evidence gathering
│   │   │   ├── auditor.py        # LLM-powered fact auditing
│   │   │   └── fixer.py          # Hallucination rewriter
│   │   └── tools/            # Agent tools
│   │       ├── truthlens_api.py  # Node.js API connector
│   │       └── serper_search.py  # Web search tool
│   ├── models/
│   │   └── llm.py            # Multi-provider LLM config
│   ├── main.py               # FastAPI server entry
│   ├── requirements.txt
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.x
- **Python** ≥ 3.10
- **npm** ≥ 9.x
- A free **Groq API key** ([console.groq.com](https://console.groq.com)) for Agent mode

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/TruthLens.git
cd TruthLens
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env          # Edit with your keys (optional)
npm install
npm start                     # Runs on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev                   # Runs on http://localhost:5173
```

### 4. Agent Setup (Optional — for Agent Mode)

```bash
cd agent
cp .env.example .env          # Add your Groq API key
pip install -r requirements.txt
python main.py                # Runs on http://localhost:8000
```

### 5. Open the App

Navigate to **http://localhost:5173** in your browser.

---

## ⚙️ Configuration

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000) |
| `SUPABASE_URL` | No | Supabase project URL for persistence |
| `SUPABASE_ANON_KEY` | No | Supabase anonymous key |
| `TRUTHLENS_DEBUG` | No | Set `true` for verbose logging |

### Agent (`agent/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | **Yes** | Groq API key for LLM calls |
| `LLM_PROVIDER` | No | `groq`, `openai`, or `google` (default: groq) |
| `LLM_MODEL` | No | Model name (default: llama-3.3-70b-versatile) |
| `SERPER_API_KEY` | No | Serper.dev key for web search |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend    │────▶│  Wikipedia   │
│  React/Vite  │     │  Express.js  │     │  Wikidata    │
│  :5173       │     │  :5000       │     │  CrossRef    │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │    Agent     │
                    │  LangGraph   │
                    │  FastAPI     │
                    │  :8000       │
                    └──────────────┘
```

**Standard Mode**: Frontend → Backend → Wikipedia/Wikidata/CrossRef → Scored Results

**Agent Mode**: Frontend → Backend → Agent (Miner → Researcher → Auditor → Fixer) → Enhanced Results

---

## 📊 Verification Pipeline

1. **Extraction** — NLP-based sentence segmentation with factual claim filtering
2. **Atomic Splitting** — Complex sentences decomposed into independently verifiable atoms
3. **Verification** — Each claim matched against Wikipedia using semantic + keyword matching
4. **Scoring** — Confidence calculated from entity match, topic presence, and match ratio
5. **Multi-Source** — Cross-referenced with Wikidata, CrossRef, Google, and NewsAPI
6. **Classification** — Claims classified as ✅ Verified, ⚠️ Unverified, or ❌ Hallucinated

---

## 🧪 API Endpoints

### Backend (`:5000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/analyze` | Analyze text (Standard mode) |
| `POST` | `/api/v1/upload` | Upload document for analysis |

### Agent (`:8000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/agent/analyze` | Run full agentic pipeline |
| `GET` | `/health` | Agent health check |

---

## 👥 Team

**Team ExWhyZed**

---

## 📄 License

This project is built for the hackathon. All rights reserved.
=======
# VerityLens
VerityLens is a Veracity Forensic Suite that audits AI-generated content, detects hallucinations, verifies claims using multiple trusted sources, and generates structured trust reports with confidence scoring.
>>>>>>> f5d06257ca8439d0daa6a614416f82075e6d7d71
