const subscriptionService = require('../services/subscription.service');
const stripeService = require('../services/stripe.service');

class SubscriptionController {
  async getPlans(req, res, next) {
    try {
      const plans = await subscriptionService.getPlans();
      res.json(plans);
    } catch (error) {
      next(error);
    }
  }

  async createCheckoutSession(req, res, next) {
    try {
      const { priceId } = req.body;
      const userId = req.user.id; // Assuming user is authenticated and ID is available
      const session = await subscriptionService.createCheckoutSession(userId, priceId);
      res.json({ id: session.id });
    } catch (error) {
      next(error);
    }
  }

  async stripeWebhook(req, res, next) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Use raw body for webhook signature verification
      event = stripeService.constructWebhookEvent(req.body, sig);
    } catch (err) {
      console.error(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await subscriptionService.handleWebhook(event);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      next(error);
    }
  }
}

module.exports = new SubscriptionController();