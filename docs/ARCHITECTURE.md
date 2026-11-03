# Architecture

## Local data path

1. A browser sends an absolute-form HTTP request to the loopback listener.
2. ProxyX parses the target URL and forwards the request to the origin.
3. For HTTPS, the browser sends CONNECT host:port. ProxyX opens a TCP connection and copies bytes in both directions. TLS remains end-to-end between browser and origin.

The initial local implementation buffers request and response bodies in memory. Large uploads/downloads and streaming are follow-up work.

## Edge data path

1. A client calls the Worker `/proxy` endpoint with a target URL.
2. The Worker checks the bearer token, scheme, host allowlist and basic literal-IP restrictions.
3. The Worker issues a fetch request and returns a limited set of response headers and the response body.

The edge gateway does not implement CONNECT, arbitrary TCP, UDP, or browser proxy auto-configuration.

## Static hosting

The `site/` directory is static HTML/CSS. GitHub Pages and Cloudflare Pages can host it, but neither static hosting product runs the local Rust daemon.
