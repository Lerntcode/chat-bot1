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
import PricingPage from './components/PricingPage'; // Import the new PricingPage
import AdminPanel from './components/AdminPanel'; // Import the admin panel
import { Route, Routes, Link, BrowserRouter, useNavigate } from 'react-router-dom'; // Import routing components
import UsageDashboard from './components/UsageDashboard';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
// Remove: import Select from 'react-select';
import ModeSelectionPage from './ModeSelectionPage';
import CodingMode from './components/CodingMode';

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
  }, []);

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
    <span>{message}</span>
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
            <strong>Low Token Warning:</strong> Your token balance is low for model(s): {warnings.lowTokenModels.join(', ')}. Please watch ads or upgrade to continue chatting.
          </div>
        )}
        {warnings.paidExpiryWarning && (
          <div>
            <strong>Paid Plan Expiring Soon:</strong> Your paid access expires in {warnings.paidExpiryDaysLeft} day(s). Renew soon to avoid losing premium features.
          </div>
        )}
      </div>
      <button className="close-btn" onClick={onClose} aria-label="Dismiss notification">&times;</button>
    </div>
  );
};

// Define ChatInput above App
const ChatInput = React.memo(({ message, setMessage, isSending, handleSendMessage, selectedFile, setSelectedFile, supportedFormats, handlePlusClick, handleFileChange, handleToggleRecording, isRecording, fileInputRef }) => (
  <div className="d-flex mt-3 align-items-center input-container">
    <div className="input-left-icons">
      <i className={`fas fa-plus ${isSending ? 'disabled' : ''}`} onClick={handlePlusClick}></i>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
        disabled={isSending}
        accept={supportedFormats.map(format => `.${format}`).join(',')}
      />
      <div className="tools-label" title={`Supported formats: ${supportedFormats.join(', ')}`}> <i className="fas fa-wrench"></i> <span>Tools</span> </div>
    </div>
    {selectedFile && (
      <div className="selected-file">
        <div className="file-info">
          <i className="fas fa-file"></i>
          <span className="file-name">{selectedFile.name}</span>
          <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button onClick={() => setSelectedFile(null)} disabled={isSending}>&times;</button>
      </div>
    )}
    <input
      type="text"
      className="form-control border-0 flex-grow-1"
      placeholder={isSending ? "Sending..." : "Ask anything"}
      value={message}
      onChange={e => setMessage(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage(message);
        }
      }}
      disabled={isSending}
      aria-label="Type your message here"
    />
    <div className="input-right-icons">
      <i className={`fas fa-microphone ${isRecording ? 'recording' : ''} ${isSending ? 'disabled' : ''}`} onClick={handleToggleRecording}></i>
      <i className="fas fa-waveform"></i>
      <button 
        className={`send-button ${message.trim() ? 'active' : ''}`}
        onClick={() => handleSendMessage(message)}
        aria-label="Send message"
        disabled={isSending || !message.trim()}
      >
        <i className="fas fa-arrow-up"></i>
      </button>
    </div>
  </div>
));

// Move ChatMessage above App
  const ChatMessage = React.memo(({ chat, index, isLastMessage, availableModels, selectedModel, setCurrentConversation, conversationId, handleSummarizeConversation }) => (
    <React.Fragment key={chat.id || chat._id || chat.timestamp || index}>
      {/* User Message */}
      {(chat.user || chat.isUserMessage) && (
        <div className="d-flex justify-content-end">
          <div className="chat-bubble user-bubble new-message">
            <strong>You:</strong> {chat.user || chat.message}
          </div>
        </div>
      )}
      {/* Bot Message */}
      {chat.bot && (
        <div className="d-flex justify-content-start">
          <div className={`chat-bubble bot-bubble${chat.isTyping ? ' new-message' : ''}`}>
            <div className="bot-header">
              <strong>Bot</strong>
              <span className="model-indicator">
                {availableModels.find(m => m.id === selectedModel)?.name || 'AI'}
              </span>
            </div>
            {chat.isTyping ? (
              <TypingEffect text="" isTyping={true} showDots={true} />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{chat.bot}</ReactMarkdown>
            )}
            {!chat.isTyping && (
              <i className="fas fa-volume-up speaker-icon" onClick={() => window.speechSynthesis.speak(new SpeechSynthesisUtterance(chat.bot))}></i>
            )}
            {chat.bot && conversationId && !chat.isTyping && (
              <Button
                variant="link"
                className="summarize-button"
                onClick={() => handleSummarizeConversation(conversationId)}
              >
                Summarize Conversation
              </Button>
            )}

          </div>
        </div>
      )}
    </React.Fragment>
  ));


function App() {
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
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [supportedFormats, setSupportedFormats] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-nano');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [error, setError] = useState(null);
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);
  const [showNotification, setShowNotification] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
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
        const response = await axios.get('http://localhost:5000/api/v1/conversations', {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
        setConversations(response.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
          setError(null);
          return;
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
          alert('Error fetching conversations.');
      }
    }
  };
    fetchConversations();
  }, [isAuthenticated]);
  useEffect(() => {
    if (!isAuthenticated) return;
      fetchUserStatus();
  }, [isAuthenticated]);
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
  }, [setContextMenu, axios, localStorage, setSummaryContent, setShowSummaryModal, setIsAuthenticated, setError]);
  const memoizedMessages = useMemo(() => {
    console.log('memoizedMessages recalculating with messages:', currentConversation.messages);
    return currentConversation.messages.map((chat, index) => {
      console.log('Rendering message:', chat);
      return (
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
        />
      );
    });
  }, [currentConversation.messages, availableModels, selectedModel, setCurrentConversation, currentConversation.id, isSending]);

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
    axios.get('http://localhost:5000/api/v1/user-status', {
          headers: { 'x-auth-token': localStorage.getItem('token') }
    })
      .then(response => {
        setUserStatus(response.data);
        setModelTokenBalances(response.data.modelTokenBalances || {});
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

  const handleSendMessage = async (userQuery) => {
    if ((!message && !selectedFile) || isSending) return;
    
    // Immediately add user message to conversation
    const userMessage = {
      id: Date.now(), // temporary ID
      user: userQuery,
      timestamp: new Date().toISOString(),
      isUserMessage: true
    };

    setMessage('');
    
    if (!currentConversation.id) {
      setCurrentConversation({ id: null, messages: [userMessage] });
    } else {
      setCurrentConversation(prev => ({ 
        ...prev, 
        messages: [...(prev.messages || []), userMessage] 
      }));
    }

    setIsSending(true);
    
    // Add a typing message for the bot (dots animation)
    const typingMessage = {
      id: Date.now() + 1, // temporary ID
      bot: '', // Will be filled with actual response
      timestamp: new Date().toISOString(),
      isTyping: true,
      typingText: '', // Empty for dots animation
      showDots: true // Flag to show dots instead of typing text
    };
    
    setCurrentConversation(prev => ({ 
      ...prev, 
      messages: [...(prev.messages || []), typingMessage] 
    }));
    
    const formData = new FormData();
    formData.append('message', message);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }
    if (currentConversation.id) {
      formData.append('conversationId', currentConversation.id);
    }
    formData.append('mode', mode);
    const systemPrompt = MODE_PROMPTS[mode] || "";
    const finalPrompt = `${systemPrompt} ${userQuery}`;
    try {
      const response = await axios.post('http://localhost:5000/api/v1/chat', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': localStorage.getItem('token'),
        },
        params: {
          model: selectedModel
        }
      });
      console.log('New message response:', response.data);
      const { conversationId, message: newMessage } = response.data;

      // The `newMessage` from the server contains both user and bot parts,
      // so we destructure it to exclude the `user` part from the bot's message bubble.
      const { user, ...botMessage } = newMessage;
      const finalBotMessage = { ...botMessage, isTyping: false };

      // This logic is the same for both new and existing conversations.
      setCurrentConversation(prev => ({
        id: conversationId, // Set or update the conversation ID
        messages: prev.messages.map(msg =>
          msg.id === typingMessage.id ? finalBotMessage : msg
        )
      }));

      // If it's a new conversation, add it to the sidebar list.
      if (!currentConversation.id) {
        const newConversation = { id: conversationId, title: newMessage.user?.substring(0, 30) + '...' || 'New Chat', lastMessageTimestamp: newMessage.timestamp };
        setConversations(prevConversations => [...prevConversations, newConversation]);
      } else {
        // If it's an existing conversation, update its timestamp and title in the sidebar.
        setConversations(prevConversations =>
          prevConversations.map(conv =>
            conv.id === conversationId
              ? { ...conv, lastMessageTimestamp: newMessage.timestamp, title: newMessage.user?.substring(0, 30) + '...' || conv.title }
              : conv
          )
        );
      }
      setMessage('');
      setSelectedFile(null);
      fetchUserStatus(); // Refresh user status after sending message
    } catch (error) {
      // Remove the temporary messages on error
      setCurrentConversation(prev => ({ 
        ...prev, 
        messages: prev.messages.filter(msg => msg.id !== userMessage.id && msg.id !== typingMessage.id)
      }));
      
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        setError(null);
        return;
      } else if (error.response && error.response.status === 403) {
        setError(error.response.data.error || 'Insufficient tokens.');
      } else if (error.response && error.response.status === 429) {
        setError('You are being rate limited. Please wait and try again.');
      } else {
        setError(error.response?.data?.error || 'Error sending message.');
      }
    } finally {
      setIsSending(false);
    }
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
          <div className="sidebar">
            <div className="chat-list-scroll">
            <h3 className="text-center my-3">Previous Chats</h3>
            <button className="modern-button w-100 mb-3" onClick={() => setShowUsageDashboard(true)}>
              <i className="fas fa-chart-bar me-2"></i>Usage Dashboard
            </button>
            <ul className="list-group list-group-flush">
              {conversations.map(conv => (
                <li
                  key={conv.id}
                  className="list-group-item list-group-item-action bg-transparent text-light d-flex justify-content-between align-items-center position-relative"
                  onClick={() => handleConversationClick(conv.id)}
                  >
                  <div>
                    <div>
                      {conv.title}
                      {conv.lastMessageTimestamp && (
                        <small className="d-block text-muted">{new Date(conv.lastMessageTimestamp).toLocaleString()}</small>
                      )}
                    </div>
                  </div>
                    <Button
                      variant="link"
                      className="text-light p-0 three-dots-button"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent parent li onClick
                        handleContextMenu(e, conv.id);
                      }}
                    >
                      <i className="fas fa-ellipsis-v"></i>
                    </Button>
                  {/* Context Menu */}
                    {contextMenu.show && contextMenu.conversationId === conv.id && (
                      <div className="context-menu">
                        <Button variant="danger" size="sm" onClick={(e) => {
                          e.stopPropagation(); // Prevent parent li onClick
                          handleDeleteConversation(conv.id);
                        }}>
                            Delete
                          </Button>
                        </div>
                    )}
                </li>
              ))}
            </ul>
            </div>
            <div className="token-logout-container">
              {/* Token card */}
              <div className="token-card">
                {userStatus && (
                  <div className="user-status-info text-center mt-2">
                  <div className="token-counter">
                    <div className="token-balance">
                      <span className="token-icon">🪙</span>
                      <span className="token-number">{getCurrentModelTokenBalance().toLocaleString()}</span>
                      <span className="token-label">tokens</span>
                    </div>
                    {!userStatus.isPaidUser && (
                      <div className="model-cost-info">
                        <span className="current-model">
                          {availableModels.find(m => m.id === selectedModel)?.name || 'Unknown'}
                        </span>
                        <span className="cost-info">
                          (~{availableModels.find(m => m.id === selectedModel)?.baseTokenCost || 20} tokens/message)
                        </span>
                        <span className="messages-possible">
                          ~{getCurrentModelMessagesPossible()} messages possible
                        </span>
                      </div>
                    )}
                    {userStatus.isPaidUser && (
                      <div className="pro-status">
                        <span className="pro-badge">PRO</span>
                        <span className="pro-date">until {new Date(userStatus.paidUntil).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  </div>
                )}
              </div>
              {/* Logout button */}
              <Button className="logout-btn" variant="outline-light" onClick={handleLogout} style={{ width: '100%', margin: 0 }}>Logout</Button>
            </div>
          </div>

          <div className="container d-flex flex-column vh-100 flex-grow-1 overflow-auto">
          <div className="header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px', background: '#353744', minHeight: 56 }}>
            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button className="modern-button" style={{ padding: '6px 18px', fontSize: 16, height: 40, borderRadius: 8 }} onClick={() => setShowSidebar(!showSidebar)}>
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
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{ marginLeft: 12, padding: '6px 12px', borderRadius: 8, fontSize: 15, height: 40, background: '#23272f', color: '#fff', border: '1px solid #444', outline: 'none', minWidth: 140 }}
                aria-label="Select AI Model"
              >
                      {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
                    </div>
            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => navigate('/mode')} style={{ padding: '6px 18px', borderRadius: 8, background: '#333', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, height: 40, cursor: 'pointer' }}>
                Mode
              </button>
              <Link to="/pricing" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <Button variant="outline-light" className="modern-button" style={{ padding: '6px 18px', fontSize: 16, height: 40, borderRadius: 8 }}>Pricing & Upgrade</Button>
              </Link>
              <Button 
                variant="outline-light" 
                className="modern-button" 
                style={{ fontSize: 16, height: 40, borderRadius: 8 }}
                onClick={() => setShowAdminPanel(true)}
              >
                Admin Panel
              </Button>
              <button className="theme-toggle-button" onClick={toggleTheme} style={{ height: 40, width: 40, borderRadius: 8, background: '#23272f', color: '#fff', border: 'none', marginLeft: 8 }}>
                {theme === 'dark' ? <i className="fas fa-sun"></i> : <i className="fas fa-moon"></i>}
              </button>
            </div>
          </div>
          <Routes>
            <Route path="/mode" element={<ModeSelectionPage onSelect={(selectedMode) => { setMode(selectedMode); navigate('/'); }} />} />
            <Route path="/pricing" element={<PricingPage userStatus={userStatus} modelTokenBalances={modelTokenBalances} handleWatchAd={handleWatchAd} handlePurchaseTier={handlePurchaseTier} />} />
            <Route path="/" element={
              <>
                {mode === 'coding' ? (
                  <CodingMode onSendMessage={handleSendMessage} chatMessages={currentConversation.messages} />
                ) : (
                  <div className="flex-grow-1 rounded shadow-sm chat-window">
                    {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
                    {userStatus && showNotification && (userStatus.lowTokenWarning || userStatus.paidExpiryWarning) && (
                      <NotificationBanner
                        warnings={userStatus}
                        onClose={() => setShowNotification(false)}
                      />
                    )}
                    {currentConversation.messages && currentConversation.messages.length > 0 ? memoizedMessages : (
                      <div className="no-messages-placeholder" style={{ color: '#aaa', textAlign: 'center', marginTop: 32 }}>
                        No messages yet. Start the conversation!
                      </div>
                    )}
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
            />
            {memory.length > 0 ? (
              <ul className="list-group">
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
                      <span>{mem.text}</span>
                    )}
                    <div>
                      <Button variant="outline-light" size="sm" onClick={() => setEditingMemory(mem)} className="me-2">Edit</Button>
                      <Button variant="outline-danger" size="sm" onClick={() => handleDeleteMemory(mem.id)}>Delete</Button>
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
        <AdminPanel 
          isVisible={showAdminPanel} 
          onClose={() => setShowAdminPanel(false)} 
        />

        <UsageDashboard show={showUsageDashboard} onClose={() => setShowUsageDashboard(false)} />

        <Modal show={showSummaryModal} onHide={() => setShowSummaryModal(false)} centered className="summary-modal">
          <Modal.Header closeButton>
            <Modal.Title>Conversation Summary</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>{summaryContent}</p>
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

export default App;