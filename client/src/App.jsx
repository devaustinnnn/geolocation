import { useState } from 'react';
import SearchPanel from './components/SearchPanel.jsx';
import ResultsCard from './components/ResultsCard.jsx';
import TrafficPanel from './components/TrafficPanel.jsx';
import MapView from './components/MapView.jsx';
import * as api from './api.js';

export default function App() {
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState(1);
  const [unit, setUnit] = useState('miles');

  const [location, setLocation] = useState(null); // { lat, lng, label }
  const [parcelPolygon, setParcelPolygon] = useState(null);
  const [result, setResult] = useState(null);

  // Traffic count state
  const [trafficRadius, setTrafficRadius] = useState(0.5);
  const [trafficUnit, setTrafficUnit] = useState('miles');
  const [trafficSort, setTrafficSort] = useState('distance');
  const [trafficRoadNames, setTrafficRoadNames] = useState(false);
  const [trafficResult, setTrafficResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    setError('');
    setResult(null);
    setTrafficResult(null);
    setParcelPolygon(null);
    if (!query.trim()) {
      setError('Enter an address, parcel ID, or coordinates.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.search(query);
      setLocation({ lat: res.lat, lng: res.lng, label: res.label });
      if (res.parcelPolygon) setParcelPolygon(res.parcelPolygon);
    } catch (err) {
      setLocation(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculate() {
    if (!location) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.calculatePopulation({
        lat: location.lat,
        lng: location.lng,
        radius: Number(radius),
        unit,
      });
      setResult(res);
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGetTraffic() {
    if (!location) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.getTrafficCounts({
        lat: location.lat,
        lng: location.lng,
        radius: Number(trafficRadius),
        unit: trafficUnit,
        sort: trafficSort,
        roadNames: trafficRoadNames,
      });
      setTrafficResult(res);
    } catch (err) {
      setTrafficResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[360px_1fr]">
        {/* Left: controls + results */}
        <div className="flex flex-col gap-4 overflow-auto">
          <SearchPanel
            query={query}
            setQuery={setQuery}
            radius={radius}
            setRadius={setRadius}
            unit={unit}
            setUnit={setUnit}
            onSearch={handleSearch}
            onCalculate={handleCalculate}
            hasLocation={Boolean(location)}
            loading={loading}
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {location && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Location:</span> {location.label}
              <br />
              <span className="font-mono">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </span>
            </div>
          )}

          <ResultsCard result={result} />

          <TrafficPanel
            radius={trafficRadius}
            setRadius={setTrafficRadius}
            unit={trafficUnit}
            setUnit={setTrafficUnit}
            sort={trafficSort}
            setSort={setTrafficSort}
            roadNames={trafficRoadNames}
            setRoadNames={setTrafficRoadNames}
            onGet={handleGetTraffic}
            hasLocation={Boolean(location)}
            loading={loading}
            result={trafficResult}
          />
        </div>

        {/* Right: map */}
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <MapView
            location={location}
            parcelPolygon={parcelPolygon}
            result={result}
            traffic={trafficResult}
          />
        </div>
      </div>
    </div>
  );
}
