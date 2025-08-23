const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Memory = require('../models/Memory');
const cache = require('../utils/cache');

const router = express.Router();

// GET /api/v1/memory - list memories for current user
router.get('/', auth, async (req, res) => {
  try {
    const cacheKey = `memory:${req.user.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const items = await Memory.findAll({
      where: { userId: req.user.id },
      order: [['timestamp', 'DESC']],
      attributes: ['id', 'text', 'timestamp', 'category', 'expiresAt']
    });
    await cache.set(cacheKey, items, 30);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch memory' });
  }
});

// POST /api/v1/memory - create a memory entry
router.post(
  '/',
  auth,
  body('text').isString().trim().isLength({ min: 1, max: 1000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { text, category = null, expiresAt = null } = req.body;
    try {
      const item = await Memory.create({
        text,
        category,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        userId: req.user.id,
        timestamp: new Date()
      });
      await cache.del(`memory:${req.user.id}`);
      res.status(201).json({ id: item.id, text: item.text, timestamp: item.timestamp, category: item.category, expiresAt: item.expiresAt });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create memory' });
    }
  }
);

module.exports = router;
