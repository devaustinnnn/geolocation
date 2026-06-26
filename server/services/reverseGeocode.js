/**
 * Reverse geocoding via OpenStreetMap Nominatim.
 * Used to recover a street name for traffic stations whose source dataset
 * doesn't publish one (TxDOT's public 5-Year/off-system layer).
 *
 * Nominatim usage policy: max ~1 request/second, a valid User-Agent is
 * required, and bulk use is discouraged. We therefore:
 *   - throttle to one request at a time, ~1.1s apart,
 *   - cache results in-memory by rounded coordinates,
 *   - and callers cap how many points they resolve per request.
 *
 * For production, swap this for your own geocoder / a self-hosted Nominatim.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'PopulationRadiusPOC/1.0 (parcel-traffic-poc)';
const MIN_SPACING_MS = 1100;

const cache = new Map(); // "lat,lng" -> road name | null
let lastCallAt = 0;
let chain = Promise.resolve(); // serialises requests

function throttledFetch(url) {
  // Queue each call after the previous one, spaced by MIN_SPACING_MS.
  const run = chain.then(async () => {
    const wait = lastCallAt + MIN_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  });
  // Keep the chain alive even if this call rejects.
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * @returns {Promise<string|null>} the road name, or null if unknown.
 */
export async function getRoadName(lat, lng) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '17', // major + minor streets
    addressdetails: '1',
  });

  try {
    const res = await throttledFetch(`${NOMINATIM_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const a = data.address || {};
    const road =
      a.road ||
      a.residential ||
      a.pedestrian ||
      a.footway ||
      a.cycleway ||
      a.path ||
      null;
    cache.set(key, road);
    return road;
  } catch {
    cache.set(key, null);
    return null;
  }
}
