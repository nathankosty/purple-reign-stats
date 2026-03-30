import { NextResponse } from 'next/server';

const ULTIANALYTICS_URL =
  'https://www.ultianalytics.com/rest/view/team/6594451383255040/stats/export';

export async function GET() {
  try {
    const response = await fetch(ULTIANALYTICS_URL, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch stats: ${response.status}` },
        { status: response.status }
      );
    }

    const csvText = await response.text();

    return new NextResponse(csvText, {
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch stats: ${error}` },
      { status: 500 }
    );
  }
}
