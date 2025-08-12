const { Plan, Subscription, User } = require('../models'); // Assuming models are exported from a central index
const stripeService = require('./stripe.service');

class SubscriptionService {
  async getPlans() {
    return Plan.findAll();
  }

  async createCheckoutSession(userId, priceId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer(user.email, user.name);
      stripeCustomerId = customer.id;
      await user.update({ stripeCustomerId });
    }

    const successUrl = `${process.env.FRONTEND_URL}/subscription-success`;
    const cancelUrl = `${process.env.FRONTEND_URL}/subscription-canceled`;

    return stripeService.createCheckoutSession(priceId, stripeCustomerId, successUrl, cancelUrl);
  }

  async handleWebhook(event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscription = await stripeService.stripe.subscriptions.retrieve(session.subscription);
        
        const user = await User.findOne({ where: { stripeCustomerId: session.customer } });
        if (!user) {
            throw new Error(`Webhook Error: User not found for customer ${session.customer}`);
        }

        await Subscription.create({
          userId: user.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await Subscription.update(
          { 
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          { where: { stripeSubscriptionId: subscription.id } }
        );
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  }
}

module.exports = new SubscriptionService();