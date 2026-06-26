/**
 * Parcel lookup.
 *
 * If a PostgreSQL parcel database is configured (DATABASE_URL), parcels are
 * looked up there by parcel number. Otherwise we fall back to a tiny built-in
 * sample so the Parcel ID search path still works for a demo.
 *
 * Expected columns (configurable via env — see server/.env.example):
 *   parcel number, address, latitude, longitude, [county]
 */
import * as turf from '@turf/turf';
import { getPool } from './db.js';
import { config } from '../config.js';

// Quote a SQL identifier safely. Names come from env (trusted), but quoting
// lets mixed-case names work and avoids keyword clashes.
const q = (name) => `"${String(name).replace(/"/g, '""')}"`;
// Quote a possibly schema-qualified table name, e.g. attom_dataset.boundaries.
const qTable = (name) => String(name).split('.').map(q).join('.');

export async function lookupParcel(parcelId) {
  const id = String(parcelId).trim();
  const pool = getPool();

  if (pool) {
    return lookupFromDb(pool, id);
  }
  return lookupSample(id);
}

async function lookupFromDb(pool, id) {
  const p = config.parcel;
  const selects = [
    `${q(p.idCol)} AS parcel_id`,
    `${q(p.latCol)} AS lat`,
    `${q(p.lngCol)} AS lng`,
    p.addrCol ? `${q(p.addrCol)} AS address` : `NULL AS address`,
    p.countyCol ? `${q(p.countyCol)} AS county` : `NULL AS county`,
    // Return the parcel boundary as GeoJSON when a geometry column is set.
    p.geomCol ? `ST_AsGeoJSON(${q(p.geomCol)}) AS geojson` : `NULL AS geojson`,
  ].join(', ');

  // Match on text form (case- and whitespace-insensitive) so numeric and
  // alphanumeric parcel numbers both resolve regardless of how they're typed.
  const sql =
    `SELECT ${selects} FROM ${qTable(p.table)} ` +
    `WHERE upper(btrim(${q(p.idCol)}::text)) = upper(btrim($1)) LIMIT 1`;

  let rows;
  try {
    ({ rows } = await pool.query(sql, [id]));
  } catch (err) {
    throw new Error(
      `Parcel database query failed: ${err.message}. ` +
        `Check PARCEL_TABLE / PARCEL_*_COL settings in server/.env.`
    );
  }

  if (rows.length === 0) {
    throw new Error(`Parcel "${id}" not found in the parcel database.`);
  }

  const r = rows[0];
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Parcel "${id}" has no valid latitude/longitude in the database.`);
  }

  let polygon = null;
  if (r.geojson) {
    try {
      polygon = JSON.parse(r.geojson);
    } catch {
      polygon = null;
    }
  }

  return {
    parcelId: String(r.parcel_id),
    address: r.address || null,
    county: r.county || null,
    polygon,
    lat,
    lng,
  };
}

// --- Built-in sample (used only when no DATABASE_URL is set) ---
const SAMPLE_PARCELS = {
  '123456789': {
    parcelId: '123456789',
    address: '725 FM 1626, Austin, TX',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [-97.84265, 30.1364],
          [-97.8418, 30.1364],
          [-97.8418, 30.13705],
          [-97.84265, 30.13705],
          [-97.84265, 30.1364],
        ],
      ],
    },
  },
};

function lookupSample(id) {
  const parcel = SAMPLE_PARCELS[id];
  if (!parcel) {
    throw new Error(
      `Parcel "${id}" not found. No parcel database is configured (set DATABASE_URL ` +
        `in server/.env). Built-in sample parcel IDs: ${Object.keys(SAMPLE_PARCELS).join(', ')}`
    );
  }
  const centroid = turf.centroid(turf.feature(parcel.polygon)).geometry.coordinates;
  return {
    parcelId: parcel.parcelId,
    address: parcel.address,
    county: null,
    polygon: parcel.polygon,
    lng: centroid[0],
    lat: centroid[1],
  };
}
