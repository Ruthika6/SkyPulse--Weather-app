
const API_BASE = 'http://localhost:3001/api';

const state = {
  unit:        'C',
  activeView:  'today',
  lastData:    null,
  lastCity:    null,
  lastCountry: null,
  lastLat:     null,
  lastLon:     null,
  searchDebounce: null,
};

const $ = id => document.getElementById(id);

const DOM = {
  searchInput:  $('searchInput'),
  clearBtn:     $('clearBtn'),
  suggestions:  $('suggestions'),
  locBtn:       $('locBtn'),
  unitBtns:     document.querySelectorAll('.unit-btn'),
  navBtns:      document.querySelectorAll('.nav-btn'),
  loading:  $('stateLoading'),
  error:    $('stateError'),
  empty:    $('stateEmpty'),

  viewToday:  $('viewToday'),
  cityLabel:  $('cityLabel'),
  heroTemp:   $('heroTemp'),
  heroDesc:   $('heroDesc'),
  heroFeels:  $('heroFeels'),
  weatherArt: $('weatherArt'),
  hiLo:       $('hiLo'),
  statsGrid:  $('statsGrid'),
  aqiWrap:    $('aqiWrap'),
  aqiNum:     $('aqiNum'),
  aqiLabel:   $('aqiLabel'),
  aqiFill:    $('aqiFill'),

  // Hourly
  viewHourly: $('viewHourly'),
  hourlyGrid: $('hourlyGrid'),

  // Forecast
  viewForecast:  $('viewForecast'),
  forecastList:  $('forecastList'),

  // Error
  errorTitle: $('errorTitle'),
  errorMsg:   $('errorMsg'),
  retryBtn:   $('retryBtn'),
  atmosphere: $('atmosphere'),
  particles:  $('particles'),
};

function getWeatherMeta(code, isDay = 1) {
  const n = !isDay;
  if (code === 0)       return { icon: n ? '🌙' : '☀️',  desc: 'Clear sky',         sky: 'day',   orbs: ['#1a5fa8','#0d3d7a','#2196c4'] };
  if (code <= 2)        return { icon: n ? '🌙' : '🌤️',  desc: 'Partly cloudy',     sky: 'day',   orbs: ['#1a4a7a','#0d3060','#1a7aa8'] };
  if (code === 3)       return { icon: '☁️',              desc: 'Overcast',           sky: 'cloud', orbs: ['#2a3a4a','#1a2a3a','#3a4a5a'] };
  if (code <= 48)       return { icon: '🌫️',              desc: 'Foggy',              sky: 'cloud', orbs: ['#2a3040','#1a2030','#353f4e'] };
  if (code <= 55)       return { icon: '🌦️',              desc: 'Drizzle',            sky: 'rain',  orbs: ['#1a3048','#0d2038','#204860'] };
  if (code <= 57)       return { icon: '🌨️',              desc: 'Freezing drizzle',   sky: 'rain',  orbs: ['#1a2a3a','#102030','#283a4a'] };
  if (code <= 63)       return { icon: '🌧️',              desc: 'Rain',               sky: 'rain',  orbs: ['#14283c','#0a1828','#1e3850'] };
  if (code <= 65)       return { icon: '🌧️',              desc: 'Heavy rain',         sky: 'storm', orbs: ['#0f1e2e','#080f1e','#182840'] };
  if (code <= 67)       return { icon: '🌨️',              desc: 'Freezing rain',      sky: 'storm', orbs: ['#141e2e','#0a1020','#202e3e'] };
  if (code <= 77)       return { icon: '❄️',              desc: 'Snow',               sky: 'cloud', orbs: ['#1e2e42','#141e30','#283a52'] };
  if (code <= 82)       return { icon: '🌦️',              desc: 'Rain showers',       sky: 'rain',  orbs: ['#142030','#0a1420','#1e2e40'] };
  if (code <= 86)       return { icon: '🌨️',              desc: 'Snow showers',       sky: 'cloud', orbs: ['#18283a','#101e2e','#22304a'] };
  if (code === 95)      return { icon: '⛈️',              desc: 'Thunderstorm',        sky: 'storm', orbs: ['#0a1020','#04080f','#141822'] };
  if (code >= 96)       return { icon: '⛈️',              desc: 'Thunderstorm + hail', sky: 'storm', orbs: ['#080e18','#020406','#10141e'] };
  return               { icon: '🌡️',                      desc: 'Unknown',            sky: 'day',   orbs: ['#1a5fa8','#0d3d7a','#2196c4'] };
}

const toDisp = c => state.unit === 'C' ? Math.round(c) : Math.round(c * 9/5 + 32);
const unitSuffix = () => `°${state.unit}`;

function windDir(deg) {
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return d[Math.round(deg / 22.5) % 16];
}

function uvLabel(v) {
  if (v <= 2)  return 'Low';
  if (v <= 5)  return 'Moderate';
  if (v <= 7)  return 'High';
  if (v <= 10) return 'Very High';
  return 'Extreme';
}

function visLabel(m) {
  const km = (m / 1000).toFixed(1);
  if (m >= 10000) return '10+ km';
  return `${km} km`;
}


function aqiInfo(aqi) {
  if (aqi <= 20)  return { label: 'Good',        color: '#27c77a' };
  if (aqi <= 40)  return { label: 'Fair',         color: '#a8e063' };
  if (aqi <= 60)  return { label: 'Moderate',     color: '#f9c74f' };
  if (aqi <= 80)  return { label: 'Poor',         color: '#f77f00' };
  if (aqi <= 100) return { label: 'Very Poor',    color: '#e63946' };
  return              { label: 'Hazardous',    color: '#9d0208' };
}

const skyColors = {
  day:   '#0b1a2e',
  night: '#050911',
  rain:  '#0d1820',
  cloud: '#101820',
  storm: '#090d18',
};

function updateAtmosphere(meta) {
  document.body.style.background = skyColors[meta.sky] || skyColors.day;
  const [o1, o2, o3] = meta.orbs;
  document.documentElement.style.setProperty('--orb1', o1);
  document.documentElement.style.setProperty('--orb2', o2);
  document.documentElement.style.setProperty('--orb3', o3);
}

(function initParticles() {
  const canvas = DOM.particles;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticles() {
    particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random(),
      speed: Math.random() * 0.3 + 0.05,
      drift: (Math.random() - 0.5) * 0.1,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,210,255,${p.a})`;
      ctx.fill();
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
    });
    requestAnimationFrame(draw);
  }

  resize();
  makeParticles();
  draw();
  window.addEventListener('resize', () => { resize(); makeParticles(); });
})();

function showState(which) {
  ['loading','error','empty'].forEach(s => DOM[s].classList.remove('active'));
  ['viewToday','viewHourly','viewForecast'].forEach(v => DOM[v].classList.remove('active'));
  if (which === 'loading' || which === 'error' || which === 'empty') {
    DOM[which].classList.add('active');
  } else {
    DOM[which].classList.add('active');
  }
}

function showView(view) {
  ['viewToday','viewHourly','viewForecast'].forEach(v => DOM[v].classList.remove('active'));
  ['loading','error','empty'].forEach(s => DOM[s].classList.remove('active'));
  DOM[`view${view.charAt(0).toUpperCase() + view.slice(1)}`].classList.add('active');
}

async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function geocodeCity(q) {
  return apiGet(`/geocode?q=${encodeURIComponent(q)}`);
}

async function reverseGeocode(lat, lon) {
  return apiGet(`/reverse?lat=${lat}&lon=${lon}`);
}

async function fetchWeather(lat, lon) {
  return apiGet(`/weather?lat=${lat}&lon=${lon}`);
}

async function fetchAQI(lat, lon) {
  try {
    return await apiGet(`/airquality?lat=${lat}&lon=${lon}`);
  } catch {
    return null; 
  }
}

async function geocodeDirect(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`, {
    headers: { 'Accept-Language': 'en' }
  });
  const data = await res.json();
  if (!data.length) throw new Error(`City "${q}" not found.`);
  return {
    results: data.map(i => ({
      lat: parseFloat(i.lat), lon: parseFloat(i.lon),
      name: i.address?.city || i.address?.town || i.address?.village || i.name,
      country: i.address?.country || '', display: i.display_name
    }))
  };
}

async function fetchWeatherDirect(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: 'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,surface_pressure,visibility,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max',
    timezone: 'auto', forecast_days: '7'
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  return res.json();
}
let useBackend = true;
async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    useBackend = res.ok;
  } catch {
    useBackend = false;
    console.info('[Stratos] Backend not detected — using direct API calls.');
  }
}
function renderToday(weather, aqi) {
  const cur   = weather.current;
  const daily = weather.daily;
  const meta  = getWeatherMeta(cur.weather_code, cur.is_day);

  updateAtmosphere(meta);

  DOM.cityLabel.textContent  = `${state.lastCity}${state.lastCountry ? ', ' + state.lastCountry : ''}`;
  DOM.heroTemp.textContent   = `${toDisp(cur.temperature_2m)}${unitSuffix()}`;
  DOM.heroDesc.textContent   = meta.desc;
  DOM.heroFeels.textContent  = `Feels like ${toDisp(cur.apparent_temperature)}${unitSuffix()}`;
  DOM.weatherArt.textContent = meta.icon;
  DOM.hiLo.textContent       = `↑ ${toDisp(daily.temperature_2m_max[0])}° · ↓ ${toDisp(daily.temperature_2m_min[0])}°`;
  const stats = [
    { icon: '💧', label: 'Humidity',    value: `${cur.relative_humidity_2m}%`,          sub: cur.relative_humidity_2m > 70 ? 'Humid' : 'Comfortable' },
    { icon: '🌬️', label: 'Wind',        value: `${Math.round(cur.wind_speed_10m)} km/h`, sub: `${windDir(cur.wind_direction_10m)} · Gusts ${Math.round(cur.wind_gusts_10m||0)} km/h` },
    { icon: '🌡️', label: 'Pressure',    value: `${Math.round(cur.surface_pressure)} hPa`, sub: cur.surface_pressure > 1013 ? 'High' : 'Low' },
    { icon: '👁️', label: 'Visibility',  value: visLabel(cur.visibility || 10000),        sub: cur.visibility >= 10000 ? 'Clear' : 'Reduced' },
    { icon: '🔆', label: 'UV Index',    value: `${daily.uv_index_max[0]}`,               sub: uvLabel(daily.uv_index_max[0]) },
    { icon: '🌧️', label: 'Precip',      value: `${cur.precipitation} mm`,                sub: `Max ${daily.precipitation_probability_max[0]}% chance` },
    { icon: '🌅', label: 'Sunrise',     value: daily.sunrise[0].split('T')[1],           sub: '' },
    { icon: '🌇', label: 'Sunset',      value: daily.sunset[0].split('T')[1],            sub: '' },
  ];

  DOM.statsGrid.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
    </div>
  `).join('');


  if (aqi?.current?.european_aqi != null) {
    const aqiVal  = Math.round(aqi.current.european_aqi);
    const info    = aqiInfo(aqiVal);
    DOM.aqiNum.textContent   = aqiVal;
    DOM.aqiNum.style.color   = info.color;
    DOM.aqiLabel.textContent = info.label;
    // bar fill: mask the right portion (100 - % of 500 scale)
    const pct = Math.min(aqiVal / 100 * 100, 100);
    DOM.aqiFill.style.left  = pct + '%';
    DOM.aqiFill.style.right = '0';
    DOM.aqiFill.style.width = 'auto';
    DOM.aqiWrap.style.display = 'block';
  } else {
    DOM.aqiWrap.style.display = 'none';
  }
}
function renderHourly(weather) {
  const hourly = weather.hourly;
  const now    = new Date();
  const startI = hourly.time.findIndex(t => new Date(t) >= now);
  const from   = startI < 0 ? 0 : startI;

  DOM.hourlyGrid.innerHTML = '';
  for (let i = from; i < Math.min(from + 24, hourly.time.length); i++) {
    const t     = new Date(hourly.time[i]);
    const hh    = t.getHours().toString().padStart(2, '0') + ':00';
    const isN   = t.getHours() < 6 || t.getHours() >= 20;
    const meta  = getWeatherMeta(hourly.weather_code[i], isN ? 0 : 1);
    const precip = hourly.precipitation_probability ? hourly.precipitation_probability[i] : null;
    const isNow = i === from;

    const card = document.createElement('div');
    card.className = 'hour-card' + (isNow ? ' now' : '');
    card.innerHTML = `
      <div class="hour-time">${isNow ? 'Now' : hh}</div>
      <div class="hour-icon">${meta.icon}</div>
      <div class="hour-temp">${toDisp(hourly.temperature_2m[i])}${unitSuffix()}</div>
      ${precip != null ? `<div class="hour-precip">${precip}%</div>` : ''}
    `;
    DOM.hourlyGrid.appendChild(card);
  }
}

function renderForecast(weather) {
  const daily  = weather.daily;
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const allMin = Math.min(...daily.temperature_2m_min);
  const allMax = Math.max(...daily.temperature_2m_max);
  const range  = allMax - allMin || 1;

  DOM.forecastList.innerHTML = daily.time.map((dateStr, i) => {
    const d      = new Date(dateStr + 'T12:00:00');
    const day    = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : days[d.getDay()];
    const date   = `${d.getDate()} ${months[d.getMonth()]}`;
    const meta   = getWeatherMeta(daily.weather_code[i]);
    const minT   = toDisp(daily.temperature_2m_min[i]);
    const maxT   = toDisp(daily.temperature_2m_max[i]);
    const barL   = ((daily.temperature_2m_min[i] - allMin) / range * 100).toFixed(1);
    const barW   = (((daily.temperature_2m_max[i] - daily.temperature_2m_min[i]) / range) * 100).toFixed(1);
    const precip = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null;
    const uv     = daily.uv_index_max ? daily.uv_index_max[i] : null;

    return `
      <div class="forecast-row">
        <div class="fc-day">${day} <small>${date}</small></div>
        <div class="fc-icon">${meta.icon}</div>
        <div class="fc-range">
          <div class="fc-bar-row">
            <div class="fc-min">${minT}°</div>
            <div class="fc-bar-bg"><div class="fc-bar-fill" style="left:${barL}%;width:${barW}%"></div></div>
            <div class="fc-max">${maxT}°</div>
          </div>
          ${precip != null ? `<div class="fc-precip">💧 ${precip}% · ${(daily.precipitation_sum?.[i] || 0).toFixed(1)}mm</div>` : ''}
        </div>
        <div class="fc-right">
          ${uv != null ? `<div class="fc-uv">UV ${uv} · ${uvLabel(uv)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function loadWeather(lat, lon, city, country) {
  state.lastLat     = lat;
  state.lastLon     = lon;
  state.lastCity    = city;
  state.lastCountry = country;

  showState('loading');

  try {
    const [weather, aqi] = await Promise.all([
      useBackend ? fetchWeather(lat, lon) : fetchWeatherDirect(lat, lon),
      useBackend ? fetchAQI(lat, lon)     : null,
    ]);

    state.lastData = weather;

    renderToday(weather, aqi);
    renderHourly(weather);
    renderForecast(weather);

    showView(state.activeView);
  } catch (err) {
    DOM.errorTitle.textContent = 'Could not load weather';
    DOM.errorMsg.textContent   = err.message;
    showState('error');
    console.error('[Stratos] Weather error:', err);
  }
}

function showSuggestions(results) {
  if (!results || !results.length) {
    DOM.suggestions.classList.remove('open');
    return;
  }
  DOM.suggestions.innerHTML = results.slice(0, 5).map((r, i) =>
    `<div class="suggestion-item" data-i="${i}">
      <strong>${r.name}</strong>
      <span>${r.country}</span>
     </div>`
  ).join('');
  DOM.suggestions.classList.add('open');
  // store results for click
  DOM.suggestions._results = results;
}

DOM.searchInput.addEventListener('input', () => {
  const q = DOM.searchInput.value.trim();
  DOM.clearBtn.classList.toggle('visible', q.length > 0);
  clearTimeout(state.searchDebounce);
  if (q.length < 2) { DOM.suggestions.classList.remove('open'); return; }
  state.searchDebounce = setTimeout(async () => {
    try {
      const geo = useBackend ? await geocodeCity(q) : await geocodeDirect(q);
      showSuggestions(geo.results);
    } catch { DOM.suggestions.classList.remove('open'); }
  }, 320);
});

DOM.suggestions.addEventListener('click', e => {
  const item = e.target.closest('.suggestion-item');
  if (!item) return;
  const r = DOM.suggestions._results[parseInt(item.dataset.i)];
  DOM.searchInput.value = r.name;
  DOM.clearBtn.classList.add('visible');
  DOM.suggestions.classList.remove('open');
  loadWeather(r.lat, r.lon, r.name, r.country);
});

DOM.searchInput.addEventListener('keydown', async e => {
  if (e.key === 'Enter') {
    clearTimeout(state.searchDebounce);
    DOM.suggestions.classList.remove('open');
    const q = DOM.searchInput.value.trim();
    if (!q) return;
    showState('loading');
    try {
      const geo = useBackend ? await geocodeCity(q) : await geocodeDirect(q);
      const r   = geo.results[0];
      loadWeather(r.lat, r.lon, r.name, r.country);
    } catch (err) {
      DOM.errorTitle.textContent = 'City not found';
      DOM.errorMsg.textContent   = err.message;
      showState('error');
    }
  }
  if (e.key === 'Escape') DOM.suggestions.classList.remove('open');
});

DOM.clearBtn.addEventListener('click', () => {
  DOM.searchInput.value = '';
  DOM.clearBtn.classList.remove('visible');
  DOM.suggestions.classList.remove('open');
  DOM.searchInput.focus();
});

DOM.locBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    DOM.errorTitle.textContent = 'Not supported';
    DOM.errorMsg.textContent   = 'Geolocation is not supported by your browser.';
    showState('error');
    return;
  }
  showState('loading');
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const { latitude: lat, longitude: lon } = coords;
        const geo = useBackend
          ? await reverseGeocode(lat, lon)
          : await (async () => {
              const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: {'Accept-Language':'en'} });
              const d = await r.json();
              return { name: d.address?.city || d.address?.town || 'Your Location', country: d.address?.country || '' };
            })();
        loadWeather(lat, lon, geo.name, geo.country);
      } catch (err) {
        DOM.errorTitle.textContent = 'Location error';
        DOM.errorMsg.textContent   = err.message;
        showState('error');
      }
    },
    () => {
      DOM.errorTitle.textContent = 'Permission denied';
      DOM.errorMsg.textContent   = 'Enable location access in your browser settings.';
      showState('error');
    }
  );
});

DOM.unitBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.unit = btn.dataset.unit;
    DOM.unitBtns.forEach(b => b.classList.toggle('active', b.dataset.unit === state.unit));
    if (state.lastData) {
      renderToday(state.lastData, null);
      renderHourly(state.lastData);
      renderForecast(state.lastData);
    }
  });
});


DOM.navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeView = btn.dataset.view;
    DOM.navBtns.forEach(b => b.classList.toggle('active', b === btn));
    if (state.lastData) showView(state.activeView);
  });
});


DOM.retryBtn.addEventListener('click', () => {
  if (state.lastLat) loadWeather(state.lastLat, state.lastLon, state.lastCity, state.lastCountry);
  else showState('empty');
});


document.addEventListener('click', e => {
  if (!DOM.searchInput.contains(e.target) && !DOM.suggestions.contains(e.target)) {
    DOM.suggestions.classList.remove('open');
  }
});


(async function init() {
  await checkBackend();
  showState('loading');
  // Default to Chennai
  try {
    const geo = useBackend ? await geocodeCity('Chennai') : await geocodeDirect('Chennai');
    const r   = geo.results[0];
    loadWeather(r.lat, r.lon, r.name, r.country);
  } catch {
    showState('empty');
  }
})();
