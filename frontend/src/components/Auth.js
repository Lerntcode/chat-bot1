import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import './Auth.css';
import { parseApiError, showErrorNotification } from '../utils/errorHandler';

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
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);

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

  // Check if Google OAuth is enabled
  useEffect(() => {
    const checkGoogleAuthStatus = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/v1/auth/google/status');
        setGoogleAuthEnabled(response.data.configured);
      } catch (error) {
        console.log('Google OAuth not configured');
      }
    };
    checkGoogleAuthStatus();
  }, []);

  // Handle Google OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'true' && token) {
      localStorage.setItem('token', token);
      onAuthSuccess();
    } else if (error) {
      setMessage(`Authentication failed: ${error}`);
    }
  }, [onAuthSuccess]);

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
      const parsedError = parseApiError(error);
      console.error('Auth error:', parsedError);
      setMessage(parsedError.message);
      showErrorNotification(parsedError, { title: 'Authentication Error' });
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
      const parsedError = parseApiError(error);
      console.error('Verification error:', parsedError);
      setMessage(parsedError.message);
      showErrorNotification(parsedError, { title: 'Verification Error' });
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
      const parsedError = parseApiError(error);
      console.error('2FA error:', parsedError);
      setMessage(parsedError.message);
      showErrorNotification(parsedError, { title: '2FA Error' });
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = 'http://localhost:5000/api/v1/auth/google';
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

      {/* Google OAuth Button */}
      {googleAuthEnabled && !twoFactorRequired && !pendingVerification && (
        <div className="google-auth-section">
          <div className="divider">
            <span>or</span>
          </div>
          <button 
            type="button" 
            className="google-auth-button"
            onClick={handleGoogleAuth}
          >
            <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
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