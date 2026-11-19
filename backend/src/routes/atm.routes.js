const express = require('express');
const {
  authenticateToken,
  authorizeRoles,
  authorizeAuthMethod,
} = require('../middlewares/auth.middleware');
const atmController = require('../controllers/atm.controller');

const router = express.Router();

router.use(authenticateToken, authorizeRoles('CLIENTE'), authorizeAuthMethod('atm'));

router.get('/saldo', atmController.getBalance);
router.get('/movimientos', atmController.listRecentMovements);
router.post('/retiros', atmController.withdraw);

module.exports = router;
