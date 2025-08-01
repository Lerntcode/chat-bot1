
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
    req.body.systemMessage = "You are an expert software developer. When the user asks a coding question, provide a complete and correct solution. If they provide code, analyze it for errors and potential improvements. In addition to the code, provide a clear explanation of the solution, including the underlying logic and any relevant best practices. If applicable, also provide an example of the code's output.";
  }

  next();
};

module.exports = technicalQuestionDetector;
