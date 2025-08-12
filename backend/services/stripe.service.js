const Stripe = require('stripe');

class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not found in environment variables.');
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async createCheckoutSession(priceId, customerId, successUrl, cancelUrl) {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        customer: customerId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return session;
    } catch (error) {
      console.error('Error creating Stripe checkout session:', error);
      throw error;
    }
  }

  async createCustomer(email, name) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  constructWebhookEvent(body, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not found in environment variables.');
    }
    try {
      return this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Error constructing webhook event:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();