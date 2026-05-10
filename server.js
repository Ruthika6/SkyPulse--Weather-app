/**
 * Weather App — Backend Server
 * Node.js + Express proxy for Open-Meteo & Nominatim
 * No API keys required — both APIs are free and open
 * Run: npm install && npm start
 * Dev: npm run dev   (needs nodemon)
 */
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* ── Logging middleware ───────────────────────────────────── */
app.use((req, _res, next) => {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}]  ${req.method}  ${req.url}`);
  next();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/* ── Geocoding  (Nominatim / OSM) ─────────────────────────── */
// GET /api/geocode?q=Chennai
app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required.' });

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'WeatherApp/1.0 (educational project)'
      }
    });

    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);

    const data = await response.json();
    if (!data.length) return res.status(404).json({ error: `No results found for "${q}".` });

    const results = data.map(item => ({
      lat:     parseFloat(item.lat),
      lon:     parseFloat(item.lon),
      name:    item.address?.city || item.address?.town || item.address?.village || item.address?.county || item.name,
      country: item.address?.country || '',
      display: item.display_name
    }));

    res.json({ results });
  } catch (err) {
    console.error('Geocode error:', err.message);
    res.status(500).json({ error: 'Geocoding service unavailable. Try again later.' });
  }
});

app.get('/api/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'WeatherApp/1.0 (educational project)'
      }
    });

    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);

    const data = await response.json();
    const address = data.address || {};
    res.json({
      name:    address.city || address.town || address.village || address.county || 'Your Location',
      country: address.country || '',
      state:   address.state  || ''
    });
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    res.status(500).json({ error: 'Reverse geocoding failed.' });
  }
});

app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });

  try {
    const params = new URLSearchParams({
      latitude:  lat,
      longitude: lon,
      current: [
        'temperature_2m', 'apparent_temperature', 'weather_code',
        'relative_humidity_2m', 'wind_speed_10m', 'wind_direction_10m',
        'wind_gusts_10m', 'precipitation', 'surface_pressure', 'visibility',
        'is_day'
      ].join(','),
      hourly: [
        'temperature_2m', 'weather_code', 'precipitation_probability',
        'wind_speed_10m'
      ].join(','),
      daily: [
        'temperature_2m_max', 'temperature_2m_min', 'weather_code',
        'sunrise', 'sunset', 'uv_index_max', 'precipitation_sum',
        'precipitation_probability_max'
      ].join(','),
      timezone:      'auto',
      forecast_days: '7'
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    res.status(500).json({ error: 'Weather service unavailable. Try again later.' });
  }
});

app.get('/api/airquality', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Air quality API responded ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('AQI error:', err.message);
    res.status(500).json({ error: 'Air quality data unavailable.' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.listen(PORT, () => {
  console.log(`\n🌤  Weather backend running at http://localhost:${PORT}`);
  console.log(`   Try: http://localhost:${PORT}/api/health\n`);
});
