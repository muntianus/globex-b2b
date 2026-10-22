import http from 'node:http';
import { URL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CatalogStore } from './catalog-store.js';
import { GlobexBridge, GLOBEX_ECOSYSTEM } from './globex-bridge.js';

export const SERVICE_VERSION = '1.2.0';

export function buildOpenApiSpec(baseUrl = 'http://localhost:4010') {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Globex B2B Inventory, Order & Ecosystem SLO Sync API',
      version: SERVICE_VERSION,
      description:
        'High-throughput B2B e-commerce catalog, M-15 warehouse stock reservation, 2026 Russian VAT 22% calculation (with optional vat_regime: OSNO_22, USN_7, USN_5, EXPORT_0), GOST ST00012 payment QR generation, and live ecosystem SLO bridge for globlex.pro, globlex.shop, globlex.online, launchgate-core, and aco.perfops.shop.',
      contact: {
        name: 'PerfOps Engineering',
        url: 'https://globlex.pro',
      },
    },
    servers: [
      { url: baseUrl, description: 'Local / Microservice Runtime' },
      { url: 'https://api.globlex.pro', description: 'Globex Production API' },
    ],
    'x-perfops-integrations': {
      upstream: GLOBEX_ECOSYSTEM.upstreamApi,
      domains: GLOBEX_ECOSYSTEM.domains,
      consumers: GLOBEX_ECOSYSTEM.consumers,
    },
    paths: {
      '/health': {
        get: {
          operationId: 'getHealth',
          summary: 'Service health check and upstream binding',
          responses: {
            '200': { description: 'Service is healthy' },
          },
        },
      },
      '/api/v1/catalog': {
        get: {
          operationId: 'listCatalog',
          summary: 'List B2B industrial catalog SKUs with category, search, and VAT filtering',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'vat_only', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: {
            '200': { description: 'Filtered B2B catalog list' },
          },
        },
        post: {
          operationId: 'createCatalogSku',
          summary: 'Create a new industrial B2B SKU in the catalog',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['sku', 'name', 'priceNet'],
                  properties: {
                    sku: { type: 'string', description: 'Upper-cased on save' },
                    name: { type: 'string' },
                    category: { type: 'string', default: 'industrial_general' },
                    unit: { type: 'string', default: 'шт' },
                    priceNet: { type: 'number', exclusiveMinimum: 0 },
                    stock: { type: 'integer', minimum: 0, default: 0 },
                    reserved: { type: 'integer', minimum: 0, default: 0 },
                    vatRate: { type: 'number', default: 0.22 },
                    vatEligible: { type: 'boolean' },
                    warehouse: { type: 'string', default: 'MSK-NORTH-01' },
                    gost: { type: 'string' },
                    minOrderQty: { type: 'integer', minimum: 1, default: 1 },
                    leadTimeDays: { type: 'integer', minimum: 0, default: 5 },
                  },
                },
                example: { sku: 'GLX-PIPE-219', name: 'Труба 219x8 ГОСТ 8732-78', priceNet: 145000, stock: 40 },
              },
            },
          },
          responses: {
            '201': { description: 'SKU created' },
            '400': { description: 'Validation error' },
            '409': { description: 'Duplicate SKU' },
          },
        },
      },
      '/api/v1/orders/reserve': {
        post: {
          operationId: 'reserveOrderStock',
          summary:
            'Validate buyer INN (10/12 digits), lock M-15 warehouse stock, compute 22% VAT (or optional vat_regime: OSNO_22, USN_7, USN_5, EXPORT_0), and issue GOST R 56042-2014 ST00012 QR payload',
          description:
            'Order lines are aggregated per SKU before the stock check. If the summed quantity for any SKU exceeds available stock, the whole order is rejected with 409 INSUFFICIENT_STOCK and no stock is reserved. Duplicate SKU lines that fit are merged into a single order item.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  description: 'Send either `items` or a single `sku` + `quantity`; `inn` / `vatRegime` are accepted aliases.',
                  properties: {
                    buyerInn: { type: 'string', pattern: '^(\\d{10}|\\d{12})$' },
                    inn: { type: 'string' },
                    buyerName: { type: 'string' },
                    vat_regime: { type: 'string', enum: ['OSNO_22', 'USN_7', 'USN_5', 'EXPORT_0'], default: 'OSNO_22' },
                    vatRegime: { type: 'string' },
                    items: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['sku', 'quantity'],
                        properties: { sku: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } },
                      },
                    },
                    sku: { type: 'string' },
                    quantity: { type: 'integer', minimum: 1, default: 1 },
                  },
                },
                example: { buyerInn: '7707083893', vat_regime: 'OSNO_22', items: [{ sku: 'GLX-PIPE-219', quantity: 2 }] },
              },
            },
          },
          responses: {
            '201': { description: 'Stock reserved and M-15 order generated' },
            '400': { description: 'Invalid INN or order payload' },
            '404': { description: 'SKU not found' },
            '409': { description: 'Insufficient warehouse stock' },
          },
        },
      },
      '/api/v1/orders': {
        get: {
          operationId: 'listOrders',
          summary: 'List reserved B2B orders and M-15 stock locks',
          responses: {
            '200': { description: 'Order list' },
          },
        },
      },
      '/api/v1/sync/globlex': {
        get: {
          operationId: 'syncGloblexEcosystem',
          summary:
            'Probe https://api.globlex.pro/health and /enterprise/overview with latency SLO metrics and deterministic fallback',
          responses: {
            '200': { description: 'Ecosystem sync telemetry and SLO report' },
          },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          operationId: 'getOpenApiSpec',
          summary: 'OpenAPI 3.1 contract',
          responses: {
            '200': { description: 'OpenAPI 3.1 JSON document' },
          },
        },
      },
    },
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Service': 'globex-b2b',
    'X-Service-Version': SERVICE_VERSION,
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > 1024 * 1024) {
        const err = new Error('Payload too large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        const err = new Error('Malformed JSON request body');
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

function health(req, res) {
  return sendJson(res, 200, {
    status: 'ok',
    service: 'globex-b2b',
    version: SERVICE_VERSION,
    upstream: 'https://api.globlex.pro',
  });
}

function listCatalog(req, res, url, { store }) {
  const category = url.searchParams.get('category') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const vatOnly = url.searchParams.get('vat_only') || undefined;
  const items = store.listCatalog({
    category,
    search,
    vat_only: vatOnly,
  });

  return sendJson(res, 200, {
    status: 'ok',
    count: items.length,
    filters: {
      category: category || null,
      search: search || null,
      vat_only: vatOnly === 'true' || vatOnly === '1',
    },
    items,
  });
}

async function createCatalogSku(req, res, url, { store }) {
  const body = await readJsonBody(req);
  const created = store.createSku(body);
  return sendJson(res, 201, {
    status: 'created',
    item: created,
  });
}

async function reserveOrder(req, res, url, { store }) {
  const body = await readJsonBody(req);
  const order = store.reserveOrder(body);
  return sendJson(res, 201, {
    status: 'reserved',
    orderId: order.orderId,
    buyerInn: order.buyer.inn,
    pricing: order.pricing,
    paymentQr: order.payment.qrPayload,
    order,
  });
}

function listOrders(req, res, url, { store }) {
  const orders = store.listOrders();
  return sendJson(res, 200, {
    status: 'ok',
    count: orders.length,
    orders,
  });
}

async function syncGloblex(req, res, url, { store, bridge }) {
  const catalogItems = store.listCatalog();
  const orders = store.listOrders();
  const syncReport = await bridge.syncEcosystem({
    skuCount: catalogItems.length,
    reservedOrdersCount: orders.length,
    totalAvailableUnits: catalogItems.reduce((acc, item) => acc + item.availableStock, 0),
  });
  return sendJson(res, 200, syncReport);
}

function openApiSpec(req, res) {
  const baseUrl = `http://${req.headers.host || 'localhost:4010'}`;
  return sendJson(res, 200, buildOpenApiSpec(baseUrl));
}

/**
 * Every route the service answers. Handlers get `(req, res, url, ctx)` where
 * ctx = { store, bridge }. tests/openapi-contract.test.js keeps this table and
 * the exported docs/api/openapi.json in lockstep.
 */
export const ROUTES = [
  { method: 'GET', path: '/health', handler: health },
  { method: 'GET', path: '/api/v1/catalog', handler: listCatalog },
  { method: 'POST', path: '/api/v1/catalog', handler: createCatalogSku },
  { method: 'POST', path: '/api/v1/orders/reserve', handler: reserveOrder },
  { method: 'GET', path: '/api/v1/orders', handler: listOrders },
  { method: 'GET', path: '/api/v1/sync/globlex', handler: syncGloblex },
  { method: 'GET', path: '/api/v1/openapi.json', handler: openApiSpec },
];

export function createAppServer(options = {}) {
  const store = options.store || new CatalogStore({ persistPath: options.persistPath });
  const bridge = options.bridge || new GlobexBridge(options.bridgeOptions);
  const ctx = { store, bridge };

  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    try {
      const route = ROUTES.find((r) => r.method === method && r.path === url.pathname);
      if (route) {
        return await route.handler(req, res, url, ctx);
      }
      return sendJson(res, 404, {
        status: 'error',
        error: 'NOT_FOUND',
        message: `Route ${method} ${url.pathname} not found`,
      });
    } catch (err) {
      const statusCode = Number(err?.statusCode) || 500;
      return sendJson(res, statusCode, {
        status: 'error',
        error: err?.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR'),
        message: err?.message || 'Unexpected server error',
      });
    }
  });

  server.store = store;
  server.bridge = bridge;
  return server;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const port = Number(process.env.PORT || 4010);
  const persistPath = process.env.GLOBEX_STORE_PATH || undefined;
  const server = createAppServer({ persistPath });

  server.listen(port, () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        service: 'globex-b2b',
        version: SERVICE_VERSION,
        port,
        upstream: 'https://api.globlex.pro',
      })
    );
  });
}
