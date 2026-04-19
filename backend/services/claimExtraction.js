// claimExtraction.js — Sentence segmentation + factual claim filtering using compromise NLP
// Enhanced: atomic claim splitting for better verification accuracy
const nlp = require('compromise');
const { splitIntoAtomicClaims } = require('./atomicSplitter');

/**
 * Split text into sentences, handling abbreviations like "Dr.", "U.S.", "e.g."
 */
function segmentSentences(text) {
  const doc = nlp(text);
  const sentences = doc.sentences().out('array');
  return sentences.filter(s => s.trim().length > 10);
}

/**
 * Check if a sentence contains verifiable factual content:
 * - Numeric values (years, percentages, counts)
 * - Named entities (people, places, organizations)
 * - Superlatives or comparative assertions
 */
function isFactualClaim(sentence) {
  const doc = nlp(sentence);

  // Check for numeric values (years, percentages, quantities)
  const hasNumbers = doc.numbers().length > 0 ||
    /\b\d{4}\b/.test(sentence) ||
    /\d+(\.\d+)?%/.test(sentence) ||
    /\b\d[\d,]*\b/.test(sentence);

  // Check for named entities using compromise
  const hasPeople = doc.people().length > 0;
  const hasPlaces = doc.places().length > 0;
  const hasOrganizations = doc.organizations().length > 0;
  const hasNamedEntity = hasPeople || hasPlaces || hasOrganizations;

  // Check for superlatives and comparatives
  const superlativePatterns = /\b(largest|smallest|fastest|slowest|highest|lowest|most|least|first|last|oldest|youngest|longest|shortest|tallest|greatest|best|worst|founded|established|discovered|invented|created|built|constructed|located|surpassed|approximately|recorded|published|released|launched|announced|introduced|developed|produced|acquired|merged|signed|elected|appointed|awarded|became|contains|comprises|consists|measures|weighs|spans|covers|generates|produces|earned|achieved|reached|exceeded|declined|increased|decreased|doubled|tripled|grew|rose|fell|dropped|ranked|scored|received|won|lost)\b/i;
  const hasSuperlative = superlativePatterns.test(sentence);

  // Check for proper nouns (capitalized words that aren't at start of sentence)
  const properNounPattern = /\s[A-Z][a-z]+/;
  const hasProperNoun = properNounPattern.test(sentence);

  // Check for assertive factual patterns ("X is Y", "X was Y", "X has Y")
  const factualPatterns = /\b(is|are|was|were|has|had|have)\b.*\b(the|a|an|one of|part of|known|called|named|considered|regarded|classified)\b/i;
  const hasFactualPattern = factualPatterns.test(sentence);

  // Filter out opinion sentences
  const opinionPatterns = /\b(I think|I believe|It seems|In my opinion|Perhaps|Maybe|Probably|It appears|Could be|Might be)\b/i;
  const isOpinion = opinionPatterns.test(sentence);

  // Filter out transition/filler sentences
  const transitionPatterns = /^(This means|In other words|Therefore|However|Moreover|Furthermore|In conclusion|To summarize|Overall|In summary)\b/i;
  const isTransition = transitionPatterns.test(sentence.trim());

  if (isOpinion || isTransition) return false;

  // Accept if ANY factual signal is present
  return hasNumbers || hasNamedEntity || hasSuperlative || (hasProperNoun && hasFactualPattern);
}

/**
 * Extract the primary entity and keywords from a claim sentence
 */
function extractEntitiesAndKeywords(sentence) {
  const doc = nlp(sentence);

  // Get named entities in priority order
  let primaryEntity = null;
  const entities = [];

  // People
  const people = doc.people().out('array');
  if (people.length > 0) {
    primaryEntity = primaryEntity || people[0];
    entities.push(...people);
  }

  // Organizations
  const orgs = doc.organizations().out('array');
  if (orgs.length > 0) {
    primaryEntity = primaryEntity || orgs[0];
    entities.push(...orgs);
  }

  // Places
  const places = doc.places().out('array');
  if (places.length > 0) {
    primaryEntity = primaryEntity || places[0];
    entities.push(...places);
  }

  // If no NER entity found, try to extract capitalized proper nouns
  if (!primaryEntity) {
    const properNouns = sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const filtered = properNouns.filter(n => !['The', 'This', 'That', 'These', 'Those', 'It', 'Its', 'In', 'On', 'At', 'By', 'For', 'With', 'From', 'And', 'But', 'Or'].includes(n));
    if (filtered.length > 0) {
      primaryEntity = filtered[0];
      entities.push(...filtered);
    }
  }

  // Extract numeric values
  const numbers = sentence.match(/\b\d[\d,.]*%?\b/g) || [];

  // Extract keywords (nouns from the sentence, excluding stop words)
  const nouns = doc.nouns().out('array');
  const stopWords = new Set(['the', 'a', 'an', 'this', 'that', 'it', 'its', 'is', 'was', 'were', 'are', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can']);
  const keywords = nouns
    .map(n => n.toLowerCase().trim())
    .filter(n => n.length > 2 && !stopWords.has(n))
    .slice(0, 3);

  return {
    primaryEntity: primaryEntity ? primaryEntity.trim() : null,
    entities: [...new Set(entities)],
    numbers,
    keywords
  };
}

/**
 * Main extraction function: takes raw text, returns array of factual claim objects
 * Each claim has: text, primaryEntity, keywords, numbers, start_char, end_char
 * No cap — the full document is processed.
 */
function extractClaims(text) {
  const sentences = segmentSentences(text);
  const claims = [];

  for (const sentence of sentences) {
    if (!isFactualClaim(sentence)) continue;

    const { primaryEntity, entities, numbers, keywords } = extractEntitiesAndKeywords(sentence);

    // Skip if we couldn't find any entity or keyword to search
    if (!primaryEntity && keywords.length === 0 && numbers.length === 0) continue;

    // Find character positions in original text
    const startChar = text.indexOf(sentence);
    const endChar = startChar + sentence.length;

    claims.push({
      text: sentence.trim(),
      primaryEntity,
      entities,
      numbers,
      keywords,
      start_char: startChar >= 0 ? startChar : null,
      end_char: startChar >= 0 ? endChar : null
    });
  }

  return claims;
}

/**
 * Classify why a sentence is non-factual
 */
function classifyNonFactualReason(sentence) {
  const opinionPatterns = /\b(I think|I believe|It seems|In my opinion|Perhaps|Maybe|Probably|It appears|Could be|Might be)\b/i;
  const transitionPatterns = /^(This means|In other words|Therefore|However|Moreover|Furthermore|In conclusion|To summarize|Overall|In summary)\b/i;

  if (opinionPatterns.test(sentence)) return 'Opinion or subjective statement';
  if (transitionPatterns.test(sentence.trim())) return 'Transitional or connective text';
  return 'No verifiable factual signal detected';
}

/**
 * Full-document extraction: returns ALL sentences with is_factual classification.
 * Factual sentences are split into atomic sub-claims for better verification accuracy.
 * Non-factual sentences are marked as non_verifiable with a reason.
 */
function extractAllSentences(text) {
  const sentences = segmentSentences(text);
  const results = [];
  let factualIndex = 0;
  const isDebug = process.env.TRUTHLENS_DEBUG === 'true';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // Find character positions in original text
    const startChar = text.indexOf(trimmed);
    const endChar = startChar + trimmed.length;

    if (isFactualClaim(trimmed)) {
      // --- ATOMIC SPLITTING ---
      // Break complex sentences into atomic claims for better matching
      let atomicClaims;
      try {
        atomicClaims = splitIntoAtomicClaims(trimmed);
      } catch {
        atomicClaims = [trimmed]; // Graceful fallback
      }

      if (isDebug && atomicClaims.length > 1) {
        console.log(`  ✂ Split: "${trimmed.substring(0, 50)}..." → ${atomicClaims.length} atomic claims`);
      }

      for (const atomText of atomicClaims) {
        const { primaryEntity, entities, numbers, keywords } = extractEntitiesAndKeywords(atomText);

        // Even if no entity/keyword, still include it as a factual sentence
        if (!primaryEntity && keywords.length === 0 && numbers.length === 0) {
          results.push({
            text: atomText,
            is_factual: false,
            status: 'non_verifiable',
            non_verifiable_reason: 'No searchable entity or keyword found',
            start_char: startChar >= 0 ? startChar : null,
            end_char: startChar >= 0 ? endChar : null,
          });
          continue;
        }

        factualIndex++;
        results.push({
          text: atomText,
          is_factual: true,
          primaryEntity,
          entities,
          numbers,
          keywords,
          start_char: startChar >= 0 ? startChar : null,
          end_char: startChar >= 0 ? endChar : null,
          _parent_text: atomicClaims.length > 1 ? trimmed : undefined, // Track parent if split
        });
      }
    } else {
      results.push({
        text: trimmed,
        is_factual: false,
        status: 'non_verifiable',
        non_verifiable_reason: classifyNonFactualReason(trimmed),
        start_char: startChar >= 0 ? startChar : null,
        end_char: startChar >= 0 ? endChar : null,
      });
    }
  }

  return results;
}

module.exports = { extractClaims, extractAllSentences, segmentSentences, isFactualClaim, extractEntitiesAndKeywords };
