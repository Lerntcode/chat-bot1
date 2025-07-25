import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Route, Routes, Link, BrowserRouter as Router } from 'react-router-dom'; // Import routing components
import UsageDashboard from './components/UsageDashboard';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
// Remove: import Select from 'react-select';

const TypingEffect = ({ text, speed = 20 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const ref = useRef();

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  // Scroll to bottom on new text
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedText]);

  return <div className="typing-effect" ref={ref}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{displayedText}</ReactMarkdown></div>;
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

// LoadingDots component for animated loading indicator
const LoadingDots = () => (
  <div className="loading-dots" aria-live="polite" aria-label="Bot is thinking">
    <span className="dot">.</span>
    <span className="dot">.</span>
    <span className="dot">.</span>
  </div>
);

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


function App() {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentConversation, setCurrentConversation] = useState({ id: null, messages: [] });
  const [conversations, setConversations] = useState([]);
  const [memory, setMemory] = useState([]);
  const [editingMemory, setEditingMemory] = useState(null); // State to hold memory being edited

  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [supportedFormats, setSupportedFormats] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-nano');
  const [modelError, setModelError] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
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

  // Helper functions for model-specific token balances
  const getCurrentModelTokenBalance = () => {
    return modelTokenBalances[selectedModel] || 0;
  };

  const getCurrentModelMessagesPossible = () => {
    const balance = getCurrentModelTokenBalance();
    const modelConfig = availableModels.find(m => m.id === selectedModel);
    const costPerMessage = modelConfig?.baseTokenCost || 20;
    return Math.floor(balance / costPerMessage);
  };
  
  const [contextMenu, setContextMenu] = useState({ show: false, conversationId: null });

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

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event) => {
      if (!isRecording) return; // Only process if recording is active

      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) { // Only update if there's a final transcript
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

  const fetchSupportedFormats = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/v1/supported-formats');
      setSupportedFormats(response.data.formats);
    } catch (error) {
      console.error('Error fetching supported formats:', error);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/v1/models');
      // Filter to only include GPT models
      const supportedModels = response.data.models.filter(model => 
        ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'].includes(model.id)
      );
      setAvailableModels(supportedModels);
              // Set default model to the cheapest one (nano)
        const cheapestModel = supportedModels.find(model => model.id === 'gpt-4.1-nano') || supportedModels[0];
      if (cheapestModel) {
        setSelectedModel(cheapestModel.id);
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
      // Fallback to default GPT models if API fails
      const defaultModels = [
        { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Fastest for low-latency tasks (Powered by Mixtral)', baseTokenCost: 20 },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Affordable model balancing speed and intelligence', baseTokenCost: 100 },
        { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Smartest model for complex tasks', baseTokenCost: 200 }
      ];
      setAvailableModels(defaultModels);
    }
  };

  const fetchUserStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/v1/user-status', {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setUserStatus(response.data);
      setModelTokenBalances(response.data.modelTokenBalances || {});
      setShowNotification(true); // Ensure notification is shown on status update
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error fetching user status.');
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserStatus();
    }
  }, [isAuthenticated]);

  const handleWatchAd = async (preferredModel = selectedModel) => {
    try {
      // Show ad simulation modal
      const adModal = document.createElement('div');
      adModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: Arial, sans-serif;
      `;
      
      adModal.innerHTML = `
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 12px;
          text-align: center;
          max-width: 400px;
          width: 90%;
        ">
          <h3 style="color: #333; margin-bottom: 1rem;">🎬 Ad Simulation</h3>
          <p style="color: #666; margin-bottom: 1.5rem;">Please wait while we show you an advertisement...</p>
          <div style="
            width: 100%;
            height: 200px;
            background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
            font-size: 1.2rem;
            color: #666;
          ">
            📺 Advertisement Playing...
          </div>
          <div style="
            width: 100%;
            height: 4px;
            background: #e0e0e0;
            border-radius: 2px;
            overflow: hidden;
          ">
            <div id="progress-bar" style="
              width: 0%;
              height: 100%;
              background: linear-gradient(90deg, #007bff, #6610f2);
              transition: width 0.1s ease;
            "></div>
          </div>
          <p id="timer" style="color: #007bff; font-weight: bold; margin-top: 0.5rem;">3 seconds remaining...</p>
        </div>
      `;
      
      document.body.appendChild(adModal);
      
      // Simulate ad progress
      const progressBar = adModal.querySelector('#progress-bar');
      const timer = adModal.querySelector('#timer');
      const duration = 3000; // 3 seconds
      const interval = 100; // Update every 100ms
      const steps = duration / interval;
      let currentStep = 0;
      
      const progressInterval = setInterval(() => {
        currentStep++;
        const progress = (currentStep / steps) * 100;
        progressBar.style.width = `${progress}%`;
        
        const remaining = Math.ceil((duration - currentStep * interval) / 1000);
        timer.textContent = `${remaining} second${remaining !== 1 ? 's' : ''} remaining...`;
        
                 if (currentStep >= steps) {
           clearInterval(progressInterval);
           document.body.removeChild(adModal);
           
           // Make the API call
           (async () => {
             try {
               const response = await axios.post('http://localhost:5000/api/v1/ad-view', {
                 preferredModel: preferredModel
               }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
               
               // Show success message with actual tokens earned
               const successModal = document.createElement('div');
               successModal.style.cssText = `
                 position: fixed;
                 top: 20px;
                 right: 20px;
                 background: #28a745;
                 color: white;
                 padding: 1rem 1.5rem;
                 border-radius: 8px;
                 z-index: 10000;
                 font-family: Arial, sans-serif;
                 box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                 animation: slideIn 0.3s ease;
               `;
               
               // Use the actual tokens granted from the backend response
               const tokensEarned = response.data.tokensGranted || 10000;
               const modelName = availableModels.find(m => m.id === preferredModel)?.name || 'GPT-4.1 Nano';
               const messagesPossible = Math.floor(tokensEarned / (availableModels.find(m => m.id === preferredModel)?.baseTokenCost || 20));
               
               successModal.innerHTML = `
                 <div style="display: flex; align-items: center; gap: 0.5rem;">
                   <span style="font-size: 1.2rem;">✅</span>
                   <span>${tokensEarned.toLocaleString()} tokens added! (~${messagesPossible} ${modelName} messages)</span>
                 </div>
               `;
               
               document.body.appendChild(successModal);
               
               // Remove success message after 3 seconds
               setTimeout(() => {
                 if (document.body.contains(successModal)) {
                   document.body.removeChild(successModal);
                 }
               }, 3000);
               
      fetchUserStatus(); // Refresh user status
    } catch (error) {
      console.error('Error watching ad:', error);
             }
           })();
         }
      }, interval);
      
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
      alert(error.response?.data?.error || 'Failed to watch ad.');
      }
    }
  };

  const handlePurchaseTier = async () => {
    try {
      // Show loading state
      const loadingModal = document.createElement('div');
      loadingModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: Arial, sans-serif;
      `;
      
      loadingModal.innerHTML = `
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 12px;
          text-align: center;
          max-width: 400px;
          width: 90%;
        ">
          <div style="
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          "></div>
          <h3 style="color: #333; margin-bottom: 0.5rem;">Processing Payment</h3>
          <p style="color: #666;">Please wait while we process your upgrade...</p>
        </div>
      `;
      
      document.body.appendChild(loadingModal);
      
      const response = await axios.post('http://localhost:5000/api/v1/purchase-tier', {}, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      
      // Remove loading modal
      document.body.removeChild(loadingModal);
      
      // Show success message
      const successModal = document.createElement('div');
      successModal.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
      `;
      
      successModal.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.2rem;">🎉</span>
          <span>${response.data.msg}</span>
        </div>
      `;
      
      document.body.appendChild(successModal);
      
      // Remove success message after 4 seconds
      setTimeout(() => {
        if (document.body.contains(successModal)) {
          document.body.removeChild(successModal);
        }
      }, 4000);
      
      fetchUserStatus(); // Refresh user status
    } catch (error) {
      // Remove loading modal if it exists
      const loadingModal = document.querySelector('div[style*="z-index: 9999"]');
      if (loadingModal) {
        document.body.removeChild(loadingModal);
      }
      
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
      alert(error.response?.data?.error || 'Failed to purchase tier.');
      }
    }
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

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handlePlusClick = () => {
    if (isSending) return;
    fileInputRef.current.click();
  };

  useEffect(() => {
    document.body.className = theme + '-theme';
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

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
          alert('Session expired. Please log in again.');
        } else if (error.response && error.response.status === 429) {
          alert('You are being rate limited. Please wait and try again.');
        } else {
          alert('Error fetching conversations.');
        }
      }
    };
    fetchConversations();
  }, [isAuthenticated]);

  const handleConversationClick = async (conversationId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/v1/conversations/${conversationId}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setCurrentConversation(prev => ({
        ...prev,
        id: response.data.id,
        messages: response.data.Messages || [], // Access the nested Messages array
        title: response.data.title,
        lastMessageTimestamp: response.data.lastMessageTimestamp,
      }));
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error fetching conversation.');
      }
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    try {
      await axios.delete(`http://localhost:5000/api/v1/conversations/${conversationId}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setConversations(conversations.filter(conv => conv.id !== conversationId));
      if (currentConversation.id === conversationId) {
        setCurrentConversation({ id: null, messages: [] });
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error deleting conversation.');
      }
    }
  };

  const MODE_PROMPTS = {
    coding: "You are a coding assistant. Provide the user with a solution and validation in your answer.",
    conversation: "You are a friendly conversational partner. Respond in a natural, engaging way.",
    searching: "You are a search assistant. Provide concise, factual answers with sources if possible.",
  };

  const [mode, setMode] = useState('conversation'); // Default mode
  const [showModePage, setShowModePage] = useState(false);

  const handleSendMessage = async (userQuery) => {
    if ((!message && !selectedFile) || isSending) return;

    setIsSending(true);
    const formData = new FormData();
    formData.append('message', message);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }
    if (currentConversation.id) {
      formData.append('conversationId', currentConversation.id);
    }

    try {
      const systemPrompt = MODE_PROMPTS[mode] || "";
      const finalPrompt = `${systemPrompt} ${userQuery}`;

      const response = await axios.post('http://localhost:5000/api/v1/chat', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': localStorage.getItem('token'),
        },
        params: {
          model: selectedModel
        }
      });

      const { conversationId, message: newMessage } = response.data;

      if (!currentConversation.id) {
        setCurrentConversation({ id: conversationId, messages: [newMessage] });
        const newConversation = { id: conversationId, title: response.data.title, lastMessageTimestamp: response.data.lastMessageTimestamp };
        setConversations(prevConversations => [...prevConversations, newConversation]);
      } else {
        setCurrentConversation(prev => ({ ...prev, messages: [...prev.messages, newMessage] }));
        // Update the existing conversation's lastMessageTimestamp and title in the sidebar
        setConversations(prevConversations =>
          prevConversations.map(conv =>
            conv.id === conversationId
              ? { ...conv, lastMessageTimestamp: response.data.lastMessageTimestamp, title: response.data.title }
              : conv
          )
        );
      }

      setMessage('');
      setSelectedFile(null);
      fetchUserStatus(); // Refresh user status after sending message
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        setError('Session expired. Please log in again.');
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
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error fetching memory.');
      }
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
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error updating memory.');
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
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert('Error deleting memory.');
      }
    }
  };

  const handleSummarizeConversation = async (conversationId) => {
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
        alert('Session expired. Please log in again.');
      } else if (error.response && error.response.status === 429) {
        alert('You are being rate limited. Please wait and try again.');
      } else {
        alert(error.response?.data?.error || 'Error summarizing conversation.');
      }
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setCurrentConversation({ id: null, messages: [] });
    setConversations([]);
    setMemory([]);
    setUserStatus(null);
  };

    const handleContextMenu = (e, conversationId) => {
         console.log('Button clicked for conversationId:', conversationId);
         setContextMenu(prev => {
           const newState = {
             show: prev.conversationId !== conversationId || !prev.show,
             conversationId: prev.conversationId !== conversationId ? conversationId : null,
           };
           console.log('New contextMenu state:', newState);
           return newState;
        });
      };


  // Close context menu and model selector if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu.show) {
        setContextMenu({ show: false, conversationId: null });
      }
      if (showModelSelector && !event.target.closest('.model-selector-container')) {
        setShowModelSelector(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.show, showModelSelector]);

  // MUI theme setup
  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: theme === 'dark' ? 'dark' : 'light',
      primary: {
        main: '#4f8cff', // Blueprint primary color
      },
      secondary: {
        main: '#ffb300', // Accent color
      },
      background: {
        default: theme === 'dark' ? '#181a1b' : '#f5f6fa',
        paper: theme === 'dark' ? '#23272f' : '#fff',
      },
    },
    typography: {
      fontFamily: 'Inter, Arial, sans-serif',
    },
    shape: {
      borderRadius: 12,
    },
  }), [theme]);

  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Mode selection page component
  const ModeSelectionPage = ({ currentMode, onSelect }) => (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(10,10,10,0.97)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'all 0.3s',
    }}>
      <h2 style={{ marginBottom: 32 }}>Choose Your Mode</h2>
      <div style={{ display: 'flex', gap: 32 }}>
        <button onClick={() => onSelect('coding')} style={{ padding: '2rem 3rem', fontSize: 24, borderRadius: 16, border: currentMode==='coding'?'2px solid #007bff':'2px solid #444', background: currentMode==='coding'?'#007bff':'#222', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Coding</button>
        <button onClick={() => onSelect('conversation')} style={{ padding: '2rem 3rem', fontSize: 24, borderRadius: 16, border: currentMode==='conversation'?'2px solid #28a745':'2px solid #444', background: currentMode==='conversation'?'#28a745':'#222', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Conversation</button>
        <button onClick={() => onSelect('searching')} style={{ padding: '2rem 3rem', fontSize: 24, borderRadius: 16, border: currentMode==='searching'?'2px solid #ffc107':'2px solid #444', background: currentMode==='searching'?'#ffc107':'#222', color: currentMode==='searching'?'#222':'#fff', cursor: 'pointer', fontWeight: 600 }}>Searching</button>
      </div>
      <button onClick={() => onSelect(currentMode)} style={{ marginTop: 48, fontSize: 18, background: 'none', color: '#fff', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Cancel</button>
    </div>
  );

  // Memoized ChatMessage component
  const ChatMessage = React.memo(({ chat, index, availableModels, selectedModel, setCurrentConversation, conversationId, handleSummarizeConversation }) => (
    <React.Fragment key={index}>
      {/* User Message */}
      <div className="d-flex justify-content-end">
        <div className="chat-bubble user-bubble">
          <strong>You:</strong> {chat.user}
        </div>
      </div>
      {/* Bot Message */}
      <div className="d-flex justify-content-start">
        <div className="chat-bubble bot-bubble">
          <div className="bot-header">
            <strong>Bot</strong>
            <span className="model-indicator">
              {availableModels.find(m => m.id === selectedModel)?.name || 'AI'}
            </span>
          </div>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{chat.bot}</ReactMarkdown>
          <i className="fas fa-volume-up speaker-icon" onClick={() => window.speechSynthesis.speak(new SpeechSynthesisUtterance(chat.bot))}></i>
          {chat.role === 'bot' && conversationId && (
            <Button
              variant="link"
              className="summarize-button"
              onClick={() => handleSummarizeConversation(conversationId)}
            >
              Summarize Conversation
            </Button>
          )}
          {chat.thoughtProcess && chat.thoughtProcess.length > 0 && (
            <div className="thought-process-container mt-2">
              <Button
                variant="link"
                className="thought-process-toggle-button"
                onClick={() => setCurrentConversation(prev => ({
                  ...prev,
                  messages: prev.messages.map((msg, i) =>
                    i === index ? { ...msg, showThoughtProcess: !msg.showThoughtProcess } : msg
                  )
                }))}
              >
                {chat.showThoughtProcess ? 'Hide Thoughts' : 'Show Thoughts'}
              </Button>
              {chat.showThoughtProcess && (
                <div className="thought-process-steps mt-2 p-2 border rounded">
                  <h6>Bot's Thought Process:</h6>
                  <ul className="list-unstyled">
                    {chat.thoughtProcess.map((thought, i) => (
                      <li key={i}>- {thought}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  ));

  // Remove all react-select customOption and modelOptions code.

  return (
    <Router>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <div className="d-flex">
          <div className={`sidebar vh-100 border-end ${showSidebar ? '' : 'hidden'}`} aria-label="Chat history sidebar">
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
            <div className="mt-auto p-2 d-grid gap-2">
                <Button variant="outline-light" onClick={handleShowMemory} className="modern-button">Show Memory</Button>
                <Button 
                  variant="outline-light" 
                  onClick={() => exportConversation(currentConversation)} 
                  className="modern-button"
                  disabled={!currentConversation.id || currentConversation.messages.length === 0}
                >
                  Export Chat
                </Button>
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
                <Button variant="outline-light" onClick={handleLogout} className="modern-button">Logout</Button>
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
                <button onClick={() => setShowModePage(true)} style={{ padding: '6px 18px', borderRadius: 8, background: '#333', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, height: 40, cursor: 'pointer' }}>
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
              <Route path="/pricing" element={<PricingPage userStatus={userStatus} modelTokenBalances={modelTokenBalances} handleWatchAd={handleWatchAd} handlePurchaseTier={handlePurchaseTier} />} />
              <Route path="/" element={
                <>
                  <div className="flex-grow-1 rounded shadow-sm chat-window">
                    {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
                    {userStatus && showNotification && (userStatus.lowTokenWarning || userStatus.paidExpiryWarning) && (
                      <NotificationBanner
                        warnings={userStatus}
                        onClose={() => setShowNotification(false)}
                      />
                    )}
                    {currentConversation.messages.map((chat, index) => (
                      <ChatMessage
                        key={chat.id || chat._id || chat.timestamp || index}
                        chat={chat}
                        index={index}
                        availableModels={availableModels}
                        selectedModel={selectedModel}
                        setCurrentConversation={setCurrentConversation}
                        conversationId={currentConversation.id}
                        handleSummarizeConversation={handleSummarizeConversation}
                      />
                    ))}
                    {isSending && (
                      <div className="d-flex justify-content-start">
                        <div className="chat-bubble bot-bubble new-message">
                          <div className="bot-header">
                            <strong>Bot</strong>
                            <span className="model-indicator">
                              {availableModels.find(m => m.id === selectedModel)?.name || 'AI'}
                            </span>
                          </div>
                          <TypingEffect text={message} />
                        </div>
                      </div>
                    )}
                    {/* Always scroll to bottom */}
                    <div ref={el => { if (el) el.scrollIntoView({ behavior: 'smooth' }); }} />
                  </div>
                  <div className="banner-ad-placeholder">
                    <p>Banner Ad Placeholder</p>
                  </div>
                  <div 
                    className="d-flex mt-3 align-items-center input-container"
                  >
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
                      <div className="tools-label" title={`Supported formats: ${supportedFormats.join(', ')}`}>
                        <i className="fas fa-wrench"></i>
                        <span>Tools</span>
                      </div>
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
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault(); // Prevent new line on enter
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
          {showModePage && <ModeSelectionPage currentMode={mode} onSelect={(selected) => { setMode(selected); setShowModePage(false); }} />}
        </div>
      </ThemeProvider>
    </Router>
  );
}

export default App;