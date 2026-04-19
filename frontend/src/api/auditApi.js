import axios from 'axios';

const API_BASE = '/api/v1';

/**
 * Run a hallucination audit on LLM-generated text
 */
export async function analyzeText(text, options = {}) {
  const response = await axios.post(`${API_BASE}/analyze`, { text, ...options }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000
  });
  return response.data;
}

/**
 * Retrieve a previously saved audit by session ID
 */
export async function getAudit(sessionId) {
  const response = await axios.get(`${API_BASE}/audit/${sessionId}`, {
    timeout: 10000
  });
  return response.data;
}

/**
 * Run the LangGraph agentic verification pipeline.
 * Calls the agent-analyze endpoint which proxies to the Python agent
 * (or falls back to standard pipeline if agent is unreachable).
 * Longer timeout since agent may loop through multiple iterations.
 */
export async function agentAnalyze(text, options = {}) {
  const response = await axios.post(`${API_BASE}/agent-analyze`, { text, ...options }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 180000
  });
  return response.data;
}

/**
 * Upload a document (PDF, DOCX, TXT) and extract text from it.
 * Returns { success, text, metadata: { fileName, fileSize, fileType, extractedLength, truncated } }
 */
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('document', file);
  const response = await axios.post(`${API_BASE}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000
  });
  return response.data;
}

/**
 * Health check
 */
export async function checkHealth() {
  const response = await axios.get(`${API_BASE}/health`, {
    timeout: 5000
  });
  return response.data;
}
