
// const sql = require("mssql");

// // const pool = new Pool({
// //     server:"ERPSERVER",
// //     user:"portal",
// //     password : "Ortal123*",
// //     //host : "20.0.0.14",
// //     //port : 1433,
// //     database : "Portal"


// // });


//     // config for your database
//     var config = {
//         server:"ERPSERVER",
//         user:"portal",
//         password : "Ortal123*",
//         //host : "20.0.0.14",
//         //port : 1433,
//         database : "Portal",
//         encrypt: false
//     //     synchronize: true,
//     //     extra: {
//     //         encrypt: false,
//     //       trustServerCertificate: false,
//     //     }
//      };

//     // connect to your database
//     sql.connect(config, async function (err) {
//        });
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

const pool = new mssql.ConnectionPool(config);

module.exports = {
  pool
};


// module.exports=sql;