/**
 * Standalone backend smoke test — no browser, no UI.
 *
 * Runs the full pipeline (parse -> geocode/coords -> buffer -> TIGERweb
 * block groups -> ACS population -> area-weighted total) and prints the result.
 *
 * Usage:
 *   node server/test.js                      # default: Austin address, 1 mile
 *   node server/test.js "30.13672,-97.84221" # coordinates
 *   node server/test.js "725 FM 1626, Austin, TX" 2 miles
 *   node server/test.js "Parcel ID: 123456789" 0.5 miles
 */
import { config } from './config.js';
import { parseInput } from './services/parseInput.js';
import { geocodeAddress } from './services/geocoder.js';
import { lookupParcel } from './services/parcel.js';
import { calculatePopulation, toMeters } from './services/population.js';

const query = process.argv[2] || '725 FM 1626, Austin, TX';
const radius = Number(process.argv[3] || 1);
const unit = (process.argv[4] || 'miles').toLowerCase();

function line() {
  console.log('─'.repeat(60));
}

async function resolveLocation(input) {
  const parsed = parseInput(input);
  console.log(`Detected input type: ${parsed.type}`);

  if (parsed.type === 'coords') {
    return { lat: parsed.lat, lng: parsed.lng, label: `${parsed.lat}, ${parsed.lng}` };
  }
  if (parsed.type === 'parcel') {
    const p = await lookupParcel(parsed.parcelId);
    return { lat: p.lat, lng: p.lng, label: `Parcel ${p.parcelId} (${p.address})` };
  }
  if (parsed.type === 'address') {
    const g = await geocodeAddress(parsed.address);
    return { lat: g.lat, lng: g.lng, label: g.matchedAddress || parsed.address };
  }
  throw new Error(parsed.error || 'Could not parse input');
}

async function main() {
  line();
  console.log('Population Within Radius — backend smoke test');
  line();
  console.log(`Query : "${query}"`);
  console.log(`Radius: ${radius} ${unit}`);
  console.log(`ACS   : ${config.acsYear} 5-Year   |  Census key set: ${Boolean(config.censusApiKey)}`);
  line();

  console.log('1/4  Resolving location...');
  const loc = await resolveLocation(query);
  console.log(`     -> ${loc.label}`);
  console.log(`     -> lat ${loc.lat}, lng ${loc.lng}`);

  const radiusMeters = toMeters(radius, unit);
  console.log(`\n2/4  Buffer radius = ${radiusMeters.toFixed(1)} meters`);

  console.log('3/4  Querying TIGERweb + ACS, computing area-weighted population...');
  const result = await calculatePopulation({
    lat: loc.lat,
    lng: loc.lng,
    radiusMeters,
  });

  console.log(`     -> ${result.blockGroupCount} intersecting block group(s)`);

  line();
  console.log('4/4  RESULT');
  line();
  console.log(`  Estimated Population : ${result.estimatedPopulation.toLocaleString()}`);
  console.log(`  Radius               : ${radius} ${unit}`);
  console.log(`  Method               : ${result.method}`);
  console.log(`  Source               : ${result.source}`);
  line();

  console.log('  Block group breakdown:');
  console.log('  ' + 'GEOID'.padEnd(14) + 'Pop'.padStart(8) + 'Overlap'.padStart(10) + 'Contrib'.padStart(10));
  for (const bg of result.blockGroups) {
    console.log(
      '  ' +
        bg.geoid.padEnd(14) +
        String(bg.population).padStart(8) +
        `${bg.weightPercent}%`.padStart(10) +
        String(bg.contribution).padStart(10)
    );
  }
  line();
  console.log('OK — backend pipeline works end to end. ✅');
}

main().catch((err) => {
  line();
  console.error('TEST FAILED ❌');
  console.error('  ' + err.message);
  line();
  process.exit(1);
});
