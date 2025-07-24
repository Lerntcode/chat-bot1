import React, { useState, useMemo } from 'react';
import axios from 'axios';
import './Auth.css';

const Auth = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const passwordValidation = useMemo(() => {
    const errors = [];
    if (password.length < 8) {
      errors.push("at least 8 characters");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("an uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("a lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("a number");
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push("a special character");
    }
    return errors;
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!isLogin && passwordValidation.length > 0) {
      setMessage(`Password must contain ${passwordValidation.join(', ')}.`);
      return;
    }

    try {
      const url = isLogin ? 'http://localhost:5000/api/v1/auth/login' : 'http://localhost:5000/api/v1/auth/register';
      const response = await axios.post(url, { email, password });
      
      const token = isLogin ? response.data.accessToken : response.data.token;
      localStorage.setItem('token', token);
      onAuthSuccess();
    } catch (error) {
      console.error('Auth error:', error.response?.data || error.message);
      setMessage(error.response?.data?.msg || error.response?.data?.error || 'An error occurred');
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {!isLogin && password.length > 0 && passwordValidation.length > 0 && (
          <div className="password-strength">
            <p>Password must contain:</p>
            <ul>
              {passwordValidation.map(rule => <li key={rule}>{rule}</li>)}
            </ul>
          </div>
        )}
        <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
      </form>
      <p onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
      </p>
      {message && <p className="error-message">{message}</p>}
    </div>
  );
};

export default Auth;