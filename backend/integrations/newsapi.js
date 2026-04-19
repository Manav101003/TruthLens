// newsapi.js — NewsAPI integration for current events verification (OPTIONAL)
// Activated only when NEWS_API_KEY is set in .env
const axios = require('axios');

const NEWS_API = 'https://newsapi.org/v2/everything';
const TIMEOUT = 4000;

/**
 * Check if NewsAPI is configured via environment variable.
 */
function isNewsAPIEnabled() {
  return !!process.env.NEWS_API_KEY;
}

/**
 * Search NewsAPI for recent news articles related to a claim.
 * Useful for verifying claims about current events, recent discoveries, etc.
 *
 * @param {string} query - Search term
 * @returns {{ found: boolean, extract?: string, source?: string, articles?: Array }}
 */
async function lookupNewsAPI(query) {
  if (!isNewsAPIEnabled()) {
    return { found: false, disabled: true };
  }

  if (!query || query.trim().length === 0) {
    return { found: false };
  }

  try {
    const response = await axios.get(NEWS_API, {
      params: {
        q: query,
        pageSize: 3,
        sortBy: 'relevancy',
        language: 'en'
      },
      timeout: TIMEOUT,
      headers: {
        'X-Api-Key': process.env.NEWS_API_KEY
      }
    });

    const articles = response.data?.articles || [];

    if (articles.length === 0) {
      return { found: false };
    }

    // Build extract from article titles and descriptions
    const extractParts = articles.map(article =>
      `${article.title || ''}. ${article.description || ''}`
    );
    const extract = extractParts.join(' ').trim();

    return {
      found: true,
      extract,
      source: 'NewsAPI',
      url: `https://newsapi.org`,
      articles: articles.map(a => ({
        title: a.title,
        description: a.description,
        source: a.source?.name,
        url: a.url,
        publishedAt: a.publishedAt
      }))
    };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

module.exports = { lookupNewsAPI, isNewsAPIEnabled };
