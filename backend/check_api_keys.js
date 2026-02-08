// Check API keys configuration
require('dotenv').config();

console.log('API Keys Configuration Check:');
console.log('============================');

console.log(`TOGETHER_API_KEY configured: ${!!process.env.TOGETHER_API_KEY}`);
console.log(`OPENAI_API_KEY configured: ${!!process.env.OPENAI_API_KEY}`);
console.log(`QWEN_API_KEY configured: ${!!process.env.QWEN_API_KEY}`);
console.log(`GOOGLE_API_KEY configured: ${!!process.env.GOOGLE_API_KEY}`);

console.log('\nModel to API mapping:');
console.log('gpt-4.1-nano -> Gemini (if GOOGLE_API_KEY) or TogetherAI (fallback)');
console.log('gpt-4.1-mini -> Qwen (if QWEN_API_KEY) or TogetherAI (fallback)');
console.log('gpt-4.1 -> Qwen (if QWEN_API_KEY) or TogetherAI (fallback)');

console.log('\nRecommendation:');
console.log('For best results, make sure you have at least one of these configured:');
console.log('- TOGETHER_API_KEY (for fallback with Mixtral model)');
console.log('- GOOGLE_API_KEY (for gpt-4.1-nano model via Gemini)');
console.log('- QWEN_API_KEY with working Nebius endpoint');