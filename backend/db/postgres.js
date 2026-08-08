// postgres.js — Local PostgreSQL connector for TruthLens
const { Pool, Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pgUser = process.env.PG_USER || 'postgres';
const pgPassword = process.env.PG_PASSWORD || 'postgres';
const pgHost = process.env.PG_HOST || 'localhost';
const pgPort = parseInt(process.env.PG_PORT || '5432', 10);
const pgDatabase = process.env.PG_DATABASE || 'truthlens';

let pool = null;
let isConnected = false;

/**
 * Bootstrap the PostgreSQL database and tables
 */
async function bootstrapDb() {
  // Step 1: Connect to default 'postgres' database to check/create target database
  const client = new Client({
    user: pgUser,
    password: pgPassword,
    host: pgHost,
    port: pgPort,
    database: 'postgres'
  });

  try {
    await client.connect();
    
    // Check if target database exists
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [pgDatabase]);
    if (res.rowCount === 0) {
      console.log(`🐘 PostgreSQL: Creating database "${pgDatabase}"...`);
      const safeDbName = pgDatabase.replace(/[^a-zA-Z0-9_]/g, '');
      await client.query(`CREATE DATABASE ${safeDbName}`);
      console.log(`🐘 PostgreSQL: Database "${safeDbName}" created successfully.`);
    }
  } catch (error) {
    console.warn('🐘 PostgreSQL: Target database check failed, attempting to connect directly:', error.message);
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }

  // Step 2: Initialize pool for the target database
  pool = new Pool({
    user: pgUser,
    password: pgPassword,
    host: pgHost,
    port: pgPort,
    database: pgDatabase
  });

  // Step 3: Verify connection and setup schemas
  try {
    const client = await pool.connect();
    
    // Create audit_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_email VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        input_text TEXT,
        total_claims INTEGER,
        verified_count INTEGER,
        unverified_count INTEGER,
        hallucinated_count INTEGER,
        trust_score INTEGER,
        citations JSONB DEFAULT '[]'::jsonb
      )
    `);

    // Create claims table
    await client.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) REFERENCES audit_sessions(id) ON DELETE CASCADE,
        claim_index INTEGER,
        claim_text TEXT,
        status VARCHAR(50),
        confidence DOUBLE PRECISION,
        confidence_label VARCHAR(50),
        source_title TEXT,
        source_snippet TEXT,
        source_url TEXT,
        start_char INTEGER,
        end_char INTEGER
      )
    `);

    client.release();
    isConnected = true;
    console.log(`🐘 PostgreSQL: Connected successfully to "${pgDatabase}" and verified schemas.`);
    return true;
  } catch (error) {
    console.error('🐘 PostgreSQL: Connection or schema verification failed:', error.message);
    isConnected = false;
    return false;
  }
}

// Check availability
function isAvailable() {
  return isConnected;
}

// Automatically bootstrap on load in the background
bootstrapDb().catch(err => {
  console.warn('🐘 PostgreSQL: Initial bootstrap failed, will retry on first query:', err.message);
});

/**
 * Insert completed audit
 */
async function insertAudit(auditData, userEmail = null) {
  if (!pool) {
    const success = await bootstrapDb();
    if (!success) throw new Error('PostgreSQL database not available.');
  }

  const sessionId = uuidv4();
  const email = userEmail ? userEmail.toLowerCase().trim() : null;
  const citations = JSON.stringify(auditData.citations || []);

  const sessionQuery = `
    INSERT INTO audit_sessions (
      id, user_email, input_text, total_claims, verified_count, 
      unverified_count, hallucinated_count, trust_score, citations
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  
  const sessionParams = [
    sessionId,
    email,
    auditData.input_text || '',
    auditData.summary?.total_claims || 0,
    auditData.summary?.verified_count || 0,
    auditData.summary?.unverified_count || 0,
    auditData.summary?.hallucinated_count || 0,
    auditData.summary?.trust_score || 0,
    citations
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sessionQuery, sessionParams);

    if (auditData.claims && auditData.claims.length > 0) {
      for (let i = 0; i < auditData.claims.length; i++) {
        const claim = auditData.claims[i];
        const claimQuery = `
          INSERT INTO claims (
            session_id, claim_index, claim_text, status, confidence,
            confidence_label, source_title, source_snippet, source_url,
            start_char, end_char
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        const claimParams = [
          sessionId,
          i + 1,
          claim.text || '',
          claim.status || '',
          claim.confidence || 0,
          claim.confidence_label || '',
          claim.source_title || null,
          claim.source_snippet || null,
          claim.source_url || null,
          claim.start_char || null,
          claim.end_char || null
        ];
        await client.query(claimQuery, claimParams);
      }
    }
    await client.query('COMMIT');
    return sessionId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🐘 PostgreSQL: Error inserting audit:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get audit by ID
 */
async function getAuditById(sessionId) {
  if (!pool) {
    const success = await bootstrapDb();
    if (!success) return null;
  }

  try {
    const sessionRes = await pool.query('SELECT * FROM audit_sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rowCount === 0) return null;

    const session = sessionRes.rows[0];
    const claimsRes = await pool.query('SELECT * FROM claims WHERE session_id = $1 ORDER BY claim_index ASC', [sessionId]);

    return {
      session_id: session.id,
      created_at: session.created_at,
      user_email: session.user_email,
      input_text: session.input_text,
      summary: {
        total_claims: session.total_claims,
        verified_count: session.verified_count,
        unverified_count: session.unverified_count,
        hallucinated_count: session.hallucinated_count,
        trust_score: session.trust_score
      },
      claims: claimsRes.rows.map(c => ({
        id: c.claim_index,
        text: c.claim_text,
        status: c.status,
        confidence: c.confidence,
        confidence_label: c.confidence_label,
        source_title: c.source_title,
        source_snippet: c.source_snippet,
        source_url: c.source_url,
        start_char: c.start_char,
        end_char: c.end_char
      })),
      citations: typeof session.citations === 'string' ? JSON.parse(session.citations) : (session.citations || [])
    };
  } catch (error) {
    console.error('🐘 PostgreSQL: Error fetching audit by ID:', error.message);
    return null;
  }
}

/**
 * Get all audits for a user
 */
async function getAuditsByUser(userEmail) {
  if (!pool) {
    const success = await bootstrapDb();
    if (!success) return [];
  }
  if (!userEmail) return [];

  try {
    const email = userEmail.toLowerCase().trim();
    const res = await pool.query(
      'SELECT * FROM audit_sessions WHERE user_email = $1 ORDER BY created_at DESC',
      [email]
    );

    return res.rows.map(session => ({
      session_id: session.id,
      created_at: session.created_at,
      input_text: session.input_text,
      summary: {
        total_claims: session.total_claims,
        verified_count: session.verified_count,
        unverified_count: session.unverified_count,
        hallucinated_count: session.hallucinated_count,
        trust_score: session.trust_score
      }
    }));
  } catch (error) {
    console.error('🐘 PostgreSQL: Error fetching audits by user:', error.message);
    return [];
  }
}

module.exports = {
  isAvailable,
  bootstrapDb,
  insertAudit,
  getAuditById,
  getAuditsByUser
};
