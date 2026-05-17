/**
 * Hokkaido Slow-Drive Photography Weather Dashboard - Core Javascript Engine
 * Coordinated weather data fetching, photogenic indexing, hourly rain analysts, and charts.
 */

// Global state variables
let weatherData = {};
let activeTab = 'overview';
let activeSelectedDates = {
  sapporo: '2026-05-24',
  takikawa: '2026-05-24',
  kutchan: '2026-05-24',
  otaru: '2026-05-24',
  biei: '2026-05-24',
  yotei: '2026-05-24',
  toya: '2026-05-24'
};
let weatherChart = null;
let activeMobileMatrixDate = '2026-05-24';

// Geography coordinates for Hokkaido route targets and weather nodes
const locations = {
  sapporo: { name: 'Sapporo (Base)', lat: 43.0621, lon: 141.3544 },
  takikawa: { name: 'Takikawa Fields', lat: 43.5574, lon: 141.9126 },
  kutchan: { name: 'Kutchan (Shibazakura)', lat: 42.9015, lon: 140.7583 },
  otaru: { name: 'Otaru Canal', lat: 43.1907, lon: 140.9947 },
  biei: { name: 'Biei Blue Pond', lat: 43.5902, lon: 142.4646 },
  yotei: { name: 'Mt. Yotei Viewpoints', lat: 42.7961, lon: 140.8122 },
  toya: { name: 'Lake Toya', lat: 42.5800, lon: 140.8575 },
  jozankei: { name: 'Jozankei Pass', lat: 42.9664, lon: 141.1633 },
  sunagawa: { name: 'Sunagawa Rest Area', lat: 43.4939, lon: 141.9083 }
};

// Date range constants
const dateList = [
  '2026-05-24',
  '2026-05-25',
  '2026-05-26',
  '2026-05-27',
  '2026-05-28',
  '2026-05-29',
  '2026-05-30'
];

// Initialize application on load
window.addEventListener('DOMContentLoaded', () => {
  initUI();
  fetchWeatherData();
});

// Initialize dynamic elements and check icons
function initUI() {
  lucide.createIcons();
}

// --------------------------------------------------------------------------
// WEATHER CODE & PHOTOGENIC MAPPING UTILITIES
// --------------------------------------------------------------------------

// Map WMO weather codes to human descriptions and Lucide icons
function mapWeatherCode(code) {
  const mapping = {
    0: { text: 'Clear Sky / Bright Sun', icon: 'sun', emoji: '☀️', photogenicBase: 50 },
    1: { text: 'Mainly Clear', icon: 'sun', emoji: '🌤️', photogenicBase: 65 },
    2: { text: 'Partly Cloudy', icon: 'cloud-sun', emoji: '⛅', photogenicBase: 78 },
    3: { text: 'Overcast & Saturated', icon: 'cloud', emoji: '☁️', photogenicBase: 95 },
    45: { text: 'Misty / Low Fog', icon: 'cloud-fog', emoji: '🌫️', photogenicBase: 98 },
    48: { text: 'Depositing Rime Fog', icon: 'cloud-fog', emoji: '🌫️', photogenicBase: 98 },
    51: { text: 'Light Drizzle', icon: 'cloud-drizzle', emoji: '🌧️', photogenicBase: 92 },
    53: { text: 'Moderate Drizzle', icon: 'cloud-drizzle', emoji: '🌧️', photogenicBase: 90 },
    55: { text: 'Dense Drizzle', icon: 'cloud-drizzle', emoji: '🌧️', photogenicBase: 85 },
    61: { text: 'Light Rain Showers', icon: 'cloud-rain', emoji: '🌧️', photogenicBase: 88 },
    63: { text: 'Moderate Rain', icon: 'cloud-rain', emoji: '🌧️', photogenicBase: 80 },
    65: { text: 'Torrential Downpour', icon: 'cloud-rain-wind', emoji: '🌧️', photogenicBase: 60 },
    80: { text: 'Passing Showers', icon: 'cloud-rain-wind', emoji: '🌧️', photogenicBase: 85 },
    81: { text: 'Heavy Passing Showers', icon: 'cloud-rain-wind', emoji: '🌧️', photogenicBase: 70 },
    82: { text: 'Violent Passing Showers', icon: 'cloud-rain-wind', emoji: '🌧️', photogenicBase: 55 },
    95: { text: 'Active Thunderstorm', icon: 'cloud-lightning', emoji: '⚡', photogenicBase: 40 }
  };
  
  return mapping[code] || { text: 'Overcast Skies', icon: 'cloud', emoji: '☁️', photogenicBase: 80 };
}

// Calculate the Custom Photography Score
function calculatePhotogenicScore(locationKey, weatherCode, rainProb, temp) {
  const weatherMap = mapWeatherCode(weatherCode);
  let baseScore = weatherMap.photogenicBase;
  
  // Custom behavior: Mt. Yotei photography requires visibility!
  if (locationKey === 'yotei') {
    if (weatherCode === 0 || weatherCode === 1) {
      baseScore = 95; // Ideal clear volcano peak!
    } else if (weatherCode === 2) {
      baseScore = 88; // Wispy clouds framing the volcano
    } else if (weatherCode === 45 || weatherCode === 48 || weatherCode === 3) {
      baseScore = 35; // Socked in mist/fog means the volcano is completely invisible
    } else {
      baseScore = 20; // Heavy storm makes shooting impossible
    }
    return baseScore;
  }
  
  // Standard moody calculation (prioritizing soft overcast/fog)
  // Adjust for ideal temperature (12°C to 16°C is peak misty-mood comfort)
  if (temp >= 12 && temp <= 17) {
    baseScore += 5;
  } else if (temp > 20 || temp < 8) {
    baseScore -= 5;
  }
  
  // High rain probability is excellent for saturated photos (unless torrential)
  if (rainProb > 40 && rainProb < 80) {
    baseScore += 3;
  }
  
  return Math.min(100, Math.max(10, baseScore));
}

// --------------------------------------------------------------------------
// DATA FETCHING & GRACEFUL MOCK FALLBACKS
// --------------------------------------------------------------------------

// Fetch weather data from Open-Meteo or trigger simulation fallback
async function fetchWeatherData() {
  setLoadingState(true);
  
  const promises = Object.keys(locations).map(async (key) => {
    const loc = locations[key];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&timezone=Asia%2FTokyo&start_date=2026-05-24&end_date=2026-05-30`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      const data = await response.json();
      return { key, data: parseHourlyResponse(key, data) };
    } catch (err) {
      console.warn(`API call failed for ${loc.name}, fallback to simulation.`, err);
      return { key, data: generateSimulationData(key) };
    }
  });

  try {
    const results = await Promise.all(promises);
    let apiLiveCount = 0;
    
    results.forEach(res => {
      weatherData[res.key] = res.data;
      if (!res.data.isSimulated) apiLiveCount++;
    });
    
    updateAPIStatus(apiLiveCount === Object.keys(locations).length);
    renderDashboard();
    
  } catch (err) {
    console.error("Dashboard render failed critically", err);
    updateAPIStatus(false);
  } finally {
    setLoadingState(false);
  }
}

// Parse Open-Meteo hourly JSON into key date maps
function parseHourlyResponse(locationKey, payload) {
  const result = { isSimulated: false, daily: {} };
  const h = payload.hourly;
  
  h.time.forEach((timeStr, idx) => {
    const datePart = timeStr.substring(0, 10); // "2026-05-24"
    const hourPart = parseInt(timeStr.substring(11, 13)); // 9
    
    if (!result.daily[datePart]) {
      result.daily[datePart] = { hourly: [] };
    }
    
    result.daily[datePart].hourly.push({
      hour: hourPart,
      temp: parseFloat(h.temperature_2m[idx]),
      precipitationProb: parseInt(h.precipitation_probability[idx]),
      precipitation: parseFloat(h.precipitation[idx] || 0),
      weatherCode: parseInt(h.weather_code[idx])
    });
  });
  
  // Aggregate daily averages
  Object.keys(result.daily).forEach(date => {
    const hours = result.daily[date].hourly;
    const daylightHours = hours.filter(hr => hr.hour >= 9 && hr.hour <= 19);
    
    let sumTemp = 0;
    let maxPrecipProb = 0;
    let sumPrecip = 0;
    let codeFrequencies = {};
    let sumPhotoScore = 0;
    
    daylightHours.forEach(hr => {
      sumTemp += hr.temp;
      sumPrecip += hr.precipitation;
      if (hr.precipitationProb > maxPrecipProb) maxPrecipProb = hr.precipitationProb;
      
      codeFrequencies[hr.weatherCode] = (codeFrequencies[hr.weatherCode] || 0) + 1;
      sumPhotoScore += calculatePhotogenicScore(locationKey, hr.weatherCode, hr.precipitationProb, hr.temp);
    });
    
    // Find dominant weather code
    let dominantCode = 3;
    let maxFreq = 0;
    Object.keys(codeFrequencies).forEach(c => {
      if (codeFrequencies[c] > maxFreq) {
        maxFreq = codeFrequencies[c];
        dominantCode = parseInt(c);
      }
    });
    
    result.daily[date].summary = {
      avgTemp: parseFloat((sumTemp / daylightHours.length).toFixed(1)),
      maxPrecipProb: maxPrecipProb,
      totalPrecip: parseFloat(sumPrecip.toFixed(1)),
      dominantCode: dominantCode,
      photoScore: Math.round(sumPhotoScore / daylightHours.length)
    };
  });
  
  return result;
}

// Generate realistic simulated Hokkaido weather data if API is throttled/offline
function generateSimulationData(locationKey) {
  const result = { isSimulated: true, daily: {} };
  
  dateList.forEach(date => {
    const hours = [];
    // Dynamic weather profiles depending on location to match itinerary flavor
    let weatherProfile = 'moody-overcast'; 
    if (locationKey === 'takikawa' && date === '2026-05-24') weatherProfile = 'afternoon-rain';
    if (locationKey === 'kutchan' && date === '2026-05-25') weatherProfile = 'foggy-morning';
    if (locationKey === 'otaru' && date === '2026-05-26') weatherProfile = 'dusk-showers';
    if (locationKey === 'biei' && date === '2026-05-27') weatherProfile = 'misty-forest';
    if (locationKey === 'yotei' && date === '2026-05-24') weatherProfile = 'clear-summit';
    if (locationKey === 'yotei' && date === '2026-05-28') weatherProfile = 'wispy-clouds';
    if (locationKey === 'toya' && date === '2026-05-29') weatherProfile = 'heavy-lake-mist';
    if (locationKey === 'sapporo' && date === '2026-05-30') weatherProfile = 'dusk-showers';
    
    for (let h = 0; h < 24; h++) {
      let temp = 14 + Math.sin((h - 6) / 24 * Math.PI * 2) * 4; // Base temperature swing
      let precipProb = 20;
      let precip = 0.0;
      let wCode = 2; // partly cloudy default
      
      switch (weatherProfile) {
        case 'clear-summit':
          precipProb = 5 + Math.floor(Math.random() * 5);
          wCode = 0; // Clear
          temp += 1.5;
          break;
        case 'wispy-clouds':
          precipProb = 15;
          wCode = 1; // mainly clear
          break;
        case 'heavy-lake-mist':
          precipProb = 35;
          if (h <= 11) {
            wCode = 45; // low fog
            temp -= 2;
          } else {
            wCode = 3; // overcast
          }
          break;
        case 'afternoon-rain': // Day 1
          if (h >= 12 && h <= 17) {
            precipProb = 75 + Math.floor(Math.random() * 15);
            precip = h === 14 || h === 15 ? 2.3 : 0.8;
            wCode = 61; // light rain
          } else {
            precipProb = 30;
            wCode = 3; // overcast
          }
          temp -= 2;
          break;
        case 'foggy-morning': // Day 2
          if (h <= 11) {
            precipProb = 45;
            precip = 0.1;
            wCode = 45; // low fog
            temp -= 3;
          } else {
            precipProb = 15;
            wCode = 3; // overcast
          }
          break;
        case 'dusk-showers': // Day 3
          if (h >= 17 && h <= 21) {
            precipProb = 85;
            precip = 1.6;
            wCode = 63; // moderate rain
            temp -= 1.5;
          } else if (h < 12) {
            precipProb = 10;
            wCode = 1; // mainly clear morning
          } else {
            precipProb = 40;
            wCode = 3;
          }
          break;
        case 'misty-forest': // Day 4
          if (h <= 10) {
            precipProb = 40;
            wCode = 48; // mist
            temp -= 4;
          } else {
            precipProb = 25;
            wCode = 3; // overcast
          }
          break;
        default: // standard moody overcast Hokkaido spring day
          precipProb = 30 + Math.sin(h/10) * 10;
          wCode = 3; // overcast
          break;
      }
      
      hours.push({
        hour: h,
        temp: parseFloat(temp.toFixed(1)),
        precipitationProb: Math.round(precipProb),
        precipitation: parseFloat(precip.toFixed(1)),
        weatherCode: wCode
      });
    }
    
    // Aggregation
    const daylightHours = hours.filter(hr => hr.hour >= 9 && hr.hour <= 19);
    let sumTemp = 0;
    let maxPrecipProb = 0;
    let sumPrecip = 0;
    let codeFrequencies = {};
    let sumPhotoScore = 0;
    
    daylightHours.forEach(hr => {
      sumTemp += hr.temp;
      sumPrecip += hr.precipitation;
      if (hr.precipitationProb > maxPrecipProb) maxPrecipProb = hr.precipitationProb;
      
      codeFrequencies[hr.weatherCode] = (codeFrequencies[hr.weatherCode] || 0) + 1;
      sumPhotoScore += calculatePhotogenicScore(locationKey, hr.weatherCode, hr.precipitationProb, hr.temp);
    });
    
    let dominantCode = 3;
    let maxFreq = 0;
    Object.keys(codeFrequencies).forEach(c => {
      if (codeFrequencies[c] > maxFreq) {
        maxFreq = codeFrequencies[c];
        dominantCode = parseInt(c);
      }
    });
    
    result.daily[date] = {
      hourly: hours,
      summary: {
        avgTemp: parseFloat((sumTemp / daylightHours.length).toFixed(1)),
        maxPrecipProb: maxPrecipProb,
        totalPrecip: parseFloat(sumPrecip.toFixed(1)),
        dominantCode: dominantCode,
        photoScore: Math.round(sumPhotoScore / daylightHours.length)
      }
    };
  });
  
  return result;
}

// --------------------------------------------------------------------------
// UI RENDERERS & DATA BINDERS
// --------------------------------------------------------------------------

// Update Loading Spinner
function setLoadingState(isLoading) {
  const btn = document.getElementById('refresh-button');
  if (isLoading) {
    btn.classList.add('loading');
    btn.querySelector('span').innerText = 'Syncing...';
  } else {
    btn.classList.remove('loading');
    btn.querySelector('span').innerText = 'Refresh Forecast';
  }
}

// Update UI Badge for Live API status
function updateAPIStatus(isLive) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  const stamp = document.getElementById('update-timestamp');
  
  if (isLive) {
    dot.className = 'status-indicator live';
    txt.innerText = 'Live Open-Meteo Sync';
  } else {
    dot.className = 'status-indicator simulated';
    txt.innerText = 'Local Simulated Forecast';
  }
  
  const now = new Date();
  stamp.innerText = `Last updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

// Global refresh action
function refreshData() {
  fetchWeatherData();
}

// Route active screen switching
function switchTab(tabId) {
  activeTab = tabId;
  
  // Update nav menu active states
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.nav-link.tab-${tabId}`);
  if (activeLink) activeLink.classList.add('active');
  
  // Toggle tab sections
  const ovTab = document.getElementById('overview-tab');
  const detailTab = document.getElementById('day-detail-tab');
  
  if (tabId === 'overview') {
    ovTab.classList.remove('hidden');
    detailTab.classList.add('hidden');
    document.getElementById('main-title').innerText = 'Sapporo Weather & Photography Intel';
    document.getElementById('main-subtitle').innerHTML = `<i data-lucide="calendar"></i> <span>Trip Window: 24 - 30 May 2026</span>`;
    renderOverview();
  } else {
    ovTab.classList.add('hidden');
    detailTab.classList.remove('hidden');
    renderDayDetail(tabId);
  }
  
  lucide.createIcons();
  
  // Auto-close sliding mobile menu drawer on navigation
  closeMobileMenu();
}

// Render main dashboard container (delegator)
function renderDashboard() {
  if (activeTab === 'overview') {
    renderOverview();
  } else {
    renderDayDetail(activeTab);
  }
}

// Cell helper: Choose location and date, then switch to detail tab
function selectLocationDate(locationKey, dateStr) {
  activeSelectedDates[locationKey] = dateStr;
  switchTab(locationKey);
}

// --------------------------------------------------------------------------
// RENDER: OVERVIEW SCREEN
// --------------------------------------------------------------------------
function renderOverview() {
  // 1. Populate the Weekly Comparative Table
  const table = document.getElementById('weekly-comparison-table');
  
  // Table headers (Date columns)
  let tableHTML = `
    <thead>
      <tr>
        <th class="col-location">Photography Spot</th>
  `;
  dateList.forEach(d => {
    const dateObj = new Date(d);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
    const dayNum = dateObj.getDate();
    tableHTML += `<th>May ${dayNum} (${dayName})</th>`;
  });
  tableHTML += `
      </tr>
    </thead>
    <tbody>
  `;
  
  // Rows for all 7 locations
  const rowMeta = [
    { key: 'sapporo', name: 'Sapporo (Base)', tag: 'Base Camp', icon: 'building' },
    { key: 'takikawa', name: 'Takikawa Fields', tag: 'Nanohana Pop', icon: 'palette' },
    { key: 'kutchan', name: 'Kutchan Garden', tag: 'Pink Shibazakura', icon: 'flower2' },
    { key: 'otaru', name: 'Otaru Canal', tag: 'Dusk Reflections', icon: 'camera' },
    { key: 'biei', name: 'Biei Blue Pond', tag: 'Misty Blue tint', icon: 'sparkles' },
    { key: 'yotei', name: 'Mt. Yotei View', tag: 'Volcanic Peak', icon: 'mountain' },
    { key: 'toya', name: 'Lake Toya', tag: 'Caldera Mist', icon: 'waves' }
  ];
  
  rowMeta.forEach(row => {
    tableHTML += `
      <tr>
        <td>
          <div class="row-location-info">
            <div class="row-location-icon"><i data-lucide="${row.icon}"></i></div>
            <div class="row-location-text">
              <span class="row-location-name">${row.name}</span>
              <span class="row-location-tag">${row.tag}</span>
            </div>
          </div>
        </td>
    `;
    
    dateList.forEach(date => {
      const summary = weatherData[row.key].daily[date].summary;
      const weatherMap = mapWeatherCode(summary.dominantCode);
      
      let badgeClass = 'score-fair';
      if (summary.photoScore >= 85) badgeClass = 'score-excellent';
      else if (summary.photoScore >= 70) badgeClass = 'score-good';
      
      tableHTML += `
        <td>
          <div class="planner-cell" onclick="selectLocationDate('${row.key}', '${date}')">
            <div class="cell-weather">
              <span class="cell-emoji">${weatherMap.emoji}</span>
              <span class="cell-temp">${summary.avgTemp}°</span>
            </div>
            <span class="cell-photo-badge ${badgeClass}">${summary.photoScore}% Score</span>
          </div>
        </td>
      `;
    });
    
    tableHTML += `</tr>`;
  });
  
  tableHTML += `</tbody>`;
  table.innerHTML = tableHTML;

  // 2. Populate the Spotlight Location Cards below
  const grid = document.getElementById('overview-grid-container');
  grid.innerHTML = '';
  
  const spotlightCardsMeta = [
    {
      id: 'sapporo',
      title: 'Sapporo Urban Drizzle',
      route: 'Base Camp local walks',
      image: 'images/base_sapporo.png',
      photoTarget: 'Odori Park & TV Tower',
      tagColor: 'sapporo',
      desc: 'Glowing city lights and wet pavement. Drizzle creates romantic orange-teal twilight reflections under cherry tree branches.'
    },
    {
      id: 'takikawa',
      title: 'Yellow Rapeseed Drive',
      route: 'Sapporo ➔ Takikawa IC Expressway Loop',
      image: 'images/day1_takikawa.png',
      photoTarget: 'Takikawa Nanohana Fields',
      tagColor: 'day1',
      desc: 'Billions of electric yellow rapeseed fields. High overcast and misty rain will yield dramatic pops of colors against rich dark skies.'
    },
    {
      id: 'kutchan',
      title: 'Pink Moss Mountain Pass',
      route: 'Sapporo ➔ Jozankei ➔ Route 230 Pass',
      image: 'images/day2_kutchan.png',
      photoTarget: "Mishima's Shibazakura Garden",
      tagColor: 'day2',
      desc: 'Rolling carpets of vibrant pink moss phlox. Soft rain lighting deepens the pink tones even if Mt. Yotei is socked in fog.'
    },
    {
      id: 'otaru',
      title: 'Moody Canal reflections',
      route: 'Sapporo Local ➔ Sasson Expressway ➔ Otaru',
      image: 'images/day3_otaru.png',
      photoTarget: 'Otaru Canal Warehouses',
      tagColor: 'day3',
      desc: 'Indoor conservatories shield morning shoots. Historic canal gas lights and brick walls shine beautifully on rain-slicked cobblestones.'
    },
    {
      id: 'biei',
      title: 'Misty Ink-Painting hills',
      route: 'Sapporo ➔ Mikasa IC ➔ Biei Loops',
      image: 'images/day4_biei.png',
      photoTarget: 'Shirogane Blue Pond & Birch Trees',
      tagColor: 'day4',
      desc: 'Minimalist trees on rolling hills take on an ink-painted mystique in morning fog. Blue Pond shines a deep turquoise in drizzle.'
    },
    {
      id: 'yotei',
      title: 'Mt. Yotei Viewpoints',
      route: 'Kyogoku Spring Park countryside roads',
      image: 'images/target_yotei.png',
      photoTarget: 'Volcano Framing Loops',
      tagColor: 'yotei',
      desc: 'The Mt. Fuji of Hokkaido. Clear days show majestic snow patches. Overcast days offer mysterious low mist wraps around its peak.'
    },
    {
      id: 'toya',
      title: 'Lake Toya Caldera Mist',
      route: 'Sapporo ➔ Nakayama Pass ➔ Toyako Onsen',
      image: 'images/target_toya.png',
      photoTarget: 'Toyako Pier & Nakajima Island',
      tagColor: 'toya',
      desc: 'Massive active caldera lake. Dense fog floating over water isolates the central forested Nakajima Island into a mystical ink-washed photo.'
    }
  ];

  let sumPhotoScore = 0;
  let moodyShootDays = 0;
  let sumAvgTemp = 0;

  spotlightCardsMeta.forEach((meta) => {
    const date = activeSelectedDates[meta.id];
    const locData = weatherData[meta.id].daily[date];
    const summary = locData.summary;
    const weatherMap = mapWeatherCode(summary.dominantCode);
    
    sumPhotoScore += summary.photoScore;
    sumAvgTemp += summary.avgTemp;
    if (summary.maxPrecipProb > 40) moodyShootDays++;

    const card = document.createElement('div');
    card.className = `overview-card glass-panel card-${meta.tagColor}`;
    card.onclick = () => switchTab(meta.id);
    
    card.innerHTML = `
      <div class="card-bg-blur"></div>
      <div class="overview-card-header">
        <span class="day-badge">${meta.id.toUpperCase()} • ${formatShortDate(date)}</span>
        <div class="score-badge">
          <span class="score-value">${summary.photoScore}%</span>
          <span class="score-lbl">Moody Index</span>
        </div>
      </div>
      
      <div class="overview-card-body">
        <h3 class="overview-card-title">${meta.title}</h3>
        <div class="overview-route">
          <i data-lucide="map-pin"></i>
          <span>${meta.photoTarget}</span>
        </div>
        <p class="overview-summary-box">${meta.desc}</p>
        
        <div class="overview-weather-row">
          <div class="ov-stat">
            <span class="ov-stat-label">Weather</span>
            <span class="ov-stat-val">
              <span style="font-size: 1.1rem; line-height:1;">${weatherMap.emoji}</span>
              <span style="font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${weatherMap.text.split(' / ')[0]}</span>
            </span>
          </div>
          <div class="ov-stat">
            <span class="ov-stat-label">Rain Chance</span>
            <span class="ov-stat-val">
              <i data-lucide="droplet" style="width: 14px; height:14px; color: var(--status-rain);"></i>
              <span>${summary.maxPrecipProb}%</span>
            </span>
          </div>
          <div class="ov-stat">
            <span class="ov-stat-label">Avg Temp</span>
            <span class="ov-stat-val">
              <i data-lucide="thermometer" style="width: 14px; height:14px; color: var(--accent-pink);"></i>
              <span>${summary.avgTemp}°C</span>
            </span>
          </div>
        </div>
      </div>
      
      <div class="overview-card-footer">
        <div class="photo-target-preview">
          <img src="${meta.image}" alt="${meta.photoTarget}">
          <span>View Blueprint</span>
        </div>
        <button class="card-action-btn">
          <i data-lucide="arrow-right"></i>
        </button>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  // Update header and overview banner stats dynamically
  document.getElementById('ov-avg-temp').innerText = `${(sumAvgTemp / spotlightCardsMeta.length).toFixed(1)}°C`;
  document.getElementById('ov-wet-days').innerText = `${moodyShootDays} / 7 Spots`;
  document.getElementById('ov-photogenic-index').innerText = `${Math.round(sumPhotoScore / spotlightCardsMeta.length)}%`;
  
  lucide.createIcons();
  
  // Render Mobile-Optimized Vertical Planner List
  renderMobileVerticalMatrix();
}

// --------------------------------------------------------------------------
// RENDER: DAY DETAIL BLUEPRINT SCREEN
// --------------------------------------------------------------------------
function renderDayDetail(dayId) {
  const container = document.getElementById('day-detail-tab');
  container.innerHTML = '';
  
  // Configuration details for specific days
  const metaLookup = {
    sapporo: {
      title: 'Sapporo: Urban Drizzle & Base Camp',
      location: 'sapporo',
      route: 'Sapporo Local walks (Odori Park, TV Tower, Nakajima Park)',
      image: 'images/base_sapporo.png',
      photoTarget: 'Odori Park & TV Tower Reflections',
      targetDesc: 'Vibrant neon city lights reflecting on wet streets. Soft mist and rain create romantic dark blue-orange tones at dusk, with gorgeous glossy reflection lanes under Odori Park cherry trees.',
      napSpotName: 'Cozy Susukino Coffee Shop',
      napSpotDesc: 'Susukino features thousands of isolated quiet cafes ideal for getting warm, resting, and backing up your morning memory cards.',
      driveDifficulty: 'Urban Navigation',
      driveInstructions: 'Standard city driving. Watch out for active tram lanes and busy pedestrian crossings during rainy rush hours.',
      photoTips: [
        'At dusk, set up near wet pavement: shoot the TV Tower glowing through misty drizzle with streetlights framing the sides.',
        'Use a fast prime lens (f/1.8) to isolate rain droplets under streetlights.',
        'Explore Nakajima Park pond for quiet, glossy reflections of canopy trees.'
      ],
      napTips: [
        ' сус susukino has incredible hand-drip coffee spots.',
        'Enjoy a warm, fresh cup of local coffee and local treats.',
        'Perfect window to dry your camera body and backup your morning shots.'
      ],
      alertText: 'Tram tracks in Sapporo become slick like ice when wet. Avoid braking directly on the metal tracks.'
    },
    takikawa: {
      title: 'Takikawa: High-Contrast Yellow Drive',
      location: 'takikawa',
      route: 'Sapporo to Takikawa IC (Expressway Loop)',
      image: 'images/day1_takikawa.png',
      photoTarget: 'Takikawa Nanohana Rapeseed Fields',
      targetDesc: 'Billions of electric yellow flowers. Dark overcast skies behave like a giant natural softbox, punching the saturation of yellow flowers to spectacular electric intensities.',
      napSpotName: 'Sunagawa Service Area',
      napSpotDesc: 'On your drive back, this spacious modern highway station features isolated quiet zones, excellent cafes, and premium washrooms.',
      driveDifficulty: 'Low Risk',
      driveInstructions: 'Straight expressway route north on Hokkaido Expressway from Sapporo to Takikawa IC. Zero complex junctions. Extremely stress-free driving loop.',
      photoTips: [
        'Shoot from a low tripod angle to maximize the contrast of the bright yellow against storm clouds.',
        'Use a circular polariser to slice through glare on wet leaves and deepen the blue-slate sky contrast.',
        'A yellow umbrella can serve as an amazing thematic foreground element!'
      ],
      napTips: [
        'Locate the quiet northern sector of the car park.',
        'Perfect weather to crack the back windows 1cm for refreshing mountain air and rain sounds.',
        'Grab a local Sunagawa apple pie and fresh cafe drip before reclining your seat.'
      ],
      alertText: 'Hokkaido Expressway remains heavily speed-monitored. Watch out for digital speed limits on wet days, which drop from 100km/h to 80km/h.'
    },
    kutchan: {
      title: 'Kutchan: Pink Moss Mountain Pass',
      location: 'kutchan',
      route: 'Sapporo to Kutchan/Niseko via Jozankei Route 230',
      image: 'images/day2_kutchan.png',
      photoTarget: "Mishima's Shibazakura Garden",
      targetDesc: 'Hills carpeted in vibrant pink and white moss phlox. Soft, diffused lighting deepens the saturation of pink hills, rendering beautiful textures up close.',
      napSpotName: 'Michi-no-Eki Niseko View Plaza',
      napSpotDesc: 'Spacious local roadside station featuring a beautiful view of Mt. Yotei base, hot local croquettes, and a quiet, secure vehicle parking lot.',
      driveDifficulty: 'Zero Highway Tolls, Low Stress',
      driveInstructions: 'Follow National Route 230 through Jozankei. Wide, heavily-signposted local pass road. Drive at your own pace without pressure.',
      photoTips: [
        'Get close to the moss phlox to capture patterns and textures in the wet flower beds.',
        'If Mt. Yotei is covered in mist, compose with trees and paths as minimal ink-painting leading lines.',
        'Soft drizzle brings out the subtle differences between pink and white moss patches!'
      ],
      napTips: [
        'Park near the perimeter trees for isolated shade and quietude.',
        'Buy a hot Hokkaido milk latte or baked sweet potato from Niseko View Plaza to warm up.',
        'Set your cabin temperature to 21°C and take a relaxing 30-minute nap.'
      ],
      alertText: 'Jozankei mountain passes can get socked in by thick fog during rain transitions. Turn on fog lights and maintain safe braking distances!'
    },
    otaru: {
      title: 'Otaru: Weather Backup & Moody Coast',
      location: 'otaru',
      route: 'Northern Sapporo to Otaru via Sasson Expressway',
      image: 'images/day3_otaru.png',
      photoTarget: 'Yurigahara Conservatory & Otaru Canal',
      targetDesc: 'Yurigahara has a glass conservatory that protects you if heavy downpours strike. The brick canal warehouses in Otaru take on a deeply romantic quality as wet cobblestones mirror glowing gas lamps at dusk.',
      napSpotName: 'Otaru Tanaka Sake Brewery parking',
      napSpotDesc: 'Massive brick warehouse lot, incredibly quiet in the afternoon, or enjoy a coastal pull-off near the port with soft wave sounds.',
      driveDifficulty: 'Very Easy',
      driveInstructions: 'Yurigahara lies in north Sapporo. Drive to Otaru along Sasson Expressway takes 35 minutes, extensively signposted with clear English directories.',
      photoTips: [
        'Spend the morning inside the Yurigahara conservatory where global flower varieties are dry and perfect.',
        'At dusk, set up at Otaru Canal. Rain makes the cobblestones look like mirrors—lower your camera to capture glowing gas-lamp reflections.',
        'In Otaru, look for raindrops dripping off old brick eaves for atmospheric detail shots.'
      ],
      napTips: [
        'Select a parking slot with a view of the water near Otaru port if you love ocean waves.',
        'The historic brewery parking lot is exceptionally quiet between 13:00 and 15:00.',
        'Great time to recline with a warm Otaru local tea.'
      ],
      alertText: 'Sea winds along the Otaru coastal expressway can trigger brief, powerful steering gusts. Keep a firm two-handed grip on the wheel.'
    },
    biei: {
      title: 'Biei: Misty Ink-Painting Route',
      location: 'biei',
      route: 'Sapporo to Biei via Mikasa IC & Country Highways',
      image: 'images/day4_biei.png',
      photoTarget: 'Shirogane Blue Pond & Patchwork Trees',
      targetDesc: 'The Shirogane Blue Pond takes on a mysterious, glowing turquoise hue when rain mixes with the mineral waters. The solitary trees on rolling hills become minimalist Japanese prints in morning mist.',
      napSpotName: 'Michi-no-Eki Biei Oka-no-Kura',
      napSpotDesc: 'A beautiful stone warehouse renovation. Highly quiet parking, warm local potato croquettes, and massive restrooms.',
      driveDifficulty: 'Moderate Driving',
      driveInstructions: 'Take the Expressway to Mikasa IC, then transition to a gorgeous, straight rural highway to Biei. Drive slowly and enjoy the scenery.',
      photoTips: [
        'Mist is your friend: compose the solitary trees of Biei (like Ken & Mary tree) with a clean white foggy background.',
        'At Blue Pond, search for a framing branch containing turquoise water below. Drizzle creates circular ripples on the glass-like water.',
        'Overcast skies reduce harsh forest shadows, capturing perfect details on the silver birch trees.'
      ],
      napTips: [
        'Oka-no-Kura parking is highly sheltered inside the local village, keeping high winds out.',
        'Indulge in a local hot bowl of Hokkaido soup curry before turning off your engine.',
        'A warm, cozy, quiet sanctuary to recharge your batteries.'
      ],
      alertText: 'Rural Biei pathways contain slow-moving farm machinery and tractors during late May. Be patient and wait for safe stretches to pass.'
    },
    yotei: {
      title: 'Mt. Yotei: Volcano Viewpoints',
      location: 'yotei',
      route: 'Sapporo to Niseko/Kutchan via Kyogoku country pass',
      image: 'images/target_yotei.png',
      photoTarget: 'Mt. Yotei volcano summits',
      targetDesc: 'The "Mount Fuji of Hokkaido." If clear, its snow-capped active peak is majestic. Under overcast/damp conditions, a gorgeous wispy cloud halo often frames its crown, looking like a traditional ink-painted wash.',
      napSpotName: 'Kyogoku Fukudashi Spring Park',
      napSpotDesc: 'Beautiful cold-spring park at the base of Mt. Yotei. Deeply isolated, lush forest canopy, quiet parking slots, and hot potato snacks.',
      driveDifficulty: 'Scenic Valley Cruising',
      driveInstructions: 'Follow Route 276. Long straight countryside paths, no complex forks or heavy toll checkpoints.',
      photoTips: [
        'If Mt. Yotei summit is clear, use Kyogoku springs for glassy water reflections.',
        'Under soft overcast skies, shoot from Kutchan potato fields: the green crop lanes form dramatic leading lines to the massive volcano.',
        'Wait for sudden cloud gap intervals to capture Mt. Yotei peaks wrapped in dramatic mists.'
      ],
      napTips: [
        'Park near Fukudashi springs under the dense canopy trees.',
        'Recline your seats and enjoy the soothing sound of cold mountain springs rushing nearby.',
        'Drink a cold cup of fresh mineral water, then buy warm Niseko croquettes to relax.'
      ],
      alertText: 'Kyogoku and Niseko valley roads can experience sudden powerful wind tunnels. Maintain active two-handed steering control.'
    },
    toya: {
      title: 'Lake Toya: Scenic Caldera Mist',
      location: 'toya',
      route: 'Sapporo to Toyako Onsen via Route 230 & Nakayama Pass',
      image: 'images/target_toya.png',
      photoTarget: 'Toyako pier & Nakajima Island',
      targetDesc: 'A colossal volcanic caldera lake. The central forested Nakajima Island floats mysterious and dark. Dense morning mist and soft drizzle isolate the island in the frame, creating a mystical ink-painted masterpiece.',
      napSpotName: 'Michi-no-Eki Toyako lakeside park',
      napSpotDesc: 'Quiet lakeside rest area with sweeps of the caldera, peaceful parking corners, and local organic sweet pastries.',
      driveDifficulty: 'Mountain pass climbing',
      driveInstructions: 'Drive Route 230 over the steep Nakayama Pass. Wide roads, but watch for heavy tour vehicles on slower hill-climb paths.',
      photoTips: [
        'Set up at the lakeside piers of Toyako Onsen. Mist and drizzle isolate Nakajima Island in the frame like a minimalist wash painting.',
        'Look for elegant swans near the misty shoreline to anchor your composition with scale and serenity.',
        'Use an ND filter to smooth out lake ripples into pure, mirror-like reflections.'
      ],
      napTips: [
        'Park near the lakeside overlook parking slots.',
        'Enjoy a warm can of local sweet corn soup while watching mist drift across Nakajima Island.',
        'The gentle sound of caldera lake waves lapping the gravel shore makes a highly soothing nap environment.'
      ],
      alertText: 'Nakayama Pass (Route 230) is prone to heavy storm downpours and low cloud banks. Slow down, keep safe braking space, and turn on fog lights!'
    }
  };

  const dayMeta = metaLookup[dayId];
  const selectedDate = activeSelectedDates[dayId];
  const locationWeather = weatherData[dayId];
  
  // If data is unavailable, exit gracefully
  if (!locationWeather) return;
  
  const dailyData = locationWeather.daily[selectedDate];
  const summary = dailyData.summary;
  const weatherMap = mapWeatherCode(summary.dominantCode);
  
  // Update header context
  document.getElementById('main-title').innerText = dayMeta.title;
  document.getElementById('main-subtitle').innerHTML = `
    <i data-lucide="map-pin"></i> 
    <span>Route: ${dayMeta.route}</span> 
  `;

  // Construct UI Cards
  container.innerHTML = `
    <!-- HORIZONTAL CALENDAR STRIP -->
    <div class="calendar-strip glass-panel">
      ${dateList.map(d => {
        const isActive = d === selectedDate;
        const dayWeather = locationWeather.daily[d];
        const daySummary = dayWeather.summary;
        const dayWeatherMap = mapWeatherCode(daySummary.dominantCode);
        const dateObj = new Date(d);
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
        const dayNum = dateObj.getDate();
        
        return `
          <button class="calendar-day-btn ${isActive ? 'active' : ''}" onclick="changeDayDate('${dayId}', '${d}')">
            <span class="cal-day-name">${dayName}</span>
            <span class="cal-day-num">${dayNum}</span>
            <span class="cal-weather-icon">${dayWeatherMap.emoji}</span>
            <span class="cal-photo-score">${daySummary.photoScore}%</span>
          </button>
        `;
      }).join('')}
    </div>

    <!-- HERO ROW -->
    <div class="day-hero-card glass-panel">
      <div class="day-hero-info">
        <div>
          <div class="day-hero-header">
            <span class="day-badge">${dayId.toUpperCase()} Target • ${formatShortDate(selectedDate)}</span>
            <div class="photo-score-circle d1" style="border-color: var(--accent-purple); box-shadow: 0 0 15px rgba(139, 92, 246, 0.2);">
              <span class="photo-score-num">${summary.photoScore}%</span>
              <span class="photo-score-label">Photo Score</span>
            </div>
          </div>
          <h2 class="day-hero-title">${dayMeta.photoTarget}</h2>
          <div class="day-hero-route-tag">
            <i data-lucide="compass"></i>
            <span>Primary Focus: Moody Saturation &amp; Textures</span>
          </div>
        </div>
        
        <p class="day-hero-narrative">${dayMeta.targetDesc}</p>
        
        <div class="day-hero-highlight-box">
          <p style="color: var(--accent-purple); font-weight: 600;">
            <i data-lucide="navigation"></i>
            <span>Driving Strategy: ${dayMeta.driveDifficulty}</span>
          </p>
          <p style="color: var(--text-secondary); margin-left: 1.5rem;">${dayMeta.driveInstructions}</p>
        </div>
      </div>
      
      <div class="day-hero-photo-wrapper">
        <img class="day-hero-photo" src="${dayMeta.image}" alt="${dayMeta.photoTarget}">
        <div class="day-hero-photo-overlay"></div>
        <div class="photo-credit-badge">
          <i data-lucide="aperture"></i>
          <span>Moody Landscape Generation</span>
        </div>
      </div>
    </div>
    
    <!-- STATS BLOCKS -->
    <div class="day-stats-row">
      <div class="stat-card glass-panel c1">
        <div class="stat-card-icon"><i data-lucide="cloud"></i></div>
        <div class="stat-card-content">
          <span class="stat-card-title">Conditions</span>
          <span class="stat-card-value">${weatherMap.text.split(' / ')[0]}</span>
        </div>
      </div>
      <div class="stat-card glass-panel c2">
        <div class="stat-card-icon"><i data-lucide="thermometer"></i></div>
        <div class="stat-card-content">
          <span class="stat-card-title">Average Temp</span>
          <span class="stat-card-value">${summary.avgTemp}°C</span>
        </div>
      </div>
      <div class="stat-card glass-panel c3">
        <div class="stat-card-icon"><i data-lucide="droplets"></i></div>
        <div class="stat-card-content">
          <span class="stat-card-title">Total Rain</span>
          <span class="stat-card-value">${summary.totalPrecip} mm</span>
        </div>
      </div>
      <div class="stat-card glass-panel c4">
        <div class="stat-card-icon"><i data-lucide="gauge"></i></div>
        <div class="stat-card-content">
          <span class="stat-card-title">Peak Rain Prob</span>
          <span class="stat-card-value">${summary.maxPrecipProb}%</span>
        </div>
      </div>
    </div>
    
    <!-- GRAPH & RAIN ANALYSIS WINDOWS -->
    <div class="day-details-grid">
      
      <!-- Chart Card -->
      <div class="chart-card glass-panel">
        <div class="chart-card-header">
          <h3 class="chart-card-title">
            <i data-lucide="trending-up"></i>
            <span>Hourly Rain &amp; Temperature Profile</span>
          </h3>
          <div class="chart-legend">
            <div class="legend-item">
              <div class="legend-color" style="background: rgba(56, 189, 248, 0.8);"></div>
              <span>Precip Probability (%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgba(236, 72, 153, 0.8);"></div>
              <span>Temp (°C)</span>
            </div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="hourlyWeatherChart"></canvas>
        </div>
      </div>
      
      <!-- Rain Segment Analyst Card -->
      <div class="analyst-card glass-panel">
        <h3 class="analyst-card-title">
          <i data-lucide="brain"></i>
          <span>Rain Analyst &amp; Timing Guide</span>
        </h3>
        <div class="analyst-timeline" id="analyst-timeline-container">
          <!-- Dynamically populated periods -->
        </div>
      </div>
      
    </div>
    
    <!-- NAVIGATION SECURITY WARNING BANNER -->
    <div class="safety-alert-banner glass-panel">
      <div class="safety-alert-icon"><i data-lucide="alert-triangle"></i></div>
      <div class="safety-alert-text">
        <div class="safety-alert-title">Driver Information Alert</div>
        <div class="safety-alert-desc" id="dynamic-safety-desc">${dayMeta.alertText}</div>
      </div>
    </div>
    
    <!-- DETAILED STRATEGY CARDS -->
    <div class="strategy-grid">
      <!-- Photo strategy card -->
      <div class="strategy-card glass-panel photo-strat">
        <h4 class="strategy-card-title">
          <i data-lucide="aperture"></i>
          <span>Creative Photography Tactics</span>
        </h4>
        <div class="strategy-content">
          ${dayMeta.photoTips.map((tip, i) => `
            <div class="strategy-item">
              <div class="strategy-item-icon"><i data-lucide="check"></i></div>
              <div class="strategy-item-text">
                <div class="strategy-item-heading">Tactic ${i+1}</div>
                <div class="strategy-item-desc">${tip}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Nap Strategy Card -->
      <div class="strategy-card glass-panel nap-strat">
        <h4 class="strategy-card-title">
          <i data-lucide="coffee"></i>
          <span>Nap Station Blueprint: ${dayMeta.napSpotName}</span>
        </h4>
        <div class="strategy-content">
          <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.5rem; line-height:1.4;">
            ${dayMeta.napSpotDesc}
          </div>
          ${dayMeta.napTips.map((tip, i) => `
            <div class="strategy-item">
              <div class="strategy-item-icon"><i data-lucide="bed"></i></div>
              <div class="strategy-item-text">
                <div class="strategy-item-heading">Nap Guideline ${i+1}</div>
                <div class="strategy-item-desc">${tip}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Initialize Lucide icons on newly inserted content
  lucide.createIcons();
  
  // Render Hourly Analyst Period Guide
  renderHourlyAnalystTimeline(dailyData.hourly, dayMeta);
  
  // Render Chart.js
  renderChart(dailyData.hourly);
}

// Render dynamic rain segments and photographic advice
function renderHourlyAnalystTimeline(hourlyData, dayMeta) {
  const container = document.getElementById('analyst-timeline-container');
  container.innerHTML = '';
  
  // Segment daylight periods
  const periods = [
    { name: 'Morning Drive / Warmup', range: [9, 12], id: 'morning' },
    { name: 'Lunch & Quiet Nap', range: [12, 15], id: 'nap' },
    { name: 'Primary Photography Target', range: [15, 18], id: 'photo' },
    { name: 'Romantic Dusk / Reflections', range: [18, 21], id: 'dusk' }
  ];
  
  periods.forEach(p => {
    const periodHours = hourlyData.filter(hr => hr.hour >= p.range[0] && hr.hour < p.range[1]);
    
    let sumTemp = 0;
    let sumPrecipProb = 0;
    let sumPrecip = 0;
    let codeFrequencies = {};
    
    periodHours.forEach(hr => {
      sumTemp += hr.temp;
      sumPrecipProb += hr.precipitationProb;
      sumPrecip += hr.precipitation;
      codeFrequencies[hr.weatherCode] = (codeFrequencies[hr.weatherCode] || 0) + 1;
    });
    
    const count = periodHours.length;
    const avgTemp = (sumTemp / count).toFixed(1);
    const avgPrecipProb = Math.round(sumPrecipProb / count);
    const totalPrecip = sumPrecip.toFixed(1);
    
    let dominantCode = 3;
    let maxFreq = 0;
    Object.keys(codeFrequencies).forEach(c => {
      if (codeFrequencies[c] > maxFreq) {
        maxFreq = codeFrequencies[c];
        dominantCode = parseInt(c);
      }
    });
    
    const weatherMap = mapWeatherCode(dominantCode);
    
    // Choose advice dynamically based on rainfall and period
    let advice = '';
    let rainClass = 'rain-none';
    
    if (totalPrecip > 0.8) {
      rainClass = 'rain-warning';
    } else if (avgPrecipProb > 35) {
      rainClass = 'rain-drizzle';
    }
    
    if (p.id === 'morning') {
      if (dominantCode === 45 || dominantCode === 48) {
        advice = '🌫️ Beautiful heavy morning mist expected along roadsides. Drive under 50km/h with full headlights, search for solitary pine frames.';
      } else if (totalPrecip > 0.5) {
        advice = '🌧️ Rainy highway drive. Engage windshield rain repellants, lock speed at 80km/h on curves. Relax, you have absolute freedom of time.';
      } else {
        advice = '☁️ Saturated soft clouds. Ideal navigation lighting. Zero sun glare, comfortable and straightforward driving conditions.';
      }
    } else if (p.id === 'nap') {
      if (totalPrecip > 0) {
        advice = `🌧️ Perfect napping environment. Recline passenger seat in ${dayMeta.napSpotName}, crack window slightly to enjoy rain pattering on the car roof. Temp ${avgTemp}°C.`;
      } else {
        advice = `☁️ Overcast & quiet wind. Recline seats, enjoy a hot coffee, and rest up. A quiet roadside sanctuary to prepare for late-afternoon shooting.`;
      }
    } else if (p.id === 'photo') {
      if (dominantCode === 3 || dominantCode === 45) {
        advice = `📷 STUNNING CONDITIONS! Perfect flat diffuse light. Colors of the flowers and trees will saturate deeply. Set exposure compensation to -0.3 to maintain shadows.`;
      } else if (totalPrecip > 1.5) {
        advice = `🌧️ Rain is heavier now (${totalPrecip}mm). Utilize your car as a mobile dry shelter. Set up tripod next to door frame or transition to indoor/covered alternatives.`;
      } else if (totalPrecip > 0) {
        advice = `📷 Light drizzle creating water ripples. Excellent for closeups of damp petals. Keep microfibre towels handy and capture atmospheric textures.`;
      } else {
        advice = `🌥️ Saturated overcast light. Great photography window. The lack of direct sun guarantees rich colors and zero harsh shadow blocks.`;
      }
    } else { // Dusk reflections
      if (totalPrecip > 0.3) {
        advice = `✨ MAGICAL DUSK reflecting window! Wet roads will mirror glowing street gaslights and buildings with incredible orange-teal depth. Use a tripod and slow shutter speed!`;
      } else if (avgPrecipProb > 50) {
        advice = `✨ Atmospheric damp twilight. Perfect moody vibes. The moisture in the air deepens the neon and brick lights, creating romantic dark blue-orange tones.`;
      } else {
        advice = `✨ Smooth blue-hour twilight. Warm orange lights contrasting against high slate skies. Standard dusk settings are optimized.`;
      }
    }
    
    const pCard = document.createElement('div');
    pCard.className = 'analyst-period';
    pCard.innerHTML = `
      <div class="period-time-box">
        <div class="period-time">${p.range[0]}:00 - ${p.range[1]}:00</div>
        <div class="period-lbl">${p.id}</div>
      </div>
      <div class="period-weather-badge">${weatherMap.emoji}</div>
      <div class="period-details">
        <div class="period-title-row">
          <span class="period-name">${p.name}</span>
          <span class="period-rain-metric ${rainClass}">
            <i data-lucide="droplet" style="width: 12px; height:12px; display:inline; vertical-align:middle; margin-right:2px;"></i>
            <span>${avgPrecipProb}% (${totalPrecip}mm)</span>
          </span>
        </div>
        <div class="period-advice">${advice}</div>
      </div>
    `;
    
    container.appendChild(pCard);
  });
  
  lucide.createIcons();
}

// --------------------------------------------------------------------------
// RENDER: HOURLY CHART (CHART.JS)
// --------------------------------------------------------------------------
function renderChart(hourlyData) {
  // Filter for key daylight hours (06:00 to 22:00)
  const chartHours = hourlyData.filter(hr => hr.hour >= 6 && hr.hour <= 22);
  
  const labels = chartHours.map(hr => `${hr.hour.toString().padStart(2, '0')}:00`);
  const tempDataset = chartHours.map(hr => hr.temp);
  const rainDataset = chartHours.map(hr => hr.precipitationProb);
  
  const ctx = document.getElementById('hourlyWeatherChart').getContext('2d');
  
  // If chart already exists, destroy it before recreating to avoid duplicate renders
  if (weatherChart) {
    weatherChart.destroy();
  }
  
  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Precipitation Probability (%)',
          data: rainDataset,
          borderColor: '#38bdf8',
          borderWidth: 2,
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'yRain'
        },
        {
          label: 'Temperature (°C)',
          data: tempDataset,
          borderColor: '#ec4899',
          borderWidth: 2,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          yAxisID: 'yTemp'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
          bodyFont: { family: 'Inter', size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label.split(' (')[0];
              let value = context.parsed.y;
              let unit = context.datasetIndex === 0 ? '%' : '°C';
              return ` ${label}: ${value}${unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 10 }
          }
        },
        yRain: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.03)'
          },
          ticks: {
            color: '#38bdf8',
            font: { family: 'Inter', size: 10 },
            callback: function(val) { return val + '%'; }
          }
        },
        yTemp: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 25,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: '#ec4899',
            font: { family: 'Inter', size: 10 },
            callback: function(val) { return val + '°'; }
          }
        }
      }
    }
  });
}

// --------------------------------------------------------------------------
// DATE TOGGLES & HELPERS
// --------------------------------------------------------------------------

// When user changes the date from the horizontal strip in detail view
function changeDayDate(dayId, newDate) {
  activeSelectedDates[dayId] = newDate;
  renderDayDetail(dayId);
}

// Helper: Format date to short string (e.g. "2026-05-24" -> "24 May")
function formatShortDate(dateStr) {
  const dateObj = new Date(dateStr);
  const day = dateObj.getDate();
  return `${day} May`;
}

// ==========================================================================
// MOBILE OPTIMIZED VERTICAL PLANNER GRID (FOR IPHONE VIEWPORTS)
// ==========================================================================

function renderMobileVerticalMatrix() {
  const container = document.getElementById('mobile-matrix-vertical');
  if (!container) return;

  const rowMeta = [
    { key: 'sapporo', name: 'Sapporo (Base)', tag: 'Base Camp', icon: 'building' },
    { key: 'takikawa', name: 'Takikawa Fields', tag: 'Nanohana Pop', icon: 'palette' },
    { key: 'kutchan', name: 'Kutchan Garden', tag: 'Pink Shibazakura', icon: 'flower2' },
    { key: 'otaru', name: 'Otaru Canal', tag: 'Dusk Reflections', icon: 'camera' },
    { key: 'biei', name: 'Biei Blue Pond', tag: 'Misty Blue tint', icon: 'sparkles' },
    { key: 'yotei', name: 'Mt. Yotei View', tag: 'Volcanic Peak', icon: 'mountain' },
    { key: 'toya', name: 'Lake Toya', tag: 'Caldera Mist', icon: 'waves' }
  ];

  let html = `
    <!-- Mobile Days Filter Pillbox Strip -->
    <div class="mobile-matrix-day-strip">
  `;

  const dateList = ['2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'];

  dateList.forEach(d => {
    const dateObj = new Date(d);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const isActive = (d === activeMobileMatrixDate);
    const activeClass = isActive ? 'active' : '';
    
    html += `
      <button class="mobile-matrix-day-btn ${activeClass}" onclick="setActiveMobileMatrixDate('${d}')">
        <span class="mobile-btn-name">${dayName}</span>
        <span class="mobile-btn-num">${dayNum}</span>
      </button>
    `;
  });

  html += `
    </div>
    
    <!-- Mobile Locations List for the Selected Day -->
    <div class="mobile-matrix-list">
  `;

  rowMeta.forEach(row => {
    const summary = weatherData[row.key].daily[activeMobileMatrixDate].summary;
    const weatherMap = mapWeatherCode(summary.dominantCode);
    
    let badgeClass = 'score-fair';
    if (summary.photoScore >= 85) badgeClass = 'score-excellent';
    else if (summary.photoScore >= 70) badgeClass = 'score-good';

    html += `
      <div class="mobile-location-row-card glass-panel" onclick="selectLocationDate('${row.key}', '${activeMobileMatrixDate}')">
        <div class="mobile-card-main-info">
          <div class="mobile-card-icon-box"><i data-lucide="${row.icon}"></i></div>
          <div class="mobile-card-names">
            <span class="mobile-spot-name">${row.name}</span>
            <span class="mobile-spot-tag">${row.tag}</span>
          </div>
          <div class="mobile-card-weather">
            <span class="mobile-weather-emoji">${weatherMap.emoji}</span>
            <span class="mobile-weather-temp">${summary.avgTemp}°</span>
          </div>
        </div>
        <div class="mobile-card-detail-bar">
          <span class="mobile-card-score-badge ${badgeClass}">${summary.photoScore}% Score</span>
          <span class="mobile-card-weather-lbl">${weatherMap.text} · Peak Rain: ${summary.maxPrecipProb}%</span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function setActiveMobileMatrixDate(dateStr) {
  activeMobileMatrixDate = dateStr;
  renderMobileVerticalMatrix();
}

// ==========================================================================
// MOBILE RESPONSIVE HAMBURGER MENU CONTROLLERS
// ==========================================================================

function toggleMobileMenu() {
  const btn = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  if (btn && sidebar) {
    btn.classList.toggle('active');
    sidebar.classList.toggle('open');
  }
}

function closeMobileMenu() {
  const btn = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  if (btn && sidebar) {
    btn.classList.remove('active');
    sidebar.classList.remove('open');
  }
}

// Close mobile menu when clicking or tapping outside of it
document.addEventListener('click', function(event) {
  const sidebar = document.querySelector('.sidebar');
  const btn = document.getElementById('hamburger-btn');
  
  if (sidebar && sidebar.classList.contains('open')) {
    // Check if the click occurred outside both the sidebar drawer and the toggle button
    if (!sidebar.contains(event.target) && btn && !btn.contains(event.target)) {
      closeMobileMenu();
    }
  }
});
