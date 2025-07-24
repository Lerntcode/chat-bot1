import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const PricingModal = ({ show, handleClose, handlePurchaseTier }) => {
  return (
    <Modal show={show} onHide={handleClose} centered className="pricing-modal">
      <Modal.Header closeButton>
        <Modal.Title>Upgrade to Premium</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h4>Free Tier</h4>
        <ul>
          <li>Limited tokens per message</li>
          <li>Watch ads to earn more tokens</li>
          <li>Basic chat features</li>
        </ul>

        <h4 className="mt-4">Premium Tier</h4>
        <ul>
          <li>Unlimited tokens</li>
          <li>No ads</li>
          <li>Advanced chat features (future)</li>
          <li>Priority support (future)</li>
        </ul>

        <p className="mt-4">Unlock unlimited access and an ad-free experience for just ₹199/week!</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button variant="primary" onClick={handlePurchaseTier}>
          Upgrade to Premium
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PricingModal;