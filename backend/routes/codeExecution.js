const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');

const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';

const languageMap = {
  javascript: 93,
  python: 71,
  java: 62,
  csharp: 51,
  cpp: 54,
  html: 68,
  css: 68,
  sql: 82,
};

router.post('/code/execute', auth, async (req, res) => {
  const { language, code, action } = req.body;

  if (!language || !code || !action) {
    return res.status(400).json({ error: 'Language, code, and action are required.' });
  }

  if (action === 'run') {
    try {
      const response = await axios.post(`${JUDGE0_API_URL}/submissions`, {
        language_id: languageMap[language],
        source_code: code,
      }, {
        headers: {
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
          'x-rapidapi-key': process.env.JUDGE0_API_KEY,
          'content-type': 'application/json',
        },
      });

      const submissionToken = response.data.token;

      // Poll for the result
      setTimeout(async () => {
        try {
          const resultResponse = await axios.get(`${JUDGE0_API_URL}/submissions/${submissionToken}`, {
            headers: {
              'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
              'x-rapidapi-key': process.env.JUDGE0_API_KEY,
            },
          });

          res.json(resultResponse.data);
        } catch (error) {
          res.status(500).json({ error: 'Failed to get code execution result.' });
        }
      }, 2000);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit code for execution.' });
    }
  } else {
    // For explain, fix, and optimize, we'll just send the request to the chatbot
    // The frontend will handle the response
    res.json({ message: 'Action sent to chatbot.' });
  }
});

module.exports = router;
