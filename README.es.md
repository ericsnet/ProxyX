# ProxyX

**Un proxy HTTP/HTTPS local con una pasarela HTTP opcional en Cloudflare Workers.**

ProxyX permite encaminar solicitudes web normales a través de un proxy local, manteniendo el servicio privado por defecto. El repositorio incluye también una pasarela Worker independiente y un panel estático publicable en Cloudflare Pages o GitHub Pages.

> **Estado:** desarrollo inicial. El proxy local y el Worker son implementaciones iniciales; todavía necesitan pruebas más amplias de compatibilidad y casos límite. ProxyX no puede garantizar el acceso a todas las páginas web.

## Componentes

| Componente | Ruta | Función |
|---|---|---|
| Proxy local | `crates/proxyx` | Reenvío HTTP y túneles HTTPS mediante `CONNECT` |
| Pasarela Edge | `worker/` | Pasarela HTTP(S) con lista de hosts permitidos en Workers |
| Panel | `site/` | Interfaz estática y guía de despliegue |
| Documentación | `docs/` | Instalación, seguridad y arquitectura |

## Inicio rápido (local)

Requisitos: Rust estable y Cargo.

```bash
cargo run --release -p proxyx
```

Por defecto, ProxyX escucha únicamente en `127.0.0.1:8080`. Configura el navegador o el sistema operativo para utilizar esa dirección como proxy HTTP y HTTPS.

Variables de entorno:

| Variable | Valor predeterminado | Descripción |
|---|---|---|
| `PROXYX_BIND` | `127.0.0.1:8080` | Dirección de escucha. No la expongas sin entender los riesgos. |
| `PROXYX_ALLOW_PRIVATE` | `false` | Permite destinos privados/locales. Déjala desactivada para navegación normal. |
| `RUST_LOG` | `proxyx=info` | Nivel de registro. |

La implementación local admite solicitudes HTTP en formato absoluto y túneles HTTPS mediante `CONNECT`. No descifra el tráfico HTTPS.

## Pasarela de Cloudflare Workers

El Worker es una pasarela HTTP independiente, **no un proxy TCP ni un sustituto del túnel local `CONNECT`**.

1. Instala Node.js 22 o posterior y npm.
2. Entra en `worker/` y ejecuta `npm install`.
3. Configura `PROXYX_TOKEN` como secreto.
4. Configura `PROXYX_ALLOWED_HOSTS` con una lista de nombres de host separados por comas.
5. Despliega con `npx wrangler deploy`.

Utiliza `GET /proxy?url=https%3A%2F%2Fexample.com%2F` y exige `Authorization: Bearer <token>`. El Worker rechaza protocolos distintos de HTTP(S), hosts fuera de la lista permitida, credenciales en la URL y direcciones IP literales privadas o reservadas. Consulta `worker/README.md` antes de desplegar.

## Panel estático

La carpeta `site/` se puede publicar como sitio estático:

- **GitHub Pages:** publica la carpeta `/site` mediante un workflow de Pages.
- **Cloudflare Pages:** conecta el repositorio y establece `site` como directorio de salida; no hace falta comando de compilación.

El panel solo ofrece documentación y configuración. No ejecuta un proxy dentro del navegador ni almacena o transmite credenciales.

## Seguridad

- El listener local se enlaza a loopback por defecto.
- No expongas el proxy local a una LAN o a Internet sin autenticación y una política de red deliberada.
- No despliegues un Worker público sin restricciones. Configura una lista de hosts permitidos y conserva el token como secreto.
- Workers está sujeto a los límites de ejecución, solicitudes y salida de red de Cloudflare.
- ProxyX no está diseñado para eludir controles de acceso, muros de pago ni restricciones de redes escolares o laborales.

## Desarrollo

```bash
cargo test --workspace
```

Consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) y [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Licencia

Todos los derechos reservados. Consulta [LICENSE](LICENSE). Por defecto, no se concede permiso para redistribuir, sublicenciar o utilizar comercialmente este software.
