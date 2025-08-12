import React, { useState, useEffect } from 'react';

const mockSubscription = {
  plan: 'Pro',
  status: 'active',
  nextBillingDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString(),
  price: 19.99,
};

const SubscriptionSettings = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // In the future, this would fetch the user's subscription from the backend.
    setLoading(true);
    setTimeout(() => {
      setSubscription(mockSubscription);
      setLoading(false);
    }, 500); // Simulate network delay
  }, []);

  const handleManageSubscription = () => {
    // This will eventually redirect to the Stripe customer portal.
    alert('Redirecting to subscription management...');
  };

  if (loading) {
    return <div>Loading subscription details...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="subscription-settings" style={{ padding: '2rem' }}>
      <h1>Subscription Details</h1>
      {subscription ? (
        <div className="subscription-card" style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', marginTop: '1rem', maxWidth: '500px' }}>
          <h2>Current Plan: {subscription.plan}</h2>
          <p><strong>Status:</strong> <span style={{ color: subscription.status === 'active' ? 'green' : 'red' }}>{subscription.status}</span></p>
          <p><strong>Next Billing Date:</strong> {subscription.nextBillingDate}</p>
          <p><strong>Price:</strong> ${subscription.price}/mo</p>
          <button onClick={handleManageSubscription} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
            Manage Subscription
          </button>
        </div>
      ) : (
        <p>You do not have an active subscription.</p>
      )}
    </div>
  );
};

export default SubscriptionSettings;