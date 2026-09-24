// The super Girls - IoT Dashboard Main Logic
// TimeZone: Asia/Kolkata (+5:30)

let currentTab = 1;
let currentPage = 1;
let totalPages = 1;
let syncCountdown = 10;
let syncInterval = null;
let countdownInterval = null;
let dht11Chart = null;
let currentLedState = 0;

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
  // Verify Authentication
  const token = localStorage.getItem('supergirls_jwt_token');
  const user = JSON.parse(localStorage.getItem('supergirls_user') || '{}');

  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // Display User Name
  if (user && user.name) {
    document.getElementById('user-display-name').textContent = user.name;
    const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-initials').textContent = initials || 'SG';
  }

  // Initial Load
  initChart();
  refreshDashboardData();
  fetchDeviceState();

  // Setup 10-Second Auto-Polling
  startAutoSync();
});

// Logout
function handleLogout() {
  localStorage.removeItem('supergirls_jwt_token');
  localStorage.removeItem('supergirls_user');
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 600);
}

// ==========================================
// AUTO SYNC & TIMER (10 SECONDS)
// ==========================================
function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  if (countdownInterval) clearInterval(countdownInterval);

  syncCountdown = 10;
  updateCountdownPill();

  // Count down every second
  countdownInterval = setInterval(() => {
    syncCountdown--;
    if (syncCountdown <= 0) {
      syncCountdown = 10;
    }
    updateCountdownPill();
  }, 1000);

  // Poll sensor data and device state every 10 seconds
  syncInterval = setInterval(() => {
    if (currentTab === 1) {
      fetchLatestSensorData();
      fetchHistoryTable(currentPage);
      updateChartData();
    }
    fetchDeviceState();
  }, 10000);
}

function updateCountdownPill() {
  const el = document.getElementById('sync-timer-counter');
  if (el) el.textContent = `${syncCountdown}s`;
}

function refreshDashboardData() {
  syncCountdown = 10;
  updateCountdownPill();
  fetchLatestSensorData();
  fetchHistoryTable(currentPage);
  updateChartData();
  fetchDeviceState();
  showToast('Dashboard data refreshed', 'info');
}

// ==========================================
// TAB SWITCHING
// ==========================================
function switchDashboardTab(tabIndex) {
  currentTab = tabIndex;

  for (let i = 1; i <= 3; i++) {
    const content = document.getElementById(`tab-content-${i}`);
    const navBtn = document.getElementById(`nav-tab-${i}`);

    if (i === tabIndex) {
      content.classList.remove('hidden');
      navBtn.className = 'tab-btn active border-b-2 border-indigo-600 text-indigo-600 py-3.5 px-2 sm:px-3 text-sm font-semibold flex items-center space-x-2 transition';
    } else {
      content.classList.add('hidden');
      navBtn.className = 'tab-btn border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 py-3.5 px-2 sm:px-3 text-sm font-semibold flex items-center space-x-2 transition';
    }
  }

  if (window.lucide) lucide.createIcons();

  if (tabIndex === 1 && dht11Chart) {
    dht11Chart.resize();
  }
}

// ==========================================
// TAB 1: ENVIRONMENT MONITORING (DHT11)
// ==========================================

// Fetch latest sensor reading & aggregate stats
async function fetchLatestSensorData() {
  try {
    const res = await fetch('/api/sensor-data/latest');
    const data = await res.json();

    if (!data.success) return;

    const { latest, stats } = data;

    if (latest) {
      updateTemperatureGauge(latest.temperature);
      updateHumidityGauge(latest.humidity);
      document.getElementById('stat-last-time').textContent = `${latest.time} (${latest.date})`;
    }

    if (stats) {
      document.getElementById('stat-min-temp').textContent = stats.min_temp !== null ? `${stats.min_temp} °C` : '-- °C';
      document.getElementById('stat-avg-temp').textContent = stats.avg_temp !== null ? `${stats.avg_temp} °C` : '-- °C';
      document.getElementById('stat-max-temp').textContent = stats.max_temp !== null ? `${stats.max_temp} °C` : '-- °C';

      document.getElementById('stat-min-hum').textContent = stats.min_hum !== null ? `${stats.min_hum} %` : '-- %';
      document.getElementById('stat-avg-hum').textContent = stats.avg_hum !== null ? `${stats.avg_hum} %` : '-- %';
      document.getElementById('stat-max-hum').textContent = stats.max_hum !== null ? `${stats.max_hum} %` : '-- %';
    }
  } catch (error) {
    console.error('Error fetching latest sensor reading:', error);
  }
}

// Update Temperature Circular Gauge & Seek Bar (0 - 50 °C scale)
function updateTemperatureGauge(temp) {
  const tempVal = parseFloat(temp);
  if (isNaN(tempVal)) return;

  const valueEl = document.getElementById('gauge-temp-value');
  const seekLabel = document.getElementById('temp-seekbar-label');
  const seekThumb = document.getElementById('temp-seek-bar');
  const badge = document.getElementById('temp-status-badge');
  const circle = document.getElementById('temp-gauge-circle');

  valueEl.textContent = tempVal.toFixed(1);
  seekLabel.textContent = `${tempVal.toFixed(1)} °C`;

  // Scale: 0 to 50 °C (percentage)
  const percent = Math.min(Math.max((tempVal / 50) * 100, 0), 100);
  seekThumb.style.width = `${percent}%`;

  // Circular gauge circumference: 2 * PI * 65 ≈ 408.4
  const circumference = 408.4;
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  // Status Badge Logic
  if (tempVal < 20) {
    badge.textContent = 'Cool';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200';
  } else if (tempVal <= 30) {
    badge.textContent = 'Optimal';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200';
  } else if (tempVal <= 36) {
    badge.textContent = 'Warm';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200';
  } else {
    badge.textContent = 'High Heat';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200';
  }
}

// Update Humidity Circular Gauge & Seek Bar (0 - 100 % scale)
function updateHumidityGauge(hum) {
  const humVal = parseFloat(hum);
  if (isNaN(humVal)) return;

  const valueEl = document.getElementById('gauge-hum-value');
  const seekLabel = document.getElementById('hum-seekbar-label');
  const seekThumb = document.getElementById('hum-seek-bar');
  const badge = document.getElementById('hum-status-badge');
  const circle = document.getElementById('hum-gauge-circle');

  valueEl.textContent = humVal.toFixed(1);
  seekLabel.textContent = `${humVal.toFixed(1)} %`;

  // Scale: 0 to 100 %
  const percent = Math.min(Math.max(humVal, 0), 100);
  seekThumb.style.width = `${percent}%`;

  // Circular gauge circumference: 2 * PI * 65 ≈ 408.4
  const circumference = 408.4;
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  // Humidity Badge Logic
  if (humVal < 35) {
    badge.textContent = 'Dry';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200';
  } else if (humVal <= 65) {
    badge.textContent = 'Optimal Comfort';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200';
  } else {
    badge.textContent = 'High Humidity';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200';
  }
}

// ==========================================
// PAGINATED SAVED RECORDS TABLE (20 per page)
// ==========================================
async function fetchHistoryTable(page = 1) {
  try {
    const res = await fetch(`/api/sensor-data/history?page=${page}&limit=20`);
    const data = await res.json();

    if (!data.success) return;

    currentPage = data.pagination.page;
    totalPages = data.pagination.totalPages;

    document.getElementById('table-total-count').textContent = data.pagination.totalRecords;
    document.getElementById('current-page-num').textContent = currentPage;
    document.getElementById('total-pages-num').textContent = totalPages;

    const tbody = document.getElementById('records-table-body');
    tbody.innerHTML = '';

    if (!data.records || data.records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-400">
            No sensor readings found. Connect ESP8266 or click "Simulate Reading".
          </td>
        </tr>
      `;
      renderPaginationControls();
      return;
    }

    data.records.forEach((row) => {
      const tr = document.createElement('tr');
      tr.id = `record-row-${row.id}`;
      tr.className = 'border-b border-slate-100 hover:bg-slate-50/70 transition';

      tr.innerHTML = `
        <td class="py-3 px-4 text-center font-mono text-slate-400 text-xs">${row.rowNumber}</td>
        <td class="py-3 px-4 font-semibold text-slate-800 font-mono">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 text-xs">
            ${parseFloat(row.temperature).toFixed(1)} &deg;C
          </span>
        </td>
        <td class="py-3 px-4 font-semibold text-slate-800 font-mono">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200/60 text-xs">
            ${parseFloat(row.humidity).toFixed(1)} %
          </span>
        </td>
        <td class="py-3 px-4 font-mono text-xs text-slate-600">${row.time}</td>
        <td class="py-3 px-4 text-xs text-slate-500">${row.date}</td>
        <td class="py-3 px-4 text-center">
          <button onclick="deleteRecord(${row.id})" title="Delete record" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderPaginationControls();
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('Error fetching history table:', error);
  }
}

function renderPaginationControls() {
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');
  const pillsContainer = document.getElementById('pagination-pills');

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  pillsContainer.innerHTML = '';

  // Render max 5 page buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);

  for (let p = startPage; p <= endPage; p++) {
    const btn = document.createElement('button');
    btn.textContent = p;
    btn.onclick = () => goToPage(p);

    if (p === currentPage) {
      btn.className = 'w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm flex items-center justify-center';
    } else {
      btn.className = 'w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs flex items-center justify-center transition';
    }
    pillsContainer.appendChild(btn);
  }
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages && page !== currentPage) {
    fetchHistoryTable(page);
  }
}

// Delete Record Action
async function deleteRecord(recordId) {
  if (!confirm(`Are you sure you want to delete record #${recordId}?`)) return;

  try {
    const res = await fetch(`/api/sensor-data/${recordId}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.success) {
      showToast('Record deleted successfully', 'success');
      fetchHistoryTable(currentPage);
      fetchLatestSensorData();
      updateChartData();
    } else {
      showToast(data.message || 'Failed to delete record', 'error');
    }
  } catch (error) {
    showToast('Network error while deleting record', 'error');
  }
}

// Simulate ESP8266 DHT11 Reading (Great for testing without hardware)
async function simulateDht11Data() {
  // Realistic sensor range (Temp 28-34°C, Hum 52-68%)
  const simTemp = (28 + Math.random() * 6).toFixed(1);
  const simHum = (52 + Math.random() * 16).toFixed(1);

  try {
    const res = await fetch('/api/sensor-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: simTemp, humidity: simHum })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Simulated DHT11: ${simTemp}°C, ${simHum}%`, 'success');
      fetchLatestSensorData();
      fetchHistoryTable(1);
      updateChartData();
    }
  } catch (err) {
    showToast('Failed to post simulated data', 'error');
  }
}

// ==========================================
// CHART.JS REAL-TIME TELEMETRY GRAPH
// ==========================================
function initChart() {
  const ctx = document.getElementById('dht11Chart');
  if (!ctx) return;

  dht11Chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature (°C)',
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#f59e0b',
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
          yAxisID: 'yTemp'
        },
        {
          label: 'Humidity (%)',
          data: [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#06b6d4',
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
          yAxisID: 'yHum'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '700' },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'JetBrains Mono', size: 10 },
            maxRotation: 45
          }
        },
        yTemp: {
          type: 'linear',
          position: 'left',
          min: 15,
          max: 45,
          title: {
            display: true,
            text: 'Temperature (°C)',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            color: '#f59e0b'
          },
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'JetBrains Mono', size: 10 } }
        },
        yHum: {
          type: 'linear',
          position: 'right',
          min: 20,
          max: 100,
          title: {
            display: true,
            text: 'Humidity (%)',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            color: '#06b6d4'
          },
          grid: { drawOnChartArea: false },
          ticks: { font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });
}

async function updateChartData() {
  if (!dht11Chart) return;

  try {
    const res = await fetch('/api/sensor-data/chart-data?limit=25');
    const data = await res.json();

    if (!data.success || !data.data) return;

    const labels = data.data.map(d => d.time);
    const temps = data.data.map(d => d.temperature);
    const hums = data.data.map(d => d.humidity);

    dht11Chart.data.labels = labels;
    dht11Chart.data.datasets[0].data = temps;
    dht11Chart.data.datasets[1].data = hums;
    dht11Chart.update('none'); // smooth update without jarring reanimation
  } catch (error) {
    console.error('Error updating chart:', error);
  }
}

// ==========================================
// TAB 2: SMART LCD (16x2 I2C)
// ==========================================

function updateLcdPreview() {
  const row1 = document.getElementById('lcd-row-1').value || '';
  const row2 = document.getElementById('lcd-row-2').value || '';

  document.getElementById('row1-counter').textContent = `${row1.length} / 16`;
  document.getElementById('row2-counter').textContent = `${row2.length} / 16`;

  // Pad to 16 characters for authentic LCD preview
  const line1Padded = (row1 + '                ').substring(0, 16);
  const line2Padded = (row2 + '                ').substring(0, 16);

  document.getElementById('lcd-preview-line1').textContent = line1Padded;
  document.getElementById('lcd-preview-line2').textContent = line2Padded;
}

function toggleLcdColorMode(mode) {
  const screen = document.getElementById('virtual-lcd-screen');
  if (mode === 'blue') {
    screen.classList.add('blue-mode');
  } else {
    screen.classList.remove('blue-mode');
  }
}

async function handleLcdUpdate(e) {
  e.preventDefault();
  const row1 = document.getElementById('lcd-row-1').value;
  const row2 = document.getElementById('lcd-row-2').value;
  const btn = document.getElementById('lcd-update-btn');

  try {
    btn.disabled = true;
    btn.innerHTML = `<span>Updating Hardware...</span>`;

    const res = await fetch('/api/device/lcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line1: row1, line2: row2 })
    });
    const data = await res.json();

    if (data.success) {
      showToast('LCD message updated! Displaying on hardware.', 'success');
    } else {
      showToast(data.message || 'Failed to update LCD', 'error');
    }
  } catch (err) {
    showToast('Network error while updating LCD', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i><span>Update Hardware LCD</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

// ==========================================
// TAB 3: LED AUTOMATION (PIN D3 / GPIO 0)
// ==========================================

async function fetchDeviceState() {
  try {
    const res = await fetch('/api/device/state');
    const data = await res.json();

    if (!data.success || !data.data) return;

    currentLedState = data.data.led_state ? 1 : 0;
    updateLedUI(currentLedState);

    // If LCD inputs are currently empty, prefill them with existing values
    const r1 = document.getElementById('lcd-row-1');
    const r2 = document.getElementById('lcd-row-2');
    if (r1 && !r1.value && data.data.lcd_line1) {
      r1.value = data.data.lcd_line1;
    }
    if (r2 && !r2.value && data.data.lcd_line2) {
      r2.value = data.data.lcd_line2;
    }
    updateLcdPreview();
  } catch (error) {
    console.error('Error fetching device state:', error);
  }
}

function updateLedUI(state) {
  const orb = document.getElementById('led-indicator-orb');
  const bulb = document.getElementById('led-bulb-icon');
  const statusText = document.getElementById('led-status-text');
  const toggleBtn = document.getElementById('led-toggle-btn');
  const knob = document.getElementById('led-switch-knob');
  const stateCode = document.getElementById('led-state-code');
  const navPill = document.getElementById('tab-led-pill');

  if (state === 1) {
    // ON State
    orb.className = 'w-24 h-24 rounded-full led-glow-on mb-6 transition-all duration-300 flex items-center justify-center border-4 border-white shadow-lg';
    bulb.className = 'w-10 h-10 text-white transition-colors duration-300';
    statusText.textContent = 'LED IS ON';
    statusText.className = 'text-2xl font-black text-emerald-600 tracking-tight font-mono';
    toggleBtn.className = 'relative inline-flex items-center h-14 w-28 rounded-full p-1 transition-colors duration-300 focus:outline-none bg-emerald-500 shadow-md shadow-emerald-200';
    knob.className = 'inline-block w-12 h-12 rounded-full bg-white shadow-md transform transition-transform duration-300 translate-x-14 flex items-center justify-center';
    knob.innerHTML = `<i data-lucide="power" class="w-5 h-5 text-emerald-600"></i>`;
    stateCode.textContent = 'HIGH (1)';
    stateCode.className = 'font-bold text-emerald-600';
    navPill.textContent = 'ON';
    navPill.className = 'ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold';
  } else {
    // OFF State
    orb.className = 'w-24 h-24 rounded-full led-glow-off mb-6 transition-all duration-300 flex items-center justify-center border-4 border-white shadow-inner';
    bulb.className = 'w-10 h-10 text-slate-400 transition-colors duration-300';
    statusText.textContent = 'LED IS OFF';
    statusText.className = 'text-2xl font-black text-slate-700 tracking-tight font-mono';
    toggleBtn.className = 'relative inline-flex items-center h-14 w-28 rounded-full p-1 transition-colors duration-300 focus:outline-none bg-slate-300 shadow-inner';
    knob.className = 'inline-block w-12 h-12 rounded-full bg-white shadow-md transform transition-transform duration-300 translate-x-0 flex items-center justify-center';
    knob.innerHTML = `<i data-lucide="power" class="w-5 h-5 text-slate-400"></i>`;
    stateCode.textContent = 'LOW (0)';
    stateCode.className = 'font-bold text-rose-600';
    navPill.textContent = 'OFF';
    navPill.className = 'ml-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold';
  }

  if (window.lucide) lucide.createIcons();
}

async function toggleLedState() {
  const newState = currentLedState === 1 ? 0 : 1;
  // Optimistic UI update
  currentLedState = newState;
  updateLedUI(currentLedState);

  try {
    const res = await fetch('/api/device/led', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Hardware LED turned ${newState === 1 ? 'ON' : 'OFF'}!`, 'success');
    } else {
      showToast(data.message || 'Failed to update LED', 'error');
      // Revert on error
      currentLedState = newState === 1 ? 0 : 1;
      updateLedUI(currentLedState);
    }
  } catch (err) {
    showToast('Network error while toggling LED', 'error');
    currentLedState = newState === 1 ? 0 : 1;
    updateLedUI(currentLedState);
  }
}
