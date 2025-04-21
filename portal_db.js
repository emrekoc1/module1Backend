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

const portal_pool = new mssql.ConnectionPool(config);

module.exports = portal_pool

