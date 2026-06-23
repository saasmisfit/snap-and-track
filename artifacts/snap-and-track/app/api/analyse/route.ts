import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Goal = 'fat_loss' | 'maintain' | 'build';

interface AnalyseRequestBody {
  image?: unknown;
  mimeType?: unknown;
  description?: unknown;
  goal?: unknown;
}

interface FoodItem {
  name: string;
  calories: number;
}

interface AnalyseResponse {
  dish: string;
  portion_estimate: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  foods_identified: FoodItem[];
  stacy_insight: string;
}

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicMessageResponse {
  content?: Array<AnthropicTextBlock | { type: string; [k: string]: unknown }>;
}

const GOAL_VALUES: readonly Goal[] = ['fat_loss', 'maintain', 'build'] as const;

const GOAL_CONTEXT: Record<Goal, string> = {
  fat_loss:
    "The user is in a fat-loss phase. Frame the insight around whether the meal supports a calorie deficit and hits protein for satiety. Reference the actual protein number. Be specific and encouraging — never shame, never preachy.",
  maintain:
    "The user is maintaining their current weight. Frame the insight around overall balance, protein adequacy, and how this meal fits within a typical day. Reference real numbers. Be supportive and specific — never preachy.",
  build:
    "The user is in a building / muscle-gain phase. Frame the insight around whether protein is high enough for muscle synthesis and whether the calories help drive a surplus. Reference real numbers. Be encouraging and specific.",
};

const SYSTEM_PROMPT = `You are Stacy Kundu — a Level 3 Personal Trainer, Level 2 Fitness Instructor, HYROX Group Instructor, and the coach behind Metaburn. You write the way you'd speak to a real client: warm, direct, specific, never shame-based, never clinical jargon. You sound like a quick text from a PT who actually cares.

You are analysing a meal — supplied either as a photo or a text description. Identify the dish, estimate the portion size, and return a macro breakdown. If the description already lists macros, treat those numbers as ground truth rather than re-estimating them. Then write a 2–3 sentence coaching note ("stacy_insight") in your own voice — goal-aware, specific to the actual numbers (reference real protein values, not generic targets), never preachy.

You MUST respond with ONLY a valid JSON object — no prose, no markdown fences, no commentary outside the JSON. The exact shape:

{
  "dish": string,
  "portion_estimate": string,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fibre_g": number,
  "foods_identified": [{ "name": string, "calories": number }],
  "stacy_insight": string
}

All macro fields are numbers (integers or one decimal place). "carbs_g" is TOTAL carbohydrates including fibre; "fibre_g" is dietary fibre in grams (always include — use 0 if the meal genuinely has none). foods_identified lists every distinct food component visible. stacy_insight is 2–3 sentences in Stacy's voice, tailored to the user's stated goal.`;

function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOAL_VALUES as readonly string[]).includes(value);
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced && fenced[1]) return fenced[1].trim();
  return trimmed;
}

function pickTextBlock(content: AnthropicMessageResponse['content']): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof (block as AnthropicTextBlock).text === 'string') {
      return (block as AnthropicTextBlock).text;
    }
  }
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server is missing ANTHROPIC_API_KEY' },
      { status: 500 }
    );
  }

  let body: AnalyseRequestBody;
  try {
    body = (await req.json()) as AnalyseRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { image, mimeType, description, goal } = body;

  if (!isGoal(goal)) {
    return NextResponse.json(
      {
        error: `Missing or invalid "goal" (expected one of: ${GOAL_VALUES.join(', ')})`,
      },
      { status: 400 }
    );
  }

  const hasImage = typeof image === 'string' && image.length > 0;
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  if (!hasImage && !hasDescription) {
    return NextResponse.json(
      { error: 'Provide either "image" (base64) plus "mimeType", or "description" (text)' },
      { status: 400 }
    );
  }
  if (hasImage && (typeof mimeType !== 'string' || mimeType.length === 0)) {
    return NextResponse.json(
      { error: 'Missing or invalid "mimeType" (expected string, e.g. "image/jpeg")' },
      { status: 400 }
    );
  }

  const goalNote = GOAL_CONTEXT[goal];

  const userContent: Array<
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'text'; text: string }
  > = [];
  if (hasImage) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType as string, data: image as string },
    });
    userContent.push({
      type: 'text',
      text: `User goal: ${goal}. ${goalNote}\n\nAnalyse the meal in this photo and return the JSON object now.`,
    });
  } else {
    userContent.push({
      type: 'text',
      text: `User goal: ${goal}. ${goalNote}\n\nMeal description: ${(description as string).trim()}\n\nReturn the JSON object now. If macro values are provided in the description, use them exactly as the ground truth.`,
    });
  }

  const anthropicPayload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  };

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicPayload),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to reach Anthropic API',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    return NextResponse.json(
      {
        error: 'Anthropic API returned an error',
        status: upstream.status,
        detail: errText,
      },
      { status: 502 }
    );
  }

  let upstreamJson: AnthropicMessageResponse;
  try {
    upstreamJson = (await upstream.json()) as AnthropicMessageResponse;
  } catch {
    return NextResponse.json(
      { error: 'Anthropic returned a non-JSON response' },
      { status: 502 }
    );
  }

  const rawText = pickTextBlock(upstreamJson.content);
  if (!rawText) {
    return NextResponse.json(
      { error: 'No text content in Anthropic response' },
      { status: 502 }
    );
  }

  let parsed: AnalyseResponse;
  try {
    parsed = JSON.parse(extractJson(rawText)) as AnalyseResponse;
  } catch {
    return NextResponse.json(
      {
        error: 'Could not parse JSON from model output',
        raw: rawText,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(parsed);
}
