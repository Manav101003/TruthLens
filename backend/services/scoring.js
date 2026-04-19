// scoring.js — Confidence score calculation and three-class classification
// BALANCED: Correct claims verified, wrong claims flagged. Match ratio matters.

/**
 * Calculate confidence score using BALANCED evidence-based formula:
 *
 * KEY PRINCIPLE: Topic presence + entity presence gives a STARTING bonus,
 * but the actual match ratio must contribute significantly.
 * A high baseline without actual keyword/semantic evidence is NOT enough.
 *
 * Formula:
 * - Topic found bonus:  0.20 (Wikipedia has a relevant article)
 * - Entity found bonus: 0.15 (the specific entity appears in the article)
 * - Match ratio weight: matchRatio × 0.65 (how well the claim ACTUALLY matches)
 * - Contradiction penalty: -0.40
 *
 * Examples:
 *   "Eiffel Tower in Paris" → topic(0.20) + entity(0.15) + match(0.79×0.65=0.51) = 0.86 ✅ Verified
 *   "Eiffel Tower in Berlin" → topic(0.20) + entity(0.15) + match(0.30×0.65=0.20) - contradiction(0.40) = 0.15 ❌ Hallucinated
 *   "Random obscure claim"  → topic(0.20) + entity(0.00) + match(0.10×0.65=0.07) = 0.27 ⚠ Unverified
 */
function calculateConfidence(keywordMatchRatio, entityFound, hasContradiction, wikiFound = true) {
  const topicBonus = wikiFound ? 0.20 : 0.0;
  const entityBonus = entityFound ? 0.15 : 0.0;
  const matchComponent = keywordMatchRatio * 0.65;

  let confidence = topicBonus + entityBonus + matchComponent;

  // Apply contradiction penalty
  if (hasContradiction) {
    confidence -= 0.40;
  }

  // Clamp between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));

  return Math.round(confidence * 100) / 100;
}

/**
 * Classify a claim based on its confidence score
 *
 * THRESHOLDS:
 * - Verified:     >= 0.55 (good evidence match)
 * - Unverified:   0.30 - 0.54 (partial evidence)
 * - Hallucinated: < 0.30 AND has explicit contradiction
 *
 * Without an explicit contradiction, claims default to "unverified" not "hallucinated".
 */
function classifyClaim(confidence, hasContradiction) {
  // Only mark as hallucinated if there's an explicit contradiction
  if (hasContradiction && confidence < 0.30) {
    return 'hallucinated';
  }

  if (confidence >= 0.55) return 'verified';
  if (confidence >= 0.30) return 'unverified';

  // Even at low confidence, without contradiction it's just "unverified"
  return hasContradiction ? 'hallucinated' : 'unverified';
}

/**
 * Get the human-readable confidence label
 */
function getConfidenceLabel(confidence) {
  if (confidence >= 0.80) return 'High Confidence';
  if (confidence >= 0.55) return 'Verified';
  if (confidence >= 0.30) return 'Medium Confidence';
  return 'Low Confidence';
}

/**
 * Score and classify a single claim
 * Takes a raw claim + verification result, returns the fully scored claim object
 */
function scoreAndClassifyClaim(claim, verificationResult, index) {
  const { wikiResult, keywordMatchRatio, entityFound, hasContradiction } = verificationResult;

  const wikiFound = wikiResult && wikiResult.found;
  const confidence = calculateConfidence(keywordMatchRatio, entityFound, hasContradiction, wikiFound);
  const status = classifyClaim(confidence, hasContradiction);
  const confidenceLabel = getConfidenceLabel(confidence);

  // Build contradiction detail if present
  let contradiction = null;
  if (hasContradiction && wikiResult.found) {
    contradiction = {
      claim_says: claim.text.substring(0, 150),
      source_says: wikiResult.extract ? wikiResult.extract.substring(0, 200) : 'See Wikipedia source'
    };
  }

  return {
    id: index + 1,
    text: claim.text,
    status,
    confidence,
    confidence_label: confidenceLabel,
    source_title: wikiResult.found ? wikiResult.title : null,
    source_snippet: wikiResult.found ? wikiResult.extract.substring(0, 300) : null,
    source_url: wikiResult.found ? wikiResult.url : null,
    start_char: claim.start_char,
    end_char: claim.end_char,
    ...(contradiction && { contradiction })
  };
}

/**
 * Generate summary statistics for the audit report
 */
function generateSummary(scoredClaims) {
  const total = scoredClaims.length;
  const verified = scoredClaims.filter(c => c.status === 'verified').length;
  const unverified = scoredClaims.filter(c => c.status === 'unverified').length;
  const hallucinated = scoredClaims.filter(c => c.status === 'hallucinated').length;
  const trustScore = total > 0 ? Math.round((verified / total) * 1000) / 10 : 0;

  return {
    total_claims: total,
    verified_count: verified,
    unverified_count: unverified,
    hallucinated_count: hallucinated,
    trust_score: trustScore
  };
}

module.exports = { calculateConfidence, classifyClaim, getConfidenceLabel, scoreAndClassifyClaim, generateSummary };
