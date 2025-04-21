const mssql = require('mssql');

const config = {
  user: "portal",
  password: "Ortal123*",
  server: "ERPSERVER",
  database: "Tiger3Ent",
  options: {
    encrypt: true,
    trustServerCertificate: true
  },
  pool: {
    max: 10, // Maksimum bağlantı sayısı
    min: 0,  // Minimum bağlantı sayısı
    idleTimeoutMillis: 30000 // Bağlantının boşa çıkma süresi (30 saniye)
  },
  requestTimeout: 180000, // Sorguların zaman aşımı süresi (60 saniye)
  connectionTimeout: 30000 // Bağlantı zaman aşımı süresi (30 saniye)
};

const poolPromises = new mssql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Connected to MSSQL');
    return pool;
  })
  .catch(err => {
    console.error('❌ MSSQL Connection Failed: ', err);
    throw err;
  });

module.exports = {
  sqls: mssql,
  poolPromises
};
