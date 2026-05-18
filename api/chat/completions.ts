export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const targetUrl = `https://agentrouter.org/v1/chat/completions${url.search}`;

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: string | null = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text();
  }

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'User-Agent': 'codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464',
      'Originator': 'codex_cli_rs',
    },
    body: body ?? undefined,
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}