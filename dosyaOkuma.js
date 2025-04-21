const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require("nodemailer");
const express = require('express');
const router = express.Router();
const cors = require('cors');
const { format } = require('date-fns');
const http = require('http');
const request = require('request');
router.use(cors());
const pool = require('./db'); // PostgreSQL yapılandırması
const { sql, poolPromise } = require('./mspoolKOKPIT'); // MSSQL yapılandırması
const multer = require('multer');
const transliteration = require('transliteration');
const QRCode = require('qrcode');
const directoryPath = '\\\\20.0.0.11\\Kalite Yönetim Sistemi\\Güncel Dokümanlar';
const kaliteDocs = multer.diskStorage({

    destination: (req, file, callBack) => {
        const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'kalite', 'assets', 'docs');
        //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
        callBack(null, destinationPath)
    },

    filename: (req, file, callBack) => {
        const bugun = new Date();
        const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
        const originalnameWithoutExtension = path.parse(file.originalname).name;
        const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
        callBack(null, `girisKalite_${tarihDamgasi}${transliteratedName}_${path.extname(file.originalname)}`);

    }

})
function copyFile(src, dest, callback) {
    fs.copyFile(src, dest, (err) => {
        if (err) {
            console.error(`Dosya kopyalanırken hata oluştu: ${err.message}`);
            callback(err);
        } else {
            callback(null);
        }
    });
}
function readFilesInDirectory(dir, destinationDir) {
    let structure = [];

    fs.readdirSync(dir, { withFileTypes: true }).forEach(file => {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
            // Alt dizinlerdeki dosyaları işle
            const newDestinationDir = path.join(destinationDir, file.name);
            fs.mkdirSync(newDestinationDir, { recursive: true }); // Klasörü oluştur
            structure.push({
                name: file.name,
                path: fullPath,
                type: 'directory',
                children: readFilesInDirectory(fullPath, newDestinationDir)
            });
        } else {
            const destFilePath = path.join(destinationDir, file.name);
            copyFile(fullPath, destFilePath, (err) => {
                if (err) {
                    console.error(`Dosya kopyalama hatası: ${err.message}`);
                }
            });

            structure.push({
                name: file.name,
                path: fullPath,
                type: 'file'
            });
        }
    });

    return structure;
}
function readFilesInDirectoryOkunacak(dir) {
    let structure = [];

    fs.readdirSync(dir, { withFileTypes: true }).forEach(file => {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
            structure.push({
                name: file.name,
                path: fullPath,
                type: 'directory',
                children: readFilesInDirectoryOkunacak(fullPath)
            });
        } else {
            structure.push({
                name: file.name,
                path: fullPath,
                type: 'file'
            });
        }
    });

    return structure;
}

function deleteFilesInDirectory(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            deleteFilesInDirectory(fullPath); // Alt dizinlerdeki dosyaları temizle
            fs.rmdirSync(fullPath); // Alt dizini sil
        } else {
            fs.unlinkSync(fullPath); // Dosyayı sil
        }
    });
}

router.post('/dosyaOku', cors(), async (req, res) => {
    try {
        const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'kalite', 'assets', 'docs','kalite_dokuman');
        // deleteFilesInDirectory(destinationPath);
        // const fileTree = readFilesInDirectory(directoryPath, destinationPath);
        // let fileTreeOku
        // if(fileTree.length){
        //   console.log("veri geldi")
          fileTreeOku = readFilesInDirectoryOkunacak(destinationPath);
        // }
        res.status(200).json({
            status: 200,
            data:fileTreeOku
        })
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

router.post('/dosyaOkuRefresh', cors(), async (req, res) => {
    try {
        const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'kalite', 'assets', 'docs','kalite_dokuman');
        deleteFilesInDirectory(destinationPath);
        const fileTree = readFilesInDirectory(directoryPath, destinationPath);
        let fileTreeOku
        if(fileTree.length){
        //   console.log("veri geldi")
          fileTreeOku = readFilesInDirectoryOkunacak(destinationPath);
        }
        res.status(400).json({
            status: 200,
            data:fileTreeOku
        })
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})
module.exports = router;
