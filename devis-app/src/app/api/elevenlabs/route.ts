import { NextResponse } from 'next/server';

// Proxy route for ElevenLabs speech-to-text. Do NOT hardcode API keys in source.
// Set ELEVENLABS_API_KEY and ELEVENLABS_STT_ENDPOINT in Vercel (or .env.local for local dev).

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const endpoint = process.env.ELEVENLABS_STT_ENDPOINT;

  if (!apiKey || !endpoint) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const body = await request.arrayBuffer();
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${apiKey}`);

    // forward the raw body to the configured endpoint
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || 'text/plain';

    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
