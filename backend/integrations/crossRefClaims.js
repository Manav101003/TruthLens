// crossRefClaims.js — CrossRef API for claim-level verification (not just citations)
// Searches for academic papers that corroborate or discuss claim topics.
const axios = require('axios');

const CROSSREF_API = 'https://api.crossref.org/works';
const TIMEOUT = 4000; // 4 seconds

/**
 * Search CrossRef for academic papers related to a claim's topic.
 * Returns an extract built from paper titles and abstracts for keyword matching.
 *
 * @param {string} query - Search term (entity name or claim keywords)
 * @returns {{ found: boolean, extract?: string, papers?: Array, source?: string }}
 */
async function lookupCrossRef(query) {
  if (!query || query.trim().length === 0) {
    return { found: false };
  }

  try {
    const response = await axios.get(CROSSREF_API, {
      params: {
        query: query,
        rows: 3,
        select: 'title,abstract,author,published-print,URL'
      },
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project; multi-source verification)'
      }
    });

    const items = response.data?.message?.items || [];

    if (items.length === 0) {
      return { found: false };
    }

    // Build extract from paper titles + abstracts for keyword matching
    const papers = items.map(item => ({
      title: item.title?.[0] || '',
      abstract: (item.abstract || '').replace(/<[^>]*>/g, ''), // Strip HTML tags
      authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`).join(', '),
      year: item['published-print']?.['date-parts']?.[0]?.[0] || null,
      url: item.URL || null
    }));

    // Combine all text for keyword matching
    const extractParts = papers.map(p => `${p.title}. ${p.abstract}`);
    const extract = extractParts.join(' ').trim();

    if (extract.length < 10) {
      return { found: false };
    }

    return {
      found: true,
      extract,
      papers,
      source: 'CrossRef',
      url: `https://search.crossref.org/?q=${encodeURIComponent(query)}`
    };
  } catch (error) {
    // Graceful fallback — never break the pipeline
    return { found: false, error: error.message };
  }
}

module.exports = { lookupCrossRef };
