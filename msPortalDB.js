const mssql = require('mssql');

const config = {
  user: "portal",
  password: "Ortal123*",
  server: "ERPSERVER",
  database: "Portal",
  options: {
    encrypt: true, // Gerekliyse şifreleme ayarını yapabilirsiniz
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
  sqls: mssql,
  poolPromise
};

