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
  'gpt-4.1-mini': 'Qwen/Qwen3-30B-A3B',
  'gpt-4.1': 'Qwen/Qwen3-235B-A22B'
};

async function createStream({ model, messages }) {
  const apiModel = MODEL_API_MAPPING[model] || model;
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
    return together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages, stream: true });
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
    return together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages, stream: true });
  }
  if (!together) throw new Error('TogetherAI key not configured');
  console.info(`[llmProvider] createStream -> Together model=${apiModel}`);
  return together.chat.completions.create({ model: apiModel, messages, stream: true });
}

async function createCompletion({ model, messages }) {
  const apiModel = MODEL_API_MAPPING[model] || model;
  if (model === 'gpt-4.1-mini') {
    if (env.QWEN_API_KEY) {
      console.info(`[llmProvider] createCompletion -> Qwen model=${apiModel}`);
      const resp = await qwenClient.post('/chat/completions', { model: apiModel, messages });
      return resp.data.choices[0].message.content;
    }
    if (!together) throw new Error('QWEN_API_KEY not configured and TogetherAI key not configured for fallback');
    console.info(`[llmProvider] createCompletion -> Together (fallback) model=${MODEL_API_MAPPING['gpt-4.1-nano']}`);
    const resp = await together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages });
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
    const resp = await together.chat.completions.create({ model: MODEL_API_MAPPING['gpt-4.1-nano'], messages });
    return resp.choices[0].message.content;
  }
  if (!together) throw new Error('TogetherAI key not configured');
  console.info(`[llmProvider] createCompletion -> Together model=${apiModel}`);
  const resp = await together.chat.completions.create({ model: apiModel, messages });
  return resp.choices[0].message.content;
}

module.exports = { createStream, createCompletion, MODEL_API_MAPPING };
