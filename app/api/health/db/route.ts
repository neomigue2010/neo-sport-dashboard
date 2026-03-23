import { NextResponse } from 'next/server';
import { getDashboardCounts, hasDatabase } from '@/lib/db';

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'DATABASE_URL is not configured in this runtime.'
    });
  }

  try {
    const counts = await getDashboardCounts();
    return NextResponse.json({ ok: true, configured: true, counts });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : 'Unknown database error'
      },
      { status: 500 }
    );
  }
}
