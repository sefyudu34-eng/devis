import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages || [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set on server' }, { status: 500 });
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.model || 'gpt-3.5-turbo',
        messages,
        max_tokens: body.max_tokens || 800,
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
      }),
    });

    // If OpenAI returned a non-OK status, try to extract text for debugging
    if (!resp.ok) {
      let textBody = '';
      try {
        textBody = await resp.text();
      } catch (e) {
        textBody = `OpenAI returned status ${resp.status}`;
      }
      return NextResponse.json({ error: textBody || `OpenAI returned status ${resp.status}` }, { status: resp.status });
    }

    // Attempt to parse JSON, but handle cases where response may be empty or non-json
    try {
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (parseErr) {
      const raw = await resp.text();
      return NextResponse.json({ error: 'Failed to parse OpenAI response as JSON', raw }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
