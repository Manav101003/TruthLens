// googleSearch.js — Google Custom Search API for multi-source verification (OPTIONAL)
// Activated only when GOOGLE_API_KEY and GOOGLE_CSE_ID are set in .env
const axios = require('axios');

const GOOGLE_API = 'https://www.googleapis.com/customsearch/v1';
const TIMEOUT = 4000;

/**
 * Check if Google Search is configured via environment variables.
 */
function isGoogleSearchEnabled() {
  return !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
}

/**
 * Search Google Custom Search API for web snippets related to a claim.
 * Returns combined snippet text for keyword matching.
 *
 * @param {string} query - Search term
 * @returns {{ found: boolean, extract?: string, source?: string, url?: string }}
 */
async function lookupGoogleSearch(query) {
  if (!isGoogleSearchEnabled()) {
    return { found: false, disabled: true };
  }

  if (!query || query.trim().length === 0) {
    return { found: false };
  }

  try {
    const response = await axios.get(GOOGLE_API, {
      params: {
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_CSE_ID,
        q: query,
        num: 3
      },
      timeout: TIMEOUT
    });

    const items = response.data?.items || [];

    if (items.length === 0) {
      return { found: false };
    }

    // Build extract from snippets and titles
    const extractParts = items.map(item =>
      `${item.title || ''}. ${item.snippet || ''}`
    );
    const extract = extractParts.join(' ').trim();

    return {
      found: true,
      extract,
      source: 'Google Search',
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      results: items.map(i => ({ title: i.title, snippet: i.snippet, link: i.link }))
    };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

module.exports = { lookupGoogleSearch, isGoogleSearchEnabled };
