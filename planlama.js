const axios = require('axios');
const nodemailer = require("nodemailer");
const express = require('express');
const router = express.Router();
const cors = require('cors');
const { format } = require('date-fns');
const http = require('http');
const request = require('request')
router.use(cors());
const pool = require('./db');
const fs = require("fs");

const { Console, table } = require('console');
router.get('/token', (req, res) => {
    getToken((error, access_token) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(access_token);
    });
});

const smtpTransport = require('nodemailer-smtp-transport');
const transporter = nodemailer.createTransport(smtpTransport({
    host: '10.0.0.37', // Exchange sunucu adresinizi buraya ekleyin
    port: 25, // Exchange sunucunuzun SMTP portunu buraya ekleyin
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'bilgi@aho.com.tr',
        pass: 'Blgaho58*'
    },
    tls: {
        rejectUnauthorized: false, // Güvenilmeyen sertifikaları kabul etmek için
        ciphers: 'SSLv3'
    }
}));

const mailOptions = {
    from: "ekoc@aho.com.tr", // Gönderen e-posta adresi
    to: "ekoc@aho.com.tr", // Alıcı e-posta adresi
    subject: 'Test Email', // E-posta konusu
    text: 'Hello, this is a test email!' // E-posta içeriği
};

router.post('/mailGonderkk', async (req, res) => {
    try {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).send('Error sending email: ' + error.message);
            }
            console.log('Email sent:', info.response);
            res.status(200).send('Email sent: ' + info.response);
        });
    } catch (error) {
        console.error('Mail Gönderme Hatası Alındı:', error);
        res.status(500).send('Mail Gönderme Hatası Alındı: ' + error.message);
    }
});
const EWS = require('node-ews');
const ntlm = require('ntlm-client'); // ntlm-client modülü ekleniyor
function getToken(callback) {
    const tokenOptions = {
        method: 'GET',
        url: 'http://20.0.0.14:32001/api/v1/token',
        headers: {
            Authorization: 'Basic TEVWRUxCSUxJU0lNOkdiVUNoeEU3elFUdzJYWWNjdHdzcTZTQkUzODdLQmF1dE94RWNScnR6cFE9',
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: 'grant_type=password&username=level&firmno=224&password=l123456*'
    };

    request(tokenOptions, function (error, response, body) {

        if (error) {
            callback(error, null);

            return;
        }
        const access_token = JSON.parse(body); // access_token değerini al
        callback(null, access_token);
    });
}
function getToken2() {
    return new Promise((resolve, reject) => {
        const tokenOptions = {
            method: 'GET',
            url: 'http://20.0.0.14:32001/api/v1/token',
            headers: {
                Authorization: 'Basic TEVWRUxCSUxJU0lNOkdiVUNoeEU3elFUdzJYWWNjdHdzcTZTQkUzODdLQmF1dE94RWNScnR6cFE9',
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: 'grant_type=password&username=level&firmno=224&password=l123456*'
        };

        request(tokenOptions, function (error, response, body) {
            if (error) {
                reject(error);
                return;
            }
            const access_token = JSON.parse(body); // access_token değerini al
            resolve(access_token);
        });
    });
}
router.post('/uretimEmriGet', cors(), (req, res) => {
    const code = req.body.code
    const code2 = req.body.code2
    let uretimEmri
    if (code !== null && code2 !== null) {
        getToken((error, access_token) => {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const urlUretimEmri = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM PLANLAMA_URETIM_DETAY WHERE KOD1 = '${code}'  AND LPRODSTAT='0' AND TRCODE = '12' AND KOD2 = '${code2}' `; // API endpointini doğru şekilde belirtin
            const optionsUretimEmri = {
                method: 'GET',
                url: urlUretimEmri,
                headers: {
                    Authorization: `Bearer ${access_token.access_token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            };
            request(optionsUretimEmri, function (error, response, body) {
                if (error) {
                    console.error(error);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                const parsedBody = JSON.parse(body);

                uretimEmriParse = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın
                const acikSiparisler = uretimEmriParse.filter(siparis => {
                    // Varsayılan olarak, 'TARİH' alanındaki değer 'gg.aa.yyyy' formatında
                    const tarih = siparis['FICHENO'];

                    // Eğer tarih 'gg.aa.yyyy' formatında değilse veya 'TARİH' boşsa bu öğeyi filtre dışı bırak



                    return siparis['KOD1'] !== null && tarih !== null && siparis['KOD2'] !== null;
                });
                res.json(acikSiparisler);

                // İşlenen veriyi JSON olarak yanıt olarak gönderin
            });

        });
    }
});
router.post('/getSat', cors(), (req, res) => {
    const code = req.body.code
    const code2 = req.body.code2
    getToken((error, access_token) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const encodedQuery = encodeURIComponent(`SELECT * FROM [PLANLAMA_TALEP_SIPARIS_225] WHERE [TALEP DURUMU] <> 'KARŞILANDI' AND [SİPARİŞ NO]=null  AND [MALZEME KODU]='${code}'`);
        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${encodedQuery}`;
        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const parsedBody = JSON.parse(body);

            siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın


            res.json(siparisler); // İşlenen veriyi JSON olarak yanıt olarak gönderin
        });
    });
});
router.post('/mailYaz', cors(), async (req, res) => {
    try {
        const fs = require('fs');
        const dosyaAdi = 'mailGonder.json';
        const yeniVeri = req.body.gm;
        const toGelen = req.body.to
        const cc = req.body.cc
        const subject = req.body.subject

        const mailBilgi = {
            to: toGelen,
            cc: cc,
            subject: subject,
            body: yeniVeri
        };
        fs.readFile(dosyaAdi, 'utf8', (err, data) => {
            if (err) {
                fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                    if (err) {
                        console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                    } else {

                    }
                });
            } else {
                fs.unlink(dosyaAdi, (err) => {
                    if (err) {
                        console.error("Dosya silinirken bir hata oluştu.", err);
                    } else {
                        fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                            if (err) {
                                console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                            } else {
                                console.log("mail yazıldı")
                                let data = {

                                    To: toGelen,
                                    CC: cc,
                                    Subject: subject,
                                    Body: yeniVeri
                                }
                                let config = {
                                    method: 'post',
                                    maxBodyLength: Infinity,
                                    url: 'http://localhost:5004/api/Home/sendMail',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    data: data
                                };

                                axios.request(config)
                                    .then((response) => {
                                        console.log("dataGonderildi");
                                    })
                                    .catch((error) => {
                                        console.log(error);
                                    });
                            }
                        });
                    }
                });
            }
        });
        res.json({
            bomlist: yeniVeri,
            status: 200
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/dataoku', cors(), async (req, res) => {
    try {
        const fs = require('fs');
        // Dosya adı
        const dosyaAdi = 'mailGonder.json';
        let gm = ""
        fs.readFile(dosyaAdi, 'utf8', (err, data) => {
            if (err) {
                console.error("Dosyayı okuma sırasında bir hata oluştu.", err);
            } else {
                // Dosyadan okunan veriyi satır bazında ayırma
                const parsedData = JSON.parse(data);
                console.log("asdasd", parsedData)
                // İşlenmiş verileri kullanma örneği
                console.log("TO:", parsedData.to);
                console.log("CC:", parsedData.cc);
                console.log("Subject:", parsedData.subject);
                // console.log("Mail İçeriği:", parsedData.body);
                let datass = {
                    to: parsedData.to,
                    cc: parsedData.cc,
                    subject: parsedData.subject,
                    body: parsedData.body
                }
                res.json(
                    datass

                );
            }

        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/bomCek2', cors(), async (req, res) => {
    try {
        const { ay_1, ay_2, ay_3, ay_4, ay_5, ay_6, ay_7, ay_8, ay_9, ay_10, ay_11, ay_12, diger } = req.body;
        const code = req.body.code.toString();
        const access_token = await getToken2();

        const fetchBomData = async (kod) => {
            const bomUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM BOM_SATIR_225() WHERE KOD = '${kod}'`;
            const bomOptions = {
                method: 'GET',
                url: bomUrl,
                headers: {
                    Authorization: `Bearer ${access_token.access_token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            };

            const bomResponse = await axios(bomOptions);
            return bomResponse.data.items || [];
        };

        const processBomLevel = async (bomList, level) => {
            const result = [];

            for (const element of bomList) {
                element.level = level;

                if (element.BOMAD2 != null && element.ALTKOD != null && element.ALTKOD !== "") {
                    const subComponentData = await fetchBomData(element.ALTKOD);
                    const processedSubComponents = await processBomLevel(subComponentData, level + 1);
                    result.push(...processedSubComponents);
                }
            }

            // Döngü sonunda sadece ana elemanı ekle
            result.push(...bomList);

            return result;
        };

        // İlk seviye
        const initialBomList = await fetchBomData(code);

        // Diğer seviyeler
        const bomlist = await processBomLevel(initialBomList, 0);

        // gelen Bom listi database kaydecek
        // eski bomu bul ve sil
        const selectBom = await pool.query(`Select * from p_target_bom WHERE siparis_urun = '${code}'`)
        if (selectBom.rowCount > 0) {
            const deleteBom = await pool.query(`DELETE FROM p_target_bom WHERE siparis_urun = '${code}'`)
        }

        // yenisini insert edilecek
        bomlist.forEach(async element => {
            const insertNewBom = await pool.query(`INSERT INTO p_target_bom(
          ust_kod, ust_malzeme, kod, malzeme, miktar, birim, seviye, ay_1, ay_2, ay_3, ay_4, ay_5, ay_6, ay_7, ay_8, ay_9, ay_10, ay_11, ay_12, diger, siparis_urun)
         VALUES ('${element.KOD}',' ${element.MALZEME}', '${element.ALTKOD}', '${element.ALTMALZEME}', ${element.MIKTAR}, '${element.BIRIM}', ${element.level}, ${ay_1}, ${ay_2},
           ${ay_3}, ${ay_4}, ${ay_5}, ${ay_6}, ${ay_7}, ${ay_8}, ${ay_9}, ${ay_10}, ${ay_11}, ${ay_12}, ${diger}, '${code}')`)
        });




        res.json({
            bomlist: bomlist,
            status: 200
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/operasyonSureli2', cors(), async (req, res) => {

    const jsonBomList = fs.readFileSync('mrpuretim.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);

    try {
        const dataBom = []

        for (let index = 0; index < sqlData.length; index++) {

            const desiredId = sqlData[index].ROUT_CODE;
            const rotaData = await rotuerGet(desiredId); // ID parametresini gönderin

            for (let element = 0; element < rotaData.length; element++) {
                dataBom.push(
                    {
                        code: sqlData[index].CODE,
                        NAME: sqlData[index].NAME,
                        urunKodu: sqlData[index].urunKodu,
                        urunaciklamasi: sqlData[index].urunaciklamasi,
                        VALIDREVREF: sqlData[index].VALIDREVREF,
                        VALIDREVREF: sqlData[index].VALIDREVREF,
                        BOMMASTERREF: sqlData[index].BOMMASTERREF,
                        REV_DATA_REFERENCE: sqlData[index].REV_DATA_REFERENCE,
                        MP_CODE: sqlData[index].MP_CODE,
                        MP_NAME: sqlData[index].MP_NAME,
                        ROUT_CODE: sqlData[index].ROUT_CODE,
                        ROUT_NAME: sqlData[index].ROUT_NAME,
                        INTERNAL_REFERENCE: sqlData[index].INTERNAL_REFERENCE,
                        DATA_REFERENCE: sqlData[index].DATA_REFERENCE,
                        LOGICALREF: sqlData[index].LOGICALREF,
                        DATA_REFERENCE: sqlData[index].DATA_REFERENCE,
                        LINENO_: rotaData[element].LINENO_,
                        istasyonname: rotaData[element].istasyonname,
                        istasyonkod: rotaData[element].istasyonkod,
                        op_code: rotaData[element].op_code,
                        kuyrukZaman: rotaData[element].kuyrukZaman,
                        kontrolzaman: rotaData[element].kontrolzaman,
                        iscilikSuresi: rotaData[element].islemzaman,
                        islem_miktari: rotaData[element].islem_miktari,
                        oponcesibekleme: rotaData[element].makinazamani,
                        makinazamani: rotaData[element].oponcesibekleme,
                        makinapartimiktari: rotaData[element].makinapartimiktari
                    }
                )
            }

        }




        res.json(dataBom);

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/itemsBomGetir', cors(), async (req, res) => {
    const jsonBomList = fs.readFileSync('mrpuretim.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    try {
        const dataBom = []
        for (let index = 0; index < sqlData.length; index++) {
            const desiredId = sqlData[index].urunRef;
            const bomData = await itemsBul(desiredId); // ID parametresini gönderin
            dataBom.push({
                LOGICALREF: bomData[0].LOGICALREF
            })
        }
        res.json(dataBom);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/kapasitePlanHesapla', cors(), async (req, res) => {

    const jsonBomList = fs.readFileSync('mrpdata.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);


    let itemsRef = []
    let bomsRef = []
    let bomsGetRotali = []
    try {
        let dataGelenIndex = 0
        const dataBom = []
        for (let mrpVeri of sqlData) {
            const desiredId = mrpVeri.malzeme_kodu;

            //items bulacak

            itemsRef = await itemRefBul(desiredId)
            bomsRef = await bomRefBul(itemsRef[0].LOGICALREF)
            // //ref e göre bom bulacak
            // //bom restapiden bom  ve rotaları getirecek
            // //rotaların operasyonları gelecek
            if (mrpVeri.karsılama_turu != 'Satınalma') {
                for (let bomrefDon of bomsRef) {

                    let bomrefDatass = bomrefDon.LOGICALREF
                    let ay = mrpVeri.ihtiyac_tarihi.split('/')[1]
                    let yil = mrpVeri.ihtiyac_tarihi.split('/')[2]
                    if (bomrefDatass < 99999 && bomrefDatass > 999) {
                        bomsGetRotali = await bomListFonksiyon(bomrefDon.LOGICALREF)
                        if (bomsGetRotali.ROUT_CODE != 'FASON') {
                            const rotaData = await rotuerGet(bomsGetRotali.ROUT_CODE);
                            for (let element of rotaData) {
                                dataBom.push(
                                    {
                                        code: bomsGetRotali.CODE,
                                        urun_kod: mrpVeri.malzeme_kodu,
                                        urun_aciklama: mrpVeri.aciklama,
                                        ihtiyac_miktar: mrpVeri.ihtiyac_miktar,
                                        ay: ay,
                                        yil: yil,
                                        bom_name: bomsGetRotali.NAME,
                                        revizyon_id: bomsGetRotali.VALIDREVREF,
                                        urun_id: bomsGetRotali.MAINPRODREF,
                                        bom_id: bomsGetRotali.BOMMASTERREF,
                                        o_kod: bomsGetRotali.MP_CODE,
                                        o_name: bomsGetRotali.MP_NAME,
                                        rota_kod: bomsGetRotali.ROUT_CODE,
                                        rota_name: bomsGetRotali.ROUT_NAME,
                                        satir_no: element.LINENO_,
                                        istasyonname: element.istasyonname,
                                        istasyonkod: element.istasyonkod,
                                        atolye: element.atolye,
                                        op_code: element.op_code,
                                        hazirlik: element.hazirlik,
                                        iscilik_suresi: element.islemzaman,
                                        islem_miktari: element.islem_miktari,
                                        oponcesibekleme: element.makinazamani,
                                        makinazamani: element.oponcesibekleme,
                                        makinapartimiktari: element.makinapartimiktari,
                                        dataGelenIndex: dataGelenIndex

                                    }
                                )

                            }
                        }

                    }
                }
            }
            dataGelenIndex += 1
        }


        const dataDelete = await pool.query(`DELETE FROM p_operasyon_kapasite `)
        for (let insterForData of dataBom) {
            const insertDataSourch = await pool.query(`INSERT INTO public.p_operasyon_kapasite(
        grup_id,urun_kod, urun_aciklama, ihtiyac_miktar, ay, yil, bom_name, revizyon_id, urun_id, bom_id, o_kod, o_name, rota_kod, rota_name, satir_no, istasyonname, istasyonkod, atolye, operasyon_code, hazirlik, iscilik_suresi, islem_miktari, oponcesibekleme, makinazamani, makinapartimiktari)
       VALUES (${insterForData.dataGelenIndex},'${insterForData.urun_kod}',
       '${insterForData.urun_aciklama}',
        ${insterForData.ihtiyac_miktar},
        ${parseInt(insterForData.ay)},
        ${parseInt(insterForData.yil)},
        '${insterForData.bom_name}',
        ${insterForData.revizyon_id},
        ${insterForData.urun_id},
        ${insterForData.bom_id},
        '${insterForData.o_kod}',
        '${insterForData.o_name}',
        '${insterForData.rota_kod}',
        '${insterForData.rota_name}',
        ${insterForData.satir_no},
        '${insterForData.istasyonname}',
        '${insterForData.istasyonkod}',
        '${insterForData.atolye}',
        '${insterForData.op_code}',
        ${insterForData.hazirlik},
        ${insterForData.iscilik_suresi},
        ${insterForData.islem_miktari},
        ${insterForData.oponcesibekleme},
        ${insterForData.makinazamani},
        ${insterForData.makinapartimiktari} )`)

        }
        const dataSelectAll = await pool.query(`SELECT SUM(ihtiyac_miktar),urun_kod FROM (
            select grup_id,urun_kod, sum(ihtiyac_miktar) as toplam, ihtiyac_miktar from p_operasyon_kapasite GROUP BY grup_id,ihtiyac_miktar,urun_kod
        ) as gor GROUP BY urun_kod
        `)
        for (let datadon of dataSelectAll.rows) { const updateData = await pool.query(`UPDATE p_operasyon_kapasite SET  toplam_ihtiyac = ${datadon.sum} WHERE urun_kod ='${datadon.urun_kod}'`) }
        res.json(dataBom);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/vardiyaGet', cors(), async (req, res) => {



    try {

        const getVardiya = await pool.query(`SELECT * FROM p_vardiya_bilgileri `)
        res.json({ status: 200, data: getVardiya.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/vardiyaGuncele', cors(), async (req, res) => {
    const { vardiya1,
        vardiya2,
        gunlukv1,
        gunlukv2,
        yil_sure,
        atelye } = req.body

    try {

        const getVardiya = await pool.query(`UPDATE p_vardiya_bilgileri
        SET  vardiya1=${parseInt(vardiya1)}, vardiya2=${parseInt(vardiya2)}, gunlukv1=${gunlukv1}, gunlukv2=${gunlukv2}, yil_sure=${yil_sure}
        WHERE atelye='${atelye}'`)
        res.json({ status: 200, data: getVardiya.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/getKabaKapasiteAtelye', cors(), async (req, res) => {
    const { data } = req.body
    try {
        const getData = await pool.query(`SELECT
        tablo1.atolye, tablo1.urun_kod, tablo1.urun_aciklama, tablo1.operasyon_code,
        tablo1.hazirlik, tablo1.iscilik_suresi, tablo1.islem_miktari,
        tablo1.oponcesibekleme, tablo1.makinazamani, tablo1.makinapartimiktari,
        tablo1.toplam_ihtiyac

    FROM p_operasyon_kapasite tablo1
    INNER JOIN (
        SELECT
            grup_id, urun_kod, urun_aciklama, ihtiyac_miktar
        FROM p_operasyon_kapasite
        GROUP BY grup_id, urun_kod, urun_aciklama, ihtiyac_miktar
    ) AS tablo2 ON tablo1.urun_kod = tablo2.urun_kod
    WHERE tablo1.atolye LIKE '%${data}%'
    GROUP BY
        tablo1.atolye, tablo1.urun_kod, tablo1.urun_aciklama,
        tablo1.operasyon_code, tablo1.hazirlik, tablo1.iscilik_suresi,
        tablo1.islem_miktari, tablo1.oponcesibekleme, tablo1.makinazamani,
        tablo1.makinapartimiktari,tablo1.toplam_ihtiyac
    ORDER BY tablo1.urun_kod

 `)
        const getDataRow = getData.rows
        res.json({ status: 200, data: getDataRow })
    } catch (error) {
        console.error(error)
    }
})
router.post('/getKabaKapasiteAll', cors(), async (req, res) => {
    try {
        //const {projeler} =req.body
        const projeler = [
            {
                atelye: "Gündüz Görüş",

            },
            {
                atelye: "Gece Görüş",

            },
            {
                atelye: "Termal Sistemler",

            },
            {
                atelye: "Optik",
            },
            {
                atelye: "Mekanik",
            },
            {
                atelye: "Test Sistemleri",
            }
        ]
        let dataArray = []
        for (let dongu of projeler) {
            const getData = await pool.query(`	SELECT urun_kod,
            urun_aciklama,
            operasyon_code,
            hazirlik,
            iscilik_suresi,
            islem_miktari,
            oponcesibekleme,
            makinazamani,
            makinapartimiktari,
            toplam_ihtiyac,COUNT(*)
            FROM p_operasyon_kapasite
            WHERE atolye  like '%${dongu.atelye}%'
             GROUP BY atolye,
             urun_kod,
             urun_aciklama,
             operasyon_code,
             hazirlik,
             iscilik_suresi,
             islem_miktari,
             oponcesibekleme,
             makinazamani,
             makinapartimiktari,
             toplam_ihtiyac `)
            const getDataRow = getData.rows
            let iscilikToplamSure = 0
            let makinaToplamSure = 0
            for (let data of getDataRow) {
                let iscilikSure = data.iscilik_suresi >= (65536 * 256) ? ((data.iscilik_suresi / (65536 * 256)) * 60) : data.iscilik_suresi / 65536
                iscilikToplamSure = Math.ceil(iscilikToplamSure + iscilikSure * Math.ceil(data.toplam_ihtiyac / data.islem_miktari))
                if (data.oponcesibekleme > 0 && data.makinapartimiktari > 0) {

                    let makianSure = data.oponcesibekleme >= (65536 * 256) ? ((data.oponcesibekleme / (65536 * 256)) * 60) : data.oponcesibekleme / 65536
                    makinaToplamSure = Math.ceil(makinaToplamSure + makianSure * Math.ceil(data.toplam_ihtiyac / data.makinapartimiktari))
                }

            }
            dataArray.push({
                atolye: dongu.atelye,
                isclikSuresi: iscilikToplamSure,
                makinaSuresi: makinaToplamSure
            })
        }
        for (let dongu of projeler) {
            const getData = await pool.query(`SELECT "OPERASYON_REF", "ITEMREF", "SETUP_SURE", "ISCILIK_SURESI", "ISCILIK_PARTI", "MAKINA_PARTI", "MAKINA_SURE", "WSREF", "PLNAMOUNT", "ACTAMOUNT", istasyonname, istasyonkod, atolye FROM p_acik_uretim_emir
              WHERE atolye like '%${dongu.atelye}%'  GROUP BY "OPERASYON_REF", "ITEMREF", "SETUP_SURE", "ISCILIK_SURESI", "ISCILIK_PARTI", "MAKINA_PARTI", "MAKINA_SURE", "WSREF", "PLNAMOUNT", "ACTAMOUNT", istasyonname, istasyonkod, atolye
             `)
            const getDataRow = getData.rows
            let acikIsiscilikToplamSure = 0
            let acikIsmakinaToplamSure = 0
            for (let data of getDataRow) {
                let acikIsiscilikSure = (data.ISCILIK_SURESI >= (65536 * 256) ? ((data.ISCILIK_SURESI / (65536 * 256)) * 60) : data.ISCILIK_SURESI) / 65536
                acikIsiscilikToplamSure = Math.ceil(acikIsiscilikToplamSure + acikIsiscilikSure * Math.ceil((data.PLNAMOUNT - data.ACTAMOUNT) > 0 ? (data.PLNAMOUNT - data.ACTAMOUNT) : 1 / data.ISCILIK_PARTI))
                if (data.MAKINA_SURE > 0 && data.MAKINA_PARTI > 0) {

                    let acikIsmakianSure = (data.MAKINA_SURE >= (65536 * 256) ? ((data.MAKINA_SURE / (65536 * 256)) * 60) : data.MAKINA_SURE) / 65536
                    acikIsmakinaToplamSure = Math.ceil(acikIsmakinaToplamSure + acikIsmakianSure * Math.ceil((data.PLNAMOUNT - data.ACTAMOUNT) > 0 ? (data.PLNAMOUNT - data.ACTAMOUNT) : 1 / data.MAKINA_PARTI))
                }

            }
            const index = dataArray.findIndex(item => item.atolye === dongu.atelye);

            if (index !== -1) {
                // Bulunan indekse göre ilgili öğenin altına ilgili değerleri ekle
                dataArray[index].acikIsiscilikToplam = acikIsiscilikToplamSure;
                dataArray[index].acikIsmakinaToplam = acikIsmakinaToplamSure;
            }
        }







        res.json({ status: 200, data: dataArray })
    } catch (error) {
        console.error(error)
    }
})
router.post('/postNormalKapasite', cors(), async (req, res) => {

    const { ay, yil, birim, p_sayi, egitim, izin, mesai, gorev, parsecalisma_saat, gerceklesen_kapasite } = req.body
    let gunler = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    try {
        const bugun = new Date();

        const yil = bugun.getFullYear()
        let baslangic = yil + '-' + ay + '-' + '01'
        let bitis = yil + '-' + ay + '-' + gunler[ay]
        // let gecmisIs = await gecmisIsmerileri(baslangic, bitis)
        // console.log(gecmisIs)
        const selectKapasite = await pool.query(`SELECT gunlukv1 FROM p_vardiya_bilgileri`)
        let kapasiste = p_sayi * selectKapasite.rows[0].gunlukv1 * calisma_saat
        let normal = kapasiste - egitim - gorev + mesai - izin
        const insertAylikKapasite = await pool.query(`INSERT INTO p_normal_kapasite(
            ay, yil, birim, p_sayi, teorik_kapasite, egitim, izin, mesai, gorev, p_normal_kapasite, gerceklesen_kapasite)
           VALUES (${ay}, ${yil}, ${birim}, ${p_sayi}, ${kapasiste}, ${egitim}, ${izin}, ${mesai}, ${gorev}, ${normal}, ${gerceklesen_kapasite});`)

        res.json({ status: 200, data: insertAylikKapasite });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.get('/getBirimler', cors(), async (req, res) => {
    try {
        const selectKapasite = await pool.query(`SELECT atelye FROM p_vardiya_bilgileri`)

        res.json({ status: 200, data: selectKapasite.rows });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/getNormalKapasite', cors(), async (req, res) => {
    const ay = req.body.ay
    try {
        let gunler = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        let dataArray = []
        const selectKapasite = await pool.query(`SELECT * FROM p_normal_kapasite WHERE ay = ${ay}`)
        const datagelen = selectKapasite.rows
        const bugun = new Date();
        dataArray = datagelen
        const yil = bugun.getFullYear()
        let baslangic = yil + '-' + ay + '-' + '01'
        let bitis = yil + '-' + ay + '-' + gunler[ay]
        let gecmisIs = await gecmisIsmerileri(baslangic, bitis); // await eklemelisiniz

        for (let items of dataArray) {
            let filtreData = gecmisIs.filter((item) => item.atolye === items.birim);
            let toplamGerceklesenIscilik = 0
            let toplamGerceklesenMakina = 0
            for (let toplaDon of filtreData) {
                toplamGerceklesenIscilik += Math.ceil(toplaDon.CONSUMPAMNT / toplaDon.ISCILIK_PARTI) * toplaDon.ISCILIK_SURESI
                if (toplaDon.MAKINA_PARTI > 0 && toplaDon.MAKINA_SURE > 0) {
                    toplamGerceklesenMakina += Math.ceil(toplaDon.CONSUMPAMNT / toplaDon.MAKINA_PARTI) * toplaDon.MAKINA_SURE
                }
            }
            items.toplamMakina = toplamGerceklesenMakina
            items.toplamIscilik = toplamGerceklesenIscilik



        }
        res.json({ status: 200, data: dataArray });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/operasyonSureli', cors(), async (req, res) => {

    const jsonBomList = fs.readFileSync('veri.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);

    try {
        const dataBom = []

        for (let index = 0; index < sqlData.length; index++) {
            const desiredId = sqlData[index].BOMREF;
            const bomData = await bomListFonksiyon(desiredId); // ID parametresini gönderin


            dataBom.push(
                {
                    code: bomData.CODE,
                    urunKodu: sqlData[index].MALZEMEkOD,
                    urunaciklamasi: sqlData[index].ACİKLAMA,
                    NAME: bomData.NAME,
                    VALIDREVREF: bomData.VALIDREVREF,
                    VALIDREVREF: bomData.VALIDREVREF,
                    BOMMASTERREF: bomData.BOMMASTERREF,
                    REV_DATA_REFERENCE: bomData.REV_DATA_REFERENCE,
                    MP_CODE: bomData.MP_CODE,
                    MP_NAME: bomData.MP_NAME,
                    ROUT_CODE: bomData.ROUT_CODE,
                    ROUT_NAME: bomData.ROUT_NAME,
                    INTERNAL_REFERENCE: bomData.INTERNAL_REFERENCE,
                    DATA_REFERENCE: bomData.DATA_REFERENCE,
                    LOGICALREF: bomData.LOGICALREF,
                    DATA_REFERENCE: bomData.DATA_REFERENCE,

                }
            )

        }


        // operasyonData = []
        // for (let index = 0; index < dataBom.length; index++) {
        //   const rotaData = await rotuerGet(bomData[index].MP_CODE); // ID parametresini gönderin

        //   for (let element = 0; element < rotaData.length; element++) {
        //     operasyonData.push(
        //       {
        //         code: dataBom[index].CODE,
        //         NAME: dataBom[index].NAME,
        //         VALIDREVREF: dataBom[index].VALIDREVREF,
        //         VALIDREVREF: dataBom[index].VALIDREVREF,
        //         BOMMASTERREF: dataBom[index].BOMMASTERREF,
        //         REV_DATA_REFERENCE: dataBom[index].REV_DATA_REFERENCE,
        //         MP_CODE: dataBom[index].MP_CODE,
        //         MP_NAME: dataBom[index].MP_NAME,
        //         ROUT_CODE: dataBom[index].ROUT_CODE,
        //         ROUT_NAME: dataBom[index].ROUT_NAME,
        //         INTERNAL_REFERENCE: dataBom[index].INTERNAL_REFERENCE,
        //         DATA_REFERENCE: dataBom[index].DATA_REFERENCE,
        //         LOGICALREF: dataBom[index].LOGICALREF,
        //         DATA_REFERENCE: dataBom[index].DATA_REFERENCE,
        //         LINENO_: rotaData[element].LINENO_,
        //         istasyonname: rotaData[element].istasyonname,
        //         istasyonkod: rotaData[element].istasyonkod,
        //         op_code: rotaData[element].op_code,
        //         kuyrukZaman: rotaData[element].kuyrukZaman,
        //         kontrolzaman: rotaData[element].kontrolzaman,
        //         islemzaman: rotaData[element].islemzaman,
        //         oponcesibekleme: rotaData[element].oponcesibekleme
        //       }
        //     )

        //   }

        // }



        res.json(dataBom);

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
async function itemRefBul(id) {
    try {
        const access_token = await getToken2(); // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        // const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM LG_225_BOMASTER boms WHERE boms.MAINPRODREF = ${id}'`; // id parametresi kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT LOGICALREF FROM LG_225_ITEMS bomss where  bomss.CODE = '${id}'`; // id parametresi kullanılmalı

        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let router = initialResponse.data.items || [];
        return router; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}
async function bomRefBul(id) {
    try {
        const access_token = await getToken2(); // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        // const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM LG_225_BOMASTER boms WHERE boms.MAINPRODREF = ${id}'`; // id parametresi kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT LOGICALREF FROM LG_225_BOMASTER bomss where  bomss.MAINPRODREF = '${id}'`; // id parametresi kullanılmalı

        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let router = initialResponse.data.items || [];
        return router; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}
async function itemsBul(id) {
    try {
        const access_token = await getToken2(); // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        // const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM LG_225_BOMASTER boms WHERE boms.MAINPRODREF = ${id}'`; // id parametresi kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT bomss.* FROM LG_225_BOMASTER bomss where  bomss.MAINPRODREF = '${id}'`; // id parametresi kullanılmalı

        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let router = initialResponse.data.items || [];
        return router; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}
async function acikIsemriGenel(id) {
    try {
        const access_token = await getToken2(); // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT 
 FROM operasyon_tamamlama 

 WHERE STATUS = 1`; // id parametresi kullanılmalı
        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let router = initialResponse.data.items || [];
        return router; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}
async function gecmisIsmerileri(baslangic, bitis) {
    try {
        const access_token = await getToken2(); // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT *
 FROM operasyon_tamamlama WHERE BEGDATE<'${bitis} 'AND BEGDATE>'${baslangic}'`; // id parametresi kullanılmalı
        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let router = initialResponse.data.items || [];
        return router; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}
async function rotuerGet(id) {
    try {
        const access_token = await getToken2(); // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT
        rotl.*,worksta.NAME as istasyonname,worksta.CODE as istasyonkod,ozelKod.DEFINITION_ as atolye,
        oper.CODE as op_code,opq.FIXEDSETUPTIME as hazirlik,opq.RUNTIME as islemzaman,opq.BATCHQUANTITY as islem_miktari,opq.WAITBATCHTIME as makinazamani,opq.WAITBATCHQTY as makinapartimiktari,opq.HEADTIME as oponcesibekleme FROM LG_225_ROUTING rot INNER JOIN LG_225_RTNGLINE rotl ON rot.LOGICALREF = rotl.ROUTINGREF INNER JOIN LG_225_OPERTION oper ON rotl.OPERATIONREF = oper.LOGICALREF INNER JOIN LG_225_OPRTREQ opq ON oper.LOGICALREF= opq.OPERATIONREF INNER JOIN LG_225_WORKSTAT worksta ON worksta.LOGICALREF=opq.WSREF INNER JOIN LG_225_SPECODES ozelKod ON worksta.SPECODE=ozelKod.SPECODE AND rot.CODE = '${id}'`; // id parametresi kullanılmalı
        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let router = initialResponse.data.items || [];
        return router; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}

async function bomListFonksiyon(id) {
    try {
        const access_token = await getToken2(); // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/boms/${id}`; // id parametresi kullanılmalı
        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let bomlist = initialResponse.data || [];
        return bomlist; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}
function getTokenPromise() {
    return new Promise((resolve, reject) => {
        const tokenOptions = {
            method: 'GET',
            url: 'http://20.0.0.14:32001/api/v1/token',
            headers: {
                Authorization: 'Basic TEVWRUxCSUxJU0lNOkdiVUNoeEU3elFUdzJYWWNjdHdzcTZTQkUzODdLQmF1dE94RWNScnR6cFE9',
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: 'grant_type=password&username=level&firmno=224&password=l123456*'
        };

        request(tokenOptions, function (error, response, body) {
            if (error) {
                reject(error);
                return;
            }
            const access_token = JSON.parse(body); // access_token değerini al
            resolve(access_token);
        });
    });
}
const groupAndSumSiparisler = async (siparisler) => {
    const groupedSiparisler = {};
    try {
        const eskiSiparisleriSil = await pool.query(`DELETE FROM p_siparisler `);
    } catch (error) {
        console.error(error)
    }
    siparisler.forEach(async (siparis) => {
        const {
            'CARİ': cari,
            'SİPARİŞ NUMARASI': siparis_no,
            'MALZEME KODU': malzeme_kodu,
            'MALZEME AÇIKLAMASI': malzeme_aciklamasi,
            'SİPARİŞ ADETİ': siparis_adet,
            'AÇIK SİPARİŞ': acik_siparis,
            'SEVKEDİLEN ADET': sevk_adet,
            'TESLİM TARİHİ': teslim_tarih,
            'PROJE': proje
        } = siparis;

        const tarihParcalari = teslim_tarih.split('.');
        const ay = parseInt(tarihParcalari[1], 10);
        const yil = parseInt(tarihParcalari[2], 10);
        let teslim_tarihi
        if ((ay < 12 && yil <= 2023) || (ay <= 12 && yil <= 2022) || (yil < 2024)) {
            teslim_tarihi = "ESKİBORC"
        } else {
            const aylar = [
                'Ocak',
                'Şubat',
                'Mart',
                'Nisan',
                'Mayıs',
                'Haziran',
                'Temmuz',
                'Ağustos',
                'Eylül',
                'Ekim',
                'Kasım',
                'Aralık'
            ];
            teslim_tarihi = aylar[ay - 1]
        }
        try {

            const result = await pool.query(`INSERT INTO p_siparisler (proje, siparis_no, teslim_tarihi, takim, malzeme, malzeme_adi, musteri, miktar, sevk_edilen, acik_siparis) VALUES('${proje}','${siparis_no}','${teslim_tarihi}',''
      ,'${malzeme_kodu}','${malzeme_aciklamasi}','${cari}','${siparis_adet}','${sevk_adet}','${acik_siparis}')`);
            const data = result.rows;

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }

    });

    return Object.values("data");
};
router.post('/iliskiliUrunler', cors(), async (req, res) => {
    const code = req.body.code;
    try {
        const result = await pool.query('SELECT ust_kod as urunKodu,ust_malzeme as takimAciklamasi,siparis_urun as satis_urun,birim,miktar,p_target_bom.* FROM p_target_bom WHERE kod = $1', [code]);
        const data = result.rows;
        res.status(200).json({ status: 200, data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post('/localSiparisGet', cors(), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM p_local_duzenli_siparis');
        const data = result.rows;
        res.status(200).json({ status: 200, data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/localSiparisGetSingle', cors(), async (req, res) => {
    const proje = req.body.proje
    try {
        const result = await pool.query(`SELECT * FROM p_local_duzenli_siparis WHERE proje = '${proje}'`);
        const data = result.rows;
        res.status(200).json({ status: 200, data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.get('/satinAlma', cors(), (req, res) => {
    getToken((error, access_token) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT *FROM SATINALMA_SIPARIS_225 `; // API endpointini doğru şekilde belirtin
        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const parsedBody = JSON.parse(body);
            siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın


            res.json(siparisler); // İşlenen veriyi JSON olarak yanıt olarak gönderin
        });
    });
});
router.get('/siparisler/search', cors(), (req, res) => {
    const keyword = req.query.keyword ? req.query.keyword.toLowerCase() : '';
    const filteredSiparisler = transformedSiparisler.filter((siparis) => {
        const malzemeKodu = siparis.MALZEME_KODU ? siparis.MALZEME_KODU.toLowerCase() : '';
        const malzemeAciklamasi = siparis.MALZEME_AÇIKLAMASI ? siparis.MALZEME_AÇIKLAMASI.toLowerCase() : '';

        return malzemeKodu.includes(keyword) || malzemeAciklamasi.includes(keyword);
    });

    const afilteredSiparisler = filteredSiparisler.map((siparis) => {
        const {
            'MALZEME_KODU': MALZEME_KODU,
            'CARI': CARI,
            'MALZEME_ACIKLAMASI': MALZEME_ACIKLAMASI,
            'TOPLAM_SIPARIS_ADETI': TOPLAM_SIPARIS_ADETI,
            'TOPLAM_ACIK_SIPARIS': TOPLAM_ACIK_SIPARIS,
            'TOPLAM_SEVK_EDILEN_ADET': TOPLAM_SEVK_EDILEN_ADET
        } = siparis;

        return {
            MALZEME_KODU,
            CARI,
            MALZEME_ACIKLAMASI,
            TOPLAM_SIPARIS_ADETI,
            TOPLAM_ACIK_SIPARIS,
            TOPLAM_SEVK_EDILEN_ADET
        };
    });
    res.json(afilteredSiparisler);
});
pool.connect((error, client, release) => {
    if (error) {
        console.error('Veritabanına bağlanılamadı:', error);
    } else {
        release(); // Bağlantıyı serbest bırakın
    }
});
router.get('/projeksiyonData', cors(), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM targettable');
        const data = result.rows;
        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/getMRP', cors(), async (req, res) => {
    try {

        let aylar = [
            "Ocak",
            "Şubat",
            "Mart",
            "Nisan",
            "Mayıs",
            "Haziran",
            "Temmuz",
            "Ağustos",
            "Eylül",
            "Ekim",
            "Kasım",
            "Aralık"
        ]
        let resultAmbar
        const sayiDizisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
        let kontrol = [];

        for (const ay of aylar) {
            for (const oncelik of sayiDizisi) {
                const result1 = await pool.query('SELECT "urunKod",ay,onem,oncelik FROM targettable WHERE ay = $1 AND onem*oncelik = $2', [ay, oncelik]);
                const urun_listesi = result1.rows;
                if (urun_listesi.length > 0) {
                    for (const liste of urun_listesi) {
                        const result2 = await pool.query('SELECT * FROM p_target_bom WHERE anaurun= $1 AND ay = $2 AND oncelik = $3 AND onem = $4', [liste.urunKod, liste.ay, liste.oncelik, liste.onem]);
                        const data = result2.rows;
                        kontrol.push(data);
                    }
                }
            }
        }

        const access_token = await getTokenPromise();
        const encodedUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=${encodeURIComponent('SELECT * FROM AMBAR_TOPLAMLARI_225 WHERE MİKTAR >0 AND DEPO != \'Şube Tekrar Lens Deposu\' AND DEPO != \'AHO Hurda-Fire\' AND DEPO != \'Sevkiyat\' AND DEPO != \'Bakım Onarım Deposu\' AND DEPO != \'Ek Uygunsuzluk Deposu\' AND DEPO != \'İthalat Deposu\' AND DEPO != \'Aselsan Hurda-Fire Yansıtma\' AND DEPO != \'Rework Deposu\' AND DEPO != \'İade Deposu\' AND DEPO != \'Sabit Kıymet Deposu\' AND DEPO != \'Ankara AR-GE Üretim Deposu\' AND DEPO != \'Bilgi İşlem Deposu\' ')}`;

        const options = {
            method: 'GET',
            url: encodedUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }
            const groupedData = {};
            const parsedBody = JSON.parse(body);
            resultAmbar = parsedBody.items || [];
            resultAmbar.forEach((item) => {
                const kodu = item.KODU; // Örneğin, KODU değeri buradan alınacak
                const miktar = item.MİKTAR; // Örneğin, MIKTAR değeri buradan alınacak
                // Gruplanan veri var mı diye kontrol edelim
                if (!groupedData[kodu]) {
                    // Kodu ile yeni bir grup oluştur
                    groupedData[kodu] = {
                        KODU: kodu,
                        TOPLAM_MIKTAR: miktar,
                    };
                } else {
                    // Grup varsa mevcut toplam miktarı güncelle
                    groupedData[kodu].TOPLAM_MIKTAR += miktar;
                }
            });
            const resultAmbar1 = Object.values(groupedData);
            kontrol.forEach(innerArray => {
                innerArray.forEach(async item => {
                    let anaurunAmbar = 0;
                    let altTakimAmbar = 0;
                    let alturunAmbar = 0;

                    resultAmbar1.forEach(ambars => {

                        if (ambars.KODU === item.anaurun) {

                            anaurunAmbar = ambars.TOPLAM_MIKTAR;

                        }
                        if (ambars.KODU === item.alturun) {
                            altTakimAmbar = ambars.TOPLAM_MIKTAR;
                        }
                        if (ambars.KODU === item.alttakimkod) {
                            alturunAmbar = ambars.TOPLAM_MIKTAR;
                        }
                    });

                    const kullanilabilir = (anaurunAmbar * item.miktar) + (altTakimAmbar * item.miktar) + (alturunAmbar)
                    const kalanUrun = (anaurunAmbar * item.miktar) + (altTakimAmbar * item.miktar) + (alturunAmbar) - item.hedef;

                    resultAmbar1.forEach(ambars => {
                        if (ambars.KODU === item.alttakimkod) {
                            ambars.TOPLAM_MIKTAR -= item.hedef;
                        }
                    });

                    item.depo_durumu = kalanUrun;
                    const result = await pool.query('UPDATE p_target_bom SET depodurumu = $3 , kullanilan_depo = $4 WHERE id=$1 and targetid=$2', [item.id, item.targetid, item.depo_durumu, kullanilabilir]);
                });
            });

            kontrol.forEach(innerArray => {
                innerArray.forEach(async item => {
                    if (item.depo_durumu < 0) {
                        const result = await pool.query('UPDATE targettable SET kontrolet = false WHERE id=$1', [item.targetid]);


                    }
                });
            });
            res.status(200).json({ kontrol });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/ayPojeGet/:id', cors(), async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query('SELECT alttakimkod as urun,alturun as usttakim, anaurun ,siparis,hedef, seviye,id, targetid ,depodurumu,ay,kullanilan_depo FROM p_target_bom WHERE targetid = $1', [id]);
        const data = result.rows;
        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.get('/productDetail/:code', cors(), async (req, res) => {
    const id = req.params.code;
    try {

        const result = await pool.query('SELECT * FROM public.p_product_detail WHERE product_code = $1', [id]);
        const data = result.rows;

        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/getProductDetailAksiyon', cors(), async (req, res) => {
    try {

        const result = await pool.query(`SELECT * FROM p_product_detail_aksiyon WHERE product_detail_id = '${req.body.product_detail_id}'  `);
        const data = result.rows;

        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/localSatinAlmaAll', cors(), async (req, res) => {
    try {


        const result = await pool.query(`SELECT sum(aciksas) as acik_siparis,urun_kod,siparis_no,cari,teslim_tarihi,cari_kod
	FROM public.p_gunluk_satin_alma GROUP BY urun_kod,siparis_no,cari,teslim_tarihi,cari_kod `);
        const data = result.rows;



        res.status(200).json({ data:data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/localSatinAlma', cors(), async (req, res) => {
    try {


        const result = await pool.query(`SELECT SUM(aciksas) FROM p_gunluk_satin_alma  WHERE urun_kod = '${req.body.code}'`);
        const data = result.rows;



        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/getSiparisIcerik', cors(), async (req, res) => {
    try {

        const result = await pool.query(`SELECT * FROM p_gunluk_satin_alma  WHERE urun_kod LIKE  '%${req.body.data}%'`);
        const data = result.rows;


        res.status(200).json({ status: 200, data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/localAmbar', cors(), async (req, res) => {
    try {


        const result = await pool.query(`SELECT SUM(miktar) FROM p_gunluk_depo_toplam WHERE urun_kod = '${req.body.code}'`);
        const data = result.rows;



        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/satiAlmaSiparisCari', cors(), async (req, res) => {
    try {
        const cari = req.body.cari

        const result = await pool.query(`SELECT * FROM p_gunluk_satin_alma WHERE cari like '%${cari}%' `);
        const data = result.rows;
        res.status(200).json({ status: 200, data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.get('/productDetail', cors(), async (req, res) => {
    try {


        const result = await pool.query(`SELECT 
        (SELECT COUNT(*) FROM p_product_detail_aksiyon pda WHERE product_detail_id = pd.id) AS aksiyonAdet,
        (SELECT SUM(miktar) FROM p_gunluk_depo_toplam pda WHERE urun_kod = pd.product_code) AS ambarToplam,
        pd.*,
        (SELECT json_agg(gsa.*) FROM p_gunluk_satin_alma gsa WHERE gsa.urun_kod = pd.product_code) as child
    FROM p_product_detail pd; `);
        const data = result.rows;



        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.get('/eksikGet', cors(), async (req, res) => {
    const id = req.params.code;
    try {

        const result = await pool.query("SELECT tb.anaurun,    tb.alturun,    tb.miktar,    tb.ay,    tb.siparis,    tb.hedef,    tb.seviye,    tb.alttakimkod,    tb.oncelik,    tb.onem,    tb.id,    tb.targetid,    tb.depodurumu,    json_agg(json_build_object('id', pd.id,      'ay', pd.ay,      'cari', pd.cari,      'siparis_no', pd.siparis_no,      'aciklama', pd.aciklama,      'aciklama2', pd.aciklama2,      'termin', pd.termin,      'termin2', pd.termin2,      'product_code', pd.product_code,      'anaurunkodu', pd.anaurunkodu,      'urunadi', pd.urunadi    )) AS productdetail FROM p_target_bom AS tb LEFT JOIN p_product_detail AS pd ON tb.alttakimkod like pd.product_code where tb.depodurumu<0 GROUP BY tb.anaurun, tb.alturun, tb.miktar, tb.ay, tb.siparis, tb.hedef, tb.seviye, tb.alttakimkod, tb.oncelik, tb.onem, tb.id, tb.targetid, tb.depodurumu");
        const data = result.rows;

        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/productPost', cors(), async (req, res) => {
    const { id,
        tarih,
        miktar,
        qmiktar } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.machine_product( machine_detail_id, product_date, quantity, qualtiy_quantity)VALUES ($1,$2, $3, $4)', [id, tarih, miktar, qmiktar]);
        const data = result.rows;
        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/postMachineDetail', cors(), async (req, res) => {
    const { id,
        detail_id,
        aciklama,
        urunkodu,
        islem,
        sure,
        calisan_is,
        miktar } = req.body;

    try {
        const putdetail = await pool.query('UPDATE machine_detail SET  bitti=1	WHERE id = $1', [detail_id]);
        const putData = putdetail.rows;
        const result = await pool.query('INSERT INTO machine_detail(machines_id, urunkodu, aciklamasi, uretim_suresi, islem_miktari, islem, bitti, hedef) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, urunkodu, aciklama, sure, islem, calisan_is, 0, miktar]);
        const data = result.rows;
        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/getprojectproductDetail', cors(), async (req, res) => {
    const data = req.body.malzeme

    try {

        const result = await pool.query(`select *from p_product_detail where siparis_urun = '${data}'`);
        const datas = result.rows;
        res.status(200).json({ datas: datas, status: 200 });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/productDetailAksiyonPost', cors(), async (req, res) => {

    const { product_detail_id, aksiyon_aciklama, siparis_no, termin_tarih, termin_adet, cari } = req.body

    try {


        const updateEski = await pool.query(`UPDATE p_product_detail_aksiyon SET is_active = false WHERE product_detail_id = ${product_detail_id} AND siparis_no = '${siparis_no}' AND is_active = true `)


        const result = await pool.query('INSERT INTO p_product_detail_aksiyon( product_detail_id, aksiyon_aciklama, siparis_no, termin_tarih, termin_adet, cari,is_active) VALUES ($1,$2, $3, $4,$5,$6,true)', [product_detail_id, aksiyon_aciklama, siparis_no, termin_tarih, termin_adet, cari]);
        const datas = result.rows;
        const selectUrunKod = await pool.query(`select * from p_product_detail WHERE id = ${product_detail_id}`)
        const selectUrunKodRows = selectUrunKod.rows[0]
        let tableRows = `
              <tr style="border: 1px solid #ddd;">
                <th style="border: 1px solid #ddd; padding: 8px;">Ürün Kodu</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Tedarik Planlama Açıklaması</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Firma Adı</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Termin Miktari</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Termin Tarihi</th>
              </tr>`;


        tableRows += `
                  <tr style="border: 1px solid #ddd;">
                    <td style="border: 1px solid #ddd; padding: 8px;">${selectUrunKodRows.product_code}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${selectUrunKodRows.urunadi}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${aksiyon_aciklama}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${cari}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${termin_adet}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${termin_tarih}</td>
                  </tr>`;

        let transporter = nodemailer.createTransport({
            host: '20.0.0.20',
            port: 25,
            secure: false,

            auth: {
                user: 'bilgi@aho.com',
                pass: 'Bilgi5858!'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        let mailOptions = {
            from: 'bilgi@aho.com',
            to: 'planlama@aho.com,ekoc@aho.com',
            cc: 'tedarikplanlama@aho.com,satinalma@aho.com',
            subject: `Aksiyon Alındı`,
            html: `<p>Sayın İlgili,</p>
          <p>Satınalma - Tedarik Planlama Tarafından Kritik Malzemeler için Aksiyon Alınmıştır..</p> 
 
          <table>${tableRows}</table>`


        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
        res.status(200).json({ status: 200 })


    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/productDetails', cors(), async (req, res) => {
    const data = req.body.data
    try {
        data.forEach(async element => {
            const result = await pool.query('INSERT INTO p_product_detail(product_code, anaurunkodu, urunadi,siparis_urun,is_active,miktar,tarih) VALUES ($1,$2, $3, $4,$5,$6,$7)', [element.product_code, element.anaurunkodu, element.urunadi, element.siparis_urun, true, element.miktar, element.tarih]);
            const datas = result;
            // Generate HTML table dynamically
            let tableRows = `
              <tr style="border: 1px solid #ddd;">
                <th style="border: 1px solid #ddd; padding: 8px;">Ürün Kodu</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Talep edilen Tarih</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Talep edilen Miktar</th>
              </tr>`;

            data.forEach(dataElement => {
                tableRows += `
                  <tr style="border: 1px solid #ddd;">
                    <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.product_code}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.urunadi}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.tarih}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.miktar}</td>
                  </tr>`;
            });
            let transporter = nodemailer.createTransport({
                host: '20.0.0.20',
                port: 25,
                secure: false,

                auth: {
                    user: 'bilgi@aho.com',
                    pass: 'Bilgi5858!'
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            let mailOptions = {
                from: 'bilgi@aho.com',
                to: 'tedarikplanlama@aho.com,satinalma@aho.com',
                cc: 'planlama@aho.com,ekoc@aho.com',
                subject: `Kritik Malzeme Belirleme Hk.`,
                html: `<p>Sayın İlgili,</p>
          <p>Planlmaa Tarafından Kritik Malzeme Belirlenmiştir.</p> 
 
          <table>${tableRows}</table>`


            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        });
        res.status(200).json({ status: 200 });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/productDetailAksiyonPut', cors(), async (req, res) => {
    const { id, product_detail_id, aksiyon_aciklama, siparis_no, termin_tarih, termin_adet, cari } = req.body;
    try {
        const result = await pool.query('UPDATE p_product_detail_aksiyon SET product_detail_id=$1, aksiyon_aciklama=$2, siparis_no=$3,termin_tarih=$4,termin_adet=$5,cari=$7  WHERE id = $6', [product_detail_id, aksiyon_aciklama, siparis_no, termin_tarih, termin_adet, id, cari]);
        const data = result.rows;
        res.status(200).json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/projeEkle', cors(), async (req, res) => {
    try {

        const { birim, proje } = req.body
        let projeEkle = await pool.query(`INSERT INTO p_projes_birim (birim,proje) VALUES ($1,$2)`, [birim, proje])
        res.json({ status: 200 })
    } catch (error) {
        console.error(error);
    }
});
router.post('/productDetailPut', cors(), async (req, res) => {
    let data = req.body
    const { id, ay, cari, siparis_no, aciklama, aciklama2, is_active, termin, termin2, product_code, anaurunkodu, urunadi } = req.body;
    try {
        data.forEach(async element => {
            const result = await pool.query('UPDATE p_product_detail SET product_code=$1, anaurunkodu=$2, urunadi=$3,is_active=$4 WHERE id = $5', [element.product_code, element.siparis_urun, element.urunadi, false, element.id]);
            const data = result.rows;
            res.status(200).json({ data });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.post('/postMissingMetaial', cors(), async (req, res) => {
    const { data } = req.body;
    try {
        data.forEach(async element => {
            const result = await pool.query('INSERT INTO public.missing_material(ust_kod, urun_kodu, urun_aciklama, april, august, december, february, january, july, june, march, may, november, october, september)	VALUES (element.kod, element.urunKodu,element.aciklama, element.April, element.August, element.December, element.February, element.January, element.July, element.June, element.March, element.May,element.November,element.October,September)');
            let dataInsert = result.rows;
        });



        res.status(200).json();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
// Belirli bir veriyi getiren endpoint
router.get('/veriler/:id', (req, res) => {
    const id = req.params.id;
    const veri = data.find(item => item.id === id);

    if (!veri) {
        res.status(404).json({ error: 'Veri bulunamadı.' });
    } else {
        res.json(veri);
    }
});
router.get('/satinalma/:code', cors(), (req, res) => {
    const code = req.body.code.toString();
    getToken((error, access_token) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT *FROM SATINALMA_SIPARIS_225 WHERE KOD = '${code}'  `; // API endpointini doğru şekilde belirtin
        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const parsedBody = JSON.parse(body);

            siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın


            res.json(siparisler); // İşlenen veriyi JSON olarak yanıt olarak gönderin
        });

    });
});
router.post('/satinalmas', cors(), async (req, res) => {
    const code = req.body.code;
    if (code !== null) {
        getToken((error, access_token) => {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const url = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM SATINALMA_SIPARIS_225 WHERE KOD = '${code}' `; // API endpointini doğru şekilde belirtin
            const options = {
                method: 'GET',
                url: url,
                headers: {
                    Authorization: `Bearer ${access_token.access_token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            };

            request(options, function (error, response, body) {
                if (error) {
                    console.error(error);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                const parsedBody = JSON.parse(body);

                siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın
                const acikSiparisler = siparisler.filter(siparis => {
                    // Varsayılan olarak, 'TARİH' alanındaki değer 'gg.aa.yyyy' formatında
                    const tarih = siparis['TARİH'];

                    // Eğer tarih 'gg.aa.yyyy' formatında değilse veya 'TARİH' boşsa bu öğeyi filtre dışı bırak
                    if (!tarih || !/^(\d{2})\.(\d{2})\.(\d{4})$/.test(tarih)) {
                        return false;
                    }

                    // 'gg.aa.yyyy' formatındaki tarihi ayrıştır ve Date nesnesine dönüştür
                    const [gun, ay, yil] = tarih.split('.').map(Number);
                    const dateObject = new Date(yil, ay - 1, gun); // Ay değeri 0-11 aralığında olduğu için bir eksiltme yapılır

                    // Örneğin, bu filtre 'TARİH' alanı 10.01.2023 ve 'AÇIK SİPARİŞ' alanı 10'dan büyük olanları geçerli kılacak
                    return siparis['AÇIK SİPARİŞ'] > 10 && siparis['KOD'] !== null && dateObject;
                });

                res.json(acikSiparisler); // İşlenen veriyi JSON olarak yanıt olarak gönderin
            });

        });
    }
});
router.post('/satinalmaTermin', cors(), async (req, res) => {
    const code = req.params.code;


    const url = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM SATINALMA_SIPARIS_225 `; // API endpointini doğru şekilde belirtin
    const options = {
        method: 'GET',
        url: url,
        headers: {
            Authorization: `Bearer ${req.body.access_token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        }
    };
    request(options, function (error, response, body) {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const parsedBody = JSON.parse(body);

        siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın


        res.json({ status: 200, siparisler: siparisler }); // İşlenen veriyi JSON olarak yanıt olarak gönderin
    });


});
router.get('/ambarlar/:code', cors(), (req, res) => {
    const code = req.params.code;
    getToken((error, access_token) => {
        if (error) {
            console.error(error);

            res.status(500).json({ error: 'Internal Server Error' });
            return;

        }
        // const query = encodeURIComponent("SELECT * FROM AMBAR_TOPLAMLARI_225 WHERE KODU = '" + code + "'");
        // const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${query}`;

        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${encodeURIComponent("SELECT * FROM AMBAR_TOPLAMLARI_225 WHERE KODU = '" + code + "' AND MİKTAR > 0 AND DEPO != 'Şube Tekrar Lens Deposu' AND DEPO != 'AHO Hurda-Fire' AND DEPO != 'Sevkiyat' AND DEPO != 'Bakım Onarım Deposu' AND DEPO != 'Ek Uygunsuzluk Deposu' AND DEPO != 'İthalat Deposu' AND DEPO != 'Aselsan Hurda-Fire Yansıtma' AND DEPO != 'Rework Deposu' AND DEPO != 'İade Deposu' AND DEPO != 'Sabit Kıymet Deposu' AND DEPO != 'Ankara AR-GE Üretim Deposu' AND DEPO != 'Bilgi İşlem Deposu' ")}`;

        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const parsedBody = JSON.parse(body);

            ambar = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın


            res.json(ambar); // İşlenen veriyi JSON olarak yanıt olarak gönderin
        });

    });
});
router.post('/ambarlars', cors(), (req, res) => {
    const code = req.body.code;
    const code2 = req.body.code2;
    getToken((error, access_token) => {
        if (error) {
            console.error(error);

            res.status(500).json({ error: 'Internal Server Error' });
            return;

        }
        // const query = encodeURIComponent("SELECT * FROM AMBAR_TOPLAMLARI_225 WHERE KODU = '" + code + "'");
        // const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${query}`;

        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${encodeURIComponent("SELECT * FROM AMBAR_TOPLAMLARI_225 WHERE( KODU = '" + code + "') AND MİKTAR > 0 AND DEPO != 'Şube Tekrar Lens Deposu' AND DEPO != 'AHO Hurda-Fire' AND DEPO != 'Sevkiyat' AND DEPO != 'Bakım Onarım Deposu' AND DEPO != 'Ek Uygunsuzluk Deposu' AND DEPO != 'İthalat Deposu' AND DEPO != 'Aselsan Hurda-Fire Yansıtma' AND DEPO != 'Rework Deposu' AND DEPO != 'İade Deposu' AND DEPO != 'Sabit Kıymet Deposu' AND DEPO != 'Ankara AR-GE Üretim Deposu' AND DEPO != 'Bilgi İşlem Deposu' ")}`;

        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const parsedBody = JSON.parse(body);

            ambar = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın


            res.json(ambar); // İşlenen veriyi JSON olarak yanıt olarak gönderin
        });

    });
});

router.get('/sumCustumOrder', cors(), (req, res) => {
    const code = req.params.code;

    getToken((error, access_token) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT *FROM SATIS_SIPARISLERI_225`; // API endpointini doğru şekilde belirtin
        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const parsedBody = JSON.parse(body);
            siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın


            res.json(siparisler); // İşlenen veriyi JSON olarak yanıt olarak gönderin
        });

    });
});
async function uretimEmriGetir(id) {
    try {
        const access_token = await getToken2();
        console.log(access_token)
        // getToken2 fonksiyonu tanımlı olmalı ve await ile kullanılmalı
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=select uretm_emri.FICHENO,uretm_emri.PLNAMOUNT,uretm_emri.ACTAMOUNT , item.CODE  from LG_225_PRODORD uretm_emri
         INNER JOIN LG_225_ITEMS item on uretm_emri.ITEMREF = item.LOGICALREF AND item.CODE like '${id}%' WHERE uretm_emri.FICHETYPE= 1  AND uretm_emri.STATUS = 1`; // id parametresi kullanılmalı
        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        const initialResponse = await axios(initialOptions);
        let router = initialResponse.data.items || [];
        return router; // resolve yerine return kullanılmalı
    } catch (error) {
        console.error(error);
        throw error; // Hata yakalandığında işlenmeli veya fırlatılmalı
    }
}
router.post('/acikUretimEmriBul', cors(), async (req, res) => {
    const code = req.body.code;

    try {
        const rotaData = await uretimEmriGetir(code)
        res.send({
            status: 200,
            data: rotaData
        })
    } catch (error) {
        res.send({
            status: 400,
            data: "eksik"
        })
    }

});

router.post('/getKalibrasyonMetarial', cors(), async (req, res) => {
    try {
        const result = await pool.query('SELECT qe.id,qe.ekipman_no,qe.ekipman_name,qe.ekipman_no,qe.ekipman_type,qe.sorumlusu,qe.son_kalibrasyon,qe.gonderme_tarihi,qs.name as durumu,qd.name as birimi FROM quailty_ekipman qe Inner Join quality_status qs ON qs.id = qe.durumu Inner Join quailty_departman qd ON qe.birimi = qd.id');
        const data = result.rows;
        res.status(200).json({ status: 200, data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post('/getGlobalBomCek', cors(), async (req, res) => {
    try {
        const code = req.body.code
        const result = await pool.query(`select* from p_target_bom where siparis_urun = '${code}'`);
        const data = result.rows;

        res.status(200).json({ data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})
router.get('/gunlukCalisacakApi', cors(), (req, res) => {
    satisSiparis()
});
router.post('/cariSasGet', cors(), (req, res) => {
    const cari = req.body.cari
    getToken((error, access_token) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }
        const sqlQuery = `SELECT * FROM SATINALMA_SIPARIS_225 WHERE CARİ = '${cari}'`;
        const encodedQuery = encodeURIComponent(sqlQuery);
        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${encodedQuery}`; // API endpointini doğru şekilde belirtin
        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const parsedBody = JSON.parse(body);
            siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın

            res.json(siparisler); // İşlenen veriyi JSON olarak yanıt olarak gönderin
        });
    });
});

router.post('/uretimSiparisSUM', cors(), (req, res) => {
    getToken((error, access_token) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // SQL sorgusunu URL'den önce encodeURIComponent ile kaçış karakterlerine dönüştürün
        const tsqlQuery = encodeURIComponent(`SELECT   
            CARİ AS cari,
            MAX(CONVERT(VARCHAR, [SİPARİŞ TARİHİ], 104)) as siparis_tarih,  
            MIN(CONVERT(VARCHAR, [TESLİM TARİHİ], 104)) as teslim_tarihi,   
            [SİPARİŞ NUMARASI] as siparis_no, 
            'Üretim' as tur, 
            [MALZEME KODU] as urun_kodu,
            [MALZEME AÇIKLAMASI] as urun_aciklama,
            SUM([SİPARİŞ ADETİ]) as miktar,
            SUM([AÇIK SİPARİŞ]) as acik_siparis,
            SUM([SEVKEDİLEN ADET]) as sevk_miktar,
            0 as cari_tur
        FROM  
            SATIS_SIPARISLERI_225
        GROUP BY 
            [SİPARİŞ NUMARASI], [MALZEME KODU], [CARİ], [MALZEME/HİZMET], [MALZEME AÇIKLAMASI]

        UNION 

        SELECT  
            'AHO URETİM' as cari,
            CONVERT(VARCHAR, [TALEP_TARIHI], 104) as siparis_tarih,  
            CONVERT(VARCHAR, [TEMIN_TARIHI], 104) as teslim_tarihi,  
            [FisNo] as siparis_no,
            [TALEP_TUR] as tur,
            [MALZEME_KODU] as urun_kodu,
            [MALZEME_ACIKLAMASI] as urun_aciklama,
            [MIKTAR] as miktar,
            [MIKTAR] as acik_siparis,
            [MIKTAR] as sevk_miktar,
            1 as cari_tur
        FROM 
            [Tiger3Ent].[dbo].[_AHO_MEKANIK_TALEP] 
        WHERE 
            ASAMA = 'Onaylandı'

        UNION 

        SELECT  
            'AHO URETİM' as cari,
            CONVERT(VARCHAR, [TALEP_TARIHI], 104) as siparis_tarih,  
            CONVERT(VARCHAR, [TEMIN_TARIHI], 104) as teslim_tarihi,  
            [FisNo] as siparis_no,
            'Uretim' as tur,
            [MALZEME_KODU] as urun_kodu,
            [MALZEME_ACIKLAMASI] as urun_aciklama,
            [MIKTAR] as miktar,
            [MIKTAR] as acik_siparis,
            0 as sevk_miktar,
            2 as cari_tur
        FROM 
            [Tiger3Ent].[dbo].[_AHO_OPTIK_TALEP] 
        WHERE 
            ASAMA = 'Onaylandı'`);

        const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${tsqlQuery}`;

        const options = {
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        request(options, async function (error, response, body) {
            if (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }
            
            const parsedBody = JSON.parse(body);
            siparisler = parsedBody.items || []; 
            const deleteDuzenle = await pool.query('DELETE FROM p_siparis_ham_sum')
            siparisler.forEach(async item => {
                const veriYukle = await pool.query(
                    `INSERT INTO p_siparis_ham_sum(
                        cari, siparis_tarih, teslim_tarihi, siparis_no, tur, urun_kodu, urun_aciklama, miktar, acik_siparis, sevk_miktar, cari_tur)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [item.cari, item.siparis_tarih, item.teslim_tarihi, item.siparis_no, item.tur, item.urun_kodu, item.urun_aciklama, item.miktar, item.acik_siparis, item.sevk_miktar, item.cari_tur]
                );
            });

            res.json(siparisler); 
        });
    });
});
router.post('/getUretimForSiparis', cors(), async (req, res) => {

    try {
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /getUretimForSiparis\n`);

        const veriGet = await pool.query(`SELECT * FROM p_siparis_ham_sum`)
        res.json({
            status:200,
            data:veriGet.rows
        });

        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getUretimForSiparis\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
       
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        if (!res.headersSent) {
            res.status(500).json({ error: error });
        }
    }

     
});

// router.get('/siparisler', cors(), (req, res) => {
//     getToken((error, access_token) => {
//         if (error) {
//             console.error(error);

//             res.status(500).json({ error: 'Internal Server Error' });
//             return;
//         }
//         const url = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT *FROM SATIS_SIPARISLERI_225   `; // API endpointini doğru şekilde belirtin
//         const options = {
//             method: 'GET',
//             url: url,
//             headers: {
//                 Authorization: `Bearer ${access_token.access_token}`,
//                 'Content-Type': 'application/json',
//                 Accept: 'application/json'
//             }
//         };
//         request(options, function (error, response, body) {
//             if (error) {
//                 console.error(error);
//                 res.status(500).json({ error: 'Internal Server Error' });
//                 return;
//             }
//             const parsedBody = JSON.parse(body);
//             siparisler = parsedBody.items || []; // "items" özelliğini kullanarak sipariş verilerini alın
//             transformedSiparisler = groupAndSumSiparisler(siparisler); // Siparişleri dönüştürün

//             res.json(transformedSiparisler); // İşlenen veriyi JSON olarak yanıt olarak gönderin
//         });
//     });
// });

// router.post('/satisSiparisDuzenlemeApi', cors(), async (req, res) => {
//     try {
//         let dataSiparis = await pool.query(`SELECT * FROM p_siparisler`);
//         let siparisler = dataSiparis.rows;
//         let deleteLocalSiparisDuzen = await pool.query('DELETE FROM p_local_duzenli_siparis');

//         for (const element of siparisler) {
//             await updateLocalDuzenliSiparis(element);
//         }
//         res.json({ status: 200 })
//     } catch (error) {
//         console.error(error);
//     }
// });
router.post('/mrpSonuc', cors(), async (req, res) => {
    const { kod } = req.body;
    try {
        const jsonBomList = fs.readFileSync('mrpdata.json', 'utf8');
        const sqlData = JSON.parse(jsonBomList);
        const dataFilter = sqlData.filter(item => item.malzeme_kodu === kod);
        res.json({ status: 200, dataFilter: dataFilter });
    } catch (error) {
        res.json(error);
    }
});
router.post('/ihamlPost', cors(), async (req, res) => {
    const data = req.body.data
    try {
        data.forEach(async element => {
            let ihmalPost = await pool.query(`INSERT INTO p_ihmal_product(malzeme_kodu, malzeme_adi, proje_kodu) VALUES ('${element.product_code}','${element.urunadi}','${element.selectedProje}')`);
        });

        res.json({ status: 200 })
    } catch (error) {
        res.json(error)
    }
});

router.post('/kodBul', cors(), async (req, res) => {
    const data = req.body.data
    try {
        data.forEach(async element => {
            let ihmalPost = await pool.query(`SELECT * FROM local_siparis-duzenlenen')`);
        });

        res.json({ status: 200 })
    } catch (error) {
        res.json(error)
    }
});
router.post('/localSiparisSingel', cors(), async (req, res) => {
    const kod = req.body.kod
    try {

        let selectData = await pool.query(`SELECT*FROM p_siparisler WHERE malzeme = '${kod}'`);

        res.json({ status: 200, data: selectData.rows })
    } catch (error) {
        res.json(error)
    }
});
router.post('/ihmalEdilenAll', cors(), async (req, res) => {

    try {

        let ihmalPost = await pool.query(`SELECT * FROM  p_ihmal_product`);

        res.json({ status: 200, data: ihmalPost.rows })
    } catch (error) {
        res.json(error)
    }
});
router.post('/satisSiparisCek', cors(), async (req, res) => {
    try {
        satisSiparis()
    } catch (error) {
        console.error(error);
    }
});

router.post('/bomCekOTOMATik', cors(), async (req, res) => {
    try {
        const deleteBom = await pool.query(`DELETE FROM p_target_bom `)

        gunlukBomGet()

    } catch (error) {
        console.error(error);
    }
});

router.get('/getProjeBirim', cors(), async (req, res) => {
    try {


        const selectProje = await pool.query(`select * from p_projes_birim`)
        let gelenData = selectProje.rows
        let datas = []

        gelenData.forEach(item => {
            datas.push({
                birim: item.birim,
                proje: item.proje,
                selected: false
            })
        })
        res.json({
            status: 200,
            data: datas
        })
    } catch (error) {
        res.json(error)
        console.error(error);
    }
});
router.post('/kapasiteOtomatikManule', cors(), async (req, res) => {
    try {
        kapasiteOtomatik()

    } catch (error) {
        console.error(error);
    }
});






async function kapasiteOtomatik() {

    // const jsonBomList = fs.readFileSync('mrpdata.json', 'utf8');
    // const sqlData = JSON.parse(jsonBomList);

    let itemsRef = []
    let bomsRef = []
    let bomsGetRotali = []
    try {
        let dataGelenIndex = 0
        const dataBom = []
        for (let mrpVeri of sqlData) {
            const desiredId = mrpVeri.malzeme_kodu;

            //items bulacak

            itemsRef = await itemRefBul(desiredId)
            bomsRef = await bomRefBul(itemsRef[0].LOGICALREF)
            // //ref e göre bom bulacak
            // //bom restapiden bom  ve rotaları getirecek
            // //rotaların operasyonları gelecek
            if (mrpVeri.karsılama_turu != 'Satınalma') {
                for (let bomrefDon of bomsRef) {

                    let bomrefDatass = bomrefDon.LOGICALREF
                    let ay = mrpVeri.ihtiyac_tarihi.split('/')[1]
                    let yil = mrpVeri.ihtiyac_tarihi.split('/')[2]
                    if (bomrefDatass < 99999 && bomrefDatass > 999) {
                        bomsGetRotali = await bomListFonksiyon(bomrefDon.LOGICALREF)
                        if (bomsGetRotali.ROUT_CODE != 'FASON') {
                            const rotaData = await rotuerGet(bomsGetRotali.ROUT_CODE);
                            for (let element of rotaData) {
                                dataBom.push(
                                    {
                                        code: bomsGetRotali.CODE,
                                        urun_kod: mrpVeri.malzeme_kodu,
                                        urun_aciklama: mrpVeri.aciklama,
                                        ihtiyac_miktar: mrpVeri.ihtiyac_miktar,
                                        ay: ay,
                                        yil: yil,
                                        bom_name: bomsGetRotali.NAME,
                                        revizyon_id: bomsGetRotali.VALIDREVREF,
                                        urun_id: bomsGetRotali.MAINPRODREF,
                                        bom_id: bomsGetRotali.BOMMASTERREF,
                                        o_kod: bomsGetRotali.MP_CODE,
                                        o_name: bomsGetRotali.MP_NAME,
                                        rota_kod: bomsGetRotali.ROUT_CODE,
                                        rota_name: bomsGetRotali.ROUT_NAME,
                                        satir_no: element.LINENO_,
                                        istasyonname: element.istasyonname,
                                        istasyonkod: element.istasyonkod,
                                        atolye: element.atolye,
                                        op_code: element.op_code,
                                        hazirlik: element.hazirlik,
                                        iscilik_suresi: element.islemzaman,
                                        islem_miktari: element.islem_miktari,
                                        oponcesibekleme: element.makinazamani,
                                        makinazamani: element.oponcesibekleme,
                                        makinapartimiktari: element.makinapartimiktari,
                                        dataGelenIndex: dataGelenIndex

                                    }
                                )

                            }
                        }

                    }
                }
            }
            dataGelenIndex += 1
        }


        const dataDelete = await pool.query(`DELETE FROM p_operasyon_kapasite `)
        for (let insterForData of dataBom) {
            const insertDataSourch = await pool.query(`INSERT INTO public.p_operasyon_kapasite(
            grup_id,urun_kod, urun_aciklama, ihtiyac_miktar, ay, yil, bom_name, revizyon_id, urun_id, bom_id, o_kod, o_name, rota_kod, rota_name, satir_no, istasyonname, istasyonkod, atolye, operasyon_code, hazirlik, iscilik_suresi, islem_miktari, oponcesibekleme, makinazamani, makinapartimiktari)
           VALUES (${insterForData.dataGelenIndex},'${insterForData.urun_kod}',
           '${insterForData.urun_aciklama}',
            ${insterForData.ihtiyac_miktar},
            ${parseInt(insterForData.ay)},
            ${parseInt(insterForData.yil)},
            '${insterForData.bom_name}',
            ${insterForData.revizyon_id},
            ${insterForData.urun_id},
            ${insterForData.bom_id},
            '${insterForData.o_kod}',
            '${insterForData.o_name}',
            '${insterForData.rota_kod}',
            '${insterForData.rota_name}',
            ${insterForData.satir_no},
            '${insterForData.istasyonname}',
            '${insterForData.istasyonkod}',
            '${insterForData.atolye}',
            '${insterForData.op_code}',
            ${insterForData.hazirlik},
            ${insterForData.iscilik_suresi},
            ${insterForData.islem_miktari},
            ${insterForData.oponcesibekleme},
            ${insterForData.makinazamani},
            ${insterForData.makinapartimiktari} )`)

        }
        const dataSelectAll = await pool.query(`SELECT SUM(ihtiyac_miktar),urun_kod FROM (
                select grup_id,urun_kod, sum(ihtiyac_miktar) as toplam, ihtiyac_miktar from p_operasyon_kapasite GROUP BY grup_id,ihtiyac_miktar,urun_kod
            ) as gor GROUP BY urun_kod
            `)
        for (let datadon of dataSelectAll.rows) { const updateData = await pool.query(`UPDATE p_operasyon_kapasite SET  toplam_ihtiyac = ${datadon.sum} WHERE urun_kod ='${datadon.urun_kod}'`) }

        try {
            const acikIsEmrileri = await acikIsemriGenel()
            const acikIsEmriDelete = await pool.query(`DELETE FROM p_acik_uretim_emir`)


            for (let data of acikIsEmrileri) {
                const insterAcikUretim = await pool.query(`INSERT INTO p_acik_uretim_emir(
                "OPERASYON_REF", "ITEMREF", "SETUP_SURE", "ISCILIK_SURESI", "ISCILIK_PARTI", "MAKINA_PARTI", "MAKINA_SURE", "WSREF", "PLNAMOUNT", "ACTAMOUNT", istasyonname, istasyonkod, atolye)
                VALUES (${data["OPERASYON_REF"]}, ${data["ITEMREF"]}, ${data["SETUP_SURE"]}, ${data["ISCILIK_SURESI"]}, ${data["ISCILIK_PARTI"]}, ${data["MAKINA_PARTI"]}, ${data["MAKINA_SURE"]}, ${data["WSREF"]}, ${data["PLNAMOUNT"]}, ${data["CONSUMPAMNT"]}, '${data["istasyonname"]}', '${data["istasyonkod"]}', '${data["atolye"]}');`);
            }
        } catch (error) {
            console.error(error)
        }

        return 0
    } catch (error) {
        console.error(error);
    }
}




async function gunlukBomGet() {
    try {
        let dataSiparis = await pool.query(`SELECT * FROM p_local_duzenli_siparis`);
        let data = dataSiparis.rows

        for (const element of data) {
            await bomCekOtomatikGunluk(element);
        }

    } catch (error) {
        console.error(error);
    }
}
async function bomCekOtomatikGunluk(gelen) {
    try {
        const { ay_1, ay_2, ay_3, ay_4, ay_5, ay_6, ay_7, ay_8, ay_9, ay_10, ay_11, ay_12, gecmis } = gelen;
        const code = gelen.malzeme.toString();
        const access_token = await getToken2();
        const fetchBomData = async (kod) => {
            const bomUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT * FROM BOM_SATIR_225() WHERE KOD = '${kod}'`;
            const bomOptions = {
                method: 'GET',
                url: bomUrl,
                headers: {
                    Authorization: `Bearer ${access_token.access_token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            };

            const bomResponse = await axios(bomOptions);
            return bomResponse.data.items || [];
        };

        const processBomLevel = async (bomList, level) => {
            const result = [];

            for (const element of bomList) {
                element.level = level;

                if (element.BOMAD2 != null && element.ALTKOD != null && element.ALTKOD !== "") {
                    const subComponentData = await fetchBomData(element.ALTKOD);
                    const processedSubComponents = await processBomLevel(subComponentData, level + 1);
                    result.push(...processedSubComponents);
                }
            }

            // Döngü sonunda sadece ana elemanı ekle
            result.push(...bomList);

            return result;
        };

        // İlk seviye
        const initialBomList = await fetchBomData(code);

        if (!initialBomList) {
            return Object.values("data");
        }


        // Diğer seviyeler
        const bomlist = await processBomLevel(initialBomList, 0);

        // gelen Bom listi database kaydecek
        // eski bomu bul ve sil


        // yenisini insert edilecek
        bomlist.forEach(async element => {
            const insertNewBom = await pool.query(`INSERT INTO p_target_bom(
          ust_kod, ust_malzeme, kod, malzeme, miktar, birim, seviye, ay_1, ay_2, ay_3, ay_4, ay_5, ay_6, ay_7, ay_8, ay_9, ay_10, ay_11, ay_12, diger, siparis_urun)
         VALUES ('${element.KOD}',' ${element.MALZEME}', '${element.ALTKOD}', '${element.ALTMALZEME}', ${element.MIKTAR}, '${element.BIRIM}', ${element.level}, ${ay_1}, ${ay_2},
           ${ay_3}, ${ay_4}, ${ay_5}, ${ay_6}, ${ay_7}, ${ay_8}, ${ay_9}, ${ay_10}, ${ay_11}, ${ay_12}, ${gecmis}, '${code}')`)
        });





        return Object.values("data");

    } catch (error) {
        console.error(error);
    }

}

// const kritikMalzemeHatirlatma = async () => {
//     // Burada sorgunuzu çalıştırabilirsiniz, örneğin:
//     try {

//         const result = await pool.query(`SELECT 
//             (SELECT COUNT(*) FROM p_product_detail_aksiyon pda WHERE product_detail_id = pd.id) AS aksiyon,
//             (SELECT SUM(aciksas) FROM p_gunluk_satin_alma pda WHERE urun_kod = pd.product_code) AS sas,
//             pd.*
//          FROM p_product_detail pd WHERE pd.is_active = true `);
//         const datas = result.rows;


//         // Generate HTML table dynamically
//         let tableRows = `
//               <tr style="border: 1px solid #ddd;">
//                 <th style="border: 1px solid #ddd; padding: 8px;">Ürün Kodu</th>
//                 <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
//                 <th style="border: 1px solid #ddd; padding: 8px;">Talep edilen Tarih</th>
//                 <th style="border: 1px solid #ddd; padding: 8px;">Talep edilen Miktar</th>
//               </tr>`;

//         datas.forEach(dataElement => {
//             if (dataElement.aksiyon < 1 && dataElement.sas > 0)
//                 tableRows += `
//                   <tr style="border: 1px solid #ddd;">
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.product_code}</td>
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.urunadi}</td>
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.tarih}</td>
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.miktar}</td>
//                   </tr>`;
//         });
//         let transporter = nodemailer.createTransport({
//             host: '20.0.0.20',
//             port: 25,
//             secure: false,

//             auth: {
//                 user: 'bilgi@aho.com',
//                 pass: 'Bilgi5858!'
//             },
//             tls: {
//                 rejectUnauthorized: false
//             }
//         });
//         let mailOptions = {
//             from: 'bilgi@aho.com',
//             to: 'tedarikplanlama@aho.com,satinalma@aho.com',
//             cc: 'planlama@aho.com,ekoc@aho.com',
//             subject: `Kritik Malzeme Hatırlatma Hk.`,
//             html: `<p>Sayın İlgili,</p>
//           <p>Planlmaa Tarafından Kritik malzemeler için aksiyonlarınız beklenmektedir..</p> 
//  Ürün listesi ekte verilmiştir.
//           <table>${tableRows}</table>`


//         };
//         transporter.sendMail(mailOptions, (error, info) => {
//             if (error) {
//                 console.log(error);
//             } else {
//                 console.log('Email sent: ' + info.response);
//             }
//         });


//     } catch (error) {
//         console.error(error);

//     }
// };
// const kritikMAlzemeSasSifir = async () => {
//     // Burada sorgunuzu çalıştırabilirsiniz, örneğin:
//     try {
//         data.forEach(async element => {
//             const result = await pool.query(`SELECT 
//             (SELECT COUNT(*) FROM p_product_detail_aksiyon pda WHERE product_detail_id = pd.id) AS aksiyon,
//             (SELECT SUM(aciksas) FROM p_gunluk_satin_alma pda WHERE urun_kod = pd.product_code) AS sas,
//             pd.*
//          FROM p_product_detail pd WHERE pd.is_active = true; `);
//             const datas = result.rows;
//             // Generate HTML table dynamically
//             let tableRows = `
//               <tr style="border: 1px solid #ddd;">
//                 <th style="border: 1px solid #ddd; padding: 8px;">Ürün Kodu</th>
//                 <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
//                 <th style="border: 1px solid #ddd; padding: 8px;">Talep edilen Tarih</th>
//                 <th style="border: 1px solid #ddd; padding: 8px;">Talep edilen Miktar</th>
//               </tr>`;

//             datas.forEach(dataElement => {
//                 if (!dataElement.sas)
//                     tableRows += `
//                   <tr style="border: 1px solid #ddd;">
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.product_code}</td>
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.urunadi}</td>
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.tarih}</td>
//                     <td style="border: 1px solid #ddd; padding: 8px;">${dataElement.miktar}</td>
//                   </tr>`;
//             });
//             let transporter = nodemailer.createTransport({
//                 host: '20.0.0.20',
//                 port: 25,
//                 secure: false,

//                 auth: {
//                     user: 'bilgi@aho.com',
//                     pass: 'Bilgi5858!'
//                 },
//                 tls: {
//                     rejectUnauthorized: false
//                 }
//             });
//             let mailOptions = {
//                 from: 'bilgi@aho.com',
//                 to: 'planlama@aho.com,ekoc@aho.com',
//                 cc: 'tedarikplanlama@aho.com,satinalma@aho.com',
//                 subject: `Kritik Malzeme Hatırlatma Hk.`,
//                 html: `<p>Sayın İlgili,</p>
//           <p>Aşağıda İstenen Ürünler için SAS oluşturulmadığından dolayı Temin edilememektedir.Ürünler AHO üretimi olacak veya ürün ihtiyacının olmaması halinde listeden çıkartılmasını rica ederiz.</p> 
//  Ürün listesi ekte verilmiştir.
//           <table>${tableRows}</table>`


//             };
//             transporter.sendMail(mailOptions, (error, info) => {
//                 if (error) {
//                     console.log(error);
//                 } else {
//                     console.log('Email sent: ' + info.response);
//                 }
//             });
//         });

//     } catch (error) {
//         console.error(error);

//     }
// };


const bucuk = 19.5 * 30 * 60 * 1000;
const bucuk2 = 20.5 * 30 * 60 * 1000;
const yirmiSaat = 20 * 60 * 60 * 1000;
const yirmi1Saat = 21 * 60 * 60 * 1000;
const yirmi2Saat = 22 * 60 * 60 * 1000;
const yirmi3Saat = 23 * 60 * 60 * 1000;
const altisaat = 2 * 60 * 60 * 1000;
const bessaat = 5 * 60 * 60 * 1000;
const ondokuzSaat = 19 * 60 * 60 * 1000;
// logo satış çekme

// satış düzenle

// setInterval(async () => {
//     try {
//         await kritikMalzemeHatirlatma();
//         console.log("kritik malzeme hatırlatıldı")

//         //await calistirSorguyu();

//     } catch (error) {
//         console.error(error);
//     }
// }, bucuk);
// setInterval(async () => {
//     try {
//         await kritikMAlzemeSasSifir();
//         console.log("kritik malzeme listesine ekleme hatırlatıldı")

//         //await calistirSorguyu();

//     } catch (error) {
//         console.error(error);
//     }
// }, bucuk2);
// setInterval(async () => {
//     try {


//         const deleteBom = await pool.query(`DELETE FROM p_target_bom `)

//         await gunlukBomGet();
//         console.log("bom çekildi")

//         //await calistirSorguyu();

//     } catch (error) {
//         console.error(error);
//     }
// }, yirmi2Saat);




// setInterval(async () => {
//     try {
//         await kapasiteOtomatik();

//         const today = new Date();
//         const dayOfWeek = today.getDay();
//         if (dayOfWeek !== 0 && dayOfWeek !== 6) {
//             await pool.query(`UPDATE p_vardiya_bilgileri SET yil_sure = yil_sure - 1`);
//         } else {
//             console.log("Hafta sonu olduğu için güncelleme yapılmadı");
//         }
//         //await calistirSorguyu();

//     } catch (error) {
//         console.error(error);
//     }
// }, ondokuzSaat);




module.exports = router;
