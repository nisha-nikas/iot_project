require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, get, run, formatToIST } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'the_super_girls_iot_jwt_secret_key_2026';
const API_KEY = process.env.API_KEY || 'supergirls_esp8266_token_secure';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// Optional API Key check for ESP8266 requests
function verifyDeviceKey(req, res, next) {
  // If API_KEY is provided in query, body, or header, check it
  const deviceKey = req.headers['x-api-key'] || req.query.api_key || (req.body && req.body.api_key);
  if (deviceKey && deviceKey !== API_KEY) {
    return res.status(403).json({ success: false, message: 'Invalid Device API Key.' });
  }
  next();
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashedPassword]
    );

    const token = jwt.sign(
      { id: result.lastID, name: name.trim(), email: email.toLowerCase().trim() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      user: { id: result.lastID, name: name.trim(), email: email.toLowerCase().trim() }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Get current logged-in user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// 2. SENSOR DATA (DHT11) ENDPOINTS
// ==========================================

// ESP8266 Posts Sensor Data every 10 seconds
app.post('/api/sensor-data', verifyDeviceKey, async (req, res) => {
  try {
    const { temperature, humidity } = req.body;

    if (temperature === undefined || humidity === undefined) {
      return res.status(400).json({ success: false, message: 'Temperature and Humidity are required.' });
    }

    const tempVal = parseFloat(temperature);
    const humVal = parseFloat(humidity);

    if (isNaN(tempVal) || isNaN(humVal)) {
      return res.status(400).json({ success: false, message: 'Temperature and Humidity must be numbers.' });
    }

    const result = await run(
      'INSERT INTO sensor_readings (temperature, humidity, created_at) VALUES (?, ?, datetime("now"))',
      [tempVal, humVal]
    );

    return res.status(201).json({
      success: true,
      message: 'Sensor data recorded successfully.',
      id: result.lastID,
      data: { temperature: tempVal, humidity: humVal }
    });
  } catch (error) {
    console.error('Error saving sensor data:', error);
    return res.status(500).json({ success: false, message: 'Failed to save sensor data.' });
  }
});

// GET Latest Sensor Reading + Quick Aggregate Stats
app.get('/api/sensor-data/latest', async (req, res) => {
  try {
    const latest = await get(
      'SELECT id, temperature, humidity, created_at FROM sensor_readings ORDER BY id DESC LIMIT 1'
    );

    // Calculate min, max, avg for temperature & humidity (last 24 hours or last 100 readings)
    const stats = await get(`
      SELECT 
        COUNT(id) as total_readings,
        ROUND(AVG(temperature), 1) as avg_temp,
        ROUND(MIN(temperature), 1) as min_temp,
        ROUND(MAX(temperature), 1) as max_temp,
        ROUND(AVG(humidity), 1) as avg_hum,
        ROUND(MIN(humidity), 1) as min_hum,
        ROUND(MAX(humidity), 1) as max_hum
      FROM sensor_readings
    `);

    let formattedLatest = null;
    if (latest) {
      const istTime = formatToIST(latest.created_at);
      formattedLatest = {
        id: latest.id,
        temperature: latest.temperature,
        humidity: latest.humidity,
        date: istTime.date,
        time: istTime.time,
        raw_created_at: latest.created_at
      };
    }

    return res.json({
      success: true,
      latest: formattedLatest,
      stats: stats || {}
    });
  } catch (error) {
    console.error('Error fetching latest sensor data:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sensor data.' });
  }
});

// GET Paginated Sensor Records (Show latest records first, 20 per page)
app.get('/api/sensor-data/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countRow = await get('SELECT COUNT(id) as count FROM sensor_readings');
    const totalRecords = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const rows = await query(
      'SELECT id, temperature, humidity, created_at FROM sensor_readings ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const records = rows.map((r, index) => {
      const ist = formatToIST(r.created_at);
      return {
        rowNumber: offset + index + 1,
        id: r.id,
        temperature: r.temperature,
        humidity: r.humidity,
        date: ist.date,
        time: ist.time,
        raw_created_at: r.created_at
      };
    });

    return res.json({
      success: true,
      records,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve records.' });
  }
});

// GET Chart Data (Last 30 readings in chronological order for graphs)
app.get('/api/sensor-data/chart-data', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const rows = await query(
      'SELECT id, temperature, humidity, created_at FROM sensor_readings ORDER BY id DESC LIMIT ?',
      [limit]
    );

    // Reverse to chronological order (oldest -> newest) for charting
    const chronological = rows.reverse().map((r) => {
      const ist = formatToIST(r.created_at);
      return {
        id: r.id,
        temperature: r.temperature,
        humidity: r.humidity,
        time: ist.time,
        date: ist.date
      };
    });

    return res.json({
      success: true,
      data: chronological
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve chart data.' });
  }
});

// DELETE Single Sensor Record
app.delete('/api/sensor-data/:id', async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    if (!recordId) {
      return res.status(400).json({ success: false, message: 'Invalid record ID.' });
    }

    const result = await run('DELETE FROM sensor_readings WHERE id = ?', [recordId]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    return res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting record:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete record.' });
  }
});

// ==========================================
// 3. DEVICE AUTOMATION (LCD & LED) ENDPOINTS
// ==========================================

// GET Current Device State (Web Dashboard)
app.get('/api/device/state', async (req, res) => {
  try {
    const state = await get('SELECT * FROM device_state WHERE id = 1');
    return res.json({
      success: true,
      data: state || {
        led_state: 0,
        lcd_line1: 'The super Girls',
        lcd_line2: 'IoT Monitoring'
      }
    });
  } catch (error) {
    console.error('Error fetching device state:', error);
    return res.status(500).json({ success: false, message: 'Failed to get device state.' });
  }
});

// POST Toggle LED (Web Dashboard)
app.post('/api/device/led', async (req, res) => {
  try {
    let { state } = req.body;
    state = state ? 1 : 0;

    await run(
      'UPDATE device_state SET led_state = ?, updated_at = datetime("now") WHERE id = 1',
      [state]
    );

    return res.json({
      success: true,
      message: `LED turned ${state === 1 ? 'ON' : 'OFF'} successfully.`,
      led_state: state
    });
  } catch (error) {
    console.error('Error updating LED:', error);
    return res.status(500).json({ success: false, message: 'Failed to update LED state.' });
  }
});

// POST Update LCD (Web Dashboard)
app.post('/api/device/lcd', async (req, res) => {
  try {
    let { line1, line2 } = req.body;

    // Sanitize and limit to 16 characters per line for 16x2 LCD
    line1 = (line1 !== undefined ? String(line1) : '').substring(0, 16);
    line2 = (line2 !== undefined ? String(line2) : '').substring(0, 16);

    await run(
      'UPDATE device_state SET lcd_line1 = ?, lcd_line2 = ?, updated_at = datetime("now") WHERE id = 1',
      [line1, line2]
    );

    return res.json({
      success: true,
      message: 'LCD message updated successfully.',
      lcd_line1: line1,
      lcd_line2: line2
    });
  } catch (error) {
    console.error('Error updating LCD:', error);
    return res.status(500).json({ success: false, message: 'Failed to update LCD display.' });
  }
});

// Lightweight ESP8266 sync endpoint (Polls LED & LCD in one fast request)
app.get('/api/device/sync', verifyDeviceKey, async (req, res) => {
  try {
    const state = await get('SELECT led_state, lcd_line1, lcd_line2 FROM device_state WHERE id = 1');
    if (!state) {
      return res.json({
        led: 0,
        l1: 'The super Girls',
        l2: 'IoT Ready'
      });
    }

    return res.json({
      led: state.led_state,
      l1: state.lcd_line1 || '',
      l2: state.lcd_line2 || ''
    });
  } catch (error) {
    console.error('Error syncing device:', error);
    return res.status(500).json({ error: 'Device sync failed' });
  }
});

// Fallback for SPA routing
app.use((req, res) => {
  // If requesting api, 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 The super Girls IoT Server running on port ${PORT}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`📡 Timezone: Asia/Kolkata (IST +5:30)`);
  console.log(`====================================================`);
});
