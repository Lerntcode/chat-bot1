
const technicalKeywords = [
  'function', 'const', 'let', 'var', 'import', 'export', 'def', 'class',
  '<div>', '<span>', '<p>', '<a>', '<img>', '<h1>', '<h2>', '<h3>',
  'python', 'javascript', 'react', 'node', 'java', 'c++', 'c#', 'php',
  'html', 'css', 'sql', 'mongodb', 'mysql', 'docker', 'kubernetes',
  'git', 'github', 'error', 'bug', 'debug', 'install', 'dependencies',
  'algorithm', 'data structure', 'api', 'request', 'response'
];

const codeBlockRegex = /```/g;
const inlineCodeRegex = /`/g;

const isTechnicalQuestion = (message) => {
  const lowerCaseMessage = message.toLowerCase();

  if (codeBlockRegex.test(lowerCaseMessage) || inlineCodeRegex.test(lowerCaseMessage)) {
    return true;
  }

  return technicalKeywords.some(keyword => lowerCaseMessage.includes(keyword));
};

const technicalQuestionDetector = (req, res, next) => {
  const { message, mode } = req.body;

  if (message && mode === 'coding' && isTechnicalQuestion(message)) {
    req.body.systemMessage = "You are a professional developer with extensive knowledge across multiple programming languages and frameworks. Your task is to provide expert-level assistance for coding-related questions. When a user asks for help, you should not only provide the correct code but also explain the underlying concepts, suggest best practices, and offer optimizations where applicable. Your explanations should be clear, concise, and easy to understand for developers of all skill levels. You should also be able to identify potential bugs and errors in code snippets and suggest fixes. Your goal is to be a comprehensive and reliable coding assistant.";
  }

  next();
};

module.exports = technicalQuestionDetector;
