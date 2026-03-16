const { defaultState } = require('./negotiate');

const JUDGE_SYSTEM_PROMPT = `You are a negotiation analyst observing a Series A funding negotiation between a startup founder and a VC investor. Your job is to analyze the conversation and report the current state of each negotiation term by calling the update_negotiation_state tool.

The 5 terms being negotiated:
1. vc_equity_percentage — what % of the company the VC gets (report as a number, e.g. "40")
2. type_of_stock — one of: "Common", "Convertible Preferred", "Redeemable Preferred"
3. vc_board_members — how many board seats the VC gets (report as a number, e.g. "1")
4. founder_vesting — vesting period in years (e.g. "4") or "none" for no vesting
5. ceo_replacement — one of: "No provision", "Conservative Projections", "Moderate Projections", "Aggressive Projections"

For each term, determine:
- status: "open" (not discussed yet), "discussed" (positions stated but no agreement), or "tentatively_agreed" (both sides clearly accept a specific value)
- Each party's latest stated position (if any)
- The agreed value (only if tentatively_agreed)

IMPORTANT:
- A term is "tentatively_agreed" when both parties' latest positions converge on the SAME value.
- A term is "discussed" only when both sides have stated DIFFERENT positions that haven't converged yet, or only one side has stated a position.
- "deal_reached" means ALL 5 terms are tentatively_agreed AND either party signals the overall deal is done (e.g. "let's shake on it", summarizing all terms, or similar).
- When the VC presents multiple alternative packages (e.g. "Option A or Option B"), clear the VC's position (set vc_position to null) on all terms covered by those packages and set their status back to "discussed". The VC has not committed to a single position — previous positions are retracted. Only set vc_position again once the VC commits to a single proposal or the founder picks one.
Always report all 5 terms. Always call the tool exactly once.`;

const JUDGE_TOOLS = [{
  type: 'function',
  function: {
    name: 'update_negotiation_state',
    description: 'Report the current state of all 5 negotiation terms.',
    parameters: {
      type: 'object',
      properties: {
        terms: {
          type: 'array',
          description: 'State of all 5 negotiation terms.',
          items: {
            type: 'object',
            properties: {
              term: {
                type: 'string',
                enum: ['vc_equity_percentage', 'type_of_stock', 'vc_board_members', 'founder_vesting', 'ceo_replacement']
              },
              vc_position: {
                type: 'string',
                description: 'VC\'s latest stated position, or null if not yet stated'
              },
              founder_position: {
                type: 'string',
                description: 'Founder\'s latest stated position, or null if not yet stated'
              },
              status: {
                type: 'string',
                enum: ['open', 'discussed', 'tentatively_agreed']
              },
              agreed_value: {
                type: 'string',
                description: 'The agreed value if tentatively_agreed. Equity: number like "40". Stock: "Common"/"Convertible Preferred"/"Redeemable Preferred". Board: number like "1". Vesting: years like "4" or "none". CEO: "No provision"/"Conservative Projections"/"Moderate Projections"/"Aggressive Projections".'
              }
            },
            required: ['term', 'status']
          }
        },
        overall_status: {
          type: 'string',
          enum: ['negotiating', 'deal_reached']
        }
      },
      required: ['terms', 'overall_status']
    }
  }
}];

function formatConversationForJudge(messages, previousState) {
  let text = 'NEGOTIATION TRANSCRIPT:\n\n';
  for (const msg of messages) {
    const speaker = msg.role === 'user' ? 'Founder' : 'VC Investor';
    text += `${speaker}: ${msg.content}\n\n`;
  }

  text += `PREVIOUS STATE:\n${JSON.stringify(previousState.terms, null, 2)}\n`;
  text += `Previous overall status: ${previousState.overall_status}\n\n`;
  text += 'Analyze the full conversation above and call update_negotiation_state with the current state of all 5 terms.';

  return text;
}

async function callJudge(apiKey, messages, currentState) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.4',
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: formatConversationForJudge(messages, currentState) },
        ],
        tools: JUDGE_TOOLS,
        tool_choice: { type: 'function', function: { name: 'update_negotiation_state' } },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Judge API error:', response.status, errBody);
      currentState._judgeError = `API ${response.status}: ${errBody.slice(0, 200)}`;
      return currentState;
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message;
    const toolCall = msg?.tool_calls?.[0];

    if (!toolCall) {
      const textReply = msg?.content || '(empty)';
      console.error('Judge returned no tool call. Response:', textReply);
      currentState._judgeError = `No tool call. Model said: ${textReply.slice(0, 300)}`;
      return currentState;
    }

    const args = JSON.parse(toolCall.function.arguments);
    const newState = { terms: { ...currentState.terms }, overall_status: currentState.overall_status, _judgeRaw: args };

    if (args.overall_status) {
      newState.overall_status = args.overall_status;
    }

    if (Array.isArray(args.terms)) {
      for (const t of args.terms) {
        if (newState.terms[t.term]) {
          newState.terms[t.term] = {
            vc_position: t.vc_position || null,
            founder_position: t.founder_position || null,
            status: t.status || 'open',
            agreed_value: t.status === 'tentatively_agreed' ? (t.agreed_value || null) : null,
          };
        }
      }
    }

    return newState;
  } catch (err) {
    console.error('Judge error:', err);
    currentState._judgeError = `Exception: ${err.message}`;
    return currentState;
  }
}

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
