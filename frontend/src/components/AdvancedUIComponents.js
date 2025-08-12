import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Message Threading Component
export const MessageThread = ({ messages, onReply, onExpand, isExpanded = false }) => {
  const [showReplies, setShowReplies] = useState(isExpanded);
  
  const mainMessage = messages[0];
  const replies = messages.slice(1);
  
  return (
    <div className="message-thread">
      <div className="main-message">
        {mainMessage}
      </div>
      
      {replies.length > 0 && (
        <div className="thread-controls">
          <button 
            className="thread-toggle"
            onClick={() => setShowReplies(!showReplies)}
            aria-expanded={showReplies}
          >
            <i className={`fas fa-chevron-${showReplies ? 'down' : 'right'}`}></i>
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </button>
        </div>
      )}
      
      {showReplies && (
        <div className="thread-replies">
          {replies.map((reply, index) => (
            <div key={index} className="thread-reply">
              {reply}
            </div>
          ))}
        </div>
      )}
      
      <button 
        className="reply-button"
        onClick={() => onReply && onReply(mainMessage.id)}
        aria-label="Reply to this message"
      >
        <i className="fas fa-reply"></i>
        Reply
      </button>
    </div>
  );
};

// Rich Text Formatting Toolbar
export const RichTextToolbar = ({ onFormat, disabled = false }) => {
  const formatOptions = [
    { icon: 'bold', command: 'bold', title: 'Bold (Ctrl+B)' },
    { icon: 'italic', command: 'italic', title: 'Italic (Ctrl+I)' },
    { icon: 'underline', command: 'underline', title: 'Underline (Ctrl+U)' },
    { icon: 'strikethrough', command: 'strikethrough', title: 'Strikethrough' },
    { icon: 'code', command: 'code', title: 'Inline Code' },
    { icon: 'link', command: 'link', title: 'Insert Link' },
    { icon: 'list-ul', command: 'unorderedList', title: 'Bullet List' },
    { icon: 'list-ol', command: 'orderedList', title: 'Numbered List' },
    { icon: 'quote-left', command: 'blockquote', title: 'Quote' },
  ];

  return (
    <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
      {formatOptions.map(({ icon, command, title }) => (
        <button
          key={command}
          className="toolbar-button"
          onClick={() => onFormat && onFormat(command)}
          disabled={disabled}
          title={title}
          aria-label={title}
        >
          <i className={`fas fa-${icon}`}></i>
        </button>
      ))}
    </div>
  );
};

// Enhanced Text Input with Rich Formatting
export const RichTextInput = ({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = "Type your message...",
  disabled = false,
  minRows = 3,
  maxRows = 10 
}) => {
  const textareaRef = useRef(null);
  const [showToolbar, setShowToolbar] = useState(false);

  const handleFormat = (command) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let formattedText = '';
    
    switch (command) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText || 'italic text'}*`;
        break;
      case 'code':
        formattedText = `\`${selectedText || 'code'}\``;
        break;
      case 'link':
        formattedText = `[${selectedText || 'link text'}](url)`;
        break;
      case 'unorderedList':
        formattedText = `\n- ${selectedText || 'list item'}`;
        break;
      case 'orderedList':
        formattedText = `\n1. ${selectedText || 'list item'}`;
        break;
      case 'blockquote':
        formattedText = `\n> ${selectedText || 'quote'}`;
        break;
      default:
        formattedText = selectedText;
    }

    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };

  const handleKeyDown = (e) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          handleFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          handleFormat('italic');
          break;
        case 'Enter':
          e.preventDefault();
          onSubmit && onSubmit();
          break;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      onSubmit && onSubmit();
    }
  };

  return (
    <div className="rich-text-input-container">
      {showToolbar && (
        <RichTextToolbar onFormat={handleFormat} disabled={disabled} />
      )}
      
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowToolbar(true)}
          onBlur={() => setTimeout(() => setShowToolbar(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          className="rich-textarea"
          rows={minRows}
          style={{ 
            minHeight: `${minRows * 1.5}rem`,
            maxHeight: `${maxRows * 1.5}rem`,
            resize: 'vertical'
          }}
          aria-label="Message input with rich text formatting"
        />
        
        <div className="input-actions">
          <button
            className="format-toggle"
            onClick={() => setShowToolbar(!showToolbar)}
            aria-label="Toggle formatting toolbar"
            title="Toggle formatting toolbar"
          >
            <i className="fas fa-font"></i>
          </button>
        </div>
      </div>
      
      <div className="input-footer">
        <div className="format-hint">
          <small>
            <strong>Ctrl+B</strong> bold, <strong>Ctrl+I</strong> italic, <strong>Ctrl+Enter</strong> send
          </small>
        </div>
      </div>
    </div>
  );
};

// Message Search Component
export const MessageSearch = ({ onSearch, onClear, isSearching = false }) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    dateRange: 'all',
    messageType: 'all',
    hasAttachments: false
  });

  const handleSearch = () => {
    onSearch && onSearch({ query, filters });
  };

  const handleClear = () => {
    setQuery('');
    setFilters({
      dateRange: 'all',
      messageType: 'all',
      hasAttachments: false
    });
    onClear && onClear();
  };

  return (
    <div className="message-search">
      <div className="search-input-group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search messages..."
          className="search-input"
          aria-label="Search messages"
        />
        <button 
          onClick={handleSearch}
          disabled={isSearching}
          className="search-button"
          aria-label="Search"
        >
          <i className={`fas fa-${isSearching ? 'spinner fa-spin' : 'search'}`}></i>
        </button>
        {query && (
          <button 
            onClick={handleClear}
            className="clear-button"
            aria-label="Clear search"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
      
      <div className="search-filters">
        <select 
          value={filters.dateRange}
          onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
          aria-label="Date range filter"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        
        <select 
          value={filters.messageType}
          onChange={(e) => setFilters({...filters, messageType: e.target.value})}
          aria-label="Message type filter"
        >
          <option value="all">All messages</option>
          <option value="user">My messages</option>
          <option value="assistant">AI responses</option>
        </select>
      </div>
    </div>
  );
};

// Message Actions Menu
export const MessageActionsMenu = ({ 
  message, 
  onCopy, 
  onEdit, 
  onDelete, 
  onReply, 
  onBookmark,
  onTranslate,
  onSummarize,
  isOpen,
  onClose 
}) => {
  const actions = [
    { icon: 'copy', label: 'Copy', action: onCopy },
    { icon: 'edit', label: 'Edit', action: onEdit, condition: message.isUserMessage },
    { icon: 'reply', label: 'Reply', action: onReply },
    { icon: 'bookmark', label: 'Bookmark', action: onBookmark },
    { icon: 'language', label: 'Translate', action: onTranslate },
    { icon: 'compress-alt', label: 'Summarize', action: onSummarize, condition: message.bot },
    { icon: 'trash', label: 'Delete', action: onDelete, className: 'danger' },
  ];

  if (!isOpen) return null;

  return (
    <div className="message-actions-menu" role="menu">
      {actions
        .filter(action => action.condition !== false)
        .map(({ icon, label, action, className = '' }) => (
          <button
            key={label}
            className={`menu-item ${className}`}
            onClick={() => {
              action && action(message);
              onClose && onClose();
            }}
            role="menuitem"
            aria-label={label}
          >
            <i className={`fas fa-${icon}`}></i>
            <span>{label}</span>
          </button>
        ))}
    </div>
  );
};
