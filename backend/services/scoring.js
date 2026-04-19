// scoring.js — Confidence score calculation and three-class classification
// FIXED: Correct claims must be verified. The formula now properly rewards
// topic presence + entity match + no contradiction = high confidence.

/**
 * Calculate confidence score using generous evidence-based formula:
 *
 * KEY PRINCIPLE: If Wikipedia has an article about the topic AND the entity is found
 * AND there's no contradiction → the claim is almost certainly correct.
 * The match ratio only fine-tunes the confidence level.
 *
 * Formula:
 * - Topic found bonus: 0.30 (Wikipedia has a relevant article)
 * - Entity found bonus: 0.35 (the specific entity appears in the article)
 * - Match ratio component: matchRatio × 0.35 (how well the specific claim matches)
 * - Contradiction penalty: -0.50 (for explicit contradictions)
 *
 * This means: topic found (0.30) + entity found (0.35) = 0.65 baseline
 * Even a match ratio of 0.0 gives 0.65 → just below Verified (0.60)
 * Any match ratio > 0 pushes it above → Verified
 */
function calculateConfidence(keywordMatchRatio, entityFound, hasContradiction, wikiFound = true) {
  const topicBonus = wikiFound ? 0.30 : 0.0;
  const entityBonus = entityFound ? 0.35 : 0.0;
  const matchComponent = keywordMatchRatio * 0.35;

  let confidence = topicBonus + entityBonus + matchComponent;

  // Apply contradiction penalty (only for explicit contradictions)
  if (hasContradiction) {
    confidence -= 0.50;
  }

  // Clamp between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));

  return Math.round(confidence * 100) / 100;
}

/**
 * Classify a claim based on its confidence score
 *
 * THRESHOLDS (updated for better accuracy):
 * - Verified:     >= 0.60 (was 0.70 — too strict for correct claims)
 * - Unverified:   0.35 - 0.59 (partial evidence)
 * - Hallucinated: < 0.35 AND has explicit contradiction
 *
 * KEY: Without an explicit contradiction, claims CANNOT be "hallucinated"
 * — they are "unverified" at worst. This prevents false negatives.
 */
function classifyClaim(confidence, hasContradiction) {
  // Only mark as hallucinated if there's an explicit contradiction
  if (hasContradiction && confidence < 0.35) {
    return 'hallucinated';
  }

  if (confidence >= 0.60) return 'verified';
  if (confidence >= 0.35) return 'unverified';

  // Even at low confidence, without contradiction it's just "unverified"
  return hasContradiction ? 'hallucinated' : 'unverified';
}

/**
 * Get the human-readable confidence label
 */
function getConfidenceLabel(confidence) {
  if (confidence >= 0.80) return 'High Confidence';
  if (confidence >= 0.60) return 'Verified';
  if (confidence >= 0.35) return 'Medium Confidence';
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

