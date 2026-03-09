const { JUDGE_SYSTEM_PROMPT, JUDGE_TOOLS, formatConversationForJudge, callJudge, defaultState } = require('./negotiate');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, state: clientState } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const currentState = clientState || defaultState();

  try {
    const newState = await callJudge(apiKey, messages, currentState);
    res.status(200).json({ state: newState });
  } catch (err) {
    console.error('judge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
