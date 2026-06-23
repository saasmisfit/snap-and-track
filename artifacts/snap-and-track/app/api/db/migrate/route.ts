import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS meal_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        log_date TEXT NOT NULL,
        log_time TEXT NOT NULL,
        meal_name TEXT NOT NULL,
        description TEXT,
        calories INTEGER NOT NULL,
        protein INTEGER NOT NULL,
        carbs INTEGER NOT NULL,
        fat INTEGER NOT NULL,
        fibre INTEGER DEFAULT 0,
        ingredients JSONB,
        coaching_note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS meal_logs_user_created_idx ON meal_logs (user_id, created_at DESC)`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
