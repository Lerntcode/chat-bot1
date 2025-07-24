import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Modal, Button, Table, Spinner, Alert } from 'react-bootstrap';

const UsageDashboard = ({ show, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState({ tokenUsage: [], adViews: [], payments: [] });

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    setError(null);
    axios.get('http://localhost:5000/api/v1/usage', {
      headers: { 'x-auth-token': localStorage.getItem('token') }
    })
      .then(res => {
        setUsage(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to fetch usage data.');
        setLoading(false);
      });
  }, [show]);

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Usage Dashboard</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && <div className="text-center my-4"><Spinner animation="border" /></div>}
        {error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && (
          <>
            <h5>Token Usage (last 20)</h5>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tokens Used</th>
                  <th>Model</th>
                  <th>Conversation</th>
                </tr>
              </thead>
              <tbody>
                {usage.tokenUsage.length === 0 ? (
                  <tr><td colSpan={4} className="text-center">No token usage found.</td></tr>
                ) : usage.tokenUsage.map(u => (
                  <tr key={u.id}>
                    <td>{new Date(u.createdAt).toLocaleString()}</td>
                    <td>{u.tokensUsed}</td>
                    <td>{u.modelUsed}</td>
                    <td>{u.conversationId ? u.conversationId.slice(0, 8) + '...' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <h5 className="mt-4">Ad Views (last 20)</h5>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Model</th>
                  <th>Ad ID</th>
                </tr>
              </thead>
              <tbody>
                {usage.adViews.length === 0 ? (
                  <tr><td colSpan={3} className="text-center">No ad views found.</td></tr>
                ) : usage.adViews.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>{a.modelId || '-'}</td>
                    <td>{a.adId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <h5 className="mt-4">Payment History (last 5)</h5>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {usage.payments.length === 0 ? (
                  <tr><td colSpan={5} className="text-center">No payments found.</td></tr>
                ) : usage.payments.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                    <td>{p.amount} {p.currency || 'USD'}</td>
                    <td>{p.status}</td>
                    <td>{p.paymentProvider}</td>
                    <td>{p.planType}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UsageDashboard; 