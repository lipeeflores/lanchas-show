import type { VercelRequest, VercelResponse } from '@vercel/node';

const RAILWAY_URL = 'https://lanchas-show-production.up.railway.app';

export async function proxyToRailway(
  req: VercelRequest,
  res: VercelResponse,
  path: string
): Promise<void> {
  const url = `${RAILWAY_URL}${path}${req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (req.headers.authorization) headers['authorization'] = req.headers.authorization as string;

  const body = req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
  });

  const text = await upstream.text();
  res.status(upstream.status);
  try {
    res.json(JSON.parse(text));
  } catch {
    res.send(text);
  }
}
