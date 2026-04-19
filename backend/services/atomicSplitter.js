// atomicSplitter.js — Decompose complex sentences into atomic verifiable claims
// Rule-based: no ML models, hackathon-ready performance.
// Falls back to original sentence if splitting fails.

/**
 * Split a complex sentence into atomic factual claims.
 * Each sub-claim retains the original subject so it can be verified independently.
 *
 * Example:
 *   "The Kerala floods of 2018 caused over 480 deaths and ₹30,000 crore damage"
 *   → ["Kerala floods of 2018 caused over 480 deaths",
 *      "Kerala floods of 2018 caused ₹30,000 crore damage"]
 *
 * @param {string} sentence - A single sentence to decompose
 * @returns {string[]} Array of atomic claims (at least 1 = the original)
 */
function splitIntoAtomicClaims(sentence) {
  if (!sentence || sentence.length < 15) return [sentence];

  try {
    const atoms = [];

    // --- Step 1: Extract the subject (everything before the first main verb) ---
    const subject = extractSubject(sentence);

    // --- Step 2: Split on coordinating conjunctions ("and", "but", "as well as") ---
    let parts = splitOnConjunctions(sentence);

    // --- Step 3: Split on semicolons and long comma-separated clauses ---
    parts = parts.flatMap(p => splitOnSemicolonsAndCommas(p));

    // --- Step 4: Split relative clauses ("which ...", "that ...") ---
    parts = parts.flatMap(p => splitRelativeClauses(p, subject));

    // --- Step 5: Clean up and ensure each part has a subject ---
    for (const part of parts) {
      const cleaned = cleanAtom(part, subject);
      if (cleaned && cleaned.length >= 10) {
        atoms.push(cleaned);
      }
    }

    // If splitting produced nothing useful, return original
    if (atoms.length === 0) return [sentence.trim()];

    // Deduplicate near-identical atoms
    return deduplicateAtoms(atoms);
  } catch {
    // Graceful fallback — never break the pipeline
    return [sentence.trim()];
  }
}

/**
 * Extract the likely subject of a sentence.
 * Heuristic: everything before the first main verb.
 */
function extractSubject(sentence) {
  // Match up to the first main verb
  const verbPattern = /^(.+?)\s+(?:is|are|was|were|has|had|have|caused|grew|reached|exceeded|surpassed|became|contains|comprises|founded|established|built|created|launched|announced|released|produced|generated|earned|achieved|received|won|lost|increased|decreased|declined|rose|fell|dropped|made|developed|introduced|discovered|invented|acquired|merged|signed|elected|appointed|awarded|ranked|scored|measures|weighs|spans|covers|located)\b/i;
  const match = sentence.match(verbPattern);
  if (match) return match[1].trim();

  // Fallback: take everything before first comma or first verb-like word
  const commaIdx = sentence.indexOf(',');
  if (commaIdx > 5 && commaIdx < 80) {
    return sentence.substring(0, commaIdx).trim();
  }

  // Last resort: first 5 words
  const words = sentence.split(/\s+/);
  return words.slice(0, Math.min(5, words.length)).join(' ');
}

/**
 * Split sentence on coordinating conjunctions, keeping meaningful parts.
 * Handles: "X and Y", "X, and Y", "X but Y", "X as well as Y"
 */
function splitOnConjunctions(sentence) {
  // Don't split very short sentences
  if (sentence.length < 40) return [sentence];

  // Pattern: split on " and " / " but " / " as well as " / " while "
  // But NOT inside quotes, parentheses, or after very short fragments
  const parts = [];
  let current = sentence;

  // Split on ", and " or " and " (with lookahead to ensure both sides are substantial)
  const conjunctionPattern = /\s*(?:,\s*)?(?:\band\b|\bbut\b|\bas well as\b|\bwhile\b|\bwhereas\b)\s+/gi;
  const splits = current.split(conjunctionPattern);

  if (splits.length > 1) {
    for (const s of splits) {
      const trimmed = s.trim();
      if (trimmed.length >= 10) {
        parts.push(trimmed);
      }
    }
    if (parts.length > 0) return parts;
  }

  return [sentence];
}

/**
 * Split on semicolons and significant comma-separated independent clauses.
 */
function splitOnSemicolonsAndCommas(sentence) {
  // Split on semicolons (these almost always separate independent clauses)
  if (sentence.includes(';')) {
    const parts = sentence.split(';')
      .map(s => s.trim())
      .filter(s => s.length >= 10);
    if (parts.length > 1) return parts;
  }

  // Split on comma + pronoun/determiner pattern (indicates new clause)
  // e.g., "X is big, making it the largest" → two claims
  const clausePattern = /,\s+(?:making|which|leading|becoming|resulting|causing|enabling|allowing|where|when)\s+/i;
  const clauseMatch = sentence.match(clausePattern);
  if (clauseMatch) {
    const idx = sentence.indexOf(clauseMatch[0]);
    const before = sentence.substring(0, idx).trim();
    const after = sentence.substring(idx + clauseMatch[0].length).trim();
    if (before.length >= 10 && after.length >= 10) {
      return [before, after];
    }
  }

  return [sentence];
}

/**
 * Split out relative clauses ("which ...", "that is ...", "who ...")
 * and re-attach the subject.
 */
function splitRelativeClauses(sentence, subject) {
  // Match ", which ..." or ", who ..." relative clauses
  const relPattern = /^(.+?),\s+(which|who|that)\s+(.+)$/i;
  const match = sentence.match(relPattern);

  if (match) {
    const mainClause = match[1].trim();
    const relativeClause = match[3].trim();

    if (mainClause.length >= 10 && relativeClause.length >= 10) {
      // The relative clause's subject is the noun before the comma
      return [mainClause, relativeClause];
    }
  }

  return [sentence];
}

/**
 * Clean an atomic claim and ensure it has a subject.
 */
function cleanAtom(atom, subject) {
  let cleaned = atom.trim();

  // Remove leading conjunctions
  cleaned = cleaned.replace(/^(?:and|but|or|also|then|thus|hence|so)\s+/i, '');

  // Remove trailing incomplete phrases
  cleaned = cleaned.replace(/[,;]\s*$/, '');

  // If the atom doesn't start with a capital letter or known subject pattern,
  // it's probably a fragment — prepend the subject
  const startsWithSubject = /^[A-Z]/.test(cleaned) || /^(?:it|its|the|this|they|he|she|we)\b/i.test(cleaned);
  const hasVerb = /\b(?:is|are|was|were|has|had|have|caused|grew|made|built|created|founded|reached|exceeded|became|produced|generated|earned|contains|comprises|measures|weighs|located|launched|announced|released|developed|introduced|discovered|invented|acquired|won|lost|increased|decreased|declined|rose|fell|dropped|ranked|scored|received)\b/i.test(cleaned);

  if (!startsWithSubject && subject && cleaned.length > 5) {
    // This is a fragment — attach the subject
    // Check if it already contains the subject
    if (!cleaned.toLowerCase().includes(subject.toLowerCase().substring(0, 10))) {
      cleaned = `${subject} ${cleaned}`;
    }
  }

  // Ensure it ends with proper punctuation
  if (cleaned && !cleaned.match(/[.!?]$/)) {
    cleaned += '.';
  }

  return cleaned;
}

/**
 * Remove near-duplicate atoms (where one is a substring of another).
 */
function deduplicateAtoms(atoms) {
  const unique = [];
  const normalized = atoms.map(a => a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim());

  for (let i = 0; i < atoms.length; i++) {
    let isDuplicate = false;
    for (let j = 0; j < unique.length; j++) {
      const existingNorm = unique[j].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      // Check if one contains the other
      if (normalized[i].includes(existingNorm) || existingNorm.includes(normalized[i])) {
        // Keep the longer one
        if (atoms[i].length > unique[j].length) {
          unique[j] = atoms[i];
        }
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      unique.push(atoms[i]);
    }
  }

  return unique;
}

/**
 * Split an array of claims into atomic sub-claims.
 * Each input claim object is decomposed; sub-claims inherit the parent's metadata.
 *
 * @param {Object[]} claims - Array of claim objects with { text, primaryEntity, keywords, ... }
 * @returns {Object[]} Expanded array of atomic claim objects
 */
function atomizeClaims(claims) {
  const atomized = [];

  for (const claim of claims) {
    const atoms = splitIntoAtomicClaims(claim.text);

    if (atoms.length <= 1) {
      // No splitting happened — keep original
      atomized.push(claim);
    } else {
      // Create sub-claims, each inheriting the parent's entity/keywords
      for (const atomText of atoms) {
        atomized.push({
          ...claim,
          text: atomText,
          _parent_text: claim.text, // Track the original for debugging
          _is_atomic: true,
        });
      }
    }
  }

  return atomized;
}

module.exports = { splitIntoAtomicClaims, atomizeClaims, extractSubject };
