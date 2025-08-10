const OpenAI = require('openai');
const TogetherAI = require('together-ai');
const axios = require('axios');
const env = require('../config/env');

const together = env.TOGETHER_API_KEY ? new TogetherAI({ apiKey: env.TOGETHER_API_KEY }) : null;
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const qwenClient = axios.create({
  baseURL: 'https://api.studio.nebius.ai/v1',
  headers: Object.assign(
    { 'Content-Type': 'application/json' },
    env.QWEN_API_KEY ? { 'Authorization': `Bearer ${env.QWEN_API_KEY}` } : {}
  )
});

// Google Gemini client (non-streaming; we'll wrap as single-chunk stream)
const geminiClient = axios.create({
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  headers: { 'Content-Type': 'application/json' },
  params: env.GOOGLE_API_KEY ? { key: env.GOOGLE_API_KEY } : undefined,
});

const MODEL_API_MAPPING = {
  // Allow overriding Gemini Flash model via env; default to a stable Flash model
  'gpt-4.1-nano': env.GEMINI_FLASH_MODEL || 'models/gemini-1.5-flash',
  'gpt-4.1-mini': 'Qwen/Qwen3-30B-A3B',
  'gpt-4.1': 'Qwen/Qwen3-235B-A22B'
};

function toGeminiContents(messages) {
  // Map OpenAI-style messages to Gemini contents; ignore 'system' for now
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : '' }]
    }));
}

async function createStream({ model, messages }) {
  const apiModel = MODEL_API_MAPPING[model] || model;
  if (model === 'gpt-4.1-nano') {
    if (env.GOOGLE_API_KEY) {
      console.info(`[llmProvider] createStream -> Gemini model=${apiModel}`);
      const contents = toGeminiContents(messages);
      const url = `/${apiModel}:generateContent`;
      const response = await geminiClient.post(url, { contents });
      const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      async function* singleChunk() {
        yield { choices: [{ delta: { content: text } }] };
      }
      return singleChunk();
    }
    // Fallback to Together if no Google key
    if (!together) throw new Error('GOOGLE_API_KEY not configured and TogetherAI key not configured for fallback');
    console.info(`[llmProvider] createStream -> Together (fallback) model=mistralai/Mixtral-8x7B-Instruct-v0.1`);
    return together.chat.completions.create({ model: 'mistralai/Mixtral-8x7B-Instruct-v0.1', messages, stream: true, max_tokens: 512, temperature: 0.7 });
  }
  if (model === 'gpt-4.1-mini') {
    if (env.QWEN_API_KEY) {
      console.info(`[llmProvider] createStream -> Qwen model=${apiModel}`);
      const response = await qwenClient.post('/chat/completions', { model: apiModel, messages });
      async function* singleChunk() {
        yield { choices: [{ delta: { content: response.data.choices[0].message.content } }] };
      }
      return singleChunk();
    }
    if (!together) throw new Error('QWEN_API_KEY not configured and TogetherAI key not configured for fallback');
    console.info(`[llmProvider] createStream -> Together (fallback) model=${MODEL_API_MAPPING['gpt-4.1-nano']}`);
    return together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages, stream: true, max_tokens: 512, temperature: 0.7 });
  }
  if (model === 'gpt-4.1') {
    // Qwen likely non-streaming; fallback to Together streaming
    if (env.QWEN_API_KEY) {
      console.info(`[llmProvider] createStream -> Qwen model=${apiModel}`);
      const response = await qwenClient.post('/chat/completions', { model: apiModel, messages });
      // Return a simple async iterator for unified handling
      async function* singleChunk() {
        yield { choices: [{ delta: { content: response.data.choices[0].message.content } }] };
      }
      return singleChunk();
    }
    if (!together) throw new Error('TogetherAI key not configured');
    console.info(`[llmProvider] createStream -> Together model=${MODEL_API_MAPPING['gpt-4.1-nano']}`);
    return together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages, stream: true, max_tokens: 512, temperature: 0.7 });
  }
  if (!together) throw new Error('TogetherAI key not configured');
  console.info(`[llmProvider] createStream -> Together model=${apiModel}`);
  return together.chat.completions.create({ model: apiModel, messages, stream: true, max_tokens: 512, temperature: 0.7 });
}

async function createCompletion({ model, messages }) {
  const apiModel = MODEL_API_MAPPING[model] || model;
  if (model === 'gpt-4.1-nano') {
    if (env.GOOGLE_API_KEY) {
      console.info(`[llmProvider] createCompletion -> Gemini model=${apiModel}`);
      const contents = toGeminiContents(messages);
      const url = `/${apiModel}:generateContent`;
      const resp = await geminiClient.post(url, { contents });
      return resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    if (!together) throw new Error('GOOGLE_API_KEY not configured and TogetherAI key not configured for fallback');
    console.info(`[llmProvider] createCompletion -> Together (fallback) model=mistralai/Mixtral-8x7B-Instruct-v0.1`);
    const resp = await together.chat.completions.create({ model: 'mistralai/Mixtral-8x7B-Instruct-v0.1', messages, max_tokens: 512, temperature: 0.7 });
    return resp.choices[0].message.content;
  }
  if (model === 'gpt-4.1-mini') {
    if (env.QWEN_API_KEY) {
      console.info(`[llmProvider] createCompletion -> Qwen model=${apiModel}`);
      const resp = await qwenClient.post('/chat/completions', { model: apiModel, messages });
      return resp.data.choices[0].message.content;
    }
    if (!together) throw new Error('QWEN_API_KEY not configured and TogetherAI key not configured for fallback');
    console.info(`[llmProvider] createCompletion -> Together (fallback) model=${MODEL_API_MAPPING['gpt-4.1-nano']}`);
    const resp = await together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages, max_tokens: 512, temperature: 0.7 });
    return resp.choices[0].message.content;
  }
  if (model === 'gpt-4.1') {
    if (env.QWEN_API_KEY) {
      console.info(`[llmProvider] createCompletion -> Qwen model=${apiModel}`);
      const resp = await qwenClient.post('/chat/completions', { model: apiModel, messages });
      return resp.data.choices[0].message.content;
    }
    if (!together) throw new Error('TogetherAI key not configured');
    console.info(`[llmProvider] createCompletion -> Together model=${MODEL_API_MAPPING['gpt-4.1-nano']}`);
    const resp = await together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages, max_tokens: 512, temperature: 0.7 });
    return resp.choices[0].message.content;
  }
  if (!together) throw new Error('TogetherAI key not configured');
  console.info(`[llmProvider] createCompletion -> Together model=${apiModel}`);
  const resp = await together.chat.completions.create({ model: apiModel, messages, max_tokens: 512, temperature: 0.7 });
  return resp.choices[0].message.content;
}

module.exports = { createStream, createCompletion, MODEL_API_MAPPING };
