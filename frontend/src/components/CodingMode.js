import React, { useState } from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import Editor from '@monaco-editor/react';
import axios from 'axios';

const CodingMode = ({ onSendMessage, chatMessages }) => {
  const [code, setCode] = useState('// Write your code here...');
  const [language, setLanguage] = useState('javascript');

  const handleSend = async (action) => {
    if (action === 'run') {
      try {
        const response = await axios.post('/api/v1/code/execute', {
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
        onSendMessage(message);
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