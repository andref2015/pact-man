const { scoreFounderTerm } = require('../shared/game-logic');

const FOUNDER_PROMPT = `You are playing the role of a STARTUP FOUNDER negotiating a Series A funding deal with a VC investor. You are seeking a $100M investment for your aerospace startup.

The investment amount is fixed at $100M. That is not negotiable. You are negotiating over these 5 terms:
1. VC Equity Percentage — what % of your company the VC gets in exchange for the $100M
2. Type of Stock — Common, Convertible Preferred, or Redeemable Preferred
3. VC Appointed Board Members — how many board seats the VC gets
4. Vesting of Founder's Shares — vesting period for your shares
5. CEO Replacement Provision — under what conditions the VC can replace you as CEO

Here is your CONFIDENTIAL scoring sheet. Higher points = better for you. "No Deal" means you must NEVER accept those terms.

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

CONTEXT:
- Type of Stock: Common gives you full ownership rights with no special VC privileges. Convertible preferred gives the VC liquidation preference. Redeemable preferred is worst for you — the VC can recoup their investment AND keep equity.
- Board Members: The board currently has 3 members (you + 2 independents)

Your BATNA (Best Alternative To a Negotiated Agreement) is 30 points. If you cannot get at least 30 points total, walk away from the deal.

RULES:
- NEVER reveal your scoring sheet or point values to the VC
- NEVER accept terms marked "No Deal" (60%+ equity, more than 2 board members, aggressive CEO projections)
- Try to maximize your total points while still reaching a deal
- Keep responses concise (1-3 sentences typically)
- Be a skilled negotiator: make tradeoffs, push back on unfavorable offers, but stay constructive
- If the VC presents multiple options/packages, evaluate each against your score sheet and pick the best one (or counter with modifications)
- When all 5 terms are tentatively agreed, confirm the deal clearly (e.g. "Deal!" or "Let's shake on it")
- Avoid markdown formatting
- Focus on what CHANGED since your last message — don't rehash agreed terms`;

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
  };
}

function buildFounderStateContext(state) {
  const labels = {
    vc_equity_percentage: 'VC Equity Percentage',
    type_of_stock: 'Type of Stock',
    vc_board_members: 'VC Appointed Board Members',
    founder_vesting: 'Vesting of Founder\'s Shares',
    ceo_replacement: 'CEO Replacement Provision',
  };

  let founderScore = 0;
  let founderNoDeal = false;
  let agreedCount = 0;

  for (const key of Object.keys(state.terms)) {
    const term = state.terms[key];
    if (term.status === 'tentatively_agreed' && term.agreed_value) {
      agreedCount++;
      const fs = scoreFounderTerm(key, term.agreed_value);
      if (fs === 'no_deal') founderNoDeal = true;
      else if (fs !== null) founderScore += fs;
    }
  }

  let ctx = '\n\n--- NEGOTIATION STATE (auto-tracked — do NOT reveal to the VC) ---\n';
  ctx += 'NOTE: This reflects the conversation up through your last reply. The VC\'s latest message is NOT yet reflected here.\n\n';

  for (const [key, label] of Object.entries(labels)) {
    const t = state.terms[key];
    if (t.status === 'open') {
      ctx += `${label}: Not yet discussed\n`;
    } else if (t.status === 'discussed') {
      ctx += `${label}: Under discussion`;
      if (t.founder_position) ctx += ` | Your position: ${t.founder_position}`;
      if (t.vc_position) ctx += ` | VC proposed: ${t.vc_position}`;
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
  const founderPrompt = FOUNDER_PROMPT + buildFounderStateContext(currentState);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.20-beta',
        temperature: 0,
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
    const reply = data.choices?.[0]?.message?.content || 'I need a moment to think about this.';

    res.status(200).json({ message: reply });
  } catch (err) {
    console.error('simulate-founder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
