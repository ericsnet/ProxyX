use anyhow::{Context, Result};
use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::header::{CONNECTION, HOST};
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use log::{info, warn};
use std::convert::Infallible;
use std::env;
use tokio::net::{TcpListener, TcpStream};
use tokio::io::copy_bidirectional;
use url::Url;

type ResponseBody = Full<Bytes>;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("proxyx=info")).init();

    let bind = env::var("PROXYX_BIND").unwrap_or_else(|_| "127.0.0.1:8080".into());
    if !bind.starts_with("127.0.0.1:") && !bind.starts_with("[::1]:") {
        warn!("Non-loopback bind requested. ProxyX is unauthenticated; this can expose an open proxy.");
    }

    let listener = TcpListener::bind(&bind).await.context("Could not bind proxy listener")?;
    info!("ProxyX listening on http://{bind}");
    loop {
        let (stream, peer) = listener.accept().await?;
        tokio::spawn(async move {
            let io = TokioIo::new(stream);
            let service = service_fn(handle);
            if let Err(error) = hyper::server::conn::http1::Builder::new()
                .serve_connection(io, service)
                .with_upgrades()
                .await
            {
                warn!("Connection from {peer} ended: {error}");
            }
        });
    }
}

async fn handle(mut request: Request<Incoming>) -> Result<Response<ResponseBody>, Infallible> {
    if request.method() == Method::CONNECT {
        let authority = request.uri().authority().map(|a| a.as_str().to_owned());
        let Some(authority) = authority else {
            return Ok(response(StatusCode::BAD_REQUEST, "CONNECT requires host:port"));
        };
        let on_upgrade = hyper::upgrade::on(&mut request);
        tokio::spawn(async move {
            match TcpStream::connect(&authority).await {
                Ok(mut upstream) => match on_upgrade.await {
                    Ok(upgraded) => {
                        let mut downstream = TokioIo::new(upgraded);
                        if let Err(error) = copy_bidirectional(&mut downstream, &mut upstream).await {
                            warn!("Tunnel ended: {error}");
                        }
                    }
                    Err(error) => warn!("CONNECT upgrade failed: {error}"),
                },
                Err(error) => warn!("Could not connect to {authority}: {error}"),
            }
        });
        let mut response = Response::new(Full::new(Bytes::new()));
        *response.status_mut() = StatusCode::OK;
        return Ok(response);
    }

    if request.method() == Method::TRACE || request.method() == Method::TRACK {
        return Ok(response(StatusCode::METHOD_NOT_ALLOWED, "Method not supported"));
    }

    let target = request.uri().to_string();
    let parsed = match Url::parse(&target) {
        Ok(url) if url.scheme() == "http" => url,
        _ => return Ok(response(StatusCode::BAD_REQUEST, "Use an absolute http:// URL or CONNECT for HTTPS")),
    };

    if parsed.host_str().is_none() {
        return Ok(response(StatusCode::BAD_REQUEST, "Target URL has no host"));
    }

    let method = request.method().clone();
    let version = request.version();
    let headers = request.headers().clone();
    let body = match request.body_mut().collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(_) => return Ok(response(StatusCode::BAD_REQUEST, "Could not read request body")),
    };

    let mut builder = Request::builder().method(method).uri(target).version(version);
    if let Some(out) = builder.headers_mut() {
        for (name, value) in headers.iter() {
            if name != CONNECTION && name != HOST && name.as_str() != "proxy-connection"
                && name.as_str() != "proxy-authorization" {
                out.append(name, value.clone());
            }
        }
        if let Some(host) = parsed.host_str() {
            if let Ok(value) = host.parse() { out.insert(HOST, value); }
        }
    }
    let outbound = match builder.body(Full::new(body)) {
        Ok(req) => req,
        Err(_) => return Ok(response(StatusCode::BAD_REQUEST, "Invalid outbound request")),
    };

    let connector = hyper_util::client::legacy::connect::HttpConnector::new();
    let client: hyper_util::client::legacy::Client<_, Full<Bytes>> =
        hyper_util::client::legacy::Client::builder(hyper_util::rt::TokioExecutor::new()).build(connector);

    match client.request(outbound).await {
        Ok(upstream) => {
            let (parts, body) = upstream.into_parts();
            let bytes = match body.collect().await {
                Ok(collected) => collected.to_bytes(),
                Err(_) => return Ok(response(StatusCode::BAD_GATEWAY, "Upstream response body failed")),
            };
            Ok(Response::from_parts(parts, Full::new(bytes)))
        }
        Err(error) => {
            warn!("Upstream request failed: {error}");
            Ok(response(StatusCode::BAD_GATEWAY, "Upstream request failed"))
        }
    }
}

fn response(status: StatusCode, message: &'static str) -> Response<ResponseBody> {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain; charset=utf-8")
        .body(Full::new(Bytes::from_static(message.as_bytes())))
        .unwrap()
}
