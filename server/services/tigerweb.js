/**
 * TIGERweb REST service.
 * Returns Census Block Group polygons intersecting a bounding box.
 *
 * Docs: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb
 */
import { config } from '../config.js';

const TIGERWEB_BASE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';

/**
 * @param {[number,number,number,number]} bbox  [minLng, minLat, maxLng, maxLat]
 * @returns {Promise<GeoJSON.Feature[]>} block group features with a GEOID property
 */
export async function getBlockGroups(bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  const layerUrl =
    `${TIGERWEB_BASE}/${config.tigerwebService}/MapServer/${config.blockGroupLayer}/query`;

  const params = new URLSearchParams({
    geometry: `${minX},${minY},${maxX},${maxY}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'GEOID',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  });

  const url = `${layerUrl}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TIGERweb returned HTTP ${res.status}`);
  }
  const data = await res.json();

  if (data.error) {
    throw new Error(`TIGERweb error: ${data.error.message || 'unknown'}`);
  }

  return (data.features || []).filter((f) => f.geometry && f.properties?.GEOID);
}
