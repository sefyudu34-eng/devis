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
    // Preserve the incoming Content-Type (multipart boundary) when forwarding.
    const incomingContentType = request.headers.get('content-type') || undefined;
    const bodyBuffer = await request.arrayBuffer();

    const forwardHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    if (incomingContentType) forwardHeaders['content-type'] = incomingContentType;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: forwardHeaders,
      body: bodyBuffer,
    });

    const respBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(respBuffer, { status: res.status, headers: { 'content-type': contentType } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
