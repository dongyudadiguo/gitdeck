// =============================================================================
// Cloudflare Pages Function — /api/proxy
// 用途：转发 git-upload-pack 请求，绕过浏览器 CORS 限制。
// =============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const target = url.searchParams.get('url');
  if (!target) {
    return new Response('Missing ?url= parameter', { status: 400, headers: CORS });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('Invalid url parameter', { status: 400, headers: CORS });
  }

  if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
    return new Response('Only http(s) allowed', { status: 400, headers: CORS });
  }

  const init = { method: request.method, headers: {}, redirect: 'follow' };

  const ct = request.headers.get('Content-Type');
  if (ct) init.headers['Content-Type'] = ct;
  const accept = request.headers.get('Accept');
  if (accept) init.headers['Accept'] = accept;

  init.headers['User-Agent'] = 'git/2.40 (gitdeck-pages-proxy)';

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl.toString(), init);
  } catch (e) {
    return new Response('Upstream fetch failed: ' + e.message, {
      status: 502,
      headers: CORS,
    });
  }

  const respHeaders = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(CORS)) {
    respHeaders.set(k, v);
  }
  respHeaders.delete('Content-Encoding');
  respHeaders.delete('Content-Length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}
