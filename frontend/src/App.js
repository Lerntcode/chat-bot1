import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { Modal, Button } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Auth from './components/Auth';
import { Route, Routes, Link, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import DOMPurify from 'dompurify';
import { Suspense } from 'react';
import { preloadRoutes, measurePerformance, optimizeChunkLoading } from './bundleOptimization';
import { LoadingSpinner, TypingIndicator, EnhancedButton, AnimatedMessage } from './components/LoadingComponents';

// Error handling imports
import ErrorBoundary from './components/ErrorBoundary';
import { setupGlobalErrorHandling, parseApiError, showErrorNotification } from './utils/errorHandler';

// Import components directly (temporarily disabled lazy loading)
import PricingPage from './components/PricingPage';
import AdminPanel from './components/AdminPanel';
import UsageDashboard from './components/UsageDashboard';
import ModeSelectionPage from './ModeSelectionPage';
import CodingMode from './components/CodingMode';

// Simple token estimator: rough heuristic ~4 chars/token
function estimateTokens(text = '') {
  const len = (text || '').length;
  return Math.max(1, Math.ceil(len / 4));
}

// Centralized sanitizer for any user/AI-provided content rendered as HTML
function sanitizeContent(content) {
  if (content === null || content === undefined) return '';
  const stringContent = typeof content === 'string' ? content : String(content);
  return DOMPurify.sanitize(stringContent, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'br', 'p', 'ul', 'ol', 'li', 'span', 'small'
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class']
  });
}

// Returns a human string and parts until next local midnight or a provided timestamp
// eslint-disable-next-line no-unused-vars
function getTimeUntilReset(nextResetAt) {
  const now = new Date();
  const target = nextResetAt ? new Date(nextResetAt) : new Date(now);
  if (!nextResetAt) {
    target.setHours(24, 0, 0, 0); // local midnight
  }
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const seconds = Math.floor((diffMs % 60000) / 1000);
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
  return { hours, minutes, seconds, label };
}

const TypingEffect = ({ text, isTyping = true, showDots = false }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const ref = useRef();

  useEffect(() => {
    if (!isTyping || !text) {
      setDisplayedText(text || '');
      setCurrentIndex(0);
      return;
    }

    setDisplayedText('');
    setCurrentIndex(0);

    const words = text.split(' ');
    let wordIndex = 0;

    const timer = setInterval(() => {
      if (wordIndex < words.length) {
        setDisplayedText(prev => prev + (wordIndex === 0 ? '' : ' ') + words[wordIndex]);
        wordIndex++;
        setCurrentIndex(wordIndex);
      } else {
        clearInterval(timer);
      }
    }, 50); // 10ms per word for faster typing

    return () => clearInterval(timer);
  }, [text, isTyping]);

  // Only scroll on initial render, not during typing
  useEffect(() => {
    if (ref.current && !isTyping) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isTyping]);

  // If showing dots (bot thinking), show dots animation
  if (showDots) {
    return (
      <span className="chat-bubble bot-bubble typing-effect" ref={ref} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
        fontSize: '1.08rem',
        lineHeight: 1.6,
        padding: '8px 12px',
        minWidth: '40px'
      }}>
        <span>•</span><span>•</span><span>•</span>
      </span>
    );
  }

  // Show typing text
  return (
    <span className="chat-bubble bot-bubble" ref={ref} style={{
      display: 'inline-block',
      fontFamily: 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
      fontSize: '1.08rem',
      lineHeight: 1.6,
      padding: '8px 12px'
    }}>
      {displayedText}
      {currentIndex < text.split(' ').length && <span className="typing-cursor">|</span>}
    </span>
  );
};



const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return !inline && match ? (
    <div className="code-block-container">
      <SyntaxHighlighter style={a11yDark} language={match[1]} PreTag="div" {...props}>
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
      <Button onClick={handleCopy} className="copy-button" variant="secondary" size="sm">
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};



// ErrorBanner component
const ErrorBanner = ({ message, onClose }) => (
  <div className="error-banner" role="alert" aria-live="assertive">
    <span dangerouslySetInnerHTML={{ __html: sanitizeContent(message) }} />
    <button className="close-btn" onClick={onClose} aria-label="Dismiss error">&times;</button>
  </div>
);

// NotificationBanner component
const NotificationBanner = ({ warnings, onClose }) => {
  if (!warnings || (!warnings.lowTokenWarning && !warnings.paidExpiryWarning)) return null;
  return (
    <div className="notification-banner" role="alert" aria-live="assertive">
      <div>
        {warnings.lowTokenWarning && (
          <div>
            <strong>Low Token Warning:</strong> Your token balance is low for model(s): <span dangerouslySetInnerHTML={{ __html: sanitizeContent(warnings.lowTokenModels.join(', ')) }} />. Please watch ads or upgrade to continue chatting.
          </div>
        )}
        {warnings.paidExpiryWarning && (
          <div>
            <strong>Paid Plan Expiring Soon:</strong> Your paid access expires in <span dangerouslySetInnerHTML={{ __html: sanitizeContent(warnings.paidExpiryDaysLeft.toString()) }} /> day(s). Renew soon to avoid losing premium features.
          </div>
        )}
      </div>
      <button className="close-btn" onClick={onClose} aria-label="Dismiss notification">&times;</button>
    </div>
  );
};

// Define ChatInput above App (custom styled input box)
const ChatInput = React.memo(({ message, setMessage, isSending, handleSendMessage, selectedFile, setSelectedFile, supportedFormats, handlePlusClick, handleFileChange, handleToggleRecording, isRecording, fileInputRef, mode, modePrompts, sidebarOpen, isMobile }) => {
  const inputStyle = {
    left: isMobile ? '0' : (sidebarOpen ? '260px' : '0')
  };

  return (
    <div className="container_chat_bot" role="form" aria-label="Chat input" style={inputStyle}>
      <div className="container-chat-options">
        <div className="chat">
          <div className="chat-bot">
            <textarea
              id="chat_bot"
              name="chat_bot"
              placeholder={isSending ? 'Sending...' : (modePrompts && mode && modePrompts[mode] ? modePrompts[mode] : 'Imagine Something...✦˚')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSending && message.trim()) handleSendMessage(message);
                }
              }}
              aria-label="Type your message here"
              rows={1}
              disabled={isSending}
            />
          </div>
          {selectedFile && (
            <div className="selected-file" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 8px' }}>
              <div className="file-info" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-file"></i>
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button onClick={() => setSelectedFile(null)} disabled={isSending} aria-label="Remove selected file" style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer' }}>&times;</button>
            </div>
          )}
          <div className="options">
            <div className="btns-add">
              {/* Upload button */}
              <button onClick={!isSending ? handlePlusClick : undefined} aria-label="Attach a file" disabled={isSending}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8v8a5 5 0 1 0 10 0V6.5a3.5 3.5 0 1 0-7 0V15a2 2 0 0 0 4 0V8"></path>
                </svg>
              </button>
              {/* Grid icon (visual only) */}
              <button type="button" aria-label="Apps" disabled={isSending}>
                <svg viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                  <path d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm0 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zm0-8h6m-3-3v6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="none"></path>
                </svg>
              </button>
              {/* Globe icon (visual only) */}
              <button type="button" aria-label="Globe" disabled={isSending}>
                <svg viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                  <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m-2.29-2.333A17.9 17.9 0 0 1 8.027 13H4.062a8.01 8.01 0 0 0 5.648 6.667M10.03 13c.151 2.439.848 4.73 1.97 6.752A15.9 15.9 0 0 0 13.97 13zm9.908 0h-3.965a17.9 17.9 0 0 1-1.683 6.667A8.01 8.01 0 0 0 19.938 13M4.062 11h3.965A17.9 17.9 0 0 1 9.71 4.333A8.01 8.01 0 0 0 4.062 11m5.969 0h3.938A15.9 15.9 0 0 0 12 4.248A15.9 15.9 0 0 0 10.03 11m4.259-6.667A17.9 17.9 0 0 1 15.973 11h3.965a8.01 8.01 0 0 0-5.648-6.667" fill="currentColor"></path>
                </svg>
              </button>
            </div>
            <button className="btn-submit" onClick={!isSending && message.trim() ? () => handleSendMessage(message) : undefined} aria-label="Send message" disabled={isSending || !message.trim()}>
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <path fill="#d1d5db" d="M7.233 20.987L21.29 13.88c1.482-.74 1.482-3.02 0-3.76L7.233 3.013A2 2 0 0 0 4.36 4.77l1.1 3.3a2 2 0 0 0 1.9 1.38h7.89c.62 0 .88.8.32 1.14L7.177 15.8a2 2 0 0 0-.92 1.11l-1.11 3.34a2 2 0 0 0 2.096 2.737z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Quick actions outside the input box */}
      <div className="tags" aria-label="Quick actions">
        {mode && modePrompts && modePrompts[mode] && (
          <span tabIndex={0} onClick={() => setMessage(modePrompts[mode])} onKeyDown={(e) => { if (e.key === 'Enter') setMessage(modePrompts[mode]); }} aria-label={`Use ${mode} prompt`}>
            Use {mode} prompt
          </span>
        )}
        <span tabIndex={0} onClick={() => setMessage(prev => prev ? prev : 'Create an image of...')} onKeyDown={(e) => { if (e.key === 'Enter') setMessage(prev => prev ? prev : 'Create an image of...'); }} aria-label="Create An Image">
          Create An Image
        </span>
        <span tabIndex={0} onClick={() => setMessage(prev => prev ? prev : 'Analyze this data: ')} onKeyDown={(e) => { if (e.key === 'Enter') setMessage(prev => prev ? prev : 'Analyze this data: '); }} aria-label="Analyse Data">
          Analyse Data
        </span>
        <span tabIndex={0} onClick={() => setMessage(prev => prev ? prev : 'More: ')} onKeyDown={(e) => { if (e.key === 'Enter') setMessage(prev => prev ? prev : 'More: '); }} aria-label="More">
          More
        </span>
      </div>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={isSending}
        accept={supportedFormats.map(format => `.${format}`).join(',')}
      />
    </div>
  );
});

// Move ChatMessage above App
const ChatMessage = React.memo(({ chat, index, isLastMessage, availableModels, selectedModel, setCurrentConversation, conversationId, handleSummarizeConversation, editingMessageId, editingText, setEditingText, startEditMessage, saveEditResend, cancelEdit, onToggleReaction }) => (
  <AnimatedMessage key={chat.id || chat._id || chat.timestamp || index} isNew={isLastMessage}>
    {/* User Message */}
    {(chat.user || chat.isUserMessage) && (
      <div className="d-flex justify-content-end mb-3">
        <div className="user-message p-3 rounded style-gradient" role="article" aria-label="User message" tabIndex={0}>
          {chat.tokenMeter && (
            <div className="token-meter" style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8, textAlign: 'right' }}>
              ≈ {chat.tokenMeter.total || 0} tok
            </div>
          )}
          {editingMessageId === chat.id ? (
            <div className="edit-container">
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="form-control mb-2"
                rows={3}
                style={{ background: 'var(--input-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                aria-label="Edit your message"
                placeholder="Edit your message..."
              />
              <div className="d-flex gap-2" role="group" aria-label="Edit message actions">
                <EnhancedButton
                  size="sm"
                  onClick={saveEditResend}
                  aria-label="Save changes and resend message"
                >
                  Save & Resend
                </EnhancedButton>
                <EnhancedButton
                  variant="secondary"
                  size="sm"
                  onClick={cancelEdit}
                  aria-label="Cancel editing"
                >
                  Cancel
                </EnhancedButton>
              </div>
            </div>
          ) : (
            <>
              <div className="message-content-wrapper">
                <div>
                  <strong>You:</strong> <span dangerouslySetInnerHTML={{ __html: sanitizeContent(chat.user || chat.message) }} />
                  {chat.edited && <small className="ms-2 text-muted" aria-label="This message was edited">(edited)</small>}
                </div>
                <div className="user-message-actions">
                  <button
                    className="icon-button"
                    aria-label="Edit message"
                    title="Edit & resend"
                    onClick={() => startEditMessage(chat)}
                  >
                    <i className="fas fa-pen"></i>
                  </button>
                  <div className="reactions-bar">
                    {['up', 'down', 'smile'].map(k => (
                      <button
                        key={k}
                        className={`reaction-btn ${chat.userReaction === k ? 'active' : ''}`}
                        onClick={() => onToggleReaction && onToggleReaction(chat.id, k)}
                        aria-pressed={chat.userReaction === k}
                        title={k === 'up' ? 'Like' : k === 'down' ? 'Dislike' : 'Smile'}
                      >
                        {k === 'up' ? '👍' : k === 'down' ? '👎' : '🙂'}
                        <span className="count">{(chat.reactions && chat.reactions[k]) || 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    {/* Assistant Message */}
    {(chat.bot || chat.isTyping) && (
      <div className="d-flex justify-content-start mb-3">
        <div className="assistant-message p-3 rounded style-gradient" role="article" aria-label="Assistant message" tabIndex={0}>
          {chat.tokenMeter && (
            <div className="token-meter" style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
              <span>
                ≈ {chat.tokenMeter.total || 0} tok
                {chat.isTyping && <span> (streaming)</span>}
              </span>
            </div>
          )}
          {chat.isTyping ? (
            <TypingIndicator modelName={chat.metadata?.modelLabel} />
          ) : (
            <div className="message-content-wrapper">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{sanitizeContent(chat.bot)}</ReactMarkdown>
              <div className="bot-message-actions">
                <button
                  className="icon-button"
                  aria-label="Copy message to clipboard"
                  title="Copy"
                  onClick={() => navigator.clipboard.writeText(chat.bot || '')}
                >
                  <i className="fas fa-copy" aria-hidden="true"></i>
                </button>
                <button
                  className="icon-button"
                  aria-label="Regenerate this response"
                  title="Regenerate"
                  onClick={() => window.__regenerateFromMessageIndex && window.__regenerateFromMessageIndex(index)}
                >
                  <i className="fas fa-rotate-right" aria-hidden="true"></i>
                </button>
                <div className="reactions-bar" role="group" aria-label="Message reactions">
                  {['up', 'down', 'smile'].map(k => (
                    <button
                      key={k}
                      className={`reaction-btn ${chat.userReaction === k ? 'active' : ''}`}
                      onClick={() => onToggleReaction && onToggleReaction(chat.id, k)}
                      aria-pressed={chat.userReaction === k}
                      aria-label={`${k === 'up' ? 'Like' : k === 'down' ? 'Dislike' : 'Smile'} this message. Current count: ${(chat.reactions && chat.reactions[k]) || 0}`}
                      title={k === 'up' ? 'Like' : k === 'down' ? 'Dislike' : 'Smile'}
                    >
                      {k === 'up' ? '👍' : k === 'down' ? '👎' : '🙂'}
                      <span className="count" aria-hidden="true">{(chat.reactions && chat.reactions[k]) || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!chat.isTyping && (
            <i
              className="fas fa-volume-up speaker-icon"
              onClick={() => window.speechSynthesis.speak(new SpeechSynthesisUtterance(chat.bot))}
              aria-label="Read message aloud"
              role="button"
              tabIndex="0"
            ></i>
          )}
          {chat.bot && conversationId && !chat.isTyping && (
            <Button
              variant="link"
              className="summarize-button"
              onClick={() => handleSummarizeConversation(conversationId)}
              aria-label="Summarize this conversation"
            >
              Summarize Conversation
            </Button>
          )}
        </div>
      </div>
    )}
  </AnimatedMessage>
));


const App = () => {
  // Setup global error handling
  useEffect(() => {
    setupGlobalErrorHandling();
  }, []);
  // === 1. All hooks at the very top ===
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentConversation, setCurrentConversation] = useState({ id: null, messages: [] });
  const [conversations, setConversations] = useState([]);
  const [memory, setMemory] = useState([]);
  const [editingMemory, setEditingMemory] = useState(null);
  const [showMemoryModal, setShowMemoryModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [supportedFormats, setSupportedFormats] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-nano');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // --- Memory helpers (inside App scope) ---
  const createMemory = async (text) => {
    const payload = (text || "").trim();
    if (!payload) return;
    try {
      const response = await axios.post('http://localhost:5000/api/v1/memory', { text: payload }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMemory((prev) => [response.data, ...prev]);
    } catch (error) {
      // Silent fail to avoid interrupting chat flow
      console.warn('createMemory failed', error?.response?.status || '', error?.message || error);
    }
  };

  // Extract memory-worthy snippet from arbitrary text
  const extractMemoryCandidate = (raw) => {
    const text = (raw || "").toString();
    if (!text) return null;
    // Patterns: introductions, roles, email/phone, preferences, timezone
    const rules = [
      /\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /\bcall me\s+([A-Z][a-z]{2,})/i,
      /\bi am\s+(?:a?n?\s+)?(student|developer|engineer|designer|trader|doctor|lawyer|manager|analyst|founder)\b/i,
      /\bemail\b[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
      /\bphone\b[:\s]*([+\d][\d\s-]{6,})/i,
      /\b(my|our)\s+(timezone|time zone)\s+is\s+([^.\n]{3,80})/i,
      /\b(i|we)\s+prefer\s+([^.\n]{3,120})/i,
      /\b(birthday|dob)\s*[:-]\s*([^\n]{3,40})/i,
    ];
    for (const r of rules) {
      const m = text.match(r);
      if (m && m[0]) {
        const snippet = m[0].trim();
        return snippet.length > 200 ? snippet.slice(0, 197) + '…' : snippet;
      }
    }
    return null;
  };

  // Select relevant memory lines for a given query (very lightweight)
  const selectRelevantMemories = (query, maxItems = 5) => {
    const q = (query || '').toLowerCase();
    if (!q || !Array.isArray(memory) || memory.length === 0) return [];
    const scored = memory.map(m => {
      const t = (m.text || '').toLowerCase();
      // simple overlap score
      let score = 0;
      if (!t) return { m, score };
      const keywords = q.split(/[^a-z0-9+#]+/).filter(Boolean);
      for (const k of keywords) if (t.includes(k)) score++;
      return { m, score };
    });
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems)
      .map(s => s.m.text);
  };
  const [error, setError] = useState(null);
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);
  const [showNotification, setShowNotification] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [availableModels, setAvailableModels] = useState([
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Fastest for low-latency tasks (Powered by Mixtral)', baseTokenCost: 20 },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Affordable model balancing speed and intelligence', baseTokenCost: 100 },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Smartest model for complex tasks', baseTokenCost: 200 }
  ]);
  const fileInputRef = useRef(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [userStatus, setUserStatus] = useState(null);
  const [modelTokenBalances, setModelTokenBalances] = useState({});
  const [contextMenu, setContextMenu] = useState({ show: false, conversationId: null });
  const [mode, setMode] = useState('conversation');
  const [convPage, setConvPage] = useState(1);
  const [convLimit] = useState(20);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  const navigate = useNavigate();
  const recognition = useMemo(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return null;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    return rec;
  }, []);
  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: theme === 'dark' ? 'dark' : 'light',
      primary: { main: '#4f8cff' },
      secondary: { main: '#ffb300' },
      background: {
        default: theme === 'dark' ? '#181a1b' : '#f5f6fa',
        paper: theme === 'dark' ? '#23272f' : '#fff',
      },
    },
    typography: { fontFamily: 'Inter, Arial, sans-serif' },
    shape: { borderRadius: 12 },
  }), [theme]);

  // === Simulated ad rewards state (must be at top level, not conditional) ===
  // Remove simulatedAdRewardsRef and mergeSimulatedRewards

  useEffect(() => {
    document.body.className = theme + '-theme';
    localStorage.setItem('theme', theme);
  }, [theme]);
  // One-time cleanup of legacy reduced-motion state
  useEffect(() => {
    document.body.classList.remove('reduced-motion');
    try { localStorage.removeItem('reducedMotion'); } catch (_) { }
  }, []);
  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (event) => {
      if (!isRecording) return;
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setMessage(finalTranscript);
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    return () => {
      recognition.stop();
    };
  }, [recognition, isRecording]);
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchSupportedFormats();
    fetchAvailableModels();
    const fetchConversations = async () => {
      try {
        setIsLoadingConversations(true);
        const response = await axios.get('http://localhost:5000/api/v1/conversations', {
          params: { page: convPage, limit: convLimit },
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const payload = response.data;
        if (Array.isArray(payload)) {
          setConversations(payload);
          setHasMoreConversations(false);
        } else {
          setConversations(prev => convPage === 1 ? payload.items : [...prev, ...payload.items]);
          setHasMoreConversations(convPage < (payload.pagination?.totalPages || 1));
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          setIsAuthenticated(false);
          localStorage.removeItem('token');
          setError(null);
          return;
        } else if (error.response && error.response.status === 429) {
          alert('You are being rate limited. Please wait and try again.');
        } else {
          console.error('Detailed error fetching conversations:', error);
          alert('Error fetching conversations. Check the browser console for details.');
        }
      } finally {
        setIsLoadingConversations(false);
      }
    };
    fetchConversations();
  }, [isAuthenticated, convPage, convLimit]);

  // Main message sending handler - must be defined before other functions that depend on it
  const handleSendMessage = useCallback(async (userQuery) => {
    if ((!userQuery && !selectedFile) || isSending) return;

    const userMessage = {
      id: Date.now(),
      user: userQuery,
      timestamp: new Date().toISOString(),
      isUserMessage: true,
      tokenMeter: { total: estimateTokens(userQuery || '') }
    };

    setMessage('');
    setIsSending(true);

    // Create a placeholder for the bot's response and add both messages to state
    const selModelName = (availableModels.find(m => m.id === selectedModel)?.name) || 'AI';
    const botMessagePlaceholder = {
      id: Date.now() + 1,
      bot: '',
      timestamp: new Date().toISOString(),
      isTyping: true,
      modelUsed: selectedModel,
      metadata: { modelLabel: selModelName },
      tokenMeter: { total: 0 }
    };

    setCurrentConversation(prev => ({
      ...prev,
      messages: [...(prev.messages || []), userMessage, botMessagePlaceholder]
    }));

    const formData = new FormData();
    formData.append('message', userQuery);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }
    if (currentConversation.id) {
      formData.append('conversationId', currentConversation.id);
    }
    // Auto recall: include relevant memory snippets for server-side use if supported
    try {
      if (memory.length === 0) {
        // lazily fetch if empty
        const memResp = await axios.get('http://localhost:5000/api/v1/memory', { headers: { 'x-auth-token': localStorage.getItem('token') } });
        setMemory(memResp.data || []);
      }
    } catch (e) { /* ignore */ }
    const hints = selectRelevantMemories(userQuery, 5);
    if (hints.length) {
      formData.append('memoryHints', JSON.stringify(hints));
    }

    // Auto-save: attempt to store memory-worthy info from the user's message
    const userCandidate = extractMemoryCandidate(userQuery);
    if (userCandidate) {
      createMemory(userCandidate);
    }

    try {
      const response = await fetch(`http://localhost:5000/api/v1/chat?model=${selectedModel}`, {
        method: 'POST',
        headers: {
          'x-auth-token': localStorage.getItem('token'),
        },
        body: formData,
      });

      // Handle non-2xx responses early
      if (!response.ok) {
        let errMsg = `Request failed (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error) errMsg = data.error;
        } catch (_) { }
        // Remove messages and surface error
        setCurrentConversation(prev => ({
          ...prev,
          messages: prev.messages.filter(msg => msg.id !== userMessage.id && msg.id !== botMessagePlaceholder.id)
        }));
        throw new Error(errMsg);
      }

      const ctype = response.headers.get('content-type') || '';
      const isSSE = ctype.includes('text/event-stream');
      if (!isSSE) {
        // Not labeled as SSE. Try to read text; if it looks like SSE ('data:'), parse it manually.
        const maybeText = await response.text();
        if (maybeText.trim().startsWith('data:')) {
          const lines = maybeText.split('\n\n').filter(Boolean);
          let conversationId = currentConversation.id;
          for (const part of lines) {
            if (!part.startsWith('data: ')) continue;
            const dataStr = part.substring(6);
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.conversationId && !conversationId) {
                conversationId = data.conversationId;
                setCurrentConversation(prev => ({ ...prev, id: data.conversationId }));
                setConversations(prev => [...prev, { id: data.conversationId, title: userQuery.substring(0, 30) + '...', lastMessageTimestamp: new Date().toISOString() }]);
              }
              if (data.chunk) {
                setCurrentConversation(prev => {
                  const updatedMessages = prev.messages.map(msg => {
                    if (msg.id === botMessagePlaceholder.id) {
                      const newBot = (msg.bot || '') + data.chunk;
                      // Update latestBotText outside the map function scope
                      setTimeout(() => { latestBotText = newBot; }, 0);
                      return { ...msg, bot: newBot, tokenMeter: { total: estimateTokens(newBot) } };
                    }
                    return msg;
                  });
                  return { ...prev, messages: updatedMessages };
                });
              }
              if (data.error) throw new Error(data.error);
            } catch (e) {
              console.error('Failed to parse pseudo-SSE data:', dataStr, e);
            }
          }
          // finalize
          setCurrentConversation(prev => ({
            ...prev,
            messages: prev.messages.map(msg => msg.id === botMessagePlaceholder.id ? { ...msg, isTyping: false } : msg)
          }));
          return;
        } else {
          // True non-stream JSON response
          try {
            const data = JSON.parse(maybeText);
            if (data?.error) throw new Error(data.error);
          } catch (e) {
            throw e instanceof Error ? e : new Error('Unexpected non-stream response');
          }
          setCurrentConversation(prev => ({
            ...prev,
            messages: prev.messages.map(msg => msg.id === botMessagePlaceholder.id ? { ...msg, isTyping: false } : msg)
          }));
          return;
        }
      }

      if (!response.body) throw new Error("Streaming response not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let conversationId = currentConversation.id;
      let latestBotText = '';

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        const chunk = decoder.decode(value, { stream: true });
        const parts = chunk.split('\n\n').filter(Boolean);

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const dataStr = part.substring(6);
            if (dataStr === '[DONE]') {
              done = true;
              break;
            }
            try {
              const data = JSON.parse(dataStr);

              if (data.conversationId && !conversationId) {
                conversationId = data.conversationId;
                setCurrentConversation(prev => ({ ...prev, id: data.conversationId }));
                setConversations(prev => [...prev, { id: data.conversationId, title: userQuery.substring(0, 30) + '...', lastMessageTimestamp: new Date().toISOString() }]);
              }

              if (data.chunk) {
                setCurrentConversation(prev => ({
                  ...prev,
                  messages: prev.messages.map(msg => {
                    if (msg.id === botMessagePlaceholder.id) {
                      const newBot = (msg.bot || '') + data.chunk;
                      return { ...msg, bot: newBot, tokenMeter: { total: estimateTokens(newBot) } };
                    }
                    return msg;
                  })
                }));
              }

              if (data.error) throw new Error(data.error);

            } catch (e) {
              console.error("Failed to parse stream data:", dataStr, e);
            }
          }
        }
      }

      // Finalize the message state
      setCurrentConversation(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === botMessagePlaceholder.id ? { ...msg, isTyping: false } : msg
        )
      }));

      // After finalizing, auto-save any memory-worthy info from the assistant reply
      const botCandidate = extractMemoryCandidate(latestBotText);
      if (botCandidate) {
        createMemory(botCandidate);
      }

      setSelectedFile(null);
      fetchUserStatus();

    } catch (error) {
      setCurrentConversation(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== userMessage.id && msg.id !== botMessagePlaceholder.id)
      }));
      setError(error.message || 'Error sending message.');
    } finally {
      setIsSending(false);
    }
  }, [selectedFile, isSending, availableModels, selectedModel, currentConversation.id, memory, setCurrentConversation, setMessage, setIsSending, setError, selectRelevantMemories, extractMemoryCandidate, createMemory]);

  // Inline edit-resend handlers
  const startEditMessage = useCallback((chat) => {
    if (isSending) return; // avoid editing during send
    setEditingMessageId(chat.id);
    setEditingText(chat.user || chat.message || '');
  }, [isSending]);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const saveEditResend = useCallback(async () => {
    if (!editingMessageId) return;
    const newText = (editingText || '').trim();
    if (!newText) return;
    // Update the specific user message locally and mark as edited
    setCurrentConversation(prev => ({
      ...prev,
      messages: (prev.messages || []).map(m =>
        m.id === editingMessageId
          ? { ...m, user: newText, message: newText, edited: true }
          : m
      )
    }));
    cancelEdit();
    // Resend as a new message in the flow
    await handleSendMessage(newText);
  }, [editingMessageId, editingText, cancelEdit, handleSendMessage]);

  // Regenerate: find the nearest preceding user message for the given assistant index
  const regenerateFromMessageIndex = useCallback(async (assistantIndex) => {
    if (isSending) return;
    const msgs = currentConversation.messages || [];
    let i = assistantIndex - 1;
    while (i >= 0) {
      const m = msgs[i];
      if (m && (m.user || m.isUserMessage)) {
        const text = m.user || m.message || '';
        if (text.trim()) {
          await handleSendMessage(text);
        }
        break;
      }
      i--;
    }
  }, [isSending, currentConversation.messages, handleSendMessage]);

  // Expose regenerate for toolbar buttons
  useEffect(() => {
    window.__regenerateFromMessageIndex = regenerateFromMessageIndex;
    return () => {
      if (window.__regenerateFromMessageIndex === regenerateFromMessageIndex) {
        window.__regenerateFromMessageIndex = undefined;
      }
    };
  }, [regenerateFromMessageIndex]);

  // Toggle reactions per message
  const toggleReaction = useCallback((messageId, key) => {
    setCurrentConversation(prev => ({
      ...prev,
      messages: (prev.messages || []).map(m => {
        if (m.id !== messageId) return m;
        const reactions = { up: 0, down: 0, smile: 0, ...(m.reactions || {}) };
        let userReaction = m.userReaction || null;
        if (userReaction === key) {
          reactions[key] = Math.max(0, (reactions[key] || 0) - 1);
          userReaction = null;
        } else {
          if (userReaction) reactions[userReaction] = Math.max(0, (reactions[userReaction] || 0) - 1);
          reactions[key] = (reactions[key] || 0) + 1;
          userReaction = key;
        }
        return { ...m, reactions, userReaction };
      })
    }));
  }, [setCurrentConversation]);
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUserStatus();
  }, [isAuthenticated]);

  // Bundle optimization initialization
  useEffect(() => {
    // Initialize performance monitoring
    measurePerformance();

    // Preload critical routes after initial load
    preloadRoutes();

    // Optimize chunk loading
    optimizeChunkLoading();
  }, []);

  // Mobile detection and responsive handling
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 640;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false); // Close sidebar on desktop
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Touch gesture handling for mobile
  useEffect(() => {
    if (!isMobile) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (!startX || !startY) return;

      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;

      // Swipe right to open sidebar (from left edge)
      if (startX < 20 && deltaX > 50 && Math.abs(deltaY) < 100) {
        setSidebarOpen(true);
      }

      // Swipe left to close sidebar
      if (sidebarOpen && deltaX < -50 && Math.abs(deltaY) < 100) {
        setSidebarOpen(false);
      }
    };

    const handleTouchEnd = () => {
      startX = 0;
      startY = 0;
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, sidebarOpen]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu.show) {
        setContextMenu({ show: false, conversationId: null });
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.show]);

  const handleSummarizeConversation = useCallback(async (conversationId) => {
    setContextMenu({ show: false, conversationId: null }); // Close context menu
    try {
      const response = await axios.post(`http://localhost:5000/api/v1/conversations/${conversationId}/summarize`, {}, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setSummaryContent(response.data.summary);
      setShowSummaryModal(true);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        setError(null);
        return;
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert(error.response?.data?.error || 'Error summarizing conversation.');
      }
    }
  }, [setContextMenu, setSummaryContent, setShowSummaryModal, setIsAuthenticated, setError]);
  const memoizedMessages = useMemo(() => {
    return currentConversation.messages.map((chat, index) => (
      <ChatMessage
        key={chat.id || index}
        chat={chat}
        index={index}
        availableModels={availableModels}
        selectedModel={selectedModel}
        setCurrentConversation={setCurrentConversation}
        conversationId={currentConversation.id}
        handleSummarizeConversation={handleSummarizeConversation}
        isLastMessage={index === currentConversation.messages.length - 1}
        isSending={isSending}
        editingMessageId={editingMessageId}
        editingText={editingText}
        setEditingText={setEditingText}
        startEditMessage={startEditMessage}
        saveEditResend={saveEditResend}
        cancelEdit={cancelEdit}
        onToggleReaction={toggleReaction}
      />
    ));
  }, [currentConversation.messages, availableModels, selectedModel, setCurrentConversation, currentConversation.id, isSending, toggleReaction, editingMessageId, editingText, setEditingText, startEditMessage, saveEditResend, cancelEdit, handleSummarizeConversation]);

  // === AUTH CONDITIONAL RETURN (after all hooks) ===
  if (!isAuthenticated) {
    return <Auth onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  // === 2. All function declarations (fetchers, handlers, etc.) ===
  function fetchSupportedFormats() {
    axios.get('http://localhost:5000/api/v1/supported-formats')
      .then(response => setSupportedFormats(response.data.formats))
      .catch(error => console.error('Error fetching supported formats:', error));
  }

  function fetchAvailableModels() {
    axios.get('http://localhost:5000/api/v1/models')
      .then(response => {
        const supportedModels = response.data.models.filter(model => ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'].includes(model.id));
        setAvailableModels(supportedModels);
        const cheapestModel = supportedModels.find(model => model.id === 'gpt-4.1-nano') || supportedModels[0];
        if (cheapestModel) setSelectedModel(cheapestModel.id);
      })
      .catch(error => {
        console.error('Error fetching available models:', error);
        setAvailableModels([
          { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Fastest for low-latency tasks (Powered by Mixtral)', baseTokenCost: 20 },
          { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Affordable model balancing speed and intelligence', baseTokenCost: 100 },
          { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Smartest model for complex tasks', baseTokenCost: 200 }
        ]);
      });
  }

  function fetchUserStatus() {
    axios.get('http://localhost:5000/api/v1/auth/me', {
      headers: { 'x-auth-token': localStorage.getItem('token') }
    })
      .then(response => {
        setUserStatus(response.data.data);
        const balancesMap = (response.data.data.tokenBalances || []).reduce((acc, item) => {
          acc[item.modelId] = item.balance;
          return acc;
        }, {});
        setModelTokenBalances(balancesMap);
        setShowNotification(true);
      })
      .catch(error => {
        if (error.response && error.response.status === 401) {
          setIsAuthenticated(false);
          localStorage.removeItem('token');
          setError(null);
          return;
        } else if (error.response && error.response.status === 429) {
          alert('You are being rate limited. Please wait and try again.');
        } else {
          alert('Error fetching user status.');
        }
      });
  }

  function handleConversationClick(conversationId) {
    console.log('handleConversationClick called with:', conversationId);
    axios.get(`http://localhost:5000/api/v1/conversations/${conversationId}`, {
      headers: { 'x-auth-token': localStorage.getItem('token') }
    })
      .then(response => {
        console.log('API response for conversation:', response.data);
        console.log('Messages array:', response.data.Messages);
        console.log('messages array:', response.data.messages);
        const messages = response.data.Messages || response.data.messages || [];
        console.log('Final messages to set:', messages);
        setCurrentConversation(prev => ({
          ...prev,
          id: response.data.id,
          messages: messages,
          title: response.data.title,
          lastMessageTimestamp: response.data.lastMessageTimestamp,
        }));
      })
      .catch(error => {
        console.error('Error in handleConversationClick:', error);
        if (error.response && error.response.status === 401) {
          setIsAuthenticated(false);
          localStorage.removeItem('token');
          setError(null);
          return;
        } else if (error.response && error.response.status === 429) {
          alert('You are being rate limited. Please wait and try again.');
        } else {
          alert('Error fetching conversation.');
        }
      });
  }

  function handleDeleteConversation(conversationId) {
    axios.delete(`http://localhost:5000/api/v1/conversations/${conversationId}`, {
      headers: { 'x-auth-token': localStorage.getItem('token') }
    })
      .then(() => {
        setConversations(conversations.filter(conv => conv.id !== conversationId));
        if (currentConversation.id === conversationId) {
          setCurrentConversation({ id: null, messages: [] });
        }
      })
      .catch(error => {
        if (error.response && error.response.status === 401) {
          setIsAuthenticated(false);
          localStorage.removeItem('token');
          setError(null);
          return;
        } else if (error.response && error.response.status === 429) {
          alert('You are being rate limited. Please wait and try again.');
        } else {
          alert('Error deleting conversation.');
        }
      });
  }

  function toggleTheme() {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  }

  async function handleWatchAd(preferredModel = selectedModel) {
    // Simulate ad watching with a 2-second delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Call backend to grant tokens
    try {
      await axios.post('http://localhost:5000/api/v1/ad-view', { preferredModel }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      // Refresh user status to get updated token balances
      fetchUserStatus();
    } catch (error) {
      throw new Error('Failed to watch ad. Please try again.');
    }
  }

  async function handlePurchaseTier() {
    // ...existing code for handlePurchaseTier...
  }

  // === 1a. recognition must be defined before any function that uses it ===
  // === 1b. All useMemo/useCallback hooks and constants that depend on hooks ===

  // === 1c. MODE_PROMPTS constant ===
  const MODE_PROMPTS = {
    coding: "You are a coding assistant. Provide the user with a solution and validation in your answer.",
    conversation: "You are a friendly conversational partner. Respond in a natural, engaging way.",
    search: "You are a search assistant. Provide concise, factual answers with sources if possible.",
    writing: "You are a writing assistant. Help the user write, edit, or improve their text.",
    study: "You are a study assistant. Help the user learn and understand new topics.",
    summarizer: "You are a summarizer. Summarize the user's input clearly and concisely.",
    translator: "You are a translator. Translate the user's input to the requested language.",
    productivity: "You are a productivity assistant. Help the user organize, plan, and optimize their tasks.",
    math: "You are a math assistant. Solve math problems and explain the steps.",
    custom: "You are a helpful assistant. Respond to the user's instructions."
  };

  // === 2. All handler/helper function declarations below hooks and before return ===
  const handleContextMenu = (e, conversationId) => {
    e.preventDefault();
    setContextMenu(prev => {
      const newState = {
        show: prev.conversationId !== conversationId || !prev.show,
        conversationId: prev.conversationId !== conversationId ? conversationId : null,
      };
      return newState;
    });
  };

  const handleShowMemory = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/v1/memory', {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMemory(response.data);
      setShowMemoryModal(true);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        setError(null);
        return;
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error fetching memory.');
      }
    }
  };

  const exportConversation = (conversation) => {
    if (!conversation.id || conversation.messages.length === 0) {
      alert('No conversation to export');
      return;
    }
    const exportData = {
      title: conversation.title || 'Chat Export',
      timestamp: new Date().toISOString(),
      messages: conversation.messages,
      model: selectedModel
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${conversation.id}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadMoreConversations = () => {
    if (isLoadingConversations || !hasMoreConversations) return;
    setConvPage(prev => prev + 1);
  };

  const ConversationList = ({ items, onClickItem, onDeleteItem, contextMenu, handleContextMenu, loadMore, hasMore }) => {
    const scrollRef = useRef(null);

    const handleScroll = useCallback((e) => {
      const node = e.currentTarget;
      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 10) {
        loadMore();
      }
    }, [loadMore]);

    return (
      <div
        ref={scrollRef}
        className="conversation-list-container"
        onScroll={handleScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
          paddingRight: '4px'
        }}
      >
        {items.map((conv, index) => (
          <div
            key={conv.id}
            className="list-group-item list-group-item-action bg-transparent text-light d-flex justify-content-between align-items-center position-relative"
            onClick={() => onClickItem(conv.id)}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                <span dangerouslySetInnerHTML={{ __html: sanitizeContent(conv.title) }} />
              </div>
              {conv.lastMessageTimestamp && (
                <small className="d-block text-muted">
                  {new Date(conv.lastMessageTimestamp).toLocaleString()}
                </small>
              )}
            </div>
            <Button
              variant="link"
              className="text-light p-0 three-dots-button"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, conv.id);
              }}
              style={{ marginLeft: '8px', flexShrink: 0 }}
            >
              <i className="fas fa-ellipsis-v"></i>
            </Button>
            {contextMenu.show && contextMenu.conversationId === conv.id && (
              <div className="context-menu">
                <div className="d-flex flex-column gap-1">
                  <Button
                    variant="outline-light"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportConversation(conv);
                      handleContextMenu(e, conv.id);
                    }}
                  >
                    Export
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(conv.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {hasMore && (
          <div style={{ padding: '8px 16px', color: '#aaa', textAlign: 'center' }}>
            Loading more conversations...
          </div>
        )}
      </div>
    );
  };

  const getCurrentModelTokenBalance = () => {
    return modelTokenBalances[selectedModel] || 0;
  };

  const getCurrentModelMessagesPossible = () => {
    const balance = getCurrentModelTokenBalance();
    const modelConfig = availableModels.find(m => m.id === selectedModel);
    const costPerMessage = modelConfig?.baseTokenCost || 20;
    return Math.floor(balance / costPerMessage);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setCurrentConversation({ id: null, messages: [] });
    setConversations([]);
    setMemory([]);
    setUserStatus(null);
    setError(null);
  };

  const handlePlusClick = () => {
    if (isSending) return;
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleToggleRecording = () => {
    if (isSending) return;
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleUpdateMemory = async (id, newText) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/v1/memory/${id}`, { text: newText }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMemory(memory.map(mem => mem.id === id ? response.data : mem));
      setEditingMemory(null); // Exit editing mode
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        setError(null);
        return;
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error updating memory.');
      }
    }
  };



  const handleDeleteMemory = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/v1/memory/${id}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMemory(memory.filter(mem => mem.id !== id));
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        setError(null);
        return;
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error deleting memory.');
      }
    }
  };


  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div className="d-flex">
        {/* Mobile overlay: always in DOM for smooth fade */}
        <div
          className={`sidebar-overlay ${isMobile && sidebarOpen ? 'active' : ''}`}
          onClick={() => isMobile && setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
        {/* Sidebar: always in DOM; smooth slide via CSS classes */}
        <div
          className={`sidebar ${(isMobile ? sidebarOpen : showSidebar) ? 'open' : 'closed'}`}
          role="complementary"
          aria-label="Chat history and navigation"
          aria-hidden={!(isMobile ? sidebarOpen : showSidebar)}
        >
          {/* Chat History Section */}
          <div className="sidebar-section">
            <h3>Chats</h3>
            <EnhancedButton
              className="w-100 mb-2"
              onClick={() => setShowUsageDashboard(true)}
              aria-label="Open usage dashboard"
              style={{
                background: '#343541',
                border: 'none',
                color: '#ECECF1',
                padding: '8px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease'
              }}
            >
              <i className="fas fa-chart-bar me-2" aria-hidden="true"></i>
              <span>Usage Dashboard</span>
            </EnhancedButton>

            <div className="chat-list-scroll">
              <ConversationList
                items={conversations}
                onClickItem={handleConversationClick}
                onDeleteItem={handleDeleteConversation}
                contextMenu={contextMenu}
                handleContextMenu={handleContextMenu}
                loadMore={loadMoreConversations}
                hasMore={hasMoreConversations}
              />
            </div>
          </div>

          {/* Account Section */}
          <div className="sidebar-section">
            <h3>Account</h3>
            <div className="token-logout-container">

              {/* Upgrade Button (for free users) */}
              {userStatus && !userStatus.isPaidUser && (
                <Button
                  className="upgrade-btn w-100 mb-2"
                  variant="primary"
                  onClick={() => window.location.href = '/pricing'}
                  style={{
                    background: 'linear-gradient(90deg, #19c37d 0%, #10a37f 100%)',
                    border: 'none',
                    fontWeight: 500,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    transition: 'opacity 0.2s ease'
                  }}
                  aria-label="Upgrade to Pro"
                >
                  <i className="fas fa-crown me-2" aria-hidden="true"></i>
                  Upgrade to Pro
                </Button>
              )}

              {/* Memories button (moved from header) */}
              <Button
                className="memories-btn w-100 mb-2"
                variant="outline-secondary"
                onClick={handleShowMemory}
                style={{
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#ECECF1',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease'
                }}
                aria-label="Open Memories"
              >
                <i className="fas fa-brain me-2" aria-hidden="true"></i>
                Memories
              </Button>

              {/* Logout button */}
              <Button
                className="logout-btn w-100"
                variant="outline-secondary"
                onClick={handleLogout}
                style={{
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#ECECF1',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease'
                }}
                aria-label="Logout from application"
              >
                <i className="fas fa-sign-out-alt me-2" aria-hidden="true"></i>
                Logout
              </Button>
            </div>
          </div>
        </div>

        <div className="container d-flex flex-column vh-100 flex-grow-1 overflow-auto">
          <div
            className="header-row"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px', background: '#353744', minHeight: 56 }}
            role="banner"
            aria-label="Application header"
          >
            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button
                className="modern-button"
                style={{ padding: '6px 18px', fontSize: 16, height: 40, borderRadius: 8 }}
                onClick={() => isMobile ? setSidebarOpen(!sidebarOpen) : setShowSidebar(!showSidebar)}
                aria-label={isMobile ? 'Toggle mobile sidebar' : 'Toggle sidebar'}
              >
                {isMobile && <i className="fas fa-bars me-2" aria-hidden="true"></i>}
                Chats
              </Button>
              {userStatus && (
                <div className="quick-token-display" style={{ display: 'flex', alignItems: 'center', background: '#23272f', borderRadius: 8, padding: '6px 16px', fontSize: 15, height: 40, marginLeft: 4 }}>
                  <span className="quick-token-icon" style={{ fontSize: 18, marginRight: 6 }}>🪙</span>
                  <span className="quick-token-number" style={{ fontWeight: 600, marginRight: 6 }}>{getCurrentModelTokenBalance().toLocaleString()}</span>
                  <span className="quick-model-info" style={{ color: '#aaa', fontSize: 14 }}>
                    {availableModels.find(m => m.id === selectedModel)?.name || 'Unknown'} (~{getCurrentModelMessagesPossible()} msgs)
                  </span>
                </div>
              )}
              <div className="model-selector-container" style={{ marginLeft: 12 }}>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  style={{
                    appearance: 'none',
                    padding: '8px 36px 8px 16px',
                    borderRadius: 8,
                    fontSize: 15,
                    height: 40,
                    background: '#2d333b',
                    color: '#fff',
                    border: '1px solid #444',
                    outline: 'none',
                    minWidth: 180,
                    cursor: 'pointer',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' fill=\'%23adbac7\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '36px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    fontFamily: 'inherit',
                    fontWeight: 500
                  }}
                  aria-label="Select AI Model"
                  id="model-selector"
                >
                  {availableModels.map(model => (
                    <option
                      key={model.id}
                      value={model.id}
                      style={{
                        padding: '8px 16px',
                        background: '#1e2228',
                        color: '#fff',
                        fontSize: '14px',
                        border: 'none',
                        outline: 'none'
                      }}
                    >
                      {model.name}
                    </option>
                  ))}
                </select>
                <style jsx={"true"}>{`
                  select:focus {
                    border-color: #539bf5;
                    box-shadow: 0 0 0 2px rgba(65, 132, 234, 0.3);
                  }
                  select:hover {
                    background-color: #373e47;
                    border-color: #539bf5;
                  }
                  select:active {
                    transform: translateY(1px);
                  }
                  option {
                    padding: 8px 16px;
                    background: #1e2228;
                    color: #fff;
                  }
                  option:checked, option:focus {
                    background: #2d333b;
                    color: #539bf5;
                  }
                `}</style>
              </div>
            </div>
            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => navigate('/mode')} style={{ padding: '6px 18px', borderRadius: 8, background: '#333', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, height: 40, cursor: 'pointer' }}>
                Mode
              </button>
              <Link to="/pricing" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <Button
                  variant="primary"
                  className="modern-button"
                  style={{
                    padding: '6px 18px',
                    fontSize: 16,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: '#007bff',
                    borderColor: '#007bff',
                    color: 'white'
                  }}
                >
                  Pricing & Upgrade
                </Button>
              </Link>
              {userStatus && String(userStatus.planStatus || '').toLowerCase() === 'enterprise' && (
                <Button
                  variant="secondary"
                  className="modern-button"
                  style={{
                    fontSize: 16,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: '#6c757d',
                    borderColor: '#6c757d',
                    color: 'white'
                  }}
                  onClick={() => setShowAdminPanel(true)}
                >
                  Admin Panel
                </Button>
              )}
              <button className="theme-toggle-button" onClick={toggleTheme} style={{ height: 40, width: 40, borderRadius: 8, background: '#23272f', color: '#fff', border: 'none', marginLeft: 8 }} aria-label="Toggle theme">
                {theme === 'dark' ? <i className="fas fa-sun"></i> : <i className="fas fa-moon"></i>}
              </button>
            </div>
          </div>
          <Routes>
            <Route path="/mode" element={
              <Suspense fallback={<LoadingSpinner text="Loading mode selection..." />}>
                <ModeSelectionPage onSelect={(selectedMode) => { setMode(selectedMode); navigate('/'); }} />
              </Suspense>
            } />
            <Route path="/pricing" element={
              <Suspense fallback={<LoadingSpinner text="Loading pricing..." />}>
                <PricingPage userStatus={userStatus} modelTokenBalances={modelTokenBalances} handleWatchAd={handleWatchAd} handlePurchaseTier={handlePurchaseTier} />
              </Suspense>
            } />
            <Route path="/" element={
              <>
                {mode === 'coding' ? (
                  <Suspense fallback={<LoadingSpinner text="Loading coding mode..." />}>
                    <CodingMode onSendMessage={handleSendMessage} chatMessages={currentConversation.messages} />
                  </Suspense>
                ) : (
                  <div
                    className="flex-grow-1 rounded shadow-sm chat-window"
                    role="main"
                    aria-label="Chat conversation"
                  >
                    {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
                    {userStatus && showNotification && (userStatus.lowTokenWarning || userStatus.paidExpiryWarning) && (
                      <NotificationBanner
                        warnings={userStatus}
                        onClose={() => setShowNotification(false)}
                      />
                    )}
                    <div
                      role="log"
                      aria-live="polite"
                      aria-label="Chat messages"
                      className="chat-messages-container"
                    >
                      {currentConversation.messages && currentConversation.messages.length > 0 ? memoizedMessages : (
                        <div
                          className="no-messages-placeholder"
                          style={{ color: '#aaa', textAlign: 'center', marginTop: 32 }}
                          role="status"
                          aria-label="No messages yet"
                        >
                          No messages yet. Start the conversation!
                        </div>
                      )}
                      {isSending && (
                        <div style={{ padding: '8px 12px' }}>
                          <TypingEffect text="" isTyping={false} showDots={true} />
                        </div>
                      )}
                    </div>
                    {/* Always scroll to bottom */}
                    <div ref={el => { if (el) el.scrollIntoView({ behavior: 'smooth' }); }} />
                  </div>
                )}
                <div className="banner-ad-placeholder">
                  <p>Banner Ad Placeholder</p>
                </div>
                <ChatInput
                  message={message}
                  setMessage={setMessage}
                  isSending={isSending}
                  handleSendMessage={handleSendMessage}
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                  supportedFormats={supportedFormats}
                  handlePlusClick={handlePlusClick}
                  handleFileChange={handleFileChange}
                  handleToggleRecording={handleToggleRecording}
                  isRecording={isRecording}
                  fileInputRef={fileInputRef}
                  mode={mode}
                  modePrompts={MODE_PROMPTS}
                  sidebarOpen={isMobile ? sidebarOpen : showSidebar}
                  isMobile={isMobile}
                />
              </>
            } />
          </Routes>
        </div>

        <Modal show={showMemoryModal} onHide={() => setShowMemoryModal(false)} centered className="memory-modal">
          <Modal.Header closeButton>
            <Modal.Title>Chatbot Memory</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Search memory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search chatbot memory"
              role="searchbox"
            />
            {memory.length > 0 ? (
              <ul className="list-group" aria-label="Memory items">
                {memory.filter(mem => mem.text.toLowerCase().includes(searchTerm.toLowerCase())).map(mem => (
                  <li key={mem.id} className="list-group-item bg-transparent text-light d-flex justify-content-between align-items-center">
                    {editingMemory?.id === mem.id ? (
                      <input
                        type="text"
                        defaultValue={mem.text}
                        onBlur={(e) => handleUpdateMemory(mem.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateMemory(mem.id, e.target.value); }}
                        autoFocus
                      />
                    ) : (
                      <span dangerouslySetInnerHTML={{ __html: sanitizeContent(mem.text) }} />
                    )}
                    <div>
                      <Button
                        variant="outline-light"
                        size="sm"
                        onClick={() => setEditingMemory(mem)}
                        className="me-2"
                        aria-label={`Edit memory: ${mem.text.substring(0, 50)}...`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteMemory(mem.id)}
                        aria-label={`Delete memory: ${mem.text.substring(0, 50)}...`}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>The chatbot hasn't remembered anything yet.</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowMemoryModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Admin Panel */}
        <Suspense fallback={null}>
          <AdminPanel
            isVisible={showAdminPanel}
            onClose={() => setShowAdminPanel(false)}
          />
        </Suspense>

        <Suspense fallback={null}>
          <UsageDashboard show={showUsageDashboard} onClose={() => setShowUsageDashboard(false)} />
        </Suspense>

        <Modal show={showSummaryModal} onHide={() => setShowSummaryModal(false)} centered className="summary-modal">
          <Modal.Header closeButton>
            <Modal.Title>Conversation Summary</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p dangerouslySetInnerHTML={{ __html: sanitizeContent(summaryContent) }} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSummaryModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </ThemeProvider>
  );
}

// Wrap the entire app with ErrorBoundary
const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;
