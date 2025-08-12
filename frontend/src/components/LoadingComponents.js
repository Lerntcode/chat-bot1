import React from 'react';

// Skeleton Loading Components
export const MessageSkeleton = () => (
  <div className="d-flex justify-content-start mb-3 fade-in">
    <div className="assistant-message p-3 rounded">
      <div className="skeleton skeleton-text short"></div>
      <div className="skeleton skeleton-text medium"></div>
      <div className="skeleton skeleton-text long"></div>
      <div className="skeleton skeleton-text short"></div>
    </div>
  </div>
);

export const ChatListSkeleton = () => (
  <div className="fade-in">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="list-group-item bg-transparent text-light d-flex justify-content-between align-items-center mb-2">
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-text medium mb-1"></div>
          <div className="skeleton skeleton-text short"></div>
        </div>
        <div className="skeleton skeleton-button"></div>
      </div>
    ))}
  </div>
);

export const LoadingSpinner = ({ text = "Loading..." }) => (
  <div className="loading-container fade-in">
    <div className="loading-spinner"></div>
    <div className="loading-text">{text}</div>
  </div>
);

export const TypingIndicator = ({ modelName }) => (
  <div className="typing-indicator slide-up" role="status" aria-live="polite" aria-label="AI is typing">
    <div className="bot-header">
      <strong>AI</strong>
      {modelName && (
        <span className="model-indicator ms-2" aria-label={`Using model: ${modelName}`}>
          {modelName}
        </span>
      )}
    </div>
    <div className="chatgpt-pulse" aria-hidden="true">
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>
);

// Enhanced Button Component
export const EnhancedButton = ({ 
  children, 
  className = "", 
  variant = "primary", 
  size = "md",
  loading = false,
  disabled = false,
  ...props 
}) => {
  const baseClass = "modern-button enhanced-typography";
  const variantClass = variant === "primary" ? "btn-primary" : `btn-${variant}`;
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  
  return (
    <button 
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <div className="loading-spinner" style={{ width: 16, height: 16, marginRight: 8 }}></div>
          Loading...
        </>
      ) : children}
    </button>
  );
};

// Animated Message Container
export const AnimatedMessage = ({ children, isNew = false }) => (
  <div className={`${isNew ? 'message-enter message-enter-active' : ''}`}>
    {children}
  </div>
);

// Enhanced Typography Components
export const GradientText = ({ children, className = "" }) => (
  <span className={`text-gradient ${className}`}>
    {children}
  </span>
);

export const EnhancedHeading = ({ level = 1, children, className = "" }) => {
  const Tag = `h${level}`;
  return (
    <Tag className={`enhanced-typography ${className}`}>
      {children}
    </Tag>
  );
};

// Progress Indicator
export const ProgressBar = ({ progress = 0, className = "" }) => (
  <div className={`progress ${className}`} style={{ height: 4 }}>
    <div 
      className="progress-bar" 
      style={{ 
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        transition: 'width 0.3s ease'
      }}
    ></div>
  </div>
);

// Toast Notification Component
export const Toast = ({ 
  message, 
  type = "info", 
  onClose, 
  autoClose = true,
  duration = 3000 
}) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose, duration]);

  const typeColors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };

  return (
    <div 
      className="toast-notification slide-up"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        background: typeColors[type],
        color: 'white',
        padding: '12px 16px',
        borderRadius: 8,
        zIndex: 1000,
        maxWidth: 300
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{message}</span>
        {onClose && (
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              marginLeft: 8,
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};
