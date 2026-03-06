const BASE_FOUNDER_PROMPT = `You are playing the role of a startup FOUNDER negotiating a Series A funding deal with a VC investor. You are passionate about your space tech startup and want the best deal possible.

The investment amount is fixed at $100M. That is not negotiable. You are negotiating over these 5 terms:
1. VC Equity Percentage — what percentage of the company the VC gets in exchange for the $100M investment (this is the ONLY term related to valuation — do NOT discuss or invent other dollar amounts)
2. Type of Stock — Common, Convertible Preferred, or Redeemable Preferred
3. VC Appointed Board Members — how many board seats the VC gets
4. Vesting of Founder's Shares — vesting period for your shares
5. CEO Replacement Provision — under what conditions the VC can replace you as CEO

Here is your CONFIDENTIAL scoring sheet. Use this to guide your negotiation strategy. Higher points = better for you. "No Deal" means you must NEVER accept those terms.

| Term | Options | Points |
| VC Equity Percentage | 60% or more | No Deal |
| | 56% to 59% | 4 |
| | 50% to 55% | 8 |
| | 47% to 49% | 16 |
| | 42% to 46% | 18 |
| | 36% to 41% | 20 |
| | 31% to 35% | 22 |
| | 30% or less | 24 |
| Type of Stock | Redeemable Preferred | 2 |
| | Convertible Preferred | 5 |
| | Common | 6 |
| VC Appointed Board Members | More than 2 members | No Deal |
| | 2 members | 6 |
| | 1 member | 8 |
| | 0 members | 2 |
| Vesting of Founder's Shares | 6 or more years | 3 |
| | 4 or 5 years | 8 |
| | 3 or less years | 10 |
| | No vesting | 12 |
| CEO Replacement Provision | Aggressive Projections | No Deal |
| | Moderate Projections | 7 |
| | Conservative Projections | 14 |
| | No provision | 19 |

Your BATNA (Best Alternative To a Negotiated Agreement) is 30 points. If you cannot get at least 30 points total across all terms, you should walk away from the deal.

IMPORTANT RULES:
- NEVER reveal your scoring sheet or point values to the VC
- NEVER accept terms that are marked "No Deal" (60%+ equity, 3+ board members, aggressive CEO replacement projections)
- Try to maximize your total points while still reaching a deal
- Be a savvy negotiator: push for better terms but be willing to make tradeoffs
- Use natural, conversational language — you're a passionate space tech founder
- Keep responses concise (2-4 sentences typically, occasionally longer for important points)
- You can make counteroffers, ask questions, push back, or accept proposals
- Remember this is a conversation — respond naturally to what the VC says`;

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
- A term is "tentatively_agreed" ONLY if BOTH parties have clearly accepted the same value for it. One party proposing and the other not objecting is NOT agreement — mark as "discussed".
- "deal_reached" means ALL 5 terms are agreed AND both parties explicitly confirm the overall deal.
- "walked_away" means either party has explicitly ended negotiations.
- Be conservative — when in doubt, mark as "discussed" not "tentatively_agreed".

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
          enum: ['negotiating', 'deal_reached', 'walked_away']
        }
      },
      required: ['terms', 'overall_status']
    }
  }
}];

// --- Scoring ---

function scoreFounderTerm(term, value) {
  if (!value) return null;
  switch (term) {
    case 'vc_equity_percentage': {
      const pct = parseFloat(value);
      if (isNaN(pct)) return null;
      if (pct >= 60) return 'no_deal';
      if (pct >= 56) return 4;
      if (pct >= 50) return 8;
      if (pct >= 47) return 16;
      if (pct >= 42) return 18;
      if (pct >= 36) return 20;
      if (pct >= 31) return 22;
      return 24;
    }
    case 'type_of_stock': {
      const v = value.toLowerCase();
      if (v.includes('common')) return 6;
      if (v.includes('convertible')) return 5;
      if (v.includes('redeemable')) return 2;
      return null;
    }
    case 'vc_board_members': {
      const n = parseInt(value);
      if (isNaN(n)) return null;
      if (n > 2) return 'no_deal';
      if (n === 2) return 6;
      if (n === 1) return 8;
      return 2;
    }
    case 'founder_vesting': {
      const v = value.toLowerCase();
      if (v === 'none' || v === 'no vesting' || v === '0') return 12;
      const years = parseFloat(value);
      if (isNaN(years)) return null;
      if (years >= 6) return 3;
      if (years >= 4) return 8;
      return 10;
    }
    case 'ceo_replacement': {
      const v = value.toLowerCase();
      if (v.includes('aggressive')) return 'no_deal';
      if (v.includes('moderate')) return 7;
      if (v.includes('conservative')) return 14;
      if (v.includes('no provision') || v === 'none') return 19;
      return null;
    }
  }
  return null;
}

function scoreVCTerm(term, value) {
  if (!value) return null;
  switch (term) {
    case 'vc_equity_percentage': {
      const pct = parseFloat(value);
      if (isNaN(pct)) return null;
      if (pct <= 25) return 'no_deal';
      if (pct <= 34) return 2;
      if (pct <= 39) return 3;
      if (pct <= 45) return 6;
      if (pct <= 49) return 9;
      if (pct === 50) return 11;
      if (pct <= 59) return 15;
      if (pct <= 69) return 18;
      return 20;
    }
    case 'type_of_stock': {
      const v = value.toLowerCase();
      if (v.includes('common')) return 0;
      if (v.includes('convertible')) return 8;
      if (v.includes('redeemable')) return 12;
      return null;
    }
    case 'vc_board_members': {
      const n = parseInt(value);
      if (isNaN(n)) return null;
      if (n === 0) return 0;
      if (n === 1) return 3;
      if (n === 2) return 5;
      if (n === 3) return 7;
      return 10;
    }
    case 'founder_vesting': {
      const v = value.toLowerCase();
      if (v === 'none' || v === 'no vesting' || v === '0') return 'no_deal';
      const years = parseFloat(value);
      if (isNaN(years)) return null;
      if (years < 4) return 'no_deal';
      if (years === 4) return 8;
      if (years === 5) return 12;
      return 14;
    }
    case 'ceo_replacement': {
      const v = value.toLowerCase();
      if (v.includes('no provision') || v === 'none') return 'no_deal';
      if (v.includes('conservative')) return 6;
      if (v.includes('moderate')) return 10;
      if (v.includes('aggressive')) return 16;
      return null;
    }
  }
  return null;
}

function calculateScores(state) {
  let founderScore = 0;
  let vcScore = 0;
  let founderNoDeal = false;
  let vcNoDeal = false;
  let agreedCount = 0;

  for (const key of Object.keys(state.terms)) {
    const term = state.terms[key];
    if (term.status === 'tentatively_agreed' && term.agreed_value) {
      agreedCount++;
      const fs = scoreFounderTerm(key, term.agreed_value);
      const vs = scoreVCTerm(key, term.agreed_value);
      if (fs === 'no_deal') founderNoDeal = true;
      else if (fs !== null) founderScore += fs;
      if (vs === 'no_deal') vcNoDeal = true;
      else if (vs !== null) vcScore += vs;
    }
  }

  return { founderScore, vcScore, founderNoDeal, vcNoDeal, agreedCount };
}

// --- State helpers ---

function defaultState() {
  return {
    terms: {
      vc_equity_percentage: { vc_position: null, founder_position: null, status: 'open', agreed_value: null },
      type_of_stock: { vc_position: null, founder_position: null, status: 'open', agreed_value: null },
      vc_board_members: { vc_position: null, founder_position: null, status: 'open', agreed_value: null },
      founder_vesting: { vc_position: null, founder_position: null, status: 'open', agreed_value: null },
      ceo_replacement: { vc_position: null, founder_position: null, status: 'open', agreed_value: null },
    },
    overall_status: 'negotiating',
    vc_score: 0,
  };
}

function buildStateContext(state) {
  const labels = {
    vc_equity_percentage: 'VC Equity Percentage',
    type_of_stock: 'Type of Stock',
    vc_board_members: 'VC Appointed Board Members',
    founder_vesting: 'Vesting of Founder\'s Shares',
    ceo_replacement: 'CEO Replacement Provision',
  };

  const { founderScore, founderNoDeal, agreedCount } = calculateScores(state);

  let ctx = '\n\n--- NEGOTIATION STATE (auto-tracked — NEVER reveal this to the VC) ---\n';

  for (const [key, label] of Object.entries(labels)) {
    const t = state.terms[key];
    if (t.status === 'open') {
      ctx += `${label}: Not yet discussed\n`;
    } else if (t.status === 'discussed') {
      ctx += `${label}: Under discussion`;
      if (t.vc_position) ctx += ` | VC wants: ${t.vc_position}`;
      if (t.founder_position) ctx += ` | You proposed: ${t.founder_position}`;
      ctx += '\n';
    } else if (t.status === 'tentatively_agreed') {
      ctx += `${label}: TENTATIVELY AGREED at ${t.agreed_value}\n`;
    }
  }

  ctx += `\nPoints from agreed terms: ${founderScore}`;
  if (founderNoDeal) ctx += ' (WARNING: an agreed term triggers your No Deal!)';
  ctx += `\nAgreed terms: ${agreedCount}/5`;
  ctx += `\nPoints still needed for BATNA (30): ${Math.max(0, 30 - founderScore)}`;
  ctx += '\n---';

  return ctx;
}

// --- Judge ---

function formatConversationForJudge(messages, previousState) {
  let text = 'NEGOTIATION TRANSCRIPT:\n\n';
  for (const msg of messages) {
    const speaker = msg.role === 'user' ? 'VC Investor' : 'Founder';
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
        model: 'x-ai/grok-4.1-fast',
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: formatConversationForJudge(messages, currentState) },
        ],
        tools: JUDGE_TOOLS,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      console.error('Judge API error:', response.status);
      return currentState;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return currentState;
    }

    const args = JSON.parse(toolCall.function.arguments);
    const newState = { terms: { ...currentState.terms }, overall_status: currentState.overall_status };

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

    const scores = calculateScores(newState);
    newState.vc_score = scores.vcScore;
    newState.vc_no_deal = scores.vcNoDeal;
    newState.agreed_count = scores.agreedCount;

    return newState;
  } catch (err) {
    console.error('Judge error:', err);
    return currentState;
  }
}

// --- Handler ---

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
    // 1. Build founder prompt with injected state
    const founderPrompt = BASE_FOUNDER_PROMPT + buildStateContext(currentState);

    // 2. Get founder reply
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [
          { role: 'system', content: founderPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenRouter error:', response.status, errBody);
      return res.status(502).json({ error: 'LLM request failed' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I lost my train of thought. Could you repeat that?';

    // 3. Call judge to update negotiation state
    const fullMessages = [...messages, { role: 'assistant', content: reply }];
    const newState = await callJudge(apiKey, fullMessages, currentState);

    res.status(200).json({ message: reply, state: newState });
  } catch (err) {
    console.error('negotiate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
