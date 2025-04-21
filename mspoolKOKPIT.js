const mssql = require('mssql');

const config = {
  user: "kokpit",
  password: "Aselsan5858*",
  server: "20.0.0.26",
  database: "MGEO_UPM",
  options: {
    encrypt: false, // Şifrelemeyi devre dışı bırak
    trustServerCertificate: true // Geçerli bir SSL/TLS sertifikası kullanıyorsanız 'true' olarak ayarlayabilirsiniz
  }
};

const poolPromise = new mssql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL');
    return pool;
  })
  .catch(err => {
    console.error('Database Connection Failed! Bad Config: ', err);
    throw err;
  });

module.exports = {
  sql: mssql,
  poolPromise
};
