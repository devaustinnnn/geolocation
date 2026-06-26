import { useEffect, useRef } from 'react';
import L from 'leaflet';

// Reliable marker icons. Bundled PNG imports often break the icon under Vite,
// so we point Leaflet's default icon at the CDN copies (same version as the CSS).
const ICON_BASE = 'https://unpkg.com/leaflet@1.9.4/dist/images';
const defaultIcon = L.icon({
  iconUrl: `${ICON_BASE}/marker-icon.png`,
  iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
  shadowUrl: `${ICON_BASE}/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

// Bold, broad styling so the parcel boundary stands out above everything else.
const PARCEL_STYLE = {
  color: '#f97316', // orange-500
  weight: 4,
  opacity: 1,
  dashArray: '6 4',
  fillColor: '#f97316',
  fillOpacity: 0.25,
};

export default function MapView({ location, parcelPolygon, result, traffic }) {
  const mapRef = useRef(null);
  const layersRef = useRef({});

  // Initialise the map once.
  useEffect(() => {
    const map = L.map('map', { center: [39.5, -98.35], zoom: 4 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;
    // Leaflet sometimes renders into a 0-height container on first paint.
    setTimeout(() => map.invalidateSize(), 0);
    return () => map.remove();
  }, []);

  // Update marker + parcel polygon when the location changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    const layers = layersRef.current;

    layers.marker?.remove();
    layers.parcel?.remove();
    layers.parcel = null;

    layers.marker = L.marker([location.lat, location.lng], { icon: defaultIcon })
      .addTo(map)
      .bindPopup(location.label || `${location.lat}, ${location.lng}`);

    if (parcelPolygon) {
      layers.parcel = L.geoJSON(parcelPolygon, { style: PARCEL_STYLE })
        .addTo(map)
        .bindPopup('Parcel boundary');
      layers.parcel.bringToFront();
      // Frame the parcel, then keep the marker visible on top.
      map.fitBounds(layers.parcel.getBounds(), { padding: [60, 60], maxZoom: 18 });
    } else {
      map.setView([location.lat, location.lng], 15);
    }
  }, [location, parcelPolygon]);

  // Draw the radius buffer + intersecting block groups when a result arrives.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = layersRef.current;

    layers.blockGroups?.remove();
    layers.circle?.remove();

    if (!result) return;

    if (result.blockGroups?.length) {
      layers.blockGroups = L.geoJSON(
        {
          type: 'FeatureCollection',
          features: result.blockGroups.map((bg) => ({
            type: 'Feature',
            geometry: bg.geometry,
            properties: bg,
          })),
        },
        {
          style: { color: '#0ea5e9', weight: 1, fillOpacity: 0.08 },
          onEachFeature: (feature, layer) => {
            const p = feature.properties;
            layer.bindPopup(
              `<b>Block Group ${p.geoid}</b><br/>` +
                `Population: ${p.population.toLocaleString()}<br/>` +
                `Overlap: ${p.weightPercent}%<br/>` +
                `Contribution: ${p.contribution.toLocaleString()}`
            );
          },
        }
      ).addTo(map);
    }

    layers.circle = L.geoJSON(result.circle, {
      style: { color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.08 },
    }).addTo(map);

    // Keep the parcel boundary and marker visible above the buffer/block groups.
    layers.parcel?.bringToFront();
    layers.marker?.setZIndexOffset(1000);

    map.fitBounds(layers.circle.getBounds(), { padding: [30, 30] });
  }, [result]);

  // Draw the traffic search radius + AADT station points.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = layersRef.current;

    layers.trafficCircle?.remove();
    layers.trafficStations?.remove();

    if (!traffic) return;

    const { center, radius, trafficCounts } = traffic;

    layers.trafficCircle = L.circle([center.lat, center.lng], {
      radius: radius.meters,
      color: '#16a34a', // green-600
      weight: 2,
      dashArray: '5 5',
      fillColor: '#16a34a',
      fillOpacity: 0.05,
    }).addTo(map);

    const stations = (trafficCounts || []).map((t) => {
      const onSystem = t.dataset !== '5-Year (off-system)';
      return L.circleMarker([t.lat, t.lng], {
        radius: 7,
        // On-system (annual) = amber; off-system (5-year) = blue.
        color: onSystem ? '#b45309' : '#1d4ed8',
        weight: 2,
        fillColor: onSystem ? '#f59e0b' : '#3b82f6',
        fillOpacity: 0.9,
      }).bindPopup(
        `<b>${t.roadName}</b><br/>` +
          `AADT: ${t.aadt != null ? t.aadt.toLocaleString() : '—'} vehicles/day<br/>` +
          `Year: ${t.year ?? '—'}<br/>` +
          `Distance: ${t.distanceMiles} mi<br/>` +
          `Station: ${t.stationId ?? '—'} (${t.source})<br/>` +
          `<span style="color:#64748b">${t.dataset ?? ''}</span>`
      );
    });
    layers.trafficStations = L.layerGroup(stations).addTo(map);
    layers.parcel?.bringToFront();
    layers.marker?.setZIndexOffset(1000);

    map.fitBounds(layers.trafficCircle.getBounds(), { padding: [40, 40] });
  }, [traffic]);

  return <div id="map" className="h-full w-full" />;
}
