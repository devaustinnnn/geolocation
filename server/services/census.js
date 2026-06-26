/**
 * Census ACS 5-Year Data API.
 * Retrieves population (B01003_001E) for a set of block group GEOIDs.
 *
 * A block group is addressed by state(2) + county(3) + tract(6) + bg(1) = 12 chars.
 * The Data API requires a (free) key; see .env.example.
 *
 * Docs: https://www.census.gov/data/developers/data-sets/acs-5year.html
 */
import { config } from '../config.js';

const TOTAL_POPULATION = 'B01003_001E';

function splitGeoid(geoid) {
  return {
    state: geoid.slice(0, 2),
    county: geoid.slice(2, 5),
    tract: geoid.slice(5, 11),
    blockGroup: geoid.slice(11, 12),
  };
}

/**
 * Fetch total population for the given block group GEOIDs.
 * Requests are batched per (state, county) to minimise API calls.
 *
 * @param {string[]} geoids
 * @param {string} [variable] ACS variable code (defaults to total population)
 * @returns {Promise<Record<string, number>>} map of GEOID -> value
 */
export async function getPopulationByGeoid(geoids, variable = TOTAL_POPULATION) {
  if (!config.censusApiKey) {
    throw new Error(
      'Missing CENSUS_API_KEY. The ACS population step requires a free key — ' +
        'sign up at https://api.census.gov/data/key_signup.html and set it in server/.env'
    );
  }
  if (geoids.length === 0) return {};

  // Group target GEOIDs by state+county.
  const byCounty = new Map();
  for (const geoid of geoids) {
    const { state, county } = splitGeoid(geoid);
    const key = `${state}:${county}`;
    if (!byCounty.has(key)) byCounty.set(key, new Set());
    byCounty.get(key).add(geoid);
  }

  const result = {};
  const wanted = new Set(geoids);

  await Promise.all(
    [...byCounty.keys()].map(async (key) => {
      const [state, county] = key.split(':');
      const rows = await fetchCounty(state, county, variable);
      for (const row of rows) {
        if (wanted.has(row.geoid)) result[row.geoid] = row.value;
      }
    })
  );

  return result;
}

async function fetchCounty(state, county, variable) {
  const base = `https://api.census.gov/data/${config.acsYear}/acs/acs5`;
  // `in` clause: all block groups in every tract of this county.
  const inClause = `state:${state} county:${county} tract:*`;
  const url =
    `${base}?get=${variable}` +
    `&for=${encodeURIComponent('block group:*')}` +
    `&in=${encodeURIComponent(inClause)}` +
    `&key=${config.censusApiKey}`;

  const res = await fetch(url);
  const text = await res.text();

  // The API returns an HTML error page (not JSON) for bad keys / requests.
  if (!res.ok || text.trimStart().startsWith('<')) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`Census ACS API error (${res.status}): ${snippet}`);
  }

  const data = JSON.parse(text);
  const header = data[0];
  const valIdx = header.indexOf(variable);
  const stIdx = header.indexOf('state');
  const coIdx = header.indexOf('county');
  const trIdx = header.indexOf('tract');
  const bgIdx = header.indexOf('block group');

  return data.slice(1).map((row) => {
    const geoid = `${row[stIdx]}${row[coIdx]}${row[trIdx]}${row[bgIdx]}`;
    const raw = Number(row[valIdx]);
    return { geoid, value: Number.isFinite(raw) && raw >= 0 ? raw : 0 };
  });
}
