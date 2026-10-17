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

export function createAppServer(options = {}) {
  const store = options.store || new CatalogStore({ persistPath: options.persistPath });
  const bridge = options.bridge || new GlobexBridge(options.bridgeOptions);

  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    try {
      if (method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'globex-b2b',
          version: SERVICE_VERSION,
          upstream: 'https://api.globlex.pro',
        });
      }

      if (method === 'GET' && pathname === '/api/v1/catalog') {
        const category = parsedUrl.searchParams.get('category') || undefined;
        const search = parsedUrl.searchParams.get('search') || undefined;
        const vatOnly = parsedUrl.searchParams.get('vat_only') || undefined;
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

      if (method === 'POST' && pathname === '/api/v1/catalog') {
        const body = await readJsonBody(req);
        const created = store.createSku(body);
        return sendJson(res, 201, {
          status: 'created',
          item: created,
        });
      }

      if (method === 'POST' && pathname === '/api/v1/orders/reserve') {
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

      if (method === 'GET' && pathname === '/api/v1/orders') {
        const orders = store.listOrders();
        return sendJson(res, 200, {
          status: 'ok',
          count: orders.length,
          orders,
        });
      }

      if (method === 'GET' && pathname === '/api/v1/sync/globlex') {
        const catalogItems = store.listCatalog();
        const orders = store.listOrders();
        const syncReport = await bridge.syncEcosystem({
          skuCount: catalogItems.length,
          reservedOrdersCount: orders.length,
          totalAvailableUnits: catalogItems.reduce((acc, item) => acc + item.availableStock, 0),
        });
        return sendJson(res, 200, syncReport);
      }

      if (method === 'GET' && pathname === '/api/v1/openapi.json') {
        const baseUrl = `http://${req.headers.host || 'localhost:4010'}`;
        return sendJson(res, 200, buildOpenApiSpec(baseUrl));
      }

      return sendJson(res, 404, {
        status: 'error',
        error: 'NOT_FOUND',
        message: `Route ${method} ${pathname} not found`,
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
