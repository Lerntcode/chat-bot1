const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middleware/authMiddleware'); // Assuming you have auth middleware

// Get all subscription plans
router.get('/plans', authMiddleware, subscriptionController.getPlans);

// Create a Stripe checkout session
router.post('/create-checkout-session', authMiddleware, subscriptionController.createCheckoutSession);

// Stripe webhook handler
// The webhook needs the raw body, so we use express.raw middleware before our controller.
router.post('/webhook', express.raw({ type: 'application/json' }), subscriptionController.stripeWebhook);

module.exports = router;