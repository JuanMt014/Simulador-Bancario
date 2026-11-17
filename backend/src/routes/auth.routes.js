const express = require('express');
const { login, cajeroLogin } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/cajero-login', cajeroLogin);

module.exports = router;
