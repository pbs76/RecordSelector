// Cloudflare Pages Function — Discogs Proxy (GET) with CORS + UA + simple cache
export const onRequest = async (context) => {
  const { request, env } = context;
  const reqUrl = new URL(request.url);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Vary': 'Authorization'
      }
    });
  }

  const path = reqUrl.searchParams.get('path') || '/';
  const target = new URL('https://api.discogs.com' + path);

  // Build upstream headers (Discogs needs a valid User-Agent!)
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('User-Agent', 'RecordSelector/1.0 (+https://recordselector.pages.dev)');

  // Use client Authorization or server token
  const clientAuth = request.headers.get('Authorization');
  const serverAuth = env.DISCOGS_APP_TOKEN ? `Discogs token=${env.DISCOGS_APP_TOKEN}` : '';
  const auth = clientAuth || serverAuth;
  if (auth) headers.set('Authorization', auth);

  const isCacheable = request.method === 'GET' && !path.startsWith('/users/');
  const cache = caches.default;
  const cacheKey = new Request(reqUrl.toString(), request);

  if (isCacheable) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const c = new Response(cached.body, cached);
      c.headers.set('Access-Control-Allow-Origin', '*');
      c.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      c.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      c.headers.set('Vary', 'Authorization');
      return c;
    }
  }

  const upstream = await fetch(target.toString(), { method: 'GET', headers });

  const resp = new Response(upstream.body, upstream);
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  resp.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  resp.headers.set('Vary', 'Authorization');

  if (isCacheable && upstream.ok) {
    const toCache = new Response(await upstream.clone().arrayBuffer(), upstream);
    await cache.put(cacheKey, toCache);
  }

  return resp;
};
