# Population Within Radius — U.S. Census Data (POC)

Search a location (address, parcel address, Parcel ID, or lat/lng), draw a
configurable radius, and estimate the **area-weighted population** inside it
using official U.S. Census data.

## How it works

```
Search ─▶ lat/lng ─▶ circular buffer ─▶ intersecting Census Block Groups
       ─▶ area-weighted intersection ─▶ ACS population ─▶ weighted total
```

| Step | Service |
|------|---------|
| Address → lat/lng + geography | **Census Geocoder API** |
| Block groups intersecting the buffer | **TIGERweb REST API** (`tigerWMS_ACS2024`, layer 10) |
| Block group population (`B01003_001E`) | **Census ACS 5-Year Data API** (2024) |
| Buffer + polygon intersection | **Turf.js** |

Estimated population = Σ ( blockGroupPopulation × intersectionArea / blockGroupArea ).

## Project structure

```
server/                 Express API
  index.js              /api/search, /api/population
  config.js             env + Census vintages
  services/
    parseInput.js       detect coords / parcel / address
    geocoder.js         Census Geocoder
    parcel.js           parcel DB (POC stub)
    tigerweb.js         block group geometry
    census.js           ACS population (batched per county)
    population.js       buffer + intersection + weighting
client/                 React + Leaflet + Tailwind (Vite)
  src/components/        SearchPanel, MapView, ResultsCard
```

## Setup

### 1. Get a free Census API key (required for population)

Sign up (instant) at <https://api.census.gov/data/key_signup.html>.

```bash
cd server
cp .env.example .env      # then paste your key into CENSUS_API_KEY
```

> Search, geocoding, buffering, and block-group lookup work **without** a key.
> Only the ACS population step needs it.

### 2. Install dependencies

```bash
# from the repo root
npm install                 # installs concurrently (root only)
npm run install:all         # installs server + client deps
```

### 3. Run

```bash
npm run dev                 # starts API (:5000) and client (:5173) together
```

Then open <http://localhost:5173>. (Vite proxies `/api` to the backend.)

You can also run them separately: `npm run dev:server` and `npm run dev:client`.

## Usage

1. Enter one of:
   - `725 FM 1626, Austin, TX` (address)
   - `Parcel ID: 123456789` (sample parcel shipped in the POC stub)
   - `30.13672,-97.84221` (coordinates)
2. Click **Find Location** — the map centers and drops a marker.
3. Set a **radius** and **unit** (Miles / Kilometers / Meters / Feet).
4. Click **Calculate Population** — the buffer, intersecting block groups, and
   the estimated population appear.

## Notes & limitations (POC)

- **Parcel DB is a stub** (`server/services/parcel.js`) with one sample parcel.
  Wire it to a real parcel layer / PostGIS for production.
- Area weighting assumes population is **uniformly distributed** within a block
  group — standard for this method but an approximation.
- Geometry intersection runs in **Turf.js**; production should use **PostGIS**.
- The design isolates the ACS variable, so adding demographics (households,
  median income, age, tenure, etc.) only means requesting more variable codes
  in `services/census.js` — the spatial workflow is unchanged.
```
