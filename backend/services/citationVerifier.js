// citationVerifier.js — Ghost Citation Hunter: detect and verify cited references
const axios = require('axios');

// Patterns to detect citations in text
const CITATION_PATTERNS = {
  // DOI pattern: 10.xxxx/xxxxx
  doi: /\b(10\.\d{4,}\/[^\s,;)]+)\b/g,
  
  // URL pattern
  url: /https?:\/\/[^\s,;)]+/g,
  
  // Academic citation: "Author et al. YEAR" or "Author & Author YEAR"
  authorYear: /\b([A-Z][a-z]+(?:\s+(?:et\s+al|and|&)\s*\.?\s*)?(?:,?\s*\d{4}))\b/g,
  
  // Quoted paper/book titles that look like references
  quotedRef: /"([^"]{10,100})"/g,
  
  // Parenthetical citations: (Author, Year) or (Author et al., Year)
  parenthetical: /\(([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4})\)/g
};

/**
 * Extract all citation-like references from text
 */
function extractCitations(text) {
  const citations = [];

  // Find DOIs
  let match;
  const doiRegex = new RegExp(CITATION_PATTERNS.doi.source, 'g');
  while ((match = doiRegex.exec(text)) !== null) {
    citations.push({
      type: 'doi',
      value: match[1],
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Find URLs
  const urlRegex = new RegExp(CITATION_PATTERNS.url.source, 'g');
  while ((match = urlRegex.exec(text)) !== null) {
    citations.push({
      type: 'url',
      value: match[0],
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Find parenthetical citations like (Smith, 2023) or (Smith et al., 2023)
  const parenRegex = new RegExp(CITATION_PATTERNS.parenthetical.source, 'g');
  while ((match = parenRegex.exec(text)) !== null) {
    citations.push({
      type: 'author_citation',
      value: match[1],
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Find inline "Author et al. YEAR" patterns (not already captured as parenthetical)
  const authorRegex = /\b([A-Z][a-z]{2,15})\s+et\s+al\.?\s*[\(,]?\s*(\d{4})\b/g;
  while ((match = authorRegex.exec(text)) !== null) {
    const value = `${match[1]} et al. ${match[2]}`;
    // Avoid duplicates
    const alreadyCaptured = citations.some(c =>
      c.start <= match.index && c.end >= match.index + match[0].length
    );
    if (!alreadyCaptured) {
      citations.push({
        type: 'author_citation',
        value: value,
        raw: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  return citations;
}

/**
 * Verify a DOI against CrossRef API
 */
async function verifyDOI(doi) {
  try {
    const response = await axios.get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      timeout: 4000,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project)'
      }
    });

    if (response.status === 200 && response.data?.message) {
      const work = response.data.message;
      return {
        exists: true,
        title: work.title?.[0] || 'Unknown',
        authors: work.author?.map(a => `${a.given || ''} ${a.family || ''}`).join(', ') || 'Unknown',
        year: work.published?.['date-parts']?.[0]?.[0] || null,
        url: work.URL || `https://doi.org/${doi}`
      };
    }

    return { exists: false };
  } catch (error) {
    if (error.response?.status === 404) {
      return { exists: false };
    }
    // Network error — don't flag as ghost, just uncertain
    return { exists: null, error: error.message };
  }
}

/**
 * Verify if a URL is reachable
 */
async function verifyURL(url) {
  try {
    const response = await axios.head(url, {
      timeout: 4000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project)'
      },
      validateStatus: (status) => status < 500
    });

    return {
      exists: response.status < 400,
      statusCode: response.status
    };
  } catch (error) {
    // Try GET if HEAD fails
    try {
      const response = await axios.get(url, {
        timeout: 4000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'TruthLens/1.0 (Hackathon Project)'
        },
        validateStatus: (status) => status < 500,
        maxContentLength: 1024 // Only read first 1KB
      });
      return { exists: response.status < 400, statusCode: response.status };
    } catch {
      return { exists: false, error: 'unreachable' };
    }
  }
}

/**
 * Verify an author citation (e.g., "Smith et al. 2023") against CrossRef search
 */
async function verifyAuthorCitation(citation) {
  try {
    // Extract author name and year
    const match = citation.match(/([A-Za-z]+).*?(\d{4})/);
    if (!match) return { exists: null };

    const author = match[1];
    const year = match[2];

    const response = await axios.get('https://api.crossref.org/works', {
      params: {
        query: `${author}`,
        'filter': `from-pub-date:${year},until-pub-date:${year}`,
        rows: 3
      },
      timeout: 4000,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project)'
      }
    });

    const items = response.data?.message?.items || [];
    
    // Check if any result matches the author name
    const matchFound = items.some(item => {
      const authors = item.author || [];
      return authors.some(a =>
        (a.family || '').toLowerCase() === author.toLowerCase()
      );
    });

    if (matchFound) {
      const bestMatch = items[0];
      return {
        exists: true,
        title: bestMatch.title?.[0] || 'Found matching publication',
        url: bestMatch.URL || null
      };
    }

    return { exists: false };
  } catch (error) {
    return { exists: null, error: error.message };
  }
}

/**
 * Run the full Ghost Citation audit on the input text
 * Returns an array of citation verification results
 */
async function auditCitations(text) {
  const citations = extractCitations(text);

  if (citations.length === 0) {
    return { citations: [], hasGhostCitations: false };
  }

  // Verify all citations in parallel
  const results = await Promise.all(
    citations.map(async (citation) => {
      let verification;

      switch (citation.type) {
        case 'doi':
          verification = await verifyDOI(citation.value);
          break;
        case 'url':
          verification = await verifyURL(citation.value);
          break;
        case 'author_citation':
          verification = await verifyAuthorCitation(citation.value);
          break;
        default:
          verification = { exists: null };
      }

      return {
        ...citation,
        verification,
        isGhost: verification.exists === false,
        status: verification.exists === true ? 'verified' :
                verification.exists === false ? 'ghost' : 'uncertain'
      };
    })
  );

  const hasGhostCitations = results.some(r => r.isGhost);

  return {
    citations: results,
    hasGhostCitations,
    total: results.length,
    ghost_count: results.filter(r => r.isGhost).length,
    verified_count: results.filter(r => r.status === 'verified').length,
    uncertain_count: results.filter(r => r.status === 'uncertain').length
  };
}

module.exports = { extractCitations, verifyDOI, verifyURL, verifyAuthorCitation, auditCitations };
