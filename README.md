# Globex B2B (`globex-b2b`)

High-throughput B2B e-commerce catalog, M-15 warehouse stock reservation, 2026 Russian VAT 22% calculation (with multi-regime support: `OSNO_22`, `USN_7`, `USN_5`, `EXPORT_0`), GOST R 56042-2014 (`ST00012`) payment QR generator, and ecosystem SLO sync microservice.

## Ecosystem & Upstream Integration

- **Upstream Production API**: `https://api.globlex.pro` (`/health`, `/enterprise/overview`)
- **Live Flagship**: `https://globlex.pro`
- **Live Storefront**: `https://globlex.shop`
- **Ecosystem Portal**: `https://globlex.online`
- **Downstream Consumers**: `globex`, `launchgate-core`, `aco.perfops.shop`

## 2026 Tax Reform & VAT Regimes (`vat_regime`)

Per the 2026 Russian Tax Reform, `globex-b2b` uses **22% VAT (`НДС 22%`)** as the standard rate across industrial catalog reservations and GOST payment orders. In addition, `POST /api/v1/orders/reserve` supports optional `vat_regime` specification:

| `vat_regime` | Rate | Tax Description | Typical Usage |
| --- | --- | --- | --- |
| `OSNO_22` *(default)* | `0.22` (22%) | ОСНО (НДС 22%) | Стандартный режим ОСНО для промышленных предприятий с 2026 года |
| `USN_7` | `0.07` (7%) | УСН (НДС 7%) | Организации на УСН с выручкой от 250 млн до 450 млн руб. |
| `USN_5` | `0.05` (5%) | УСН (НДС 5%) | Организации на УСН с выручкой от 60 млн до 250 млн руб. |
| `EXPORT_0` | `0.00` (0%) | Экспорт (НДС 0%) | Экспортные контракты и освобожденные операции |

## Architecture

Built strictly on zero-bloat Node.js built-ins (`node:http`, `node:test`, `node:perf_hooks`, `node:fs`, `node:crypto`) for `<50ms` cold start and deterministic SLO verification:

- `src/catalog-store.js` — Seeded with 15 industrial B2B SKUs across 5 industrial verticals (`cnc_machinery`, `rolled_metal`, `power_equipment`, `server_infrastructure`, `polymers`), buyer INN validation (`10`/`12` digits), 2026 Russian VAT 22% (`НДС 22%`) & multi-regime calculation, atomic M-15 (`ОКУД 0315007`) stock reservation locks, and GOST R 56042-2014 `ST00012` settlement QR string builder.
- `src/globex-bridge.js` — Upstream telemetry bridge probing `https://api.globlex.pro/health` and `https://api.globlex.pro/enterprise/overview` with p95 latency tracking and deterministic offline fallback.
- `src/server.js` — HTTP microservice (default port `4010`) with OpenAPI 3.1 contract discovery.

## HTTP API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service status, version (`1.2.0`), and `https://api.globlex.pro` upstream binding |
| `GET` | `/api/v1/catalog` | Query 15+ industrial SKUs with `?category=`, `?search=`, and `?vat_only=true` filters |
| `POST` | `/api/v1/catalog` | Register a new industrial B2B SKU (defaults to 22% VAT) |
| `POST` | `/api/v1/orders/reserve` | Validate buyer INN (`10`/`12` digits), lock M-15 warehouse stock, compute 22% VAT (or optional `vat_regime`: `OSNO_22`, `USN_7`, `USN_5`, `EXPORT_0`), and return `ST00012` QR |
| `GET` | `/api/v1/orders` | List active reserved B2B orders and M-15 stock locks |
| `GET` | `/api/v1/sync/globlex` | Probe `https://api.globlex.pro/health` and `/enterprise/overview` and report latency SLO metrics |
| `GET` | `/api/v1/openapi.json` | OpenAPI 3.1 specification for `globex`, `launchgate-core`, and `aco.perfops.shop` |

### Stock Reservation Example with `vat_regime`

```bash
# Reserve order with standard 22% VAT (OSNO)
curl -X POST http://localhost:4010/api/v1/orders/reserve \
  -H "Content-Type: application/json" \
  -d '{
    "buyerInn": "7707083893",
    "buyerName": "ПАО ПРОММАШИНЖИНИРИНГ",
    "sku": "GLX-PIPE-09G2S-159",
    "quantity": 10,
    "vat_regime": "OSNO_22"
  }'

# Reserve order with USN 7% VAT
curl -X POST http://localhost:4010/api/v1/orders/reserve \
  -H "Content-Type: application/json" \
  -d '{
    "buyerInn": "7707083893",
    "buyerName": "ООО СпецМонтаж",
    "sku": "GLX-PIPE-09G2S-159",
    "quantity": 10,
    "vat_regime": "USN_7"
  }'
```

## Quick Start

```bash
# Run test suite
npm test

# Run smoke test
npm run smoke

# Start HTTP server (default port 4010)
npm start
```
