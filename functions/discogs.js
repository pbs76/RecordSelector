// Cloudflare Pages Function — Discogs Proxy (GET) with CORS + simple cache
export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.searchParams.get('path') || '/';
  const target = new URL('https://api.discogs.com' + path);

  const headers = new Headers();
  headers.set('Accept', 'application/json');
  const auth = request.headers.get('Authorization') || (env.DISCOGS_APP_TOKEN ? 'Discogs token=' + env.DISCOGS_APP_TOKEN : '');
  if (auth) headers.set('Authorization', auth);

  const isCacheable = request.method === 'GET' && !path.startsWith('/users/');
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  if (isCacheable) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const c = new Response(cached.body, cached);
      c.headers.set('Access-Control-Allow-Origin', '*');
      c.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return c;
    }
  }

  const upstream = await fetch(target.toString(), { method: 'GET', headers, cf: { cacheEverything: false } });
  const resp = new Response(upstream.body, upstream);
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  resp.headers.set('Vary', 'Authorization');

  if (isCacheable && upstream.ok) {
    const toCache = new Response(await upstream.clone().arrayBuffer(), upstream);
    await cache.put(cacheKey, toCache);
  }
  return resp;
};
