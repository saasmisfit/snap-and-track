import { NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

// Lifetime allowance of AI analyses for a non-subscribed user. Every request
// that reaches this route costs an Anthropic call, so every one of them counts.
// Barcode scans do not call this route at all (Open Food Facts supplies their
// macros and their coaching note is a static string), so they stay free.
const FREE_SNAP_LIFETIME_LIMIT = 3;
const FREE_SNAPS_USED_KEY = 'freeSnapsUsed';

const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(userId: string, now: number): boolean {
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

type Goal = 'fat_loss' | 'maintain' | 'build';
type Mode = 'meal' | 'menu' | 'voice';

interface AnalyseRequestBody {
  image?: unknown;
  mimeType?: unknown;
  description?: unknown;
  goal?: unknown;
  mode?: unknown;
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

You are analysing a meal — supplied either as a photo or a text description.

CRITICAL — TOTAL VISIBLE QUANTITY RULE:
Analyse the TOTAL amount of ALL food and drink visible in the image (or described in the text). Do NOT estimate a single-person serving. Do NOT assume what one person "should" eat or adjust to a typical portion. Report macros for EVERYTHING visible, in its entirety, exactly as it appears. If there is a whole pizza, count the whole pizza — not one slice. If there are three plates on the table, count all three. If a jug of juice and two filled glasses are visible, count both the jug contents and the glasses. The user will adjust quantities themselves if they only ate part of it — your job is to measure what is there, not to portion it.

Identify the dish(es), describe the TOTAL visible quantity in "portion_estimate" (e.g. "Whole 12-inch pizza", "Two plates of chicken curry", "Large family-style bowl of pasta plus side salad"), and return a macro breakdown for the entire visible quantity. If the description already lists macros, treat those numbers as ground truth rather than re-estimating them. Then write a 2–3 sentence coaching note ("stacy_insight") in your own voice — goal-aware, specific to the actual numbers (reference real protein values, not generic targets), never preachy.

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

All macro fields are numbers (integers or one decimal place) for the TOTAL amount visible — not a single-serving estimate. "portion_estimate" describes the total visible quantity, not what one person typically eats. "carbs_g" is TOTAL carbohydrates including fibre; "fibre_g" is dietary fibre in grams (always include — use 0 if the meal genuinely has none). foods_identified lists every distinct food component visible with its calories contributing to the total. stacy_insight is 2–3 sentences in Stacy's voice, tailored to the user's stated goal. Write stacy_insight in plain prose only — no markdown syntax (no asterisks for bold or italics, no # headers, no numbered lists with periods). If you want to emphasise a point, use plain sentence structure or a dash, not formatting characters.`;

const VOICE_SYSTEM_PROMPT = `You are Stacy Kundu, a certified personal trainer. The user has described a meal by voice. Estimate the calories, protein, carbs, fat, and fibre for what they described. Make reasonable assumptions about portion sizes for a typical adult. Be specific: list each component you are estimating.

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

"dish" is a short name summarising what they ate. "portion_estimate" is the portion assumption in plain language (e.g. "approx 200g chicken, 150g cooked rice"). "foods_identified" lists each component you estimated (one item per food, with the assumed portion in the name) and its approximate calories. "stacy_insight" is 2–3 sentences in your warm, direct voice — reference the actual protein number and tailor to the user's goal. Write it as plain text, not markdown — no asterisks, no headers, no numbered lists; use a dash if you need to separate points. "carbs_g" includes fibre; "fibre_g" defaults to 0 if you can't estimate it.`;

function menuSystemPrompt(goal: Goal): string {
  return `You are Stacy Kundu, a certified personal trainer and nutrition coach. The user has photographed a restaurant menu or menu board. Analyse what is visible. Based on their goal (${goal}), recommend the single best menu item for their macros and fat loss / muscle building objective. Provide: recommended dish name, your estimated calories/protein/carbs/fat for a standard restaurant portion, why you chose it for their goal, and one brief tip (e.g. 'ask for sauce on the side' or 'add extra chicken for more protein'). Be direct and practical — this is a coaching recommendation, not a database lookup.

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

"dish" is the recommended menu item by name as it appears on the menu. "portion_estimate" describes the typical restaurant portion (e.g. "standard restaurant portion", "regular bowl", "8oz steak"). "foods_identified" lists 1–3 key components of the recommended dish (e.g. main protein, side, sauce) with approximate calories — these summarise why the choice fits. "stacy_insight" is 2–3 sentences in your warm, direct voice: why this dish wins for the user's goal, plus one practical tip. Reference the actual macro numbers, not generic targets. Keep it plain text — no markdown formatting (asterisks, headers, numbered lists); a dash is fine if you're listing more than one thing. All macro fields are numbers; "carbs_g" includes fibre; "fibre_g" defaults to 0 if you can't estimate it.`;
}

function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOAL_VALUES as readonly string[]).includes(value);
}

function isMode(value: unknown): value is Mode {
  return value === 'meal' || value === 'menu' || value === 'voice';
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

function logAnalyse(message: string, context: Record<string, unknown> = {}): void {
  console.error(`[analyse] ${message}`, context);
}

function readFreeSnapsUsed(metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object') return 0;
  const raw = (metadata as Record<string, unknown>)[FREE_SNAPS_USED_KEY];
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 0;
}

/**
 * Record one consumed free analysis. Metadata is read-then-spread so unrelated
 * keys (subscribed, paymentFailedAt) survive. Best-effort: if the write fails
 * the user keeps the snap they just paid us for, which is the right way to
 * fail — we log it rather than erroring a request that already succeeded.
 */
async function incrementFreeSnaps(
  userId: string,
  existingMetadata: unknown,
  nextCount: number
): Promise<void> {
  try {
    const client = await clerkClient();
    const existing =
      existingMetadata && typeof existingMetadata === 'object'
        ? (existingMetadata as Record<string, unknown>)
        : {};
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...existing, [FREE_SNAPS_USED_KEY]: nextCount },
    });
  } catch (err) {
    logAnalyse('Failed to increment free-snap counter — user keeps a free snap', {
      userId,
      nextCount,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRateLimit(userId, Date.now())) {
    return NextResponse.json(
      { error: 'Too many requests — please wait a moment before analysing another meal.' },
      { status: 429 }
    );
  }

  // Free tier: 3 AI analyses per user, lifetime. Subscribers are unlimited.
  // Checked here, before the Anthropic call, so an exhausted user costs nothing.
  const user = await currentUser();
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  const freeSnapsUsed = readFreeSnapsUsed(user?.publicMetadata);
  if (!isSubscribed && freeSnapsUsed >= FREE_SNAP_LIFETIME_LIMIT) {
    return NextResponse.json(
      {
        error: "You've used all 3 free snaps. Subscribe to keep tracking.",
        freeSnapsUsed,
        freeSnapsRemaining: 0,
        limitReached: true,
      },
      { status: 403 }
    );
  }

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

  const { image, mimeType, description, goal, mode: rawMode } = body;

  if (!isGoal(goal)) {
    return NextResponse.json(
      {
        error: `Missing or invalid "goal" (expected one of: ${GOAL_VALUES.join(', ')})`,
      },
      { status: 400 }
    );
  }

  const mode: Mode = isMode(rawMode) ? rawMode : 'meal';

  const hasImage = typeof image === 'string' && image.length > 0;
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  if (mode === 'menu' && !hasImage) {
    return NextResponse.json(
      { error: 'Menu mode requires "image" (base64) plus "mimeType"' },
      { status: 400 }
    );
  }
  if (mode === 'voice' && !hasDescription) {
    return NextResponse.json(
      { error: 'Voice mode requires "description" (transcript text)' },
      { status: 400 }
    );
  }
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
  if (hasImage) {
    const mt = (mimeType as string).toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mt)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, or WebP image.' },
        { status: 400 }
      );
    }
    const sizeBytes = Buffer.byteLength(image as string, 'base64');
    if (sizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Please upload an image under 10MB.' },
        { status: 400 }
      );
    }
  }

  const goalNote = GOAL_CONTEXT[goal];
  const descText = hasDescription ? (description as string).trim() : '';

  const userContent: Array<
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'text'; text: string }
  > = [];
  if (hasImage) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType as string, data: image as string },
    });
    if (mode === 'menu') {
      userContent.push({
        type: 'text',
        text: `User goal: ${goal}. ${goalNote}\n\nLook at the menu in this photo and recommend the single best item for the user's goal. Return the JSON object now.`,
      });
    } else {
      userContent.push({
        type: 'text',
        text: `User goal: ${goal}. ${goalNote}\n\nAnalyse the TOTAL amount of ALL food and drink visible in this photo. Do not estimate a single-person serving — measure everything visible in its entirety. Return the JSON object now.`,
      });
    }
  } else if (mode === 'voice') {
    userContent.push({
      type: 'text',
      text: `User goal: ${goal}. ${goalNote}\n\nI ate: ${descText}\n\nReturn the JSON object now.`,
    });
  } else {
    userContent.push({
      type: 'text',
      text: `User goal: ${goal}. ${goalNote}\n\nMeal description: ${descText}\n\nReturn the JSON object now. If macro values are provided in the description, use them exactly as the ground truth.`,
    });
  }

  let systemPrompt: string;
  if (mode === 'menu') systemPrompt = menuSystemPrompt(goal);
  else if (mode === 'voice') systemPrompt = VOICE_SYSTEM_PROMPT;
  else systemPrompt = SYSTEM_PROMPT;

  const anthropicPayload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: systemPrompt,
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

  // Only a genuinely successful analysis consumes an allowance. Every failure
  // path above returns early, so a user never loses a snap to our own errors.
  let nextFreeSnapsUsed = freeSnapsUsed;
  if (!isSubscribed) {
    nextFreeSnapsUsed = freeSnapsUsed + 1;
    await incrementFreeSnaps(userId, user?.publicMetadata, nextFreeSnapsUsed);
  }

  return NextResponse.json({
    ...parsed,
    freeSnapsUsed: nextFreeSnapsUsed,
    freeSnapsRemaining: isSubscribed
      ? null
      : Math.max(0, FREE_SNAP_LIFETIME_LIMIT - nextFreeSnapsUsed),
  });
}
