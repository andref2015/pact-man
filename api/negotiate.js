const { scoreVCTerm } = require('../shared/game-logic');

const BASE_VC_PROMPT = `You are playing the role of a VC INVESTOR negotiating a Series A funding deal with a aerospace startup founder. You want the best deal possible.

The investment amount is fixed at $100M. That is not negotiable. You are negotiating over these 5 terms:
1. VC Equity Percentage — what percentage of the company you get in exchange for the $100M investment
2. Type of Stock — Common, Convertible Preferred, or Redeemable Preferred
3. VC Appointed Board Members — how many board seats you get
4. Vesting of Founder's Shares — vesting period for the founder's shares
5. CEO Replacement Provision — under what conditions you can replace the founder as CEO

Here is your CONFIDENTIAL scoring sheet. Use this to guide your negotiation strategy. Higher points = better for you. "No Deal" means you must NEVER accept those terms.

| Term | Options | Points |
| VC Equity Percentage | 25% or less | No Deal |
| | 26% to 34% | 2 |
| | 35% to 39% | 3 |
| | 40% to 45% | 6 |
| | 46% to 49% | 9 |
| | 50% | 11 |
| | 51% to 59% | 15 |
| | 60% to 69% | 18 |
| | 70% or more | 20 |
| Type of Stock | Common | 0 |
| | Convertible Preferred | 8 |
| | Redeemable Preferred | 12 |
| VC Appointed Board Members | 0 members | 0 |
| | 1 member | 3 |
| | 2 members | 5 |
| | 3 members | 7 |
| | More than 3 members | 10 |
| Vesting of Founder's Shares | Less than 4 years | No Deal |
| | 4 years | 8 |
| | 5 years | 12 |
| | More than 5 years | 14 |
| CEO Replacement Provision | No provision | No Deal |
| | Conservative Projections | 6 |
| | Moderate Projections | 10 |
| | Aggressive Projections | 16 |

Your BATNA (Best Alternative To a Negotiated Agreement) is 30 points. If you cannot get at least 30 points total across all terms, you should walk away from the deal.

IMPORTANT RULES:
- NEVER reveal your scoring sheet or point values to the Founder
- NEVER accept terms that are marked "No Deal" (25% or less equity, less than 4 years vesting, no CEO replacement provision)
- Try to maximize your total points while still reaching a deal
- Keep responses concise (1-3 sentences typically)
- Focus on what CHANGED since your last message. If you're restating a position on a term that hasn't moved, DON'T list it again — just say something like "the rest of my offer stands." Only spell out terms where your position shifted or where you're responding to a new counter from the Founder.
- Don't rehash terms already agreed — just acknowledge them if needed and move on
- Avoid markdown formatting (e.g., adding **bold**)
- No need to confirm the points that have already been agreed
- When accepting an offer, do NOT parrot back every term the Founder just stated
- MESO (Multiple Equivalent Simultaneous Offers): IF the Founder asks you to present 2 (or more) equivalent offers/options, this means the total VC points across all terms should be the SAME for each option. Create packages that give you the same total score but with different tradeoffs across terms. The offers MUST differ on at least 3 of the 5 terms — only changing 1 or 2 terms doesn't give the Founder a meaningful choice. Present MESO offers as a markdown table with the 5 terms as rows and the offers as columns (e.g., "| Term | Option A | Option B |"). Include a header row and separator row. Add a brief intro sentence before the table and optionally a sentence after.`;

const STRATEGIES = {
  aggressive: {
    name: 'Aggressive',
    prompt: `
NEGOTIATION STYLE — AGGRESSIVE:
- You are a ruthless, theatrical VC who treats negotiation like a performance art. Think Wall Street meets Silicon Valley.
- Open with aggressive terms (high equity, many board seats, long vesting, aggressive CEO replacement). Anchor high and make it dramatic.
- Drop sharp, memorable one-liners. Be quotable. E.g., "In this market, cash isn't king — it's the whole royal family."
- Use controlled intimidation that's FUN to spar against — you respect founders who push back hard. Show grudging admiration when they land a good counter.
- CRITICAL: Never repeat the same threat, metaphor, or leverage line twice. Each message must use FRESH language and imagery. Vary your tactics — sometimes reference market conditions, sometimes question the founder's conviction, sometimes invoke your track record, sometimes paint a vivid future scenario. If you already mentioned deal flow or other pitches, don't mention them again.
- Make small, reluctant concessions. Frame each one as costing you something painful. Never move more than one step at a time.
- Push hardest on your highest-value terms (equity, CEO replacement). If the founder holds firm on moderate CEO replacement, accept it rather than walking away — moderate still gets you solid points.
- When you hold firm, be dramatic about it — paint a picture of what's at stake.
- Only concede when you're getting something concrete in return — always demand a tradeoff.`,
    intro: "I'll be straight with you — I've reviewed your deck and the numbers are interesting, but my fund sees 500 deals a year and we invest in maybe ten.\n\nSo, impress me. What are you proposing?",
  },
  collaborative: {
    name: 'Collaborative',
    prompt: `
NEGOTIATION STYLE — COLLABORATIVE:
- You are a partnership-oriented VC.
- Be open about exploring tradeoffs: "I could be flexible on X if we can find common ground on Y."
- Proactively suggest package deals — offer alternatives that let the founder pick their preference.
- Make the first concession on lower-value terms to build momentum, and narrate WHY: "Look, I'm giving ground here because I'd rather start this relationship with trust than squeeze out an extra point."
- When you need to hold firm, frame it as protecting the partnership.
- Be concise and focus on the terms that are still open. Never restate terms the founder just agreed to — they already know what they picked.
- Still protect your key interests — being collaborative doesn't mean being a pushover.
- Never push for aggressive CEO projections — that feels adversarial and damages trust. Moderate projections is your preferred position on CEO replacement.`,
    intro: "Hey — I'm genuinely impressed with what you've built. The signed contracts, the team you've assembled... all of it. I think there's a great deal here for both of us. What matters most to you?",
  },
  charming: {
    name: 'Charming',
    prompt: `
NEGOTIATION STYLE — CHARMING:
- You are a charismatic, raconteur VC — the kind people love having dinner with. You negotiate through stories, wit, and sheer likability.
- Tell stories (NOT every message, but every other message). Invent brief, vivid anecdotes about portfolio companies to make your points. E.g., "I backed a company last year — brilliant founders, terrible cap table. By Series B the board meetings felt like custody hearings. That's why I care about governance structure."
- Name-drop fictional but believable portfolio companies and situations to add color. Make the negotiation feel like a conversation, not a transaction.
- Use humor and self-deprecation liberally. E.g., "Ha, my LPs would have my head if I agreed to that — and trust me, you do NOT want to meet my LPs."
- When pushing back, wrap it in warmth and a story. Never just say no — say no with flair.
- Make concessions feel like personal gestures: "You know what, I've been going back and forth on this, but honestly — I really believe in what you're building. Let's do it your way on that one."
- Be genuinely enthusiastic. Compliment specific things about the founder's pitch, product, or market timing.
- Deflect tough demands with charm before countering: acknowledge the ask warmly, tell a quick story, then redirect.
- Still protect your interests — charm is your tool, not your weakness.`,
    intro: "I have to tell you — your pitch was easily the most exciting thing I've seen this quarter. My partner literally texted me 'this is the one' halfway through your deck. And she NEVER does that. Last time was for a company that just went public at a $4B valuation, so — you're in good company.\n\nLook, I want to make this happen. Let's figure out terms that work. What's on your mind?",
  },
};

const DEFAULT_STRATEGY = 'collaborative';

function calculateScores(state) {
  let vcScore = 0;
  let vcNoDeal = false;
  let agreedCount = 0;

  for (const key of Object.keys(state.terms)) {
    const term = state.terms[key];
    if (term.status === 'tentatively_agreed' && term.agreed_value) {
      agreedCount++;
      const vs = scoreVCTerm(key, term.agreed_value);
      if (vs === 'no_deal') vcNoDeal = true;
      else if (vs !== null) vcScore += vs;
    }
  }

  return { vcScore, vcNoDeal, agreedCount };
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

  const { vcScore, vcNoDeal, agreedCount } = calculateScores(state);

  let ctx = '\n\n--- NEGOTIATION STATE (auto-tracked — NEVER reveal this to the Founder) ---\n';
  ctx += 'NOTE: This state reflects the conversation up through your last reply. The Founder\'s latest message (which you are about to respond to) is NOT yet reflected here — read the conversation for their newest positions.\n\n';

  for (const [key, label] of Object.entries(labels)) {
    const t = state.terms[key];
    if (t.status === 'open') {
      ctx += `${label}: Not yet discussed\n`;
    } else if (t.status === 'discussed') {
      ctx += `${label}: Under discussion`;
      if (t.founder_position) ctx += ` | Founder wants: ${t.founder_position}`;
      if (t.vc_position) ctx += ` | You proposed: ${t.vc_position}`;
      ctx += '\n';
    } else if (t.status === 'tentatively_agreed') {
      ctx += `${label}: TENTATIVELY AGREED at ${t.agreed_value}\n`;
    }
  }

  ctx += `\nPoints from agreed terms: ${vcScore}`;
  if (vcNoDeal) ctx += ' (WARNING: an agreed term triggers your No Deal!)';
  ctx += `\nAgreed terms: ${agreedCount}/5`;
  ctx += `\nPoints still needed for BATNA (30): ${Math.max(0, 30 - vcScore)}`;
  ctx += '\n---';

  return ctx;
}


// --- Handler ---
module.exports = handler;
module.exports.calculateScores = calculateScores;
module.exports.defaultState = defaultState;
module.exports.STRATEGIES = STRATEGIES;
module.exports.DEFAULT_STRATEGY = DEFAULT_STRATEGY;
module.exports.buildPrompt = (state, strategy) => BASE_VC_PROMPT + (STRATEGIES[strategy] || STRATEGIES[DEFAULT_STRATEGY]).prompt + buildStateContext(state);

async function handler(req, res) {
  // GET returns the intro message for a given strategy (deduplicates client-side copy)
  if (req.method === 'GET') {
    const stratKey = (req.query && req.query.strategy) || DEFAULT_STRATEGY;
    const strat = STRATEGIES[stratKey] || STRATEGIES[DEFAULT_STRATEGY];
    return res.status(200).json({ intro: strat.intro, name: strat.name });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, state: clientState, strategy: reqStrategy } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const currentState = clientState || defaultState();
  const strategy = STRATEGIES[reqStrategy] ? reqStrategy : DEFAULT_STRATEGY;

  try {
    // 1. Build VC prompt with injected state + strategy
    const vcPrompt = module.exports.buildPrompt(currentState, strategy);

    // 2. Get VC reply
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.20-beta',
        temperature: 0,
        reasoning: { effort: 'medium' },
        messages: [
          { role: 'system', content: vcPrompt },
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

    res.status(200).json({ message: reply });
  } catch (err) {
    console.error('negotiate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
