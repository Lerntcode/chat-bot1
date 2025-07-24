import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Badge, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './PricingPage.css';

const PricingPage = ({ userStatus, modelTokenBalances, handleWatchAd, handlePurchaseTier }) => {
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adMessage, setAdMessage] = useState('');
  const [selectedAdModel, setSelectedAdModel] = useState('gpt-4.1-nano');
  
  const adModels = [
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', reward: 10000, cost: 20 },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', reward: 2000, cost: 100 },
    { id: 'gpt-4.1', name: 'GPT-4.1', reward: 500, cost: 200 }
  ];

  const handleWatchAdClick = async () => {
    setIsWatchingAd(true);
    setAdMessage('');
    try {
      await handleWatchAd(selectedAdModel);
      const selectedModel = adModels.find(m => m.id === selectedAdModel);
      const messagesPossible = Math.floor(selectedModel.reward / selectedModel.cost);
      setAdMessage(`✅ ${selectedModel.reward.toLocaleString()} tokens added! You can use ${selectedModel.name} for ~${messagesPossible} messages.`);
    } catch (error) {
      setAdMessage('❌ Failed to watch ad. Please try again.');
    } finally {
      setIsWatchingAd(false);
    }
  };

  const features = {
    free: [
      { text: '100 tokens per month', included: true },
      { text: 'GPT-4.1 Nano (~20 tokens/message)', included: true },
      { text: 'GPT-4.1 Mini (~100 tokens/message)', included: true },
      { text: 'GPT-4.1 (~200 tokens/message)', included: true },
      { text: 'Memory feature', included: true },
      { text: 'File upload support', included: true },
      { text: 'Watch ads for tokens (500-10,000 tokens)', included: true },
      { text: 'Ad-free experience', included: false },
      { text: 'Unlimited messages', included: false },
      { text: 'Priority support', included: false }
    ],
    pro: [
      { text: 'Unlimited tokens', included: true },
      { text: 'All AI models available', included: true },
      { text: 'Enhanced memory feature', included: true },
      { text: 'File upload support', included: true },
      { text: 'Ad-free experience', included: true },
      { text: 'Unlimited messages', included: true },
      { text: 'Priority support', included: true },
      { text: 'Advanced AI models', included: true }
    ]
  };

  return (
    <Container className="pricing-page mt-5">
      <div className="text-center mb-5">
        <h1 className="pricing-title">Choose Your Plan</h1>
        <p className="pricing-subtitle">Start free, upgrade when you need more</p>
        
        {/* Current Status */}
        {userStatus && (
          <div className="current-status mb-4">
            <Badge bg={userStatus.isPaidUser ? "success" : "info"} className="status-badge">
              {userStatus.isPaidUser ? "Pro Plan Active" : "Free Plan"}
            </Badge>
            <div className="token-info">
              <div className="token-breakdown-pricing">
                {Object.entries(modelTokenBalances || {}).map(([modelId, balance]) => {
                  const modelName = adModels.find(m => m.id === modelId)?.name || modelId;
                  return (
                    <div key={modelId} className="token-item-pricing">
                      <span className="token-model">{modelName}:</span>
                      <span className="token-count">{balance.toLocaleString()} tokens</span>
                    </div>
                  );
                })}
                {Object.keys(modelTokenBalances || {}).length === 0 && (
                  <span className="token-count">No tokens available</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ad Message */}
      {adMessage && (
        <Alert variant={adMessage.includes('✅') ? 'success' : 'danger'} className="mb-4">
          {adMessage}
        </Alert>
      )}

      <Row className="justify-content-center">
        {/* Free Plan Card */}
        <Col lg={5} md={6} className="mb-4">
          <Card className={`h-100 pricing-card ${!userStatus?.isPaidUser ? 'current-plan' : ''}`}>
            <Card.Header className="text-center">
              <h3 className="plan-title">Free Plan</h3>
              <div className="price">$0</div>
              <div className="price-period">forever</div>
            </Card.Header>
            <Card.Body className="d-flex flex-column">
              <div className="features-list">
                {features.free.map((feature, index) => (
                  <div key={index} className={`feature-item ${feature.included ? 'included' : 'not-included'}`}>
                    <span className="feature-icon">
                      {feature.included ? '✅' : '❌'}
                    </span>
                    <span className="feature-text">{feature.text}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-auto pt-4">
                {!userStatus?.isPaidUser ? (
                  <div className="action-buttons">
                    <div className="mb-3">
                      <label className="form-label">Choose model for ad reward:</label>
                      <div className="model-selector-pricing">
                        {adModels.map(model => (
                          <div 
                            key={model.id}
                            className={`model-option-pricing ${selectedAdModel === model.id ? 'selected' : ''}`}
                            onClick={() => setSelectedAdModel(model.id)}
                          >
                            <div className="model-info-pricing">
                              <div className="model-name-pricing">{model.name}</div>
                              <div className="model-reward-pricing">
                                {model.reward.toLocaleString()} tokens (~{Math.floor(model.reward / model.cost)} messages)
                              </div>
                            </div>
                            {selectedAdModel === model.id && <i className="fas fa-check"></i>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button 
                      variant="success" 
                      onClick={handleWatchAdClick}
                      disabled={isWatchingAd}
                      className="w-100 mb-2"
                    >
                      {isWatchingAd ? 'Watching Ad...' : `Watch Ad for ${adModels.find(m => m.id === selectedAdModel)?.reward.toLocaleString()} Tokens`}
                  </Button>
                    <small className="text-muted d-block">
                      Watch ads to earn tokens for your chosen model
                    </small>
                  </div>
                ) : (
                  <div className="current-plan-indicator">
                    <Badge bg="success" className="w-100">Current Plan</Badge>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Pro Plan Card */}
        <Col lg={5} md={6} className="mb-4">
          <Card className={`h-100 pricing-card pro-plan ${userStatus?.isPaidUser ? 'current-plan' : ''}`}>
            <Card.Header className="text-center">
              <div className="popular-badge">Most Popular</div>
              <h3 className="plan-title">Pro Plan</h3>
              <div className="price">₹199</div>
              <div className="price-period">per week</div>
            </Card.Header>
            <Card.Body className="d-flex flex-column">
              <div className="features-list">
                {features.pro.map((feature, index) => (
                  <div key={index} className={`feature-item ${feature.included ? 'included' : 'not-included'}`}>
                    <span className="feature-icon">
                      {feature.included ? '✅' : '❌'}
                    </span>
                    <span className="feature-text">{feature.text}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-auto pt-4">
                {!userStatus?.isPaidUser ? (
                  <Button 
                    variant="primary" 
                    onClick={handlePurchaseTier}
                    className="w-100 upgrade-btn"
                  >
                    Upgrade to Pro
                  </Button>
                ) : (
                  <div className="current-plan-indicator">
                    <Badge bg="success" className="w-100">Current Plan</Badge>
                    <small className="text-muted d-block mt-2">
                      Active until: {userStatus.paidUntil ? new Date(userStatus.paidUntil).toLocaleDateString() : 'N/A'}
                    </small>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Additional Info */}
      <Row className="mt-5">
        <Col md={8} className="mx-auto">
          <Card className="info-card">
            <Card.Body>
              <h5>How it works:</h5>
              <ul className="info-list">
                <li><strong>Free Plan:</strong> Start with 100 tokens. Each message costs 1 token. Watch ads to earn more tokens.</li>
                <li><strong>Pro Plan:</strong> Unlimited tokens, no ads, and premium features for ₹199/week.</li>
                <li><strong>Tokens:</strong> Used for AI responses. More complex questions may use more tokens.</li>
                <li><strong>Upgrade anytime:</strong> You can upgrade to Pro at any time to unlock unlimited usage.</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="text-center mt-4">
        <Link to="/">
          <Button variant="outline-secondary">← Back to Chat</Button>
        </Link>
      </div>
    </Container>
  );
};

export default PricingPage;