// semanticMatcher.js — Fuzzy matching, numeric tolerance, and synonym handling
// Lightweight: no ML models, uses bigram similarity + token overlap + numeric conversion.
// Drop-in enhancement for the verification pipeline.

/**
 * ============================
 * TEXT NORMALIZATION
 * ============================
 */

/**
 * Normalize text for comparison: lowercase, strip punctuation, standardize whitespace.
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/['']/g, "'")       // Normalize quotes
    .replace(/[""]/g, '"')       // Normalize double quotes
    .replace(/[₹$€£¥]/g, '')    // Remove currency symbols
    .replace(/[^\w\s'-]/g, ' ') // Remove punctuation except hyphens and apostrophes
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .trim();
}

/**
 * Simple suffix stripping for English words (poor-man's stemming).
 * Not perfect, but good enough for matching "founded" ≈ "founding", "deaths" ≈ "death".
 */
function simpleStem(word) {
  if (word.length < 4) return word;
  return word
    .replace(/ies$/, 'y')
    .replace(/ves$/, 'f')
    .replace(/(s|es|ed|ing|ly|ment|tion|sion|ness|able|ible|ful|less|ous|ive|al|ial|ual|ent|ant|ence|ance)$/, '')
    || word;
}

/**
 * ============================
 * SYNONYM MAP
 * ============================
 */

const SYNONYM_GROUPS = [
  ['founded', 'established', 'created', 'started', 'incorporated', 'set up', 'begun', 'initiated'],
  ['approximately', 'about', 'around', 'roughly', 'nearly', 'close to', 'circa', 'approx'],
  ['died', 'killed', 'perished', 'lost lives', 'fatalities', 'deaths', 'casualties'],
  ['located', 'situated', 'found in', 'based in', 'lies in', 'positioned'],
  ['largest', 'biggest', 'greatest', 'most extensive'],
  ['smallest', 'tiniest', 'least', 'most compact'],
  ['increased', 'grew', 'rose', 'climbed', 'surged', 'expanded', 'went up'],
  ['decreased', 'fell', 'dropped', 'declined', 'reduced', 'went down', 'shrank'],
  ['built', 'constructed', 'erected', 'assembled'],
  ['destroyed', 'demolished', 'devastated', 'ruined', 'wrecked'],
  ['announced', 'declared', 'stated', 'proclaimed', 'revealed'],
  ['acquired', 'bought', 'purchased', 'obtained'],
  ['produced', 'manufactured', 'made', 'generated', 'created'],
  ['country', 'nation', 'state', 'republic'],
  ['city', 'town', 'municipality', 'metropolis', 'urban area'],
  ['river', 'waterway', 'stream'],
  ['mountain', 'peak', 'summit'],
  ['population', 'inhabitants', 'residents', 'people'],
  ['area', 'region', 'territory', 'zone'],
  ['government', 'administration', 'regime', 'authority'],
  ['president', 'head of state', 'leader'],
  ['war', 'conflict', 'battle', 'warfare'],
  ['disease', 'illness', 'ailment', 'condition', 'disorder'],
  ['capital', 'capital city', 'seat of government'],
];

// Build a fast lookup: word → group index
const SYNONYM_LOOKUP = {};
SYNONYM_GROUPS.forEach((group, groupIdx) => {
  group.forEach(word => {
    SYNONYM_LOOKUP[word.toLowerCase()] = groupIdx;
  });
});

/**
 * Check if two words/phrases are synonyms.
 */
function areSynonyms(word1, word2) {
  const w1 = word1.toLowerCase().trim();
  const w2 = word2.toLowerCase().trim();
  if (w1 === w2) return true;

  const g1 = SYNONYM_LOOKUP[w1];
  const g2 = SYNONYM_LOOKUP[w2];
  if (g1 !== undefined && g1 === g2) return true;

  // Also check stemmed versions
  const s1 = simpleStem(w1);
  const s2 = simpleStem(w2);
  if (s1 === s2) return true;

  const sg1 = SYNONYM_LOOKUP[s1];
  const sg2 = SYNONYM_LOOKUP[s2];
  if (sg1 !== undefined && sg1 === sg2) return true;

  return false;
}

/**
 * ============================
 * NUMERIC HANDLING
 * ============================
 */

// Unit conversion table (to a common base unit)
const UNIT_CONVERSIONS = {
  // Indian numbering
  'crore': 10_000_000,
  'crores': 10_000_000,
  'lakh': 100_000,
  'lakhs': 100_000,
  // Western numbering
  'billion': 1_000_000_000,
  'million': 1_000_000,
  'thousand': 1_000,
  'hundred': 100,
  'trillion': 1_000_000_000_000,
  // Length
  'km': 1000,
  'kilometer': 1000,
  'kilometers': 1000,
  'kilometre': 1000,
  'kilometres': 1000,
  'mile': 1609.34,
  'miles': 1609.34,
  'meter': 1,
  'meters': 1,
  'metre': 1,
  'metres': 1,
  'feet': 0.3048,
  'foot': 0.3048,
  'ft': 0.3048,
  // Weight
  'kg': 1,
  'kilogram': 1,
  'kilograms': 1,
  'pound': 0.453592,
  'pounds': 0.453592,
  'lb': 0.453592,
  'lbs': 0.453592,
  'ton': 1000,
  'tons': 1000,
  'tonne': 1000,
  'tonnes': 1000,
};

/**
 * Extract all numbers from text, converting units to base values where possible.
 * Returns array of { rawValue, normalizedValue, unit, position }.
 */
function extractNumbers(text) {
  if (!text) return [];
  const results = [];

  // Pattern: optional currency, number (with commas/decimals), optional unit word
  const numPattern = /(?:[₹$€£¥]?\s*)(\d[\d,]*(?:\.\d+)?)\s*(crore|crores|lakh|lakhs|billion|million|thousand|hundred|trillion|km|kilometer|kilometers|kilometre|kilometres|mile|miles|meter|meters|metre|metres|feet|foot|ft|kg|kilogram|kilograms|pound|pounds|lb|lbs|ton|tons|tonne|tonnes|%|percent)?/gi;

  let match;
  while ((match = numPattern.exec(text)) !== null) {
    const rawNum = match[1].replace(/,/g, '');
    const numValue = parseFloat(rawNum);
    const unit = (match[2] || '').toLowerCase();

    if (isNaN(numValue)) continue;

    let normalized = numValue;
    if (unit && UNIT_CONVERSIONS[unit]) {
      normalized = numValue * UNIT_CONVERSIONS[unit];
    }

    results.push({
      raw: match[0].trim(),
      rawValue: numValue,
      normalizedValue: normalized,
      unit: unit || 'raw',
      isPercentage: unit === '%' || unit === 'percent',
    });
  }

  return results;
}

/**
 * Compare two numbers with tolerance.
 * Returns similarity from 0.0 to 1.0.
 *
 * - Exact match → 1.0
 * - Within ±5% → 0.9
 * - Within ±10% → 0.75
 * - Within ±20% → 0.5
 * - Beyond ±20% → 0.0
 */
function compareNumbers(num1, num2) {
  if (num1 === 0 && num2 === 0) return 1.0;
  if (num1 === 0 || num2 === 0) return 0.0;

  const ratio = Math.abs(num1 - num2) / Math.max(Math.abs(num1), Math.abs(num2));

  if (ratio === 0) return 1.0;
  if (ratio <= 0.02) return 0.95;   // Within 2%
  if (ratio <= 0.05) return 0.90;   // Within 5%
  if (ratio <= 0.10) return 0.75;   // Within 10%
  if (ratio <= 0.20) return 0.50;   // Within 20%
  return 0.0;
}

/**
 * Calculate numeric match score between claim and source text.
 * Tries to match each claim number against source numbers,
 * using unit normalization for cross-unit comparison.
 *
 * @returns {number} Score from 0.0 to 1.0
 */
function calculateNumericMatch(claimText, sourceText) {
  const claimNums = extractNumbers(claimText);
  const sourceNums = extractNumbers(sourceText);

  if (claimNums.length === 0) return 1.0; // No numbers to match → neutral

  if (sourceNums.length === 0) return 0.3; // Source has no numbers at all

  let totalScore = 0;
  let matchedCount = 0;

  for (const cn of claimNums) {
    let bestMatch = 0;

    for (const sn of sourceNums) {
      // Try raw comparison first
      let score = compareNumbers(cn.rawValue, sn.rawValue);

      // Try normalized (unit-converted) comparison
      const normalizedScore = compareNumbers(cn.normalizedValue, sn.normalizedValue);
      score = Math.max(score, normalizedScore);

      bestMatch = Math.max(bestMatch, score);
    }

    totalScore += bestMatch;
    if (bestMatch > 0.5) matchedCount++;
  }

  return totalScore / claimNums.length;
}

/**
 * ============================
 * BIGRAM SIMILARITY (Dice Coefficient)
 * ============================
 */

/**
 * Generate character bigrams from a string.
 */
function getBigrams(str) {
  const bigrams = new Set();
  const s = str.toLowerCase().trim();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.substring(i, i + 2));
  }
  return bigrams;
}

/**
 * Dice coefficient between two strings (0.0–1.0).
 * Good for detecting similarity even with word reordering.
 */
function diceCoefficient(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const b1 = getBigrams(str1);
  const b2 = getBigrams(str2);

  if (b1.size === 0 || b2.size === 0) return 0;

  let intersection = 0;
  for (const bg of b1) {
    if (b2.has(bg)) intersection++;
  }

  return (2 * intersection) / (b1.size + b2.size);
}

/**
 * ============================
 * TOKEN OVERLAP WITH STEMMING & SYNONYMS
 * ============================
 */

/**
 * Calculate token-level overlap between claim and source,
 * using stemming and synonym matching.
 *
 * @returns {number} Score from 0.0 to 1.0
 */
function calculateTokenOverlap(claimText, sourceText) {
  const claimTokens = normalizeText(claimText).split(/\s+/).filter(t => t.length > 2);
  const sourceTokens = normalizeText(sourceText).split(/\s+/).filter(t => t.length > 2);

  if (claimTokens.length === 0) return 0;

  // Stop words to ignore during matching
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'its', 'his', 'how', 'who', 'did', 'get', 'got',
    'let', 'say', 'she', 'too', 'use', 'may', 'own', 'any', 'new', 'now', 'way', 'may', 'day',
    'been', 'have', 'from', 'with', 'they', 'this', 'that', 'what', 'will', 'each', 'make',
    'like', 'than', 'them', 'then', 'when', 'where', 'which', 'more', 'most', 'some', 'such',
    'into', 'over', 'after', 'also', 'about', 'other', 'were', 'being', 'would', 'could',
    'should', 'there', 'their', 'these', 'those', 'between', 'through']);

  const claimContentTokens = claimTokens.filter(t => !stopWords.has(t));
  if (claimContentTokens.length === 0) return 0.5; // All stop words → neutral

  const sourceTokenSet = new Set(sourceTokens);
  const sourceStemSet = new Set(sourceTokens.map(simpleStem));

  let matches = 0;

  for (const token of claimContentTokens) {
    // Direct match
    if (sourceTokenSet.has(token)) {
      matches++;
      continue;
    }

    // Stemmed match
    const stemmed = simpleStem(token);
    if (sourceStemSet.has(stemmed)) {
      matches += 0.9; // Slightly less than exact
      continue;
    }

    // Synonym match
    let synonymFound = false;
    for (const sourceToken of sourceTokens) {
      if (areSynonyms(token, sourceToken)) {
        matches += 0.85;
        synonymFound = true;
        break;
      }
    }
    if (synonymFound) continue;

    // Partial substring match (for compound words / names)
    for (const sourceToken of sourceTokens) {
      if (sourceToken.length > 4 && token.length > 4) {
        if (sourceToken.includes(token) || token.includes(sourceToken)) {
          matches += 0.7;
          break;
        }
      }
    }
  }

  return Math.min(1, matches / claimContentTokens.length);
}

/**
 * ============================
 * MAIN: SEMANTIC MATCH SCORE
 * ============================
 */

/**
 * Calculate a combined semantic match score between a claim and source text.
 * Combines: token overlap + bigram similarity + numeric matching.
 *
 * This is the main exported function used by the verification pipeline.
 *
 * @param {string} claimText - The claim to verify
 * @param {string} sourceText - The source material (e.g., Wikipedia extract)
 * @param {Object} [options] - Optional config
 * @param {boolean} [options.debug=false] - If true, return debug breakdown
 * @returns {{ score: number, breakdown?: Object }} Score from 0.0 to 1.0
 */
function calculateSemanticMatch(claimText, sourceText, options = {}) {
  if (!claimText || !sourceText) return { score: 0 };

  const debug = options.debug || (process.env.TRUTHLENS_DEBUG === 'true');

  // 1. Token overlap with stemming + synonyms (weight: 40%)
  const tokenScore = calculateTokenOverlap(claimText, sourceText);

  // 2. Character bigram similarity (weight: 20%)
  // Compare normalized versions for better signal
  const bigramScore = diceCoefficient(
    normalizeText(claimText),
    normalizeText(sourceText.substring(0, 2000)) // Cap source length for performance
  );

  // 3. Numeric match with tolerance (weight: 40%)
  const numericScore = calculateNumericMatch(claimText, sourceText);

  // Weighted combination
  const combined = (tokenScore * 0.40) + (bigramScore * 0.20) + (numericScore * 0.40);
  const finalScore = Math.round(Math.min(1, combined) * 100) / 100;

  const result = { score: finalScore };

  if (debug) {
    result.breakdown = {
      tokenOverlap: Math.round(tokenScore * 100) / 100,
      bigramSimilarity: Math.round(bigramScore * 100) / 100,
      numericMatch: Math.round(numericScore * 100) / 100,
      combined: finalScore,
      claimNormalized: normalizeText(claimText).substring(0, 100),
      sourceNormalized: normalizeText(sourceText).substring(0, 200),
    };

    if (process.env.TRUTHLENS_DEBUG === 'true') {
      console.log(`  🔍 Semantic match for: "${claimText.substring(0, 60)}..."`);
      console.log(`     Token: ${result.breakdown.tokenOverlap} | Bigram: ${result.breakdown.bigramSimilarity} | Numeric: ${result.breakdown.numericMatch} → ${finalScore}`);
    }
  }

  return result;
}

module.exports = {
  calculateSemanticMatch,
  calculateNumericMatch,
  calculateTokenOverlap,
  diceCoefficient,
  normalizeText,
  simpleStem,
  areSynonyms,
  extractNumbers,
  compareNumbers,
};
