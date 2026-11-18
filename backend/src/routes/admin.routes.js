const express = require('express');
const {
  authenticateToken,
  authorizeRoles,
  authorizeAuthMethod,
} = require('../middlewares/auth.middleware');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.use(authenticateToken, authorizeRoles('ADMIN'), authorizeAuthMethod('password'));

router.get('/dashboard', adminController.dashboard);
router.route('/clientes')
  .get(adminController.listClients)
  .post(adminController.createClient);
router.get('/clientes/:id', adminController.getClient);
router.put('/clientes/:id', adminController.updateClient);
router.patch('/clientes/:id/estado', adminController.changeClientStatus);
router.get('/cuentas', adminController.listAccounts);
router.get('/movimientos', adminController.listMovements);
router.post('/consignaciones', adminController.createDeposit);

module.exports = router;
