const express = require('express');
const router = express.Router();
const codeController = require('../controllers/codeController');
const auth = require('../middleware/auth'); // Optional: protect this route

// POST /api/v1/code/execute
// Currently protecting with 'auth' middleware so only logged-in users can execute code
router.post('/execute', auth, codeController.executeCode);

module.exports = router;
