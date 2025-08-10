const { encode } = require('gpt-tokenizer');

function estimateTokenCount(text) {
  try {
    if (!text || typeof text !== 'string') return 0;
    // gpt-tokenizer encode approximates cl100k_base
    const tokens = encode(text);
    return tokens.length;
  } catch (e) {
    // Fallback heuristic
    return Math.ceil((text || '').length / 4);
  }
}

module.exports = { estimateTokenCount };
