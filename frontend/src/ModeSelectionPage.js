import React from 'react';

const MODES = [
  { key: 'coding', label: 'Coding Assistant', description: 'Get code help, bug fixes, and code generation.' },
  { key: 'conversation', label: 'Conversation', description: 'Chat with the AI in a friendly, open-ended way.' },
  { key: 'search', label: 'Search/Research', description: 'Ask factual questions and get concise answers.' },
  { key: 'writing', label: 'Writing Assistant', description: 'Essays, emails, creative writing, grammar help.' },
  { key: 'study', label: 'Study/Quiz', description: 'Generate quizzes, flashcards, or explanations.' },
  { key: 'summarizer', label: 'Summarizer', description: 'Summarize text or files.' },
  { key: 'translator', label: 'Translator', description: 'Translate text between languages.' },
  { key: 'productivity', label: 'Productivity', description: 'To-do lists, reminders, productivity tips.' },
  { key: 'math', label: 'Math Solver', description: 'Solve math problems and show steps.' },
  { key: 'custom', label: 'Custom Prompt', description: 'Create your own AI persona.' },
];

const ModeSelectionPage = ({ onSelect }) => (
  <div style={{ minHeight: '100vh', background: '#181a1b', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48 }}>
    <h2 style={{ marginBottom: 32, fontWeight: 700 }}>Choose Your Mode</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center', maxWidth: 1200 }}>
      {MODES.map(mode => (
        <div
          key={mode.key}
          onClick={() => onSelect(mode.key)}
          style={{
            background: '#23272f',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            padding: '2.5rem 2rem',
            minWidth: 240,
            maxWidth: 320,
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
            border: '2px solid #353744',
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 600,
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: 26, marginBottom: 12 }}>{mode.label}</div>
          <div style={{ fontSize: 15, color: '#aaa', fontWeight: 400 }}>{mode.description}</div>
        </div>
      ))}
    </div>
  </div>
);

export default ModeSelectionPage; 