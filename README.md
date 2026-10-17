# Globex B2B (`globex-b2b`)

High-throughput B2B e-commerce catalog, M-15 warehouse stock reservation, VAT 20% calculation, GOST R 56042-2014 (`ST00012`) payment QR generator, and ecosystem SLO sync microservice.

## Ecosystem & Upstream Integration

- **Upstream Production API**: `https://api.globlex.pro` (`/health`, `/enterprise/overview`)
- **Live Flagship**: `https://globlex.pro`
- **Live Storefront**: `https://globlex.shop`
- **Ecosystem Portal**: `https://globlex.online`
- **Downstream Consumers**: `globex`, `launchgate-core`, `aco.perfops.shop`

## Architecture

Built strictly on zero-bloat Node.js built-ins (`node:http`, `node:test`, `node:perf_hooks`, `node:fs`, `node:crypto`) for `<50ms` cold start and deterministic SLO verification:

- `src/catalog-store.js` — Seeded with 15 industrial B2B SKUs across 5 industrial verticals (`cnc_machinery`, `rolled_metal`, `power_equipment`, `server_infrastructure`, `polymers`), buyer INN validation (`10`/`12` digits), 20% Russian VAT (`НДС 20%`) calculation, atomic M-15 (`ОКУД 0315007`) stock reservation locks, and GOST R 56042-2014 `ST00012` settlement QR string builder.
- `src/globex-bridge.js` — Upstream telemetry bridge probing `https://api.globlex.pro/health` and `https://api.globlex.pro/enterprise/overview` with p95 latency tracking and deterministic offline fallback.
- `src/server.js` — HTTP microservice (default port `4010`) with OpenAPI 3.1 contract discovery.

## HTTP API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service status, version (`1.2.0`), and `https://api.globlex.pro` upstream binding |
| `GET` | `/api/v1/catalog` | Query 15+ industrial SKUs with `?category=`, `?search=`, and `?vat_only=true` filters |
| `POST` | `/api/v1/catalog` | Register a new industrial B2B SKU |
| `POST` | `/api/v1/orders/reserve` | Validate buyer INN (`10`/`12` digits), lock M-15 warehouse stock, compute 20% VAT, and return `ST00012` QR |
| `GET` | `/api/v1/orders` | List active reserved B2B orders and M-15 stock locks |
| `GET` | `/api/v1/sync/globlex` | Probe `https://api.globlex.pro/health` and `/enterprise/overview` and report latency SLO metrics |
| `GET` | `/api/v1/openapi.json` | OpenAPI 3.1 specification for `globex`, `launchgate-core`, and `aco.perfops.shop` |

## Quick Start

```bash
# Run test suite
npm test

# Start HTTP server (default port 4010)
npm start
```
