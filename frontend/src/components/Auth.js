import React, { useState, useMemo } from 'react';
import axios from 'axios';
import './Auth.css';

const Auth = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorUserId, setTwoFactorUserId] = useState('');

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
      if (isLogin) {
        const response = await axios.post('http://localhost:5000/api/v1/auth/login', { email, password });
        if (response.data?.twoFactorRequired) {
          setTwoFactorRequired(true);
          setTwoFactorUserId(response.data.userId);
          setMessage('Enter your 2FA code to continue.');
          return;
        }
        const token = response.data.accessToken;
        localStorage.setItem('token', token);
        onAuthSuccess();
      } else {
        const response = await axios.post('http://localhost:5000/api/v1/auth/register', { email, password });
        if (response.data?.verificationToken) {
          setPendingVerification(true);
          setMessage('Registration successful. Check email for verification link. For testing, paste the token below.');
          setVerificationToken(response.data.verificationToken);
        } else {
          setMessage('Registration successful. Please verify your email.');
          setPendingVerification(true);
        }
      }
    } catch (error) {
      console.error('Auth error:', error.response?.data || error.message);
      setMessage(error.response?.data?.msg || error.response?.data?.error || 'An error occurred');
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/v1/auth/verify-email', { token: verificationToken });
      setMessage('Email verified. You can now log in.');
      setPendingVerification(false);
      setIsLogin(true);
    } catch (error) {
      setMessage(error.response?.data?.msg || 'Verification failed');
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/v1/auth/2fa/verify-login', { userId: twoFactorUserId, token: twoFactorToken });
      const token = response.data.accessToken;
      localStorage.setItem('token', token);
      onAuthSuccess();
    } catch (error) {
      setMessage(error.response?.data?.msg || 'Invalid 2FA code');
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      {!twoFactorRequired && !pendingVerification && (
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
      )}

      {pendingVerification && (
        <form onSubmit={handleVerifyEmail}>
          <input
            type="text"
            placeholder="Verification token"
            value={verificationToken}
            onChange={(e) => setVerificationToken(e.target.value)}
            required
          />
          <button type="submit">Verify Email</button>
        </form>
      )}

      {twoFactorRequired && (
        <form onSubmit={handleVerify2FA}>
          <input
            type="text"
            placeholder="2FA code"
            value={twoFactorToken}
            onChange={(e) => setTwoFactorToken(e.target.value)}
            required
          />
          <button type="submit">Verify 2FA</button>
        </form>
      )}

      <p onClick={() => { setIsLogin(!isLogin); setMessage(''); setPendingVerification(false); setTwoFactorRequired(false); }}>
        {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
      </p>
      {message && <p className="error-message">{message}</p>}
    </div>
  );
};

export default Auth;