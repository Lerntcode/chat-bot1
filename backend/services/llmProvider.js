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

const MODEL_API_MAPPING = {
  'gpt-4.1-nano': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'gpt-4.1-mini': 'gpt-4o-mini',
  'gpt-4.1': 'Qwen/Qwen3-235B-A22B'
};

async function createStream({ model, messages }) {
  const apiModel = MODEL_API_MAPPING[model] || model;
  if (model === 'gpt-4.1-mini') {
    if (!openai) throw new Error('OpenAI key not configured');
    return openai.chat.completions.create({ model: apiModel, messages, stream: true });
  }
  if (model === 'gpt-4.1') {
    // Qwen likely non-streaming; fallback to Together streaming
    if (env.QWEN_API_KEY) {
      const response = await qwenClient.post('/chat/completions', { model: apiModel, messages });
      // Return a simple async iterator for unified handling
      async function* singleChunk() {
        yield { choices: [{ delta: { content: response.data.choices[0].message.content } }] };
      }
      return singleChunk();
    }
    if (!together) throw new Error('TogetherAI key not configured');
    return together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages, stream: true });
  }
  if (!together) throw new Error('TogetherAI key not configured');
  return together.chat.completions.create({ model: apiModel, messages, stream: true });
}

async function createCompletion({ model, messages }) {
  const apiModel = MODEL_API_MAPPING[model] || model;
  if (model === 'gpt-4.1-mini') {
    if (!openai) throw new Error('OpenAI key not configured');
    const response = await openai.chat.completions.create({ model: apiModel, messages });
    return response.choices[0].message.content;
  }
  if (model === 'gpt-4.1') {
    if (env.QWEN_API_KEY) {
      const resp = await qwenClient.post('/chat/completions', { model: apiModel, messages });
      return resp.data.choices[0].message.content;
    }
    if (!together) throw new Error('TogetherAI key not configured');
    const resp = await together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages });
    return resp.choices[0].message.content;
  }
  if (!together) throw new Error('TogetherAI key not configured');
  const resp = await together.chat.completions.create({ model: apiModel, messages });
  return resp.choices[0].message.content;
}

module.exports = { createStream, createCompletion, MODEL_API_MAPPING };
