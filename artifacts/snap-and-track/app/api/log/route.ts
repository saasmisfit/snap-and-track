import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

interface FoodItem {
  name: string;
  calories: number;
}

interface LogRow {
  id: number;
  user_id: string;
  log_date: string;
  log_time: string;
  meal_name: string;
  description: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number | null;
  ingredients: unknown;
  coaching_note: string | null;
  created_at: string | Date;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asIngredients(v: unknown): FoodItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is { name: unknown; calories: unknown } =>
      !!item && typeof item === 'object'
    )
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : '',
      calories: asNumber(item.calories, 0),
    }));
}

function rowToEntry(row: LogRow) {
  const loggedAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  return {
    id: row.id,
    dish: row.meal_name,
    portion_estimate: row.description ?? '',
    calories: asNumber(row.calories, 0),
    protein_g: asNumber(row.protein, 0),
    carbs_g: asNumber(row.carbs, 0),
    fat_g: asNumber(row.fat, 0),
    fibre_g: asNumber(row.fibre, 0),
    foods_identified: asIngredients(row.ingredients),
    stacy_insight: row.coaching_note ?? '',
    logDate: row.log_date,
    logTime: row.log_time,
    loggedAt,
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  const { userId: authUserId } = await auth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId || userId !== authUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const daysParam = parseInt(url.searchParams.get('days') ?? '7', 10);
  const days = Number.isFinite(daysParam) ? Math.max(1, Math.min(90, daysParam)) : 7;
  const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql<LogRow>`
      SELECT id, user_id, log_date, log_time, meal_name, description,
             calories, protein, carbs, fat, fibre, ingredients, coaching_note,
             created_at
      FROM meal_logs
      WHERE user_id = ${userId}
        AND created_at >= ${cutoffIso}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ entries: result.rows.map(rowToEntry) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Query failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
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

  const logDate = typeof o.logDate === 'string' ? o.logDate.trim() : '';
  const logTime = typeof o.logTime === 'string' ? o.logTime.trim() : '';
  const mealName = typeof o.mealName === 'string' ? o.mealName.trim() : '';
  if (!logDate || !mealName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const description = typeof o.description === 'string' ? o.description : null;
  const calories = Math.round(asNumber(o.calories, 0));
  const protein = Math.round(asNumber(o.protein, 0));
  const carbs = Math.round(asNumber(o.carbs, 0));
  const fat = Math.round(asNumber(o.fat, 0));
  const fibre = Math.round(asNumber(o.fibre, 0));
  const ingredients = asIngredients(o.ingredients);
  const coachingNote = typeof o.coachingNote === 'string' ? o.coachingNote : null;

  try {
    const result = await sql<LogRow>`
      INSERT INTO meal_logs (
        user_id, log_date, log_time, meal_name, description,
        calories, protein, carbs, fat, fibre, ingredients, coaching_note
      ) VALUES (
        ${userId}, ${logDate}, ${logTime}, ${mealName}, ${description},
        ${calories}, ${protein}, ${carbs}, ${fat}, ${fibre},
        ${JSON.stringify(ingredients)}::jsonb, ${coachingNote}
      )
      RETURNING id, user_id, log_date, log_time, meal_name, description,
        calories, protein, carbs, fat, fibre, ingredients, coaching_note, created_at
    `;
    const row = result.rows[0];
    return NextResponse.json({ entry: row ? rowToEntry(row) : null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Insert failed' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request): Promise<NextResponse> {
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

  const id = asNumber(o.id, NaN);
  const userId = typeof o.userId === 'string' ? o.userId : '';
  if (!Number.isFinite(id) || !userId || userId !== authUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const calories = o.calories == null ? null : Math.round(asNumber(o.calories, 0));
  const protein = o.protein == null ? null : Math.round(asNumber(o.protein, 0));
  const carbs = o.carbs == null ? null : Math.round(asNumber(o.carbs, 0));
  const fat = o.fat == null ? null : Math.round(asNumber(o.fat, 0));
  const fibre = o.fibre == null ? null : Math.round(asNumber(o.fibre, 0));

  try {
    const result = await sql`
      UPDATE meal_logs
      SET
        calories = COALESCE(${calories}, calories),
        protein = COALESCE(${protein}, protein),
        carbs = COALESCE(${carbs}, carbs),
        fat = COALESCE(${fat}, fat),
        fibre = COALESCE(${fibre}, fibre)
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return NextResponse.json({ updated: result.rowCount ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
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

  const id = asNumber(o.id, NaN);
  const userId = typeof o.userId === 'string' ? o.userId : '';
  if (!Number.isFinite(id) || !userId || userId !== authUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await sql`
      DELETE FROM meal_logs
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return NextResponse.json({ deleted: result.rowCount ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
