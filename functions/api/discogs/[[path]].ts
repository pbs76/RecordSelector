export const onRequest: PagesFunction = async (ctx) => {
  const { request, params, env } = ctx;
  const url = new URL(request.url);
  const tail = (params.path as string | undefined) ?? "";
  const upstream = new URL(`https://api.discogs.com/${tail}`);
  upstream.search = url.search;

  // Optional: inject server-side token
  if (env.DISCOGS_TOKEN && !upstream.searchParams.has("token")) {
    upstream.searchParams.set("token", env.DISCOGS_TOKEN);
  }

  // Clean headers; browsers can’t set UA anyway
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("user-agent");

  // CORS preflight
  if (request.method === "OPTIONS") {
    const pre = new Response(null, { status: 204 });
    pre.headers.set("Access-Control-Allow-Origin", url.origin);
    pre.headers.set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
    pre.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    pre.headers.set("Vary", "Origin");
    return pre;
  }

  const resp = await fetch(upstream.toString(), {
    method: request.method,
    headers: reqHeaders,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "follow",
  });

  const out = new Response(resp.body, resp);
  out.headers.set("Access-Control-Allow-Origin", url.origin);
  out.headers.set("Vary", "Origin");
  return out;
};
