import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

type Goal = 'fat_loss' | 'maintain' | 'build';

const GOAL_VALUES: readonly Goal[] = ['fat_loss', 'maintain', 'build'] as const;

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicMessageResponse {
  content?: Array<AnthropicTextBlock | { type: string; [k: string]: unknown }>;
}

function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOAL_VALUES as readonly string[]).includes(value);
}

function systemPrompt(goal: Goal): string {
  return `You are Stacy Kundu, a certified personal trainer and nutrition coach. You have access to this user's meal log for the past 7 days. Their goal is ${goal}. Answer their question in a warm, direct, knowledgeable coaching voice — like texting a PT who knows you. Keep responses under 100 words unless a longer answer is clearly needed. Be specific to their actual logged data, not generic advice.`;
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
    return NextResponse.json({ error: 'Server is missing ANTHROPIC_API_KEY' }, { status: 500 });
  }

  const { userId: authUserId } = await auth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const userId = typeof o.userId === 'string' ? o.userId : '';
  if (!userId || userId !== authUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const question = typeof o.question === 'string' ? o.question.trim() : '';
  if (!question) {
    return NextResponse.json({ error: 'Missing or empty "question"' }, { status: 400 });
  }

  const mealHistory = typeof o.mealHistory === 'string' ? o.mealHistory.trim() : '';
  const goal: Goal = isGoal(o.goal) ? o.goal : 'maintain';

  const userMessage = mealHistory
    ? `The user's logged meals over the past 7 days:\n${mealHistory}\n\nTheir question: ${question}`
    : `(The user has no meals logged this week yet.)\n\nTheir question: ${question}`;

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: systemPrompt(goal),
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: userMessage }],
          },
        ],
      }),
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
      { error: 'Anthropic API returned an error', status: upstream.status, detail: errText },
      { status: 502 }
    );
  }

  let upstreamJson: AnthropicMessageResponse;
  try {
    upstreamJson = (await upstream.json()) as AnthropicMessageResponse;
  } catch {
    return NextResponse.json({ error: 'Anthropic returned a non-JSON response' }, { status: 502 });
  }

  const reply = pickTextBlock(upstreamJson.content);
  if (!reply) {
    return NextResponse.json({ error: 'No text content in coach reply' }, { status: 502 });
  }

  return NextResponse.json({ reply: reply.trim() });
}
