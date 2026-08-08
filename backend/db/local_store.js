// local_store.js — Zero-config file-based JSON database for TruthLens audits
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORE_PATH = path.join(__dirname, 'local_store.json');

// Helper to read database
function readDb() {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify({ audits: [] }, null, 2));
    }
    const data = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading local JSON database:', error.message);
    return { audits: [] };
  }
}

// Helper to write database
function writeDb(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing local JSON database:', error.message);
    return false;
  }
}

/**
 * Save an audit to the local JSON file
 */
function saveLocalAudit(auditData, userEmail = null) {
  const db = readDb();
  const sessionId = uuidv4();

  const newAudit = {
    id: sessionId,
    user_email: userEmail ? userEmail.toLowerCase().trim() : null,
    created_at: new Date().toISOString(),
    input_text: auditData.input_text || '',
    summary: auditData.summary || {},
    claims: auditData.claims || [],
    citations: auditData.citations || []
  };

  db.audits.push(newAudit);
  writeDb(db);
  return sessionId;
}

/**
 * Get an audit by ID
 */
function getLocalAuditById(sessionId) {
  const db = readDb();
  return db.audits.find(a => a.id === sessionId) || null;
}

/**
 * Get all audits for a specific user
 */
function getLocalAuditsByUser(userEmail) {
  if (!userEmail) return [];
  const db = readDb();
  const email = userEmail.toLowerCase().trim();
  
  return db.audits
    .filter(a => a.user_email === email)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = {
  saveLocalAudit,
  getLocalAuditById,
  getLocalAuditsByUser
};
