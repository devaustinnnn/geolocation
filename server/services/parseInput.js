/**
 * Detect the type of a free-form search query.
 * Supported: coordinates ("lat, lng"), parcel IDs, and addresses.
 *
 * Returns one of:
 *   { type: 'coords',  lat, lng }
 *   { type: 'parcel',  parcelId }
 *   { type: 'address', address }
 */
export function parseInput(raw) {
  const input = (raw || '').trim();
  if (!input) {
    return { type: 'unknown', error: 'Empty search input' };
  }

  // 1) Coordinates: "30.13672,-97.84221" or "30.13672, -97.84221"
  //    Two decimal numbers separated by a comma, with latitude in [-90,90].
  const coordMatch = input.match(
    /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
  );
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { type: 'coords', lat, lng };
    }
  }

  // 2) Explicit parcel id: "Parcel ID: 123456789" or "APN 123-456-789"
  const parcelLabel = input.match(/^(?:parcel\s*id|parcel|apn)\s*[:#]?\s*(.+)$/i);
  if (parcelLabel) {
    return { type: 'parcel', parcelId: parcelLabel[1].trim() };
  }

  // 3) Bare parcel id / APN: a single token (no spaces), at least 5 chars of
  //    letters/digits/dashes, containing at least one digit. This matches both
  //    numeric IDs ("533274") and alphanumeric APNs ("R327563"), while a plain
  //    word like "Austin" (no digit) falls through to address handling.
  if (/^[A-Za-z0-9][A-Za-z0-9-]{4,}$/.test(input) && /\d/.test(input)) {
    return { type: 'parcel', parcelId: input };
  }

  // 4) Everything else is treated as an address.
  return { type: 'address', address: input };
}
