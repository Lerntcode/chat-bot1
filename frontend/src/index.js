import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider, setNotificationContext } from './components/NotificationSystem';
// Basic CSP for frontend as defense-in-depth when served statically
const csp = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net blob:; worker-src 'self' blob:; connect-src 'self' http://localhost:5000 ws: wss: https://cdn.jsdelivr.net;";
const meta = document.createElement('meta');
meta.httpEquiv = 'Content-Security-Policy';
meta.content = csp;
document.head.appendChild(meta);

const root = ReactDOM.createRoot(document.getElementById('root'));

// Create notification context reference
let notificationContextRef = null;

root.render(
  <React.StrictMode>
    <NotificationProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </NotificationProvider>
  </React.StrictMode>
);

// Set up global notification function
window.showNotification = (notification) => {
  if (notificationContextRef) {
    return notificationContextRef.addNotification(notification);
  }
  console.log(`[${notification.type || 'info'}] ${notification.title || ''}: ${notification.message}`);
  return null;
};

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();