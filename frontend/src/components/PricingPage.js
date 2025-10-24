import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Badge, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './PricingPage.css';

const PricingPage = ({ userStatus, modelTokenBalances, handleWatchAd, handlePurchaseTier }) => {
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adMessage, setAdMessage] = useState('');
  const [selectedAdModel, setSelectedAdModel] = useState('gpt-4.1-nano');
  
  const adModels = [
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', reward: 10000, cost: 20, icon: '⚡' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', reward: 2000, cost: 100, icon: '🚀' },
    { id: 'gpt-4.1', name: 'GPT-4.1', reward: 500, cost: 200, icon: '🧠' }
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
      { text: '100 tokens per month', included: true, icon: '🎁' },
      { text: 'GPT-4.1 Nano (~20 tokens/message)', included: true, icon: '⚡' },
      { text: 'GPT-4.1 Mini (~100 tokens/message)', included: true, icon: '🚀' },
      { text: 'GPT-4.1 (~200 tokens/message)', included: true, icon: '🧠' },
      { text: 'Memory feature', included: true, icon: '💾' },
      { text: 'File upload support', included: true, icon: '📁' },
      { text: 'Watch ads for tokens', included: true, icon: '📺' },
      { text: 'Ad-free experience', included: false, icon: '🚫' },
      { text: 'Unlimited messages', included: false, icon: '∞' },
      { text: 'Priority support', included: false, icon: '🎯' }
    ],
    pro: [
      { text: 'Unlimited tokens', included: true, icon: '∞' },
      { text: 'All AI models available', included: true, icon: '🤖' },
      { text: 'Enhanced memory feature', included: true, icon: '💾' },
      { text: 'File upload support', included: true, icon: '📁' },
      { text: 'Ad-free experience', included: true, icon: '✨' },
      { text: 'Unlimited messages', included: true, icon: '💬' },
      { text: 'Priority support', included: true, icon: '🎯' },
      { text: 'Advanced AI models', included: true, icon: '🧠' }
    ]
  };

  const isProActive = userStatus?.isPaidUser && userStatus?.paidUntil && new Date(userStatus.paidUntil) > new Date();

  return (
    <div className="pricing-page">
      <Container>
        <div className="text-center mb-4">
          <h1 className="pricing-title">Choose Your Plan</h1>
          <p className="pricing-subtitle">Start free, upgrade when you need more power</p>
          
          {/* Current Status */}
          {userStatus && (
            <div className="current-status">
              <Badge className="status-badge">
                {isProActive ? "✨ Pro Plan Active" : "🎯 Free Plan"}
              </Badge>
              <div className="token-info">
                <div className="token-breakdown-pricing">
                  {Object.entries(modelTokenBalances || {}).map(([modelId, balance]) => {
                    const modelName = adModels.find(m => m.id === modelId)?.name || modelId;
                    const modelIcon = adModels.find(m => m.id === modelId)?.icon || '💎';
                    return (
                      <div key={modelId} className="token-item-pricing">
                        <span className="token-model">
                          <span style={{ marginRight: '8px' }}>{modelIcon}</span>
                          {modelName}:
                        </span>
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
            <Card className={`h-100 pricing-card ${!isProActive ? 'current-plan' : ''}`}>
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
                      <span className="feature-text">
                        <span style={{ marginRight: '8px' }}>{feature.icon}</span>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-auto pt-3">
                  <div className="action-buttons">
                    <div className="mb-3">
                      <label className="form-label" style={{ color: '#4a5568', fontWeight: '500', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Choose model for ad reward:
                      </label>
                      <div className="model-selector-pricing">
                        {adModels.map(model => (
                          <div 
                            key={model.id}
                            className={`model-option-pricing ${selectedAdModel === model.id ? 'selected' : ''}`}
                            onClick={() => setSelectedAdModel(model.id)}
                          >
                            <div className="model-info-pricing">
                              <div className="model-name-pricing">
                                <span style={{ marginRight: '8px' }}>{model.icon}</span>
                                {model.name}
                              </div>
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
                      {isWatchingAd ? '📺 Watching Ad...' : `📺 Watch Ad for ${adModels.find(m => m.id === selectedAdModel)?.reward.toLocaleString()} Tokens`}
                    </Button>
                    <small style={{ color: '#718096', display: 'block', textAlign: 'center', fontSize: '0.8rem' }}>
                      Watch ads to earn tokens for your chosen model
                    </small>
                  </div>
                  {isProActive && (
                    <div className="current-plan-indicator mt-3">
                      <Badge style={{ background: '#48bb78', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
                        ✨ Current Plan
                      </Badge>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Pro Plan Card */}
          <Col lg={5} md={6} className="mb-4">
            <Card className={`h-100 pricing-card pro-plan ${isProActive ? 'current-plan' : ''}`}>
              <Card.Header className="text-center">
                <div className="popular-badge">🔥 Most Popular</div>
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
                      <span className="feature-text">
                        <span style={{ marginRight: '8px' }}>{feature.icon}</span>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-auto pt-3">
                  {!isProActive ? (
                    <Button 
                      variant="primary" 
                      onClick={handlePurchaseTier}
                      className="w-100 upgrade-btn"
                    >
                      🚀 Upgrade to Pro
                    </Button>
                  ) : (
                    <div className="current-plan-indicator">
                      <Badge style={{ background: '#48bb78', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '1rem' }}>
                        ✨ Current Plan
                      </Badge>
                      <small style={{ color: '#718096', display: 'block', textAlign: 'center', fontSize: '0.8rem' }}>
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
        <Row className="mt-4">
          <Col md={8} className="mx-auto">
            <Card className="info-card">
              <Card.Body>
                <h5>💡 How it works:</h5>
                <ul className="info-list">
                  <li><strong>🎁 Free Plan:</strong> Start with 100 tokens. Each message costs 1 token. Watch ads to earn more tokens.</li>
                  <li><strong>🚀 Pro Plan:</strong> Unlimited tokens, no ads, and premium features for ₹199/week.</li>
                  <li><strong>💎 Tokens:</strong> Used for AI responses. More complex questions may use more tokens.</li>
                  <li><strong>⚡ Upgrade anytime:</strong> You can upgrade to Pro at any time to unlock unlimited usage.</li>
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
    </div>
  );
}

export default PricingPage;