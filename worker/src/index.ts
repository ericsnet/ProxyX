interface Env {
  PROXYX_TOKEN: string;
  PROXYX_ALLOWED_HOSTS: string;
  PROXYX_CORS_ORIGINS?: string;
}

const PRIVATE_IPV4 = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
const DEFAULT_CORS_ORIGINS = ["https://proxyx-2lq.pages.dev", "https://ericsnet.github.io"];

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (PRIVATE_IPV4.test(host) || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
  return true;
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({ "vary": "Origin" });
  const origin = request.headers.get("Origin");
  const configured = (env.PROXYX_CORS_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_CORS_ORIGINS;
  if (origin && allowed.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "Authorization, Content-Type");
    headers.set("access-control-allow-methods", "GET, HEAD, OPTIONS");
  }
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ name: "ProxyX Gateway", status: "ok" }, 200, cors);
    if (url.pathname !== "/proxy") return json({ error: "Not found" }, 404, cors);
    if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405, cors);

    if (!env.PROXYX_TOKEN) return json({ error: "Gateway is not configured" }, 503, cors);
    const authorization = request.headers.get("Authorization") || "";
    if (authorization !== `Bearer ${env.PROXYX_TOKEN}`) return json({ error: "Unauthorized" }, 401, cors);

    const raw = url.searchParams.get("url");
    if (!raw) return json({ error: "Missing url query parameter" }, 400, cors);

    let target: URL;
    try { target = new URL(raw); } catch { return json({ error: "Invalid URL" }, 400, cors); }
    if (target.protocol !== "http:" && target.protocol !== "https:") return json({ error: "Only HTTP and HTTPS are supported" }, 400, cors);
    if (target.username || target.password) return json({ error: "URL credentials are not allowed" }, 400, cors);
    if (!isPublicHost(target.hostname)) return json({ error: "Private or reserved destinations are blocked" }, 403, cors);

    const allowed = (env.PROXYX_ALLOWED_HOSTS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    const host = target.hostname.toLowerCase();
    if (!allowed.some(entry => host === entry || host.endsWith(`.${entry}`))) {
      return json({ error: "Destination host is not allowlisted" }, 403, cors);
    }

    try {
      const upstream = await fetch(target.toString(), {
        method: request.method,
        redirect: "manual",
        headers: { "user-agent": "ProxyX-Gateway/0.2" },
      });
      const responseHeaders = new Headers(cors);
      for (const name of ["content-type", "content-length", "last-modified", "etag"]) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      responseHeaders.set("cache-control", "no-store");
      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      return json({ error: "Upstream request failed" }, 502, cors);
    }
  },
};
