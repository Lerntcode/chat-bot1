import React, { useState, useEffect } from 'react';
import { subscriptionService } from '../../services/subscription.service';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe only if the publishable key is available
let stripePromise;
if (process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY) {
  try {
    stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
  } catch (error) {
    console.error('Failed to load Stripe', error);
  }
}

const PricingPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (priceId) => {
    try {
      setLoading(true);
      
      if (!stripePromise) {
        setError('Payment processing is currently unavailable. Please try again later.');
        return;
      }
      
      const { sessionId } = await subscriptionService.createCheckoutSession(priceId);
      const stripe = await stripePromise;
      
      if (!stripe) {
        throw new Error('Payment processor not available');
      }
      
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      setError(error.message || 'Failed to start subscription. Please try again.');
      console.error('Subscription error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const fetchedPlans = await subscriptionService.getPlans();
        setPlans(fetchedPlans);
        setError('');
      } catch (err) {
        setError('Failed to load pricing plans.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  if (loading && plans.length === 0) {
    return <div>Loading plans...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="pricing-page" style={{ padding: '2rem' }}>
      <h1>Choose Your Plan</h1>
      <div className="plans-container" style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '2rem' }}>
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card" style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', width: '300px', textAlign: 'center' }}>
            <h2>{plan.name}</h2>
            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>${plan.price}/mo</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0' }}>
              {plan.features.map((feature, index) => (
                <li key={index} style={{ marginBottom: '0.5rem' }}>{feature}</li>
              ))}
            </ul>
            <button onClick={() => handleSubscribe(plan.stripePriceId)} disabled={loading} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
              {loading ? 'Processing...' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPage;