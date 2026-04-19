// queries.js — Database queries for Supabase (insert/retrieve audits)
const { v4: uuidv4 } = require('uuid');
const { getClient, isAvailable } = require('../integrations/supabase');

/**
 * Insert a completed audit into the database
 * Returns the session_id
 */
async function insertAudit(auditData) {
  const sessionId = uuidv4();

  if (!isAvailable()) {
    // Return the session_id even without persistence
    return sessionId;
  }

  const supabase = getClient();

  try {
    // Insert audit session
    const { error: sessionError } = await supabase
      .from('audit_sessions')
      .insert({
        id: sessionId,
        input_text: auditData.input_text,
        total_claims: auditData.summary.total_claims,
        verified_count: auditData.summary.verified_count,
        unverified_count: auditData.summary.unverified_count,
        hallucinated_count: auditData.summary.hallucinated_count,
        trust_score: auditData.summary.trust_score
      });

    if (sessionError) {
      console.error('Error inserting audit session:', sessionError.message);
      return sessionId; // Still return ID even if DB fails
    }

    // Insert individual claims
    const claimRows = auditData.claims.map((claim, index) => ({
      session_id: sessionId,
      claim_index: index + 1,
      claim_text: claim.text,
      status: claim.status,
      confidence: claim.confidence,
      confidence_label: claim.confidence_label,
      source_title: claim.source_title,
      source_snippet: claim.source_snippet,
      source_url: claim.source_url,
      start_char: claim.start_char,
      end_char: claim.end_char
    }));

    const { error: claimsError } = await supabase
      .from('claims')
      .insert(claimRows);

    if (claimsError) {
      console.error('Error inserting claims:', claimsError.message);
    }

    return sessionId;
  } catch (error) {
    console.error('Database error:', error.message);
    return sessionId;
  }
}

/**
 * Retrieve a previously saved audit by session_id
 */
async function getAuditById(sessionId) {
  if (!isAvailable()) {
    return null;
  }

  const supabase = getClient();

  try {
    // Get audit session
    const { data: session, error: sessionError } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return null;
    }

    // Get claims for this session
    const { data: claims, error: claimsError } = await supabase
      .from('claims')
      .select('*')
      .eq('session_id', sessionId)
      .order('claim_index', { ascending: true });

    if (claimsError) {
      return null;
    }

    return {
      session_id: session.id,
      created_at: session.created_at,
      summary: {
        total_claims: session.total_claims,
        verified_count: session.verified_count,
        unverified_count: session.unverified_count,
        hallucinated_count: session.hallucinated_count,
        trust_score: session.trust_score
      },
      claims: claims.map(c => ({
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
      }))
    };
  } catch (error) {
    console.error('Database error:', error.message);
    return null;
  }
}

module.exports = { insertAudit, getAuditById };
