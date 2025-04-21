const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '1234',
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  max: 10, // Maksimum bağlantı sayısı
  idleTimeoutMillis: 30000, // Boşta kalan bağlantıların süre aşımı (30 saniye)
  connectionTimeoutMillis: 30000 // Bağlantı zaman aşımı süresi (30 saniye)
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL Connection Error:', err);
});

module.exports = pool;
