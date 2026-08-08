// queries.js — Database queries for PostgreSQL with Local JSON Fallback
const { v4: uuidv4 } = require('uuid');
const { saveLocalAudit, getLocalAuditById, getLocalAuditsByUser } = require('./local_store');
const postgres = require('./postgres');

/**
 * Insert a completed audit into the database
 * Returns the session_id
 */
async function insertAudit(auditData, userEmail = null) {
  // Tier 1: Local PostgreSQL
  if (postgres.isAvailable()) {
    try {
      return await postgres.insertAudit(auditData, userEmail);
    } catch (err) {
      console.warn('🐘 PostgreSQL insert failed, trying Local JSON fallback:', err.message);
    }
  }

  // Tier 2: Local JSON File Fallback
  return saveLocalAudit(auditData, userEmail);
}

/**
 * Retrieve a previously saved audit by session_id
 */
async function getAuditById(sessionId) {
  // Tier 1: Local PostgreSQL
  if (postgres.isAvailable()) {
    const audit = await postgres.getAuditById(sessionId);
    if (audit) return audit;
  }

  // Tier 2: Local JSON File Fallback
  const audit = getLocalAuditById(sessionId);
  if (!audit) return null;
  return {
    session_id: audit.id,
    created_at: audit.created_at,
    user_email: audit.user_email || null,
    input_text: audit.input_text || '',
    summary: audit.summary || {},
    claims: audit.claims || [],
    citations: audit.citations || []
  };
}

/**
 * Retrieve recent audits checked by a user
 */
async function getAuditsByUser(userEmail) {
  if (!userEmail) return [];

  // Tier 1: Local PostgreSQL
  if (postgres.isAvailable()) {
    const audits = await postgres.getAuditsByUser(userEmail);
    if (audits && audits.length > 0) return audits;
  }

  // Tier 2: Local JSON File Fallback
  const localAudits = getLocalAuditsByUser(userEmail);
  return localAudits.map(audit => ({
    session_id: audit.id,
    created_at: audit.created_at,
    input_text: audit.input_text,
    summary: audit.summary
  }));
}

module.exports = { insertAudit, getAuditById, getAuditsByUser };
