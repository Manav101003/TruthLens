// wikidata.js — Wikidata entity lookup for multi-source verification
const axios = require('axios');

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const TIMEOUT = 3000; // 3 seconds

/**
 * Search Wikidata for an entity and return its label + description.
 * Uses the wbsearchentities action which is fast and doesn't require auth.
 *
 * @param {string} query - The entity name or search term
 * @returns {{ found: boolean, label?: string, description?: string, url?: string }}
 */
async function lookupWikidata(query) {
  if (!query || query.trim().length === 0) {
    return { found: false };
  }

  try {
    // Step 1: Search for the entity
    const searchResponse = await axios.get(WIKIDATA_API, {
      params: {
        action: 'wbsearchentities',
        search: query,
        language: 'en',
        limit: 1,
        format: 'json',
        origin: '*'
      },
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project; multi-source verification)'
      }
    });

    const results = searchResponse.data?.search;
    if (!results || results.length === 0) {
      return { found: false };
    }

    const entity = results[0];
    const entityId = entity.id;

    // Step 2: Get entity details (description + claims summary)
    const detailResponse = await axios.get(WIKIDATA_API, {
      params: {
        action: 'wbgetentities',
        ids: entityId,
        props: 'descriptions|labels|sitelinks',
        languages: 'en',
        format: 'json',
        origin: '*'
      },
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'TruthLens/1.0 (Hackathon Project; multi-source verification)'
      }
    });

    const entityData = detailResponse.data?.entities?.[entityId];
    if (!entityData) {
      return { found: false };
    }

    const label = entityData.labels?.en?.value || entity.label || '';
    const description = entityData.descriptions?.en?.value || entity.description || '';

    // Build a text excerpt from label + description for keyword matching
    const extract = `${label}. ${description}`;

    return {
      found: true,
      label,
      description,
      extract,
      url: `https://www.wikidata.org/wiki/${entityId}`
    };
  } catch (error) {
    // Graceful fallback — never break the pipeline
    return { found: false, error: error.message };
  }
}

module.exports = { lookupWikidata };
