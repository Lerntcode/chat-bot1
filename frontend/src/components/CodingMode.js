import React, { useState } from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import Editor from '@monaco-editor/react';
import axios from 'axios';

const CodingMode = ({ onSendMessage, chatMessages }) => {
  const [code, setCode] = useState('// Write your code here...');
  const [language, setLanguage] = useState('javascript');

  // Reset code template when language changes
  React.useEffect(() => {
    if (code === '// Write your code here...' && language === 'python') {
      setCode('# Write your code here...\nprint("Hello World")');
    } else if (code.startsWith('# Write') && language === 'javascript') {
      setCode('// Write your code here...\nconsole.log("Hello World");');
    }
  }, [language]);

  const handleSend = async (action) => {
    console.log('handleSend triggered with action:', action);
    console.log('Current state code:', code);

    if (action === 'run') {
      try {
        const response = await axios.post('http://localhost:5000/api/v1/code/execute', {
          language,
          code,
          action,
        }, {
          headers: {
            'x-auth-token': localStorage.getItem('token'),
          },
        });
        const result = response.data.stdout || response.data.stderr || response.data.message || 'No output';
        const message = 'Execution Result:\n\n```\n' + result + '\n```';
        // Send as a system/bot message directly to frontend state, or use a special flag
        // For now, we'll append it to the chat manually if onSendMessage supports it, 
        // or just let it be a user message but we need the backend to NOT fail.
        // Since we can't easily change App.js state from here without a new prop, 
        // we will rely on the backend fix. 
        onSendMessage(message, { isLocal: true });
      } catch (error) {
        onSendMessage('Error executing code: ' + (error.response?.data?.error || error.message));
      }
    } else {
      const message = 'Action: ' + action + '\n\nLanguage: ' + language + '\n\nCode:\n```' + language + '\n' + code + '\n```';
      onSendMessage(message);
    }
  };

  return (
    <Row className="coding-mode-container">
      <Col md={6} className="chat-panel">
        <div className="chat-messages">
          {chatMessages.map((chat, index) => (
            <div key={index} className={`chat-bubble ${chat.isUserMessage ? 'user-bubble' : 'bot-bubble'}`}>
              {chat.isUserMessage ? 'You: ' : 'Bot: '}
              {chat.user || chat.bot}
            </div>
          ))}
        </div>
      </Col>
      <Col md={6} className="editor-panel">
        <div className="editor-controls">
          <Form.Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="language-select"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="csharp">C#</option>
            <option value="cpp">C++</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="sql">SQL</option>
          </Form.Select>
        </div>
        <Editor
          height="80vh"
          language={language}
          value={code}
          onChange={(value) => setCode(value || '')}
          theme="vs-dark"
        />
        <div className="action-buttons">
          <Button variant="primary" onClick={() => handleSend('run')}>Run</Button>
          <Button variant="secondary" onClick={() => handleSend('explain')}>Explain</Button>
          <Button variant="success" onClick={() => handleSend('fix')}>Fix</Button>
          <Button variant="warning" onClick={() => handleSend('optimize')}>Optimize</Button>
        </div>
      </Col>
    </Row>
  );
};

export default CodingMode;