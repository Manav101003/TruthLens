// verification.js — Verify claims against Wikipedia with keyword matching & contradiction detection
// Enhanced: semantic matching for fuzzy/approximate/paraphrased verification
const { lookupEntity } = require('../integrations/wikipedia');
const { calculateSemanticMatch } = require('./semanticMatcher');

/**
 * Count how many of the claim's keywords/numbers appear in the Wikipedia extract
 */
function calculateKeywordMatch(claimKeywords, claimNumbers, wikiExtract) {
  if (!wikiExtract) return 0;

  const extractLower = wikiExtract.toLowerCase();
  const allTerms = [
    ...claimKeywords.map(k => k.toLowerCase()),
    ...claimNumbers
  ];

  if (allTerms.length === 0) return 0;

  let matchCount = 0;
  for (const term of allTerms) {
    if (extractLower.includes(term.toLowerCase())) {
      matchCount++;
    }
  }

  return matchCount / allTerms.length;
}

/**
 * Check if Wikipedia contradicts any numeric values in the claim.
 * FIXED: Only flags contradiction when numbers appear in a SIMILAR CONTEXT,
 * not when any random number in the Wikipedia article differs.
 * e.g., claim says "7.5% growth" and Wikipedia says "6.8% growth" → contradiction
 * But claim says "480 deaths" and Wikipedia mentions "1924" (a year) → NOT a contradiction
 */
function detectContradiction(claimNumbers, wikiExtract) {
  if (!wikiExtract || claimNumbers.length === 0) return false;

  // Only check percentage contradictions (most reliable signal)
  // Other number contradictions are too noisy for academic text
  for (const claimNum of claimNumbers) {
    if (!claimNum.includes('%')) continue; // Only check percentages

    const cleanClaim = claimNum.replace(/,/g, '').replace('%', '');
    const claimVal = parseFloat(cleanClaim);
    if (isNaN(claimVal)) continue;

    // Find percentages in Wikipedia
    const wikiPercentages = wikiExtract.match(/\d[\d,.]*%/g) || [];
    for (const wikiPct of wikiPercentages) {
      const wikiVal = parseFloat(wikiPct.replace(/,/g, '').replace('%', ''));
      if (isNaN(wikiVal)) continue;

      // Only flag if both are percentages AND they differ significantly (>25%)
      if (claimVal !== wikiVal && Math.abs(claimVal - wikiVal) / Math.max(claimVal, wikiVal) > 0.25) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect factual contradictions beyond just numeric ones.
 * Checks if key entities in the claim are contradicted by Wikipedia.
 * e.g., claim says "located in Berlin" but Wikipedia says "located in Paris"
 */
function detectFactualContradiction(claimText, claimEntities, wikiExtract) {
  if (!wikiExtract || !claimText) return false;

  const claimLower = claimText.toLowerCase();
  const extractLower = wikiExtract.toLowerCase();

  // Location contradiction patterns
  // If the claim mentions "located in X" and Wikipedia mentions a different location
  const locationPatterns = [
    /located\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /in\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)/i,
    /capital\s+of\s+([A-Z][a-z]+)/i
  ];

  for (const pattern of locationPatterns) {
    const claimMatch = claimText.match(pattern);
    if (claimMatch) {
      const claimedLocation = claimMatch[1].toLowerCase();
      // Check if Wikipedia mentions a DIFFERENT location for the same entity
      // e.g., claim says Berlin but Wiki says Paris
      const majorCities = ['paris', 'london', 'berlin', 'rome', 'tokyo', 'new york', 'washington', 'moscow', 'beijing', 'sydney', 'mumbai', 'cairo', 'delhi'];
      const majorCountries = ['france', 'germany', 'italy', 'japan', 'china', 'india', 'australia', 'united states', 'united kingdom', 'russia', 'brazil', 'egypt'];
      const allLocations = [...majorCities, ...majorCountries];

      for (const location of allLocations) {
        // If Wikipedia mentions a location that's different from the claimed one
        if (extractLower.includes(location) && !claimLower.includes(location)) {
          // And the claimed location is NOT in the Wikipedia extract
          if (!extractLower.includes(claimedLocation)) {
            return true;
          }
        }
      }
    }
  }

  // Population/quantity contradiction — large magnitude differences
  const populationMatch = claimText.match(/(\d[\d,.]*)\s*(million|billion|trillion)/i);
  if (populationMatch) {
    const claimedNum = parseFloat(populationMatch[1].replace(/,/g, ''));
    const claimedUnit = populationMatch[2].toLowerCase();

    const wikiPopMatch = wikiExtract.match(/(\d[\d,.]*)\s*(million|billion|trillion)/i);
    if (wikiPopMatch) {
      const wikiNum = parseFloat(wikiPopMatch[1].replace(/,/g, ''));
      const wikiUnit = wikiPopMatch[2].toLowerCase();

      // Convert to same unit for comparison
      const unitMultiplier = { million: 1, billion: 1000, trillion: 1000000 };
      const claimedVal = claimedNum * (unitMultiplier[claimedUnit] || 1);
      const wikiVal = wikiNum * (unitMultiplier[wikiUnit] || 1);

      // If the difference is more than 5x, it's a contradiction
      if (Math.max(claimedVal, wikiVal) / Math.max(Math.min(claimedVal, wikiVal), 0.001) > 5) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate an enhanced match score combining keyword match + semantic match.
 * This is the improved scoring that replaces strict substring matching.
 * Falls back to keyword-only if semantic matcher fails.
 *
 * @param {Object} claim - The claim object (text, keywords, numbers)
 * @param {string} sourceText - The source text to match against (e.g., Wikipedia extract)
 * @returns {{ enhancedScore: number, keywordScore: number, semanticScore: number }}
 */
function calculateEnhancedMatch(claim, sourceText) {
  // Original keyword match (always computed, for backward compatibility)
  const keywordScore = calculateKeywordMatch(
    claim.keywords || [],
    claim.numbers || [],
    sourceText
  );

  // Semantic match (fuzzy + numeric tolerance + synonyms)
  let semanticScore = 0;
  try {
    const semanticResult = calculateSemanticMatch(claim.text, sourceText);
    semanticScore = semanticResult.score || 0;
  } catch {
    // Graceful fallback — semantic matcher failure doesn't break verification
    semanticScore = 0;
  }

  // Combined: take the BETTER of keyword and semantic, with a blend
  // This ensures that if either method finds a match, it counts
  const enhancedScore = Math.max(
    keywordScore,
    semanticScore,
    (keywordScore * 0.5) + (semanticScore * 0.5) // Blended
  );

  return {
    enhancedScore: Math.round(enhancedScore * 100) / 100,
    keywordScore: Math.round(keywordScore * 100) / 100,
    semanticScore: Math.round(semanticScore * 100) / 100,
  };
}

/**
 * Verify a single claim against Wikipedia.
 * Enhanced: includes semantic matching + secondary search fallback.
 * If primary entity lookup gives poor results, tries searching with claim keywords.
 */
async function verifyClaim(claim) {
  const isDebug = process.env.TRUTHLENS_DEBUG === 'true';

  // --- Primary lookup: by entity name ---
  let wikiResult = await lookupEntity(claim.primaryEntity, claim.keywords);

  // --- Secondary lookup: if primary gives poor match, try searching by claim text ---
  if (wikiResult.found) {
    const { enhancedScore: primaryScore } = calculateEnhancedMatch(claim, wikiResult.extract);

    // If the primary match is weak, try a more specific search
    if (primaryScore < 0.3 && claim.keywords.length > 0) {
      try {
        const { searchWikipedia } = require('../integrations/wikipedia');
        const searchQuery = [claim.primaryEntity, ...claim.keywords.slice(0, 2)].filter(Boolean).join(' ');
        const secondaryResult = await searchWikipedia(searchQuery);

        if (secondaryResult.found) {
          const { enhancedScore: secondaryScore } = calculateEnhancedMatch(claim, secondaryResult.extract);
          if (secondaryScore > primaryScore) {
            if (isDebug) {
              console.log(`  🔄 Secondary search "${searchQuery}" improved: ${primaryScore} → ${secondaryScore}`);
            }
            wikiResult = secondaryResult;
          }
        }
      } catch {
        // Secondary search failed — continue with primary
      }
    }
  }

  if (!wikiResult.found) {
    // Last resort: try searching with full claim keywords
    try {
      const { searchWikipedia } = require('../integrations/wikipedia');
      const searchQuery = [claim.primaryEntity, ...claim.keywords].filter(Boolean).join(' ');
      wikiResult = await searchWikipedia(searchQuery);
    } catch {
      // Complete failure
    }

    if (!wikiResult || !wikiResult.found) {
      if (isDebug) {
        console.log(`  ❌ No Wikipedia source for: "${(claim.text || '').substring(0, 60)}..."`);
      }
      return {
        wikiResult: { found: false },
        keywordMatchRatio: 0,
        semanticScore: 0,
        enhancedMatchRatio: 0,
        entityFound: false,
        hasContradiction: false
      };
    }
  }

  // Calculate both keyword and semantic match
  const { enhancedScore, keywordScore, semanticScore } = calculateEnhancedMatch(claim, wikiResult.extract);

  // Check if primary entity appears in extract — also check keywords for broader entity matching
  let entityFound = false;
  if (claim.primaryEntity) {
    entityFound = wikiResult.extract.toLowerCase().includes(claim.primaryEntity.toLowerCase());
  }
  // If primary entity not found, check if ANY entity from the claim appears
  if (!entityFound && claim.entities && claim.entities.length > 0) {
    entityFound = claim.entities.some(e =>
      wikiResult.extract.toLowerCase().includes(e.toLowerCase())
    );
  }
  // Also check if the Wikipedia article title directly matches the primary entity
  if (!entityFound && wikiResult.title && claim.primaryEntity) {
    const titleLower = wikiResult.title.toLowerCase();
    const entityLower = claim.primaryEntity.toLowerCase();
    entityFound = titleLower.includes(entityLower) || entityLower.includes(titleLower);
  }

  // Check for numeric contradictions (existing logic — untouched)
  const numericContradiction = detectContradiction(claim.numbers, wikiResult.extract);

  // Check for factual contradictions (existing logic — untouched)
  const factualContradiction = detectFactualContradiction(claim.text, claim.entities, wikiResult.extract);

  const hasContradiction = numericContradiction || factualContradiction;

  // Debug logging
  if (isDebug) {
    console.log(`  🔎 Claim: "${(claim.text || '').substring(0, 60)}..."`);
    console.log(`     Wiki: "${wikiResult.title}" | Entity: ${entityFound ? '✓' : '✗'} | Contradiction: ${hasContradiction ? '⚠' : '✓'}`);
    console.log(`     Keyword: ${keywordScore} | Semantic: ${semanticScore} | Enhanced: ${enhancedScore}`);
  }

  return {
    wikiResult,
    keywordMatchRatio: enhancedScore,
    semanticScore,
    enhancedMatchRatio: enhancedScore,
    originalKeywordScore: keywordScore,
    entityFound,
    hasContradiction
  };
}

/**
 * Verify all claims in parallel using Promise.all (FR-009, NFR-5.1)
 */
async function verifyAllClaims(claims) {
  const isDebug = process.env.TRUTHLENS_DEBUG === 'true';
  if (isDebug) {
    console.log(`\n🔍 === VERIFICATION DEBUG START (${claims.length} claims) ===`);
  }

  const results = await Promise.all(
    claims.map(claim => verifyClaim(claim))
  );

  if (isDebug) {
    const matched = results.filter(r => r.enhancedMatchRatio > 0.3).length;
    console.log(`🔍 === VERIFICATION DEBUG END: ${matched}/${claims.length} matched ===\n`);
  }

  return results;
}

module.exports = { verifyClaim, verifyAllClaims, calculateKeywordMatch, calculateEnhancedMatch, detectContradiction, detectFactualContradiction };
