const express = require('express');
const {
  authenticateToken,
  authorizeRoles,
  authorizeAuthMethod,
} = require('../middlewares/auth.middleware');
const clientController = require('../controllers/client.controller');

const router = express.Router();

router.use(authenticateToken, authorizeRoles('CLIENTE'), authorizeAuthMethod('password'));

router.get('/perfil', clientController.getProfile);
router.put('/perfil', clientController.updateProfile);
router.put('/password', clientController.changePassword);
router.get('/cuenta', clientController.getPrimaryAccount);
router.get('/cuentas', clientController.getAccounts);
router.get('/movimientos', clientController.listMovements);
router.post('/transferencias', clientController.transfer);

module.exports = router;
