const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'iot_database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Sensor Readings table
    db.run(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create index on created_at for fast pagination
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sensor_created ON sensor_readings(created_at DESC)
    `);

    // Device state table (for LED and LCD)
    db.run(`
      CREATE TABLE IF NOT EXISTS device_state (
        id INTEGER PRIMARY KEY,
        led_state INTEGER DEFAULT 0,
        lcd_line1 TEXT DEFAULT 'The super Girls',
        lcd_line2 TEXT DEFAULT 'IoT Monitoring',
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Ensure default device_state exists
    db.run(`
      INSERT OR IGNORE INTO device_state (id, led_state, lcd_line1, lcd_line2, updated_at)
      VALUES (1, 0, 'The super Girls', 'IoT Monitoring', datetime('now'))
    `);

    // Check and seed initial sensor readings if empty
    db.get('SELECT COUNT(*) as count FROM sensor_readings', (err, row) => {
      if (!err && row && row.count === 0) {
        console.log('Seeding initial DHT11 sensor readings...');
        const stmt = db.prepare('INSERT INTO sensor_readings (temperature, humidity, created_at) VALUES (?, ?, datetime("now", ?))');
        const seedData = [
          [28.5, 62.0, '-50 minutes'],
          [28.8, 61.5, '-45 minutes'],
          [29.0, 60.8, '-40 minutes'],
          [29.2, 59.5, '-35 minutes'],
          [29.6, 58.2, '-30 minutes'],
          [30.1, 57.0, '-25 minutes'],
          [30.4, 56.4, '-20 minutes'],
          [30.2, 57.2, '-15 minutes'],
          [29.8, 58.5, '-10 minutes'],
          [29.4, 60.1, '-5 minutes'],
          [29.1, 61.4, '-1 minutes']
        ];
        seedData.forEach(([temp, hum, offset]) => {
          stmt.run(temp, hum, offset);
        });
        stmt.finalize();
      }
    });
  });
}

// Promise helpers for clean async/await
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Convert UTC SQLite timestamp into Asia/Kolkata (+5:30) formatted strings
function formatToIST(utcDateString) {
  if (!utcDateString) return { date: '-', time: '-', full: '-' };
  // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' in UTC
  const utcDate = new Date(utcDateString.replace(' ', 'T') + 'Z');
  
  const optionsDate = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  
  const optionsTime = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };

  try {
    const datePart = new Intl.DateTimeFormat('en-GB', optionsDate).format(utcDate); // DD/MM/YYYY
    const timePart = new Intl.DateTimeFormat('en-US', optionsTime).format(utcDate); // hh:mm:ss AM/PM
    return {
      date: datePart,
      time: timePart,
      full: `${datePart} ${timePart}`
    };
  } catch (e) {
    return {
      date: utcDateString.split(' ')[0] || utcDateString,
      time: utcDateString.split(' ')[1] || utcDateString,
      full: utcDateString
    };
  }
}

module.exports = {
  db,
  query,
  get,
  run,
  formatToIST
};
