import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const mockPlans = [
  {
    id: 1,
    name: 'Basic',
    price: 9.99,
    features: ['50 messages/day', 'Basic model access', 'Email support'],
    stripePriceId: 'price_basic_mock',
  },
  {
    id: 2,
    name: 'Pro',
    price: 19.99,
    features: ['Unlimited messages', 'Advanced model access', 'Priority support', 'Early access to new features'],
    stripePriceId: 'price_pro_mock',
  },
  {
    id: 3,
    name: 'Enterprise',
    price: 49.99,
    features: ['All Pro features', 'Dedicated support', 'Custom integrations', 'Team management'],
    stripePriceId: 'price_enterprise_mock',
  },
];

const getPlans = async () => {
  // In the future, this will make a real API call
  // const response = await axios.get(`${API_URL}/subscriptions/plans`);
  // return response.data;
  return Promise.resolve(mockPlans);
};

const createCheckoutSession = async (priceId) => {
  // In the future, this will make a real API call
  // const response = await axios.post(`${API_URL}/subscriptions/create-checkout-session`, { priceId });
  // return response.data;
  console.log(`Creating checkout session for priceId: ${priceId}`);
  return Promise.resolve({ id: 'cs_test_mock' });
};

export const subscriptionService = {
  getPlans,
  createCheckoutSession,
};