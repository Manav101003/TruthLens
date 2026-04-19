// audit.js — Orchestrates the full audit pipeline: extract → verify → score → multi-source → classify + ghost citations
const { extractAllSentences } = require('./claimExtraction');
const { verifyAllClaims } = require('./verification');
const { scoreAndClassifyClaim, generateSummary } = require('./scoring');
const { auditCitations } = require('./citationVerifier');
const { enhanceWithMultiSource, generateMultiSourceSummary } = require('./multiSourceVerifier');

/**
 * Run the full TruthLens audit pipeline on input text.
 * Full-document mode: every sentence is accounted for.
 * Returns: { session_id, created_at, summary, claims, citations, capped }
 */
async function runAudit(text) {
  // Step 1: Extract ALL sentences from text (factual + non-factual)
  const allSentences = extractAllSentences(text);

  if (allSentences.length === 0) {
    return { error: 'No verifiable content was found in the provided text.', status: 422 };
  }

  // Separate factual claims from non-factual sentences
  const factualClaims = allSentences.filter(s => s.is_factual);
  const nonFactualSentences = allSentences.filter(s => !s.is_factual);

  if (factualClaims.length === 0) {
    // All sentences are non-factual — still return a report
    const scoredClaims = allSentences.map((s, index) => ({
      id: index + 1,
      text: s.text,
      status: 'non_verifiable',
      confidence: null,
      confidence_label: 'Non-Verifiable',
      non_verifiable_reason: s.non_verifiable_reason || 'No verifiable factual signal detected',
      start_char: s.start_char,
      end_char: s.end_char,
    }));

    return {
      summary: {
        total_claims: 0,
        total_sentences: allSentences.length,
        verified_count: 0,
        unverified_count: 0,
        hallucinated_count: 0,
        non_verifiable_count: nonFactualSentences.length,
        trust_score: 0,
      },
      claims: scoredClaims,
      citations: [],
      capped: false,
      input_text: text,
    };
  }

  const capped = false; // No cap — full document is processed

  // Step 2: Run claim verification and citation audit in parallel (factual claims only)
  const [verificationResults, citationAudit] = await Promise.all([
    verifyAllClaims(factualClaims),
    auditCitations(text)
  ]);

  // Step 3: Score and classify each factual claim
  const scoredFactualClaims = factualClaims.map((claim, index) => {
    const vResult = verificationResults[index];
    const scored = scoreAndClassifyClaim(claim, vResult, index);

    // Add contradiction mapping details
    if (vResult.hasContradiction && vResult.wikiResult.found) {
      scored.contradiction = {
        claim_says: extractRelevantFragment(claim.text),
        source_says: extractRelevantFragment(vResult.wikiResult.extract),
        source_title: vResult.wikiResult.title
      };
    }

    // Add claim vs source comparison for all claims with sources
    if (vResult.wikiResult.found) {
      scored.comparison = {
        claim_text: claim.text,
        source_text: vResult.wikiResult.extract.substring(0, 300),
        match_ratio: (vResult.keywordMatchRatio * 100).toFixed(0) + '%',
        entity_found: vResult.entityFound
      };
    }

    return scored;
  });

  // Step 3.5: Multi-source verification (enhances but never replaces Wikipedia results)
  try {
    const multiSourceResults = await Promise.all(
      factualClaims.map((claim, index) =>
        enhanceWithMultiSource(claim, verificationResults[index])
          .catch(() => null) // Graceful per-claim fallback
      )
    );

    // Merge multi-source data into each scored claim
    for (let i = 0; i < scoredFactualClaims.length; i++) {
      const msResult = multiSourceResults[i];
      if (msResult) {
        scoredFactualClaims[i].sources_checked = msResult.sources_checked;
        scoredFactualClaims[i].agreement_score = msResult.agreement_score;
        scoredFactualClaims[i].source_results = msResult.source_results;

        // Update confidence and status with multi-source consensus
        scoredFactualClaims[i].confidence = msResult.enhanced_confidence;
        scoredFactualClaims[i].status = msResult.enhanced_status;

        // Recalculate confidence label
        if (msResult.enhanced_confidence >= 0.70) {
          scoredFactualClaims[i].confidence_label = 'High Confidence';
        } else if (msResult.enhanced_confidence >= 0.40) {
          scoredFactualClaims[i].confidence_label = 'Medium Confidence';
        } else {
          scoredFactualClaims[i].confidence_label = 'Low Confidence';
        }
      } else {
        // Fallback: keep original Wikipedia-only values, add empty multi-source fields
        scoredFactualClaims[i].sources_checked = 1;
        scoredFactualClaims[i].agreement_score = scoredFactualClaims[i].confidence;
        scoredFactualClaims[i].source_results = [
          { source: 'wikipedia', found: !!verificationResults[i].wikiResult?.found, match: verificationResults[i].keywordMatchRatio || 0, vote: 'neutral' }
        ];
      }
    }
  } catch (multiSourceError) {
    // If entire multi-source layer fails, log and continue with Wikipedia-only results
    console.warn('⚠ Multi-source verification failed, using Wikipedia-only results:', multiSourceError.message);
    for (let i = 0; i < scoredFactualClaims.length; i++) {
      scoredFactualClaims[i].sources_checked = 1;
      scoredFactualClaims[i].agreement_score = scoredFactualClaims[i].confidence;
      scoredFactualClaims[i].source_results = [
        { source: 'wikipedia', found: !!verificationResults[i].wikiResult?.found, match: verificationResults[i].keywordMatchRatio || 0, vote: 'neutral' }
      ];
    }
  }

  // Step 4: Merge factual and non-factual sentences back in document order
  // Build a map of factual claim positions
  let factualIdx = 0;
  const mergedClaims = allSentences.map((sentence, globalIdx) => {
    if (sentence.is_factual) {
      const scored = scoredFactualClaims[factualIdx];
      factualIdx++;
      return {
        ...scored,
        id: globalIdx + 1, // Re-index by document position
        is_factual: true,
      };
    } else {
      return {
        id: globalIdx + 1,
        text: sentence.text,
        status: 'non_verifiable',
        confidence: null,
        confidence_label: 'Non-Verifiable',
        non_verifiable_reason: sentence.non_verifiable_reason || 'No verifiable factual signal detected',
        start_char: sentence.start_char,
        end_char: sentence.end_char,
        is_factual: false,
      };
    }
  });

  // Step 5: Generate summary statistics (uses potentially updated confidence/status, factual only)
  const summary = generateSummary(scoredFactualClaims);
  summary.total_sentences = allSentences.length;
  summary.non_verifiable_count = nonFactualSentences.length;

  // Step 5.5: Add multi-source summary
  summary.multi_source_summary = generateMultiSourceSummary(scoredFactualClaims);

  // Step 6: Add citation audit results to summary
  if (citationAudit.citations.length > 0) {
    summary.citation_audit = {
      total_citations: citationAudit.total,
      verified_citations: citationAudit.verified_count,
      ghost_citations: citationAudit.ghost_count,
      uncertain_citations: citationAudit.uncertain_count,
      has_ghost_citations: citationAudit.hasGhostCitations
    };
  }

  return {
    summary,
    claims: mergedClaims,
    citations: citationAudit.citations,
    capped,
    input_text: text
  };
}

/**
 * Extract a relevant fragment from text (first meaningful sentence or key phrase)
 */
function extractRelevantFragment(text) {
  if (!text) return '';
  // Get first sentence or first 150 chars
  const firstSentence = text.match(/^[^.!?]+[.!?]/);
  if (firstSentence && firstSentence[0].length <= 200) {
    return firstSentence[0].trim();
  }
  return text.substring(0, 150).trim() + '...';
}

module.exports = { runAudit };

