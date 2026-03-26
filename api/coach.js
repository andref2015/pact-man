const { fetchWithRetry } = require('./_retry');

const COACH_PROMPT = `You are an expert negotiation coach reviewing a practice negotiation. The human played the FOUNDER (startup seeking $100M Series A funding). The AI played the VC INVESTOR.

Analyze the conversation and provide feedback to help the Founder improve their negotiation skills.

Return your response as JSON with this exact structure:
{
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "tip": "One specific tactical tip for next time"
}

Rules:
- 2-3 strengths, 2-3 improvements. Keep each to ONE short sentence.
- Be specific — reference actual moments from the conversation, not generic advice.
- The "tip" should be a single concrete, actionable sentence.
- If the Founder did poorly, still find something positive. If they did great, still find something to improve.
- Consider: anchoring, concession patterns, use of tradeoffs, emotional control, information gathering, BATNA awareness.
- Return ONLY the JSON object, no other text.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, founderScore, vcScore, strategy } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const context = `The negotiation just ended. Final scores: Founder ${founderScore}/59, VC ${vcScore}/54. VC strategy was "${strategy}". Here is the full conversation:`;

  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'FOUNDER' : 'VC'}: ${m.content}`)
    .join('\n\n');

  try {
    const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.20-beta',
        temperature: 0.7,
        messages: [
          { role: 'system', content: COACH_PROMPT },
          { role: 'user', content: `${context}\n\n${conversationText}` },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenRouter error:', response.status, errBody);
      return res.status(502).json({ error: 'LLM request failed' });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';


    // Parse the JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'Invalid coach response' });
    }

    const feedback = JSON.parse(jsonMatch[0]);
    res.status(200).json(feedback);
  } catch (err) {
    console.error('coach error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
