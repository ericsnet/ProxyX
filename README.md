# ProxyX

**A local HTTP/HTTPS forward proxy with an optional Cloudflare Workers HTTP gateway.**

ProxyX is designed to make ordinary web requests pass through a local proxy while keeping the network listener private by default. The repository also contains a separately deployed Worker gateway and a static control panel that can be hosted on Cloudflare Pages or GitHub Pages.

> **Status:** early development. The local proxy and Worker are starter implementations; protocol edge cases, platform limits and compatibility still need broader testing. ProxyX cannot guarantee access to every website.

## Components

| Component | Location | Purpose |
|---|---|---|
| Local proxy | `crates/proxyx` | HTTP forwarding and HTTPS `CONNECT` tunnelling |
| Edge gateway | `worker/` | Allowlisted HTTP(S) fetch gateway on Cloudflare Workers |
| Control panel | `site/` | Static configuration and deployment guidance |
| Documentation | `docs/` | Setup, security and architecture |

## Quick start (local)

Requirements: Rust stable and Cargo.

```bash
cargo run --release -p proxyx
```

By default ProxyX listens only on `127.0.0.1:8080`. Configure your browser or operating system to use that address as its HTTP and HTTPS proxy.

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `PROXYX_BIND` | `127.0.0.1:8080` | Listener address. Keep it loopback unless you understand the exposure. |
| `PROXYX_ALLOW_PRIVATE` | `false` | Permit private/local destination addresses. Leave disabled for normal browsing. |
| `RUST_LOG` | `proxyx=info` | Log verbosity. |

The local implementation supports standard absolute-form HTTP requests and HTTPS `CONNECT` tunnels. It does not decrypt HTTPS traffic.

## Cloudflare Worker gateway

The Worker is a distinct HTTP fetch gateway, **not** a TCP proxy and not a replacement for the local `CONNECT` proxy.

1. Install Node.js 22+ and npm.
2. From `worker/`, run `npm install`.
3. Configure `PROXYX_TOKEN` as a secret.
4. Configure `PROXYX_ALLOWED_HOSTS` as a comma-separated list of hostnames.
5. Deploy with `npx wrangler deploy`.

Requests use `GET /proxy?url=https%3A%2F%2Fexample.com%2F` and require `Authorization: Bearer <token>`. The Worker intentionally rejects non-HTTP(S) URLs, hosts outside the allowlist, credentials in URLs, and literal private/reserved IP addresses. Review `worker/README.md` before deployment.

## Static control panel

The contents of `site/` can be published as a static site:

- **GitHub Pages:** publish from the repository's `/site` directory using a Pages workflow.
- **Cloudflare Pages:** connect this repository and set the build output directory to `site`; no build command is required.

The panel is documentation/configuration UI only. It does not run a proxy inside the browser and does not store or transmit proxy credentials.

## Security model

- Local listener binds to loopback by default.
- Do not expose the local proxy to a LAN or the public Internet without adding authentication and a deliberate network policy.
- Do not run an unrestricted public Worker proxy. Configure a narrow host allowlist and keep the bearer token secret.
- The Worker is subject to Cloudflare Workers runtime, request and egress limits.
- ProxyX is not intended to bypass access controls, paywalls, school/work network rules, or website restrictions.

## Development

```bash
cargo test --workspace
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

All rights reserved. See [LICENSE](LICENSE). No permission to redistribute, sublicense, or use this software commercially is granted by default.
