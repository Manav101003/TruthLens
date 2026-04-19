# VerityLens — Hallucination Audit System

## Overview

TruthLens is a veracity analysis system designed to detect and evaluate hallucinations in AI-generated content. It processes textual input, extracts factual claims, verifies them against reliable knowledge sources, and produces a structured audit report.

The system classifies claims into verified, unverified, and hallucinated categories while assigning confidence scores based on source agreement and semantic consistency.

---

## Problem Statement

Large Language Models (LLMs) are known to generate incorrect or fabricated information, including false facts and non-existent citations. This lack of reliability presents a significant challenge in domains that require factual accuracy.

TruthLens addresses this issue by providing a transparent and systematic verification pipeline.

---

## Key Features

* Atomic claim extraction from complex text
* Multi-source verification using trusted knowledge bases
* Detection of hallucinated or misleading statements
* Citation and DOI validation
* Confidence scoring based on verification results
* Dual-mode operation:

  * Standard Mode for deterministic verification
  * Agent Mode for enhanced reasoning using LLMs
* Structured report generation for analysis and presentation

---

## System Architecture

The system follows a multi-stage verification pipeline:

### 1. Claim Extraction

Text is segmented into smaller, verifiable factual statements using natural language processing techniques.

### 2. Verification Engine

Each claim is cross-checked against reliable sources such as Wikipedia and other public knowledge bases.

### 3. Citation and Consistency Analysis

References, URLs, and DOIs are validated to detect fabricated or invalid citations.

---

## Technology Stack

### Frontend

* React.js (Vite)
* Tailwind CSS

### Backend

* Node.js
* Express.js

### Agent Layer

* Python
* LangGraph
* Groq API (Llama 3.1 70B)

### External Integrations

* Wikipedia API
* Wikidata
* DuckDuckGo Instant Answers
* CrossRef API

### Database (Optional)

* Supabase (PostgreSQL)

---

## Installation and Setup

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/TruthLens.git
cd TruthLens
```

---

### 2. Backend Setup

```bash
cd backend
npm install
npm run dev
```

---

### 3. Agent Setup

```bash
cd agent
pip install -r requirements.txt
python main.py
```

---

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

### Backend

```
PORT=5000
```

### Agent

```
GROQ_API_KEY=your_api_key_here
```

---

## Usage

1. Launch all services (frontend, backend, agent)
2. Open the application in the browser
3. Input AI-generated text
4. Run analysis
5. Review classification results and confidence scores

---

## Limitations

* Accuracy depends on availability and consistency of external data sources
* Complex or highly descriptive text may require improved claim extraction
* Agent mode may be affected by API rate limits

---

## Future Enhancements

* Integration of additional trusted data sources
* Improved semantic matching and tolerance handling
* Browser extension for real-time verification
* Enterprise-grade reporting dashboard

---

## License

This project is licensed under the MIT License.

---

## Conclusion

TruthLens provides a structured and transparent approach to verifying AI-generated content. It enables users to critically assess the reliability of generated information and supports responsible AI usage.
