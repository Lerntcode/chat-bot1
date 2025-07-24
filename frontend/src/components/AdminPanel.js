import React, { useState, useEffect, useCallback } from 'react';
import './AdminPanel.css';

const AdminPanel = ({ isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [error, setError] = useState(null);

  const fetchTabData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      
      switch (activeTab) {
        case 'dashboard':
          endpoint = '/api/v1/admin/system/stats';
          break;
        case 'users':
          endpoint = '/api/v1/admin/users';
          break;
        case 'tokens':
          endpoint = '/api/v1/admin/tokens';
          break;
        case 'analytics':
          endpoint = '/api/v1/admin/analytics';
          break;
        case 'payments':
          endpoint = '/api/v1/admin/payments';
          break;
        case 'monitoring':
          endpoint = '/api/v1/monitoring/metrics';
          break;
        default:
          endpoint = '/api/v1/admin/system/stats';
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${endpoint}`, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isVisible && activeTab) {
      fetchTabData();
    }
  }, [isVisible, activeTab, fetchTabData]);

  const renderDashboard = () => (
    <div className="admin-dashboard">
      <h3>System Overview</h3>
      {loading ? (
        <div className="loading">Loading...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Users</h4>
            <p className="stat-number">{data.users || 0}</p>
          </div>
          <div className="stat-card">
            <h4>Conversations</h4>
            <p className="stat-number">{data.conversations || 0}</p>
          </div>
          <div className="stat-card">
            <h4>Messages</h4>
            <p className="stat-number">{data.messages || 0}</p>
          </div>
          <div className="stat-card">
            <h4>Ad Views</h4>
            <p className="stat-number">{data.adViews || 0}</p>
          </div>
          <div className="stat-card">
            <h4>Payments</h4>
            <p className="stat-number">{data.payments || 0}</p>
          </div>
          <div className="stat-card">
            <h4>File Uploads</h4>
            <p className="stat-number">{data.fileUploads || 0}</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="admin-users">
      <h3>User Management</h3>
      {loading ? (
        <div className="loading">Loading users...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(data.users) ? data.users : []).map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.name || 'N/A'}</td>
                  <td>
                    <span className={`plan-badge ${user.planStatus}`}>
                      {user.planStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-small">Edit</button>
                    <button className="btn-small btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderTokens = () => (
    <div className="admin-tokens">
      <h3>Token Management</h3>
      {loading ? (
        <div className="loading">Loading token data...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="tokens-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Model</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.tokenBalances?.map(balance => (
                <tr key={balance.id}>
                  <td>{balance.User?.email || 'N/A'}</td>
                  <td>{balance.modelId}</td>
                  <td>{balance.balance.toLocaleString()}</td>
                  <td>
                    <button className="btn-small">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="admin-analytics">
      <h3>Analytics & Reports</h3>
      {loading ? (
        <div className="loading">Loading analytics...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="analytics-grid">
          <div className="analytics-card">
            <h4>User Growth (30 days)</h4>
            <div className="chart-placeholder">
              {/* Defensive: check if data.userAnalytics is an array */}
              {Array.isArray(data.userAnalytics) ? `Data points: ${data.userAnalytics.length}` : 'No data'}
            </div>
          </div>
          <div className="analytics-card">
            <h4>Revenue Analytics</h4>
            <div className="chart-placeholder">
              {Array.isArray(data.revenueAnalytics) ? `Data points: ${data.revenueAnalytics.length}` : 'No data'}
            </div>
          </div>
          <div className="analytics-card">
            <h4>Model Usage</h4>
            <div className="chart-placeholder">
              {Array.isArray(data.modelAnalytics) ? `Data points: ${data.modelAnalytics.length}` : 'No data'}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPayments = () => (
    <div className="admin-payments">
      <h3>Payment Management</h3>
      {loading ? (
        <div className="loading">Loading payments...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="payments-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(data.payments) ? data.payments : []).map(payment => (
                <tr key={payment.id}>
                  <td>{payment.User?.email || 'N/A'}</td>
                  <td>${payment.amount}</td>
                  <td>
                    <span className={`status-badge ${payment.status}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td>{payment.paymentProvider}</td>
                  <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-small">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderMonitoring = () => (
    <div className="admin-monitoring">
      <h3>System Monitoring</h3>
      {loading ? (
        <div className="loading">Loading monitoring data...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="monitoring-grid">
          <div className="monitoring-card">
            <h4>Database Status</h4>
            <p>Connection: {data.database?.connectionStatus || 'Unknown'}</p>
            <p>Total Tables: {data.database?.totalTables || 0}</p>
            <p>Total Size: {data.database?.totalSize || 0} MB</p>
          </div>
          <div className="monitoring-card">
            <h4>Application Metrics</h4>
            <p>Total Users: {data.application?.users?.total || 0}</p>
            <p>Active Users: {data.application?.users?.active || 0}</p>
            <p>Total Tokens Used: {data.application?.usage?.totalTokens || 0}</p>
          </div>
          <div className="monitoring-card">
            <h4>System Health</h4>
            <p>Status: {data.system?.overall?.status || 'Unknown'}</p>
            <p>Health Score: {data.system?.overall?.healthPercentage || 0}%</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'users':
        return renderUsers();
      case 'tokens':
        return renderTokens();
      case 'analytics':
        return renderAnalytics();
      case 'payments':
        return renderPayments();
      case 'monitoring':
        return renderMonitoring();
      default:
        return renderDashboard();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button 
            className={`tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
            onClick={() => setActiveTab('tokens')}
          >
            Tokens
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button 
            className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            Payments
          </button>
          <button 
            className={`tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitoring')}
          >
            Monitoring
          </button>
        </div>
        
        <div className="admin-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 