# ProxyX Cloudflare Worker

This is an HTTP fetch gateway, not a raw TCP forward proxy. Cloudflare Workers does not provide a general inbound TCP listener for browser-style HTTP CONNECT proxying.

## Configure

```bash
npm install
npx wrangler secret put PROXYX_TOKEN
```

Set `PROXYX_ALLOWED_HOSTS` in `wrangler.toml` to a comma-separated allowlist. Use exact hostnames or parent domains only when you intend to permit their subdomains. Configure `PROXYX_CORS_ORIGINS` with exact trusted origins if browser access is needed. Do not use wildcard origins with bearer credentials.

## Request

```bash
curl -H "Authorization: Bearer $PROXYX_TOKEN" \
  "https://YOUR-WORKER.workers.dev/proxy?url=https%3A%2F%2Fexample.com%2F"
```

The gateway permits GET and HEAD, rejects URL credentials and non-HTTP(S) schemes, applies a hostname allowlist, and blocks common literal private/reserved IP ranges. This is defense-in-depth, not a complete substitute for a dedicated egress firewall or DNS-rebinding-resistant network policy. Keep the allowlist narrow and do not use this as an unrestricted public proxy.
