export const onRequest: PagesFunction = async (ctx) => {
  const { request, params, env } = ctx;
  const url = new URL(request.url);

  const tailFromParams = (params.path as string | undefined) ?? "";
  const tailFromQuery = url.searchParams.get("path") ?? "";
  const tail = tailFromParams || tailFromQuery;

  if (!tail || !tail.startsWith("/")) {
    return new Response("Bad request: missing path", { status: 400 });
  }

  const upstream = new URL("https://api.discogs.com" + tail);

  const fwd = new URLSearchParams(url.search);
  fwd.delete("path");

  // pull token from ENV secret or Authorization header
  if (!fwd.has("token")) {
    const envToken = env.DISCOGS_TOKEN as string | undefined;
    const h = request.headers.get("Authorization") || "";
    const m = /^Discogs\s+token=(.+)$/i.exec(h);
    const hdrToken = m?.[1];
    const token = envToken || hdrToken;
    if (token) fwd.set("token", token);
  }
  upstream.search = fwd.toString();

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("user-agent");
  reqHeaders.delete("authorization");

  if (request.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }), url.origin);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const resp = await fetch(upstream.toString(), {
    method: request.method,
    headers: reqHeaders,
    body,
    redirect: "follow",
  });

  const out = new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: new Headers(resp.headers),
  });
  return cors(out, url.origin);
};

function cors(res: Response, origin: string) {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.headers.set("Vary", "Origin");
  return res;
}
