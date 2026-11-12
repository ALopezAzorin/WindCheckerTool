// Weather and charts module
// Handles API calls and chart rendering

let windChart = null;

function setSelectedLocation(loc) {
  selectedLocation = loc;
  updateSelectedTooltip();
  const panel = document.getElementById("weather-panel");

  if (!loc) {
    if (windChart) {
      windChart.destroy();
      windChart = null;
    }
    panel.style.display = "none";
    collapseWeatherPanel();
    return;
  }

  panel.style.display = "block";
  const nameEl = panel.querySelector(".wp-name");
  const coordEl = panel.querySelector(".wp-coords");

  nameEl.textContent = loc.name;
  coordEl.textContent = `${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°`;

  loadWeatherData(loc);
}


toggleWeatherPanelDailyView = function() {
  weatherPanelDailyViewisActive = !weatherPanelDailyViewisActive;
  applyWeatherPanelDailyViewState();
}

function applyWeatherPanelDailyViewState() {
  const dailyBtn = document.querySelector(".wp-daily");
  dailyBtn.querySelector("p").textContent = weatherPanelDailyViewisActive ? "weekly view" : "daily view";
  dailyBtn.setAttribute("aria-label", weatherPanelDailyViewisActive ? "Weekly forecast" : "Daily forecast");
  dailyBtn.setAttribute("title", weatherPanelDailyViewisActive ? "Weekly forecast" : "Daily forecast");

  loadWeatherData(selectedLocation);
  /* const panel = document.getElementById("weather-panel");
  const btn = document.querySelector(".wp-daily");

  panel.classList.toggle("daily-view", weatherPanelDailyViewisActive);
  btn.classList.toggle("active", weatherPanelDailyViewisActive);
  btn.setAttribute("aria-label", weatherPanelDailyViewisActive ? "Hourly forecast" : "Daily forecast");
  btn.setAttribute("title", weatherPanelDailyViewisActive ? "Hourly forecast" : "Daily forecast");

  if (windChart) {
    windChart.resize();
  } */
}

function toggleWeatherPanelExpand() {
  weatherPanelExpanded = !weatherPanelExpanded;
  applyWeatherPanelExpandState();
}

function collapseWeatherPanel() {
  weatherPanelExpanded = false;
  applyWeatherPanelExpandState();
}

function applyWeatherPanelExpandState() {
  const panel = document.getElementById("weather-panel");
  const btn = document.querySelector(".wp-expand");

  panel.classList.toggle("expanded", weatherPanelExpanded);
  btn.innerHTML = weatherPanelExpanded ? getCollapseIcon() : getExpandIcon();
  btn.setAttribute("aria-label", weatherPanelExpanded ? "Collapse panel" : "Expand panel");
  btn.setAttribute("title", weatherPanelExpanded ? "Collapse panel" : "Expand panel");

  if (windChart) {
    windChart.resize();
  }
}

function getExpandIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>`;
}

function getCollapseIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"/></svg>`;
}



function loadWeatherData(location) {
  const body = document.getElementById("wp-body");

  if (windChart) {
    windChart.destroy();
    windChart = null;
  }

  body.innerHTML = makeSkeletonHTML();

  const lat = location.lat;
  const lon = location.lon;


  const cacheKey = `weather_${lat}_${lon}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);
    const isFresh = (Date.now() - parsed.timestamp) < 3600000 && parsed.data.hourly.wind_speed_10m; // 1 hora

    if (isFresh) {
      console.log("Loaded from cache");

      const hourly = parsed.data.hourly;
      const windData = {
        time: hourly.time,
        ws10: hourly.wind_speed_10m,
        ws80: hourly.wind_speed_80m,
        ws120: hourly.wind_speed_120m,
        ws180: hourly.wind_speed_180m
      };

      body.innerHTML = makeWindChartHTML(windData);
      setupWindChart(body.querySelector(".wind-chart-canvas"), windData);

      return;
    } else {
      console.log("Cache expired ");
    }
  }




  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("hourly", "wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "auto");

  fetch(url.toString())
    .then(response => {
      if (!response.ok) {
        throw new Error("API response not ok");
      }
      return response.json();
    })
    .then(data => {
      
      console.log("API fetched correctly");

      // guardar en cache
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));


      const hourly = data.hourly;
      const windData = {
        time: hourly.time,
        ws10: hourly.wind_speed_10m,
        ws80: hourly.wind_speed_80m,
        ws120: hourly.wind_speed_120m,
        ws180: hourly.wind_speed_180m
      };

      body.innerHTML = makeWindChartHTML(windData);
      setupWindChart(body.querySelector(".wind-chart-canvas"), windData);

      const badge = calculateBadgeForLocation(location);
      if (badge) {
        const badgeOverrides = {};
        badgeOverrides[location.id] = badge;
        updateMarkers(badgeOverrides);
      }
    })
    .catch(err => {
      console.error("Failed to load weather:", err);
      body.innerHTML = makeErrorHTML();

      const retryBtn = body.querySelector(".wp-retry");
      if (retryBtn) {
        retryBtn.addEventListener("click", function() {
          loadWeatherData(location);
        });
      }
    });
}

function computeWindStats(windData, times) {
  if (!times || times.length === 0) {
    return { now: "--", todayMax: "--", weekMax: "--" };
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hoursSinceMidnight = Math.floor((now - todayMidnight) / (1000 * 60 * 60));

  let currentIndex = 0;
  let minDiff = Infinity;

  for (let i = 0; i < times.length; i++) {
    const d = new Date(times[i]);
    const dayMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const hoursSinceDataMidnight = Math.floor((d - dayMidnight) / (1000 * 60 * 60));
    const diff = Math.abs(hoursSinceDataMidnight - hoursSinceMidnight);

    if (diff < minDiff) {
      minDiff = diff;
      currentIndex = i;
    }
  }

  const currentVal = windData[currentIndex] !== null && windData[currentIndex] !== undefined
    ? windData[currentIndex].toFixed(1)
    : "--";

  let todayMaxVal = "--";
  const currentDay = new Date(times[currentIndex]).toDateString();
  const todayData = [];

  for (let i = currentIndex; i < times.length; i++) {
    const d = new Date(times[i]);
    if (d.toDateString() !== currentDay) break;
    if (windData[i] !== null && windData[i] !== undefined) {
      todayData.push(windData[i]);
    }
  }

  if (todayData.length > 0) {
    todayMaxVal = Math.max(...todayData).toFixed(1);
  }

  let weekMaxVal = "--";
  const futureData = [];
  const maxIndex = Math.min(currentIndex + 168, times.length);

  for (let i = currentIndex; i < maxIndex; i++) {
    if (windData[i] !== null && windData[i] !== undefined) {
      futureData.push(windData[i]);
    }
  }

  if (futureData.length > 0) {
    weekMaxVal = Math.max(...futureData).toFixed(1);
  }

  return {
    now: currentVal,
    todayMax: todayMaxVal,
    weekMax: weekMaxVal
  };
}

function makeSkeletonHTML() {
  const placeholders = [0, 1, 2].map(() => {
    return `<div class="sk-block" style="flex:1;height:34px;border-radius:9px"></div>`;
  }).join("");

  const statPlaceholders = [0, 1, 2].map(() => {
    return `<div class="sk-block" style="flex:1;height:68px;border-radius:12px"></div>`;
  }).join("");

  return `
    <div class="skeleton pulse">

      <p style="font-size:14px;color:var(--text-muted);margin-bottom:8px; text-align: center;">
        Loading wind data (this may take some seconds)...
      </p>

      <div style="display:flex;gap:3px;background:rgba(15,23,42,0.9);border:1px solid rgba(51,65,85,0.5);border-radius:12px;padding:4px">
        ${placeholders}
      </div>

      <div style="display:flex;gap:10px;padding:14px 0 0">
        ${statPlaceholders}
      </div>

      <div class="sk-block" style="width:100%;height:240px;border-radius:10px"></div>
    </div>
  `;
}

function makeWindChartHTML(windData) {
  const stats = computeWindStats(windData[`ws${windHeight}`], windData.time);

  let date = new Date();
  date.setDate(date.getDate() + currentDayOffset);
  let dayName = date.toLocaleDateString("en", {
    weekday: "long"
  });

  return `
    <div class="wp-height-toggle">
      ${[10, 80, 120, 180].map(h => `<button class="wh-btn${h === windHeight ? " active" : ""}" data-h="${h}">${h} m</button>`).join("")}
    </div>
    <div class="wp-summary">
      <div class="wp-stat">
        <span class="wp-stat-label">Now</span>
        <span class="wp-stat-value" id="wp-now">${stats.now} m/s</span>
      </div>
      <div class="wp-stat">
        <span class="wp-stat-label">Today max</span>
        <span class="wp-stat-value" id="wp-today">${stats.todayMax} m/s</span>
      </div>
      <div class="wp-stat">
        <span class="wp-stat-label">7d max</span>
        <span class="wp-stat-value" id="wp-week">${stats.weekMax} m/s</span>
      </div>
    </div>
    <div class="wp-chart-wrap">
      <canvas class="wind-chart-canvas"></canvas>
    </div>

    ${
      weatherPanelDailyViewisActive ?
      `
      <div class="daily-view-info">
        <button class="wp-daily-buttons" data-direction="prev">prev</button>
        <p style="font-size: 14px; color: var(--text-main);"> ${dayName} </p>
        <button class="wp-daily-buttons" data-direction="next">next</button>
      </div>
      ` : ''
    }
      
    `;
}

function interpolateAtThreshold(timeArray, valueArray, thresholdValue) {
  const result = {
    times: [],
    values: []
  };

  for (let i = 0; i < valueArray.length - 1; i++) {
    const t0 = new Date(timeArray[i]);
    const t1 = new Date(timeArray[i + 1]);
    const v0 = valueArray[i];
    const v1 = valueArray[i + 1];

    result.times.push(timeArray[i]);
    result.values.push(v0);

    const crossedUp = v0 <= thresholdValue && v1 > thresholdValue;
    const crossedDown = v0 > thresholdValue && v1 <= thresholdValue;

    if ((crossedUp || crossedDown) && v0 !== v1) {
      const fraction = (thresholdValue - v0) / (v1 - v0);
      const crossTime = new Date(t0.getTime() + fraction * (t1 - t0));

      result.times.push(crossTime.toISOString());
      result.values.push(thresholdValue);
    }
  }

  const lastTime = timeArray[timeArray.length - 1];
  const lastValue = valueArray[valueArray.length - 1];
  result.times.push(lastTime);
  result.values.push(lastValue);

  return result;
}

function setupWindChart(canvasElement, windData) {
  const allHeightData = {
    10: windData.ws10,
    80: windData.ws80,
    120: windData.ws120,
    180: windData.ws180
  };

  let activeHeight = windHeight;
  let activeData = allHeightData[activeHeight];

  let chartTimes = windData.time;
  let chartValues = activeData;

  const interpolated = interpolateAtThreshold(chartTimes, chartValues, windThreshold);

  const now = new Date();

  dayIndices = chartTimes
      .map((time, index) => ({ time, index }))
      .filter(item => item.time.startsWith(selectedDay))
      .map(item => item.index);
    
    chartTimes = weatherPanelDailyViewisActive ? dayIndices.map(i => chartTimes[i]) : chartTimes;
    chartValues = weatherPanelDailyViewisActive ? dayIndices.map(i => chartValues[i]) : chartValues;


  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hoursSinceMidnight = Math.floor((now - todayMidnight) / (1000 * 60 * 60));

  let currentTimeIndex = 0;
  let minDiff = Infinity;

  for (let i = 0; i < chartTimes.length; i++) {
    const d = new Date(chartTimes[i]);
    const dayMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const hoursSinceDataMidnight = Math.floor((d - dayMidnight) / (1000 * 60 * 60));
    const diff = Math.abs(hoursSinceDataMidnight - hoursSinceMidnight);

    if (diff < minDiff) {
      minDiff = diff;
      currentTimeIndex = i;
    }
  }

  const noonIndices = new Set();
  let lastDayShown = null;

  for (let i = 0; i < chartTimes.length; i++) {
    const d = new Date(chartTimes[i]);
    const dayKey = d.toDateString();

    if (d.getHours() === 12 && lastDayShown !== dayKey) {
      noonIndices.add(i);
      lastDayShown = dayKey;
    }
  }

  windChart = new Chart(canvasElement, {
    type: "line",
    data: {
      labels: chartTimes,
      datasets: [{
        data: chartValues,
        backgroundColor: "rgba(34,211,238,0.07)",
        segment: {
          borderColor: (ctx) => {
            const val = ctx.p0.parsed.y;
            return meetsWindCondition(val) ? "green" : "red";
          },
          backgroundColor: (ctx) => {
            const val = ctx.p0.parsed.y;
            return meetsWindCondition(val) ? "rgba(34, 197, 94, 0.25)" : "rgba(249, 115, 22, 0.25)";
          }
        },
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: (tooltipItems) => {
              const index = tooltipItems[0].dataIndex;
              const timeStr = chartTimes[index];
              const d = new Date(timeStr);
              const dateStr = d.toLocaleDateString("en", {
                weekday: "short",
                month: "short",
                day: "numeric"
              });
              const timeStr2 = d.toLocaleTimeString("en", {
                hour: "2-digit",
                minute: "2-digit"
              });
              return `${dateStr}  ${timeStr2}`;
            },
            label: (ctx) => {
              const val = ctx.raw;
              const display = val !== null ? val.toFixed(1) : "--";
              return ` ${display} m/s`;
            }
          },
          backgroundColor: "#1e293b",
          borderColor: "#334155",
          borderWidth: 1,
          titleColor: "#94a3b8",
          bodyColor: "#22d3ee",
          padding: 8
        }
      },
      scales: {
        x: {
          min: weatherPanelDailyViewisActive ? 0 : currentTimeIndex,
          ticks: {
            color: "#64748b",
            autoSkip: false,
            maxRotation: 0,
            font: { size: 10 },
            callback: (idx) => {
              const t = chartTimes[idx];
              if (!t) return "";
              const d = new Date(t);
              if (weatherPanelDailyViewisActive) {
              return d.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit"
              });
              }

              if (!noonIndices.has(idx)) {
              return "";
              }
              return d.toLocaleDateString("en", {
              weekday: "short"
              });
            },
          },
          grid: weatherPanelDailyViewisActive ? { color: "rgba(255,255,255,0.1)" } : { display: false },
          border: { color: "rgba(51,65,85,0.4)" }
        },
        y: {
          min: 0,
          ticks: {
            color: "#64748b",
            font: { size: 10 }
          },
          grid: { color: "rgba(255,255,255,0.1)" },
          border: { color: "rgba(51,65,85,0.4)" },
          title: {
            display: true,
            text: "m/s",
            color: "#64748b",
            font: { size: 10 }
          }
        }
      }
    }
    });

  const parentPanel = canvasElement.closest("#wp-body");
  const heightButtons = parentPanel.querySelectorAll(".wh-btn");

  heightButtons.forEach(btn => {
    btn.addEventListener("click", function() {
      const selectedHeight = parseInt(this.getAttribute("data-h"));

      heightButtons.forEach(b => b.classList.remove("active"));
      this.classList.add("active");

      activeHeight = selectedHeight;
      activeData = allHeightData[activeHeight];

      const newInterp = interpolateAtThreshold(windData.time, activeData, windThreshold);
      chartTimes = newInterp.times;
      chartValues = newInterp.values;

      dayIndices = chartTimes
      .map((time, index) => ({ time, index }))
      .filter(item => item.time.startsWith(selectedDay))
      .map(item => item.index);
    
      chartTimes = weatherPanelDailyViewisActive ? dayIndices.map(i => chartTimes[i]) : chartTimes;
      chartValues = weatherPanelDailyViewisActive ? dayIndices.map(i => chartValues[i]) : chartValues;


      const newNoonIndices = new Set();
      let lastDayShown = null;
      for (let i = 0; i < chartTimes.length; i++) {
        const d = new Date(chartTimes[i]);
        const dayKey = d.toDateString();
        if (d.getHours() === 12 && lastDayShown !== dayKey) {
          newNoonIndices.add(i);
          lastDayShown = dayKey;
        }
      }

      windChart.data.labels = chartTimes;
      windChart.data.datasets[0].data = chartValues;

    
      windChart.options.scales.x.ticks.callback = (idx) => {
        const t = chartTimes[idx];
        if (!t) return "";
        const d = new Date(t);
        if (weatherPanelDailyViewisActive) {
        return d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
        });
        }

        if (!noonIndices.has(idx)) {
        return "";
        }
        return d.toLocaleDateString("en", {
        weekday: "short"
        });
      };

      const newStats = computeWindStats(activeData, windData.time);
      document.getElementById("wp-now").textContent = `${newStats.now} m/s`;
      document.getElementById("wp-today").textContent = `${newStats.todayMax} m/s`;
      document.getElementById("wp-week").textContent = `${newStats.weekMax} m/s`;

      windChart.update("none");
    });
  });

  const dailyButtons = parentPanel.querySelectorAll(".wp-daily-buttons");

  dailyButtons.forEach(btn => {
    btn.addEventListener("click", function() {
      const direction = this.getAttribute("data-direction");
      if (direction === "prev") {
        currentDayOffset = Math.max(0, currentDayOffset - 1);
      } else if (direction === "next") {
        currentDayOffset = Math.min(6, currentDayOffset + 1);
      }

      let targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + currentDayOffset);
      selectedDay = targetDate.toISOString().split("T")[0];

      const newInterp = interpolateAtThreshold(windData.time, activeData, windThreshold);
      chartTimes = newInterp.times;
      chartValues = newInterp.values;

      dayIndices = chartTimes
      .map((time, index) => ({ time, index }))
      .filter(item => item.time.startsWith(selectedDay))
      .map(item => item.index);
    
      chartTimes = weatherPanelDailyViewisActive ? dayIndices.map(i => chartTimes[i]) : chartTimes;
      chartValues = weatherPanelDailyViewisActive ? dayIndices.map(i => chartValues[i]) : chartValues;

      windChart.data.labels = chartTimes;
      windChart.data.datasets[0].data = chartValues;

      let date = new Date();
      date.setDate(date.getDate() + currentDayOffset);
      let dayName = date.toLocaleDateString("en", {
      weekday: "long"
      });

      const dailyInfo = parentPanel.querySelector(".daily-view-info p");
      if (dailyInfo) {
        dailyInfo.textContent = dayName;
      }

      windChart.update("none");
    });
  
  });

}

function makeErrorHTML() {
  return `
    <div class="wp-error">
      <p>Nordex firewall is blocking the API where the data comes from.</p>
      <p>Try turning off the VPN or just retry after some time</p>
      <button class="wp-retry">Retry</button>
    </div>
  `;
}

function hasConsecutiveHours(windData, threshold, minHours) {
  let consecutiveCount = 0;

  for (let i = 0; i < windData.length; i++) {
    if (windData[i] >= threshold) {
      consecutiveCount++;
      if (consecutiveCount >= minHours) {
        return true;
      }
    } else {
      consecutiveCount = 0;
    }
  }

  return false;
}

// Above: wind over the threshold. Below: wind at or under the threshold
function meetsWindCondition(value, threshold = windThreshold) {
  if (value === null || value === undefined) {
    return false;
  }
  return markerSymbolMode === "above" ? value > threshold : value <= threshold;
}

function hasBusinessHoursWind(windData, times, threshold, minHours) {
  let consecutiveCount = 0;

  for (let i = 0; i < windData.length; i++) {
    const timestamp = new Date(times[i]);
    const dayOfWeek = timestamp.getDay();
    const hour = timestamp.getHours();

    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isBusinessHours = hour >= 8 && hour < 18;
    const hasWind = meetsWindCondition(windData[i], threshold);

    if (isWeekday && isBusinessHours && hasWind) {
      consecutiveCount++;
      if (consecutiveCount >= minHours) {
        return true;
      }
    } else {
      consecutiveCount = 0;
    }
  }

  return false;
}

function calculateBadgeForLocation(location) {
  const lat = location.lat;
  const lon = location.lon;
  const cacheKey = `weather_${lat}_${lon}`;
  const cached = localStorage.getItem(cacheKey);

  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    const ws = parsed.data.hourly[`wind_speed_${windHeight}m`];
    const times = parsed.data.hourly.time;

    if (!Array.isArray(ws) || ws.length === 0) {
      return null;
    }

    const has8BusinessHours = hasBusinessHoursWind(ws, times, windThreshold, 8);
    return has8BusinessHours ? 'valid' : 'invalid';
  } catch (err) {
    console.error("Error calculating badge:", err);
    return null;
  }
}

function fetchWeatherDataForLocation(location) {
  return new Promise((resolve) => {
    const lat = location.lat;
    const lon = location.lon;
    const cacheKey = `weather_${lat}_${lon}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached);
      const isFresh = (Date.now() - parsed.timestamp) < 3600000 && parsed.data.hourly.wind_speed_10m;

      if (isFresh) {
        console.log(`Cache hit for ${location.name}`);
        resolve(location.id);
        return;
      }
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("hourly", "wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("timezone", "auto");

    fetch(url.toString())
      .then(response => {
        if (!response.ok) throw new Error("API response not ok");
        return response.json();
      })
      .then(data => {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: data
        }));
        resolve(location.id);
      })
      .catch(err => {
        console.error(`Failed to fetch weather for ${location.name}:`, err);
        resolve(location.id);
      });
  });
}

async function fetchAndCalculateAllBadges() {
  const badgeOverrides = {};

  for (const location of locations) {
    await fetchWeatherDataForLocation(location);
    const badge = calculateBadgeForLocation(location);
    if (badge) {
      badgeOverrides[location.id] = badge;
    }
  }

  updateMarkers(badgeOverrides);
}
