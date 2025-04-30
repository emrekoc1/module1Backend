const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());

const portalUserController = require('../controllers/portalUserController');

// POST: Haber ekleme
router.post('/postUserAll', portalUserController.postUserAll);
router.post('/getGenelHiyerArsiAll', portalUserController.getGenelHiyerArsiAll);
router.post('/getGenelAll', portalUserController.getGenelAll);
router.post('/getUserLogin', portalUserController.getUserLogin);
router.post('/logInPortal', portalUserController.logInPortal);
router.post('/getUserSifreDegirstir', portalUserController.getUserSifreDegirstir);
router.post('/userPaswordForget', portalUserController.userPaswordForget);
router.post('/updatePaswordUser', portalUserController.updatePaswordUser);
router.post('/getUserSifreDurum', portalUserController.getUserSifreDurum);
router.post('/getusersDepartmant', portalUserController.getusersDepartmant);
router.post('/departmanOrganizasyonGetir',portalUserController.getDepartmanOrganizasyon)
router.post('/departmanOrganizasyonInsert',portalUserController.insertDepartmanOrganizasyon)
router.post('/departmanOrganizasyonUpdate',portalUserController.updateDepartmanOrganizasyon)
router.post('/updateDepartmanUsersOrganizasyon',portalUserController.updateDepartmanUsersOrganizasyon)
router.post('/insertUserDepartmanmatching',portalUserController.insertUserDepartmanmatching)
router.post('/selectUserSicilOrg',portalUserController.selectUserSicilOrg)
router.post('/insertUserAhoEgitim',portalUserController.insertUserAhoEgitim)
router.post('/topluUserEgitimInsert',portalUserController.topluUserEgitimInsert)
router.post('/topluUserBirimInsert',portalUserController.topluUserBirimInsert)
router.post('/selectUserIzinlerGet',portalUserController.selectUserIzinlerGet)
router.post('/updateUserGenel',portalUserController.updateUserGenel)
router.post('/deleteUserDepartman',portalUserController.deleteUserDepartman)
router.post('/updateUserFoto',portalUserController.updateUserFoto)
router.post('/updateUserEgitim',portalUserController.updateUserEgitim)
router.post('/selectUserSkillAll',portalUserController.selectUserSkillAll)
router.post('/userIlkIs',portalUserController.userIlkIs)
router.post('/getGenelDepartmanOrganizasyonFonk',portalUserController.getGenelDepartmanOrganizasyonFonk)
router.post('/personelDagit',portalUserController.personelDagit)
router.post('/insertUserEgitim',portalUserController.insertUserEgitim)
router.post('/getAllSkills',portalUserController.getAllSkills)
router.post('/userMachMsql',portalUserController.userMachMsql)
router.post('/insertAllSkill',portalUserController.insertAllSkill)
module.exports = router;



