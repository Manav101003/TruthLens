// audit.routes.js — API route handlers for TruthLens
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { runAudit } = require('../services/audit');
const { insertAudit, getAuditById } = require('../db/queries');

// Configure multer for file uploads (stored in memory for text extraction)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md', '.rtf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});
/**
 * GET /api/v1/health — Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TruthLens API'
  });
});

/**
 * POST /api/v1/extract-claims — Full-document sentence extraction (used by LangGraph Miner)
 * Returns ALL sentences with is_factual classification for complete document coverage.
 */
router.post('/extract-claims', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Input text required.' });
    }
    
    // Use full-document extraction — returns ALL sentences with is_factual flag
    const { extractAllSentences } = require('../services/claimExtraction');
    const allSentences = extractAllSentences(text);
    
    res.json({ claims: allSentences });
  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: 'Failed to extract claims' });
  }
});

/**
 * POST /api/v1/analyze — Run hallucination audit on LLM-generated text
 */
router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    // Validate input (FR-002)
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Input text must be at least 50 characters.'
      });
    }

    const trimmedText = text.trim();

    if (trimmedText.length < 50) {
      return res.status(400).json({
        error: 'Input text must be at least 50 characters.'
      });
    }

    if (trimmedText.length > 35000) {
      return res.status(400).json({
        error: 'Input text must not exceed 5,000 words (~35,000 characters).'
      });
    }

    // Run the full audit pipeline
    console.log(`\n🔍 Running audit on ${trimmedText.length} characters...`);
    const startTime = Date.now();

    const auditResult = await runAudit(trimmedText);

    // Check if the pipeline returned an error (e.g., no claims found)
    if (auditResult.error) {
      return res.status(auditResult.status || 422).json({
        error: auditResult.error
      });
    }

    // Persist to Supabase (if available)
    const sessionId = await insertAudit(auditResult);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Audit complete in ${elapsed}s — ${auditResult.summary.total_claims} claims analyzed`);
    console.log(`   Trust Score: ${auditResult.summary.trust_score}%`);
    console.log(`   Verified: ${auditResult.summary.verified_count} | Unverified: ${auditResult.summary.unverified_count} | Hallucinated: ${auditResult.summary.hallucinated_count}\n`);

    // Return full audit response
    res.json({
      session_id: sessionId,
      created_at: new Date().toISOString(),
      summary: auditResult.summary,
      claims: auditResult.claims,
      citations: auditResult.citations || [],
      capped: auditResult.capped || false
    });

  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again.'
    });
  }
});

/**
 * GET /api/v1/audit/:session_id — Retrieve a saved audit report
 */
router.get('/audit/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(session_id)) {
      return res.status(400).json({
        error: 'Invalid session ID format.'
      });
    }

    const audit = await getAuditById(session_id);

    if (!audit) {
      return res.status(404).json({
        error: 'Audit session not found.'
      });
    }

    res.json(audit);

  } catch (error) {
    console.error('Retrieve error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again.'
    });
  }
});

/**
 * POST /api/v1/agent-analyze — Run the LangGraph agentic pipeline
 * Proxies to the Python agent service on :8000.
 * Falls back to standard audit if agent is unreachable.
 */
router.post('/agent-analyze', async (req, res) => {
  try {
    const { text, userTier, referenceDocument } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return res.status(400).json({ error: 'Input text must be at least 50 characters.' });
    }

    if (text.trim().length > 35000) {
      return res.status(400).json({ error: 'Input text must not exceed 5,000 words.' });
    }

    const axios = require('axios');
    const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000';

    try {
      console.log(`\n🤖 Proxying to LangGraph agent at ${AGENT_URL}... (Tier: ${userTier || 'enterprise'})`);
      const agentResponse = await axios.post(
        `${AGENT_URL}/agent/analyze`,
        { 
          text: text.trim(),
          user_tier: userTier || 'enterprise',
          reference_document: referenceDocument || null
        },
        { timeout: 180000, headers: { 'Content-Type': 'application/json' } }
      );

      console.log(`✅ Agent response received (${agentResponse.data.iterations_used} iterations)`);
      res.json(agentResponse.data);

    } catch (agentError) {
      // Return actual agent error instead of falling back to slow legacy pipeline
      console.warn('⚠ Agent error:', agentError.message);
      let detail = agentError.response?.data?.detail;
      // Handle Pydantic validation errors (detail is array of objects)
      let msg;
      if (Array.isArray(detail)) {
        msg = detail.map(d => typeof d === 'object' ? (d.msg || JSON.stringify(d)) : String(d)).join('; ');
      } else if (typeof detail === 'object' && detail !== null) {
        msg = JSON.stringify(detail);
      } else {
        msg = detail || agentError.message;
      }
      return res.status(502).json({ 
        error: `Agent pipeline error: ${msg}`
      });
    }

  } catch (error) {
    console.error('Agent-analyze error:', error);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});

/**
 * POST /api/v1/upload — Upload a document and extract text for analysis
 * Supports: PDF, DOCX, TXT, MD, RTF
 * Returns extracted text that the frontend populates into the text input.
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a document.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    let extractedText = '';

    console.log(`\n📄 Processing upload: ${fileName} (${(fileSize / 1024).toFixed(1)}KB, type: ${ext})`);

    switch (ext) {
      case '.pdf': {
        const { PDFParse } = require('pdf-parse');
        // pdf-parse v3+ requires Uint8Array, not Node Buffer
        const uint8 = new Uint8Array(req.file.buffer.buffer, req.file.buffer.byteOffset, req.file.buffer.byteLength);
        const parser = new PDFParse(uint8);
        await parser.load();
        // getText() returns { pages: [{text, num}], text: string, total: number }
        const result = await parser.getText();
        extractedText = result.text || result.pages.map(p => p.text).join('\n\n');
        const info = await parser.getInfo();
        console.log(`   PDF: ${info.total} pages, ${extractedText.length} chars extracted`);
        parser.destroy();
        break;
      }

      case '.docx':
      case '.doc': {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
        if (result.messages && result.messages.length > 0) {
          console.log(`   DOCX warnings: ${result.messages.map(m => m.message).join(', ')}`);
        }
        console.log(`   DOCX: ${extractedText.length} chars extracted`);
        break;
      }

      case '.txt':
      case '.md':
      case '.rtf': {
        extractedText = req.file.buffer.toString('utf-8');
        console.log(`   Text: ${extractedText.length} chars extracted`);
        break;
      }

      default:
        return res.status(400).json({ error: `Unsupported file type: ${ext}` });
    }

    // Clean up extracted text
    extractedText = extractedText
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/--\s*\d+\s*of\s*\d+\s*--/g, '') // Strip pdf-parse page markers
      .replace(/\n{3,}/g, '\n\n')        // Collapse multiple blank lines
      .replace(/[ \t]+/g, ' ')           // Collapse whitespace
      .replace(/^\uFEFF/, '')            // Strip BOM
      .trim();

    if (!extractedText || extractedText.length < 20) {
      return res.status(422).json({
        error: 'Could not extract meaningful text from the uploaded document. The file may be empty, image-based, or corrupted.'
      });
    }

    // Truncate if too long (keep first ~5000 words as per frontend limit)
    const truncated = extractedText.length > 35000;
    if (truncated) {
      extractedText = extractedText.substring(0, 35000);
    }

    console.log(`✅ Upload processed: ${extractedText.length} chars${truncated ? ' (truncated)' : ''}`);

    res.json({
      success: true,
      text: extractedText,
      metadata: {
        fileName,
        fileSize,
        fileType: ext,
        extractedLength: extractedText.length,
        truncated,
      }
    });

  } catch (error) {
    // Handle multer-specific errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${error.message}` });
    }

    console.error('Upload processing error:', error.message);
    res.status(500).json({
      error: `Failed to process document: ${error.message}`
    });
  }
});

module.exports = router;
