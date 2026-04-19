// wikipedia.js — Wikipedia REST API wrapper with timeout and fallback
const axios = require('axios');

const WIKI_BASE_URL = 'https://en.wikipedia.org/api/rest_v1';
const WIKI_SEARCH_URL = 'https://en.wikipedia.org/w/api.php';
const TIMEOUT = 4000; // 4 seconds per SRS

/**
 * Get a page summary from Wikipedia by exact title
 */
async function getPageSummary(title) {
  try {
    const encodedTitle = encodeURIComponent(title.replace(/\s+/g, '_'));
    const response = await axios.get(`${WIKI_BASE_URL}/page/summary/${encodedTitle}`, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project; contact@truthlens.dev)'
      }
    });

    if (response.data && response.data.extract) {
      return {
        found: true,
        title: response.data.title,
        extract: response.data.extract,
        url: response.data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedTitle}`
      };
    }

    return { found: false };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { found: false };
    }
    // Network error or timeout
    return { found: false, error: error.message };
  }
}

/**
 * Search Wikipedia for a query and return the best matching page summary
 */
async function searchWikipedia(query) {
  try {
    // Use the MediaWiki Action API for search
    const response = await axios.get(WIKI_SEARCH_URL, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: 1,
        format: 'json',
        origin: '*'
      },
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project; contact@truthlens.dev)'
      }
    });

    const results = response.data?.query?.search;
    if (results && results.length > 0) {
      // Got a search result, now get its summary
      const pageTitle = results[0].title;
      return await getPageSummary(pageTitle);
    }

    return { found: false };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

/**
 * Main lookup function: tries direct page summary first, then search fallback
 * Returns: { found, title, extract, url } or { found: false }
 */
async function lookupEntity(entity, fallbackKeywords = []) {
  if (!entity) {
    // No entity, try searching with keywords
    if (fallbackKeywords.length > 0) {
      return await searchWikipedia(fallbackKeywords.join(' '));
    }
    return { found: false };
  }

  // First attempt: direct page lookup
  let result = await getPageSummary(entity);
  if (result.found) return result;

  // Second attempt: search with entity name
  result = await searchWikipedia(entity);
  if (result.found) return result;

  // Third attempt: search with entity + keywords combined
  if (fallbackKeywords.length > 0) {
    result = await searchWikipedia(`${entity} ${fallbackKeywords.slice(0, 2).join(' ')}`);
    if (result.found) return result;
  }

  return { found: false };
}

module.exports = { getPageSummary, searchWikipedia, lookupEntity };
