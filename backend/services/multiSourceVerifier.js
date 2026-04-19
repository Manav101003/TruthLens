// multiSourceVerifier.js — Consensus engine for multi-source claim verification
// Enhances Wikipedia-based results with CrossRef + Wikidata + optional Google/NewsAPI.
// Falls back to Wikipedia-only if additional sources fail.

const { lookupWikidata } = require('../integrations/wikidata');
const { lookupCrossRef } = require('../integrations/crossRefClaims');
const { lookupGoogleSearch, isGoogleSearchEnabled } = require('../integrations/googleSearch');
const { lookupNewsAPI, isNewsAPIEnabled } = require('../integrations/newsapi');
const { calculateKeywordMatch } = require('./verification');
const { calculateSemanticMatch } = require('./semanticMatcher');

/**
 * Check if multi-source verification is enabled via environment variable.
 * Defaults to true if not set.
 */
function isMultiSourceEnabled() {
  const envVal = process.env.MULTI_SOURCE_ENABLED;
  if (envVal === 'false' || envVal === '0') return false;
  return true;
}

/**
 * Classify a source's vote based on its match ratio.
 * IMPROVED: Lowered thresholds so that partial matches (common with paraphrased text)
 * are properly classified as supporting instead of neutral.
 *   - 'supporting'     if match >= 0.15 (meaningful overlap — lowered from 0.25)
 *   - 'contradicting'  if found but match < 0.08 (source exists but strongly disagrees)
 *   - 'neutral'        if not found or match is ambiguous
 */
function classifySourceVote(found, matchRatio) {
  if (!found) return 'neutral';
  if (matchRatio >= 0.15) return 'supporting';
  if (matchRatio < 0.08) return 'contradicting';
  return 'neutral';
}

/**
 * Build the list of source lookup promises based on what's available.
 * Always includes: CrossRef, Wikidata
 * Optionally includes: Google Custom Search, NewsAPI (if API keys configured)
 */
function buildSourceQueries(searchQuery) {
  const queries = [
    // Source: CrossRef (research papers — always available, no key needed)
    {
      name: 'crossref',
      promise: lookupCrossRef(searchQuery).catch(() => ({ found: false }))
    },
    // Source: Wikidata (structured entity data — always available, no key needed)
    {
      name: 'wikidata',
      promise: lookupWikidata(searchQuery).catch(() => ({ found: false }))
    }
  ];

  // Optional: Google Custom Search (if GOOGLE_API_KEY + GOOGLE_CSE_ID are set)
  if (isGoogleSearchEnabled()) {
    queries.push({
      name: 'google',
      promise: lookupGoogleSearch(searchQuery).catch(() => ({ found: false }))
    });
  }

  // Optional: NewsAPI (if NEWS_API_KEY is set)
  if (isNewsAPIEnabled()) {
    queries.push({
      name: 'newsapi',
      promise: lookupNewsAPI(searchQuery).catch(() => ({ found: false }))
    });
  }

  return queries;
}

/**
 * Enhance a single claim's verification with multi-source consensus.
 *
 * @param {Object} claim - The raw claim object (text, primaryEntity, keywords, numbers)
 * @param {Object} wikiVerification - The existing Wikipedia verification result
 * @returns {Object|null} Multi-source enhancement data, or null if disabled/skipped
 */
async function enhanceWithMultiSource(claim, wikiVerification) {
  // If disabled, return null (no-op)
  if (!isMultiSourceEnabled()) {
    return null;
  }

  const searchQuery = claim.primaryEntity || claim.keywords.join(' ');
  if (!searchQuery || searchQuery.trim().length === 0) {
    return null;
  }

  // ---- Source Results Collector ----
  const sourceResults = [];

  // Source 1: Wikipedia (already computed — just record its result)
  const wikiMatchRatio = wikiVerification.keywordMatchRatio || 0;
  const wikiFound = wikiVerification.wikiResult?.found || false;
  sourceResults.push({
    source: 'wikipedia',
    found: wikiFound,
    match: Math.round(wikiMatchRatio * 100) / 100,
    vote: classifySourceVote(wikiFound, wikiMatchRatio)
  });

  // Build and execute additional source queries in parallel
  const sourceQueries = buildSourceQueries(searchQuery);
  let additionalResults;
  try {
    additionalResults = await Promise.all(
      sourceQueries.map(sq => sq.promise)
    );
  } catch {
    // Total failure of all additional sources — fall back to Wikipedia only
    additionalResults = sourceQueries.map(() => ({ found: false }));
  }

  // Score each additional source using ENHANCED matching (semantic + keyword)
  for (let i = 0; i < sourceQueries.length; i++) {
    const result = additionalResults[i];
    const sourceName = sourceQueries[i].name;
    const extractText = result?.extract || result?.abstract || result?.description || '';

    let matchRatio = 0;
    if (result?.found && extractText) {
      // Use keyword match as base
      const kwMatch = calculateKeywordMatch(claim.keywords, claim.numbers, extractText);

      // Enhanced with semantic match (graceful fallback)
      let semMatch = 0;
      try {
        const semResult = calculateSemanticMatch(claim.text, extractText);
        semMatch = semResult.score || 0;
      } catch { semMatch = 0; }

      // Take the better of keyword and semantic
      matchRatio = Math.max(kwMatch, semMatch);
    }

    sourceResults.push({
      source: sourceName,
      found: !!result?.found,
      match: Math.round(matchRatio * 100) / 100,
      vote: classifySourceVote(result?.found, matchRatio)
    });
  }

  // ---- Consensus Calculation ----
  const totalSources = sourceResults.length;
  const supportingCount = sourceResults.filter(s => s.vote === 'supporting').length;
  const contradictingCount = sourceResults.filter(s => s.vote === 'contradicting').length;
  const agreementScore = Math.round((supportingCount / totalSources) * 100) / 100;

  // ---- Enhanced Confidence ----
  // Blend: 70% original Wikipedia confidence + 30% multi-source agreement
  // (CrossRef/Wikidata often return neutral for general knowledge, so we don't let them drag scores down)
  const entityBonus = wikiVerification.entityFound ? 0.3 : 0;
  const topicBonus = wikiFound ? 0.2 : 0;
  const originalScore = Math.min(1, (wikiMatchRatio * 0.5) + entityBonus + topicBonus);
  let blendedConfidence = Math.round(((originalScore * 0.7) + (agreementScore * 0.3)) * 100) / 100;

  // Apply contradiction penalty from Wikipedia
  if (wikiVerification.hasContradiction) {
    blendedConfidence = Math.max(0, blendedConfidence - 0.25);
  }

  // Clamp
  blendedConfidence = Math.max(0, Math.min(1, blendedConfidence));

  // ---- Enhanced Status (consensus-based) ----
  // IMPROVED: 2+ supporting sources → verified (was: majority needed)
  let enhancedStatus;
  if (wikiVerification.hasContradiction && contradictingCount >= 1) {
    // Wikipedia AND another source contradict → hallucinated
    enhancedStatus = 'hallucinated';
  } else if (supportingCount >= 2) {
    // At least 2 sources agree → verified (lowered from majority)
    enhancedStatus = 'verified';
  } else if (supportingCount >= Math.ceil(totalSources / 2)) {
    // Majority of sources agree → verified
    enhancedStatus = 'verified';
  } else if (supportingCount >= 1 || agreementScore >= 0.25) {
    // At least one source supports → unverified (was: 0.33 threshold)
    enhancedStatus = 'unverified';
  } else {
    // No support from any source but no explicit contradiction either → unverified (NOT hallucinated)
    enhancedStatus = wikiVerification.hasContradiction ? 'hallucinated' : 'unverified';
  }

  // Safety: if Wikipedia found a contradiction, never upgrade to verified
  if (wikiVerification.hasContradiction && enhancedStatus === 'verified') {
    enhancedStatus = 'unverified';
  }

  return {
    sources_checked: totalSources,
    agreement_score: agreementScore,
    source_results: sourceResults,
    enhanced_confidence: blendedConfidence,
    enhanced_status: enhancedStatus
  };
}

/**
 * Generate multi-source summary statistics for the audit report.
 * @param {Object[]} claimsWithMultiSource - Array of claims that have multi-source data
 * @returns {Object} Summary stats
 */
function generateMultiSourceSummary(claimsWithMultiSource) {
  const withData = claimsWithMultiSource.filter(c => c.sources_checked > 0);
  if (withData.length === 0) {
    return {
      total_sources_available: getAvailableSourceCount(),
      avg_agreement_score: 0,
      multi_source_enabled: isMultiSourceEnabled(),
      sources: getAvailableSources()
    };
  }

  const avgAgreement = withData.reduce((sum, c) => sum + c.agreement_score, 0) / withData.length;

  return {
    total_sources_available: getAvailableSourceCount(),
    avg_agreement_score: Math.round(avgAgreement * 100) / 100,
    multi_source_enabled: true,
    sources: getAvailableSources()
  };
}

/**
 * Get count of all available verification sources.
 */
function getAvailableSourceCount() {
  let count = 3; // Wikipedia + CrossRef + Wikidata (always available)
  if (isGoogleSearchEnabled()) count++;
  if (isNewsAPIEnabled()) count++;
  return count;
}

/**
 * Get list of available source names.
 */
function getAvailableSources() {
  const sources = ['wikipedia', 'crossref', 'wikidata'];
  if (isGoogleSearchEnabled()) sources.push('google');
  if (isNewsAPIEnabled()) sources.push('newsapi');
  return sources;
}

module.exports = { enhanceWithMultiSource, generateMultiSourceSummary, isMultiSourceEnabled };
