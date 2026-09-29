/**
 * Cloudflare Worker: 通用 CORS 代理，用于 git clone over HTTPS
 *
 * 请求形式:
 *   GET  https://<worker>/?url=https%3A%2F%2Fgithub.com%2Fuser%2Frepo.git%2Finfo%2Frefs%3Fservice%3Dgit-upload-pack
 *   POST https://<worker>/?url=https%3A%2F%2Fgithub.com%2Fuser%2Frepo.git%2Fgit-upload-pack
 *
 * 安全建议（按需启用）：
 *   在下方 ALLOWED_ORIGINS 里填上你的 Pages 域名，防止被滥用。
 */

const ALLOWED_ORIGINS = [
  // 'https://gitdeck.pages.dev',
  // 'http://localhost:5173',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ---- CORS 预检 ----
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ---- 白名单校验（可选）----
    if (ALLOWED_ORIGINS.length > 0) {
      const origin = request.headers.get('Origin') || '';
      if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response('Forbidden', { status: 403, headers: CORS_HEADERS });
      }
    }

    // ---- 取目标 URL ----
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: CORS_HEADERS });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid url parameter', { status: 400, headers: CORS_HEADERS });
    }
    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return new Response('Only http(s) allowed', { status: 400, headers: CORS_HEADERS });
    }

    // ---- 转发请求 ----
    const init = {
      method: request.method,
      headers: {},
      redirect: 'follow',
    };

    const ct = request.headers.get('Content-Type');
    if (ct) init.headers['Content-Type'] = ct;
    const accept = request.headers.get('Accept');
    if (accept) init.headers['Accept'] = accept;
    // 让 GitHub 识别为 git 客户端
    init.headers['User-Agent'] = 'git/2.40 (gitdeck-proxy)';

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), init);
    } catch (e) {
      return new Response('Upstream fetch failed: ' + e.message, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }

    // ---- 透传响应并追加 CORS ----
    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) respHeaders.set(k, v);
    // 去掉可能干扰的压缩头（浏览器会自动解压）
    respHeaders.delete('Content-Encoding');
    respHeaders.delete('Content-Length');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  },
};
