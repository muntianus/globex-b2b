import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/server.js';
import { GlobexBridge } from '../src/globex-bridge.js';

async function withTestServer(options, fn) {
  const server = createAppServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(baseUrl, server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /health returns exact service metadata and upstream binding', async () => {
  await withTestServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, {
      status: 'ok',
      service: 'globex-b2b',
      version: '1.2.0',
      upstream: 'https://api.globlex.pro',
    });
  });
});

test('GET /api/v1/catalog returns 15 seeded industrial B2B SKUs and supports category, search, and vat_only filters', async () => {
  await withTestServer({}, async (baseUrl) => {
    const allRes = await fetch(`${baseUrl}/api/v1/catalog`);
    assert.equal(allRes.status, 200);
    const allBody = await allRes.json();
    assert.equal(allBody.status, 'ok');
    assert.equal(allBody.count, 15);
    assert.equal(allBody.items.length, 15);

    // Category filter: rolled_metal (09G2S pipes)
    const metalRes = await fetch(`${baseUrl}/api/v1/catalog?category=rolled_metal`);
    assert.equal(metalRes.status, 200);
    const metalBody = await metalRes.json();
    assert.equal(metalBody.count, 3);
    assert.ok(metalBody.items.every((item) => item.category === 'rolled_metal'));

    // Search filter: 09Г2С
    const searchRes = await fetch(
      `${baseUrl}/api/v1/catalog?search=${encodeURIComponent('09Г2С')}`
    );
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.count, 3);

    // VAT-only filter excludes VAT-exempt R&D licensing SKU
    const vatRes = await fetch(`${baseUrl}/api/v1/catalog?vat_only=true`);
    assert.equal(vatRes.status, 200);
    const vatBody = await vatRes.json();
    assert.equal(vatBody.count, 14);
    assert.ok(vatBody.items.every((item) => item.vatEligible === true && item.vatRate === 0.22));
  });
});

test('POST /api/v1/catalog creates a new B2B SKU and persists to catalog', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globex-b2b-test-'));
  const persistPath = path.join(tmpDir, 'catalog.json');

  await withTestServer({ persistPath }, async (baseUrl) => {
    const createRes = await fetch(`${baseUrl}/api/v1/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'GLX-PUMP-ind-900',
        name: 'Насос центробежный промышленный ЦНС 180-1900',
        category: 'pumping_units',
        unit: 'шт',
        priceNet: 750000,
        stock: 20,
        warehouse: 'EKB-URAL-02',
        gost: 'ГОСТ 10407-88',
      }),
    });

    assert.equal(createRes.status, 201);
    const createdBody = await createRes.json();
    assert.equal(createdBody.status, 'created');
    assert.equal(createdBody.item.sku, 'GLX-PUMP-IND-900');
    assert.equal(createdBody.item.priceNet, 750000);
    assert.equal(createdBody.item.vatRate, 0.22);
    assert.equal(createdBody.item.priceGrossVat22, 915000);
    assert.equal(createdBody.item.priceGrossVat20, 900000);
    assert.equal(createdBody.item.availableStock, 20);

    // Duplicate SKU should return 409
    const dupRes = await fetch(`${baseUrl}/api/v1/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'GLX-PUMP-IND-900',
        name: 'Дубликат',
        priceNet: 750000,
        stock: 5,
      }),
    });
    assert.equal(dupRes.status, 409);
  });

  // Verify persistence reload
  await withTestServer({ persistPath }, async (baseUrl) => {
    const listRes = await fetch(`${baseUrl}/api/v1/catalog?category=pumping_units`);
    const listBody = await listRes.json();
    assert.equal(listBody.count, 1);
    assert.equal(listBody.items[0].sku, 'GLX-PUMP-IND-900');
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('POST /api/v1/orders/reserve validates INN, computes 22% VAT (default OSNO_22), generates ST00012 QR, and deducts stock', async () => {
  await withTestServer({}, async (baseUrl) => {
    // 1. Reject invalid INN
    const badInnRes = await fetch(`${baseUrl}/api/v1/orders/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerInn: '12345',
        sku: 'GLX-PIPE-09G2S-159',
        quantity: 10,
      }),
    });
    assert.equal(badInnRes.status, 400);

    // 2. Reserve valid order (10 tons of 09G2S pipe @ 118,500 RUB/t net) with default 22% VAT (OSNO_22)
    const reserveRes = await fetch(`${baseUrl}/api/v1/orders/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerInn: '7707083893',
        buyerName: 'ПАО "ПРОММАШИНЖИНИРИНГ"',
        sku: 'GLX-PIPE-09G2S-159',
        quantity: 10,
      }),
    });
    assert.equal(reserveRes.status, 201);
    const reserveBody = await reserveRes.json();

    assert.equal(reserveBody.status, 'reserved');
    assert.equal(reserveBody.buyerInn, '7707083893');
    // 10 * 118,500 = 1,185,000 net; 22% VAT = 260,700; gross = 1,445,700
    assert.equal(reserveBody.pricing.vatRegime, 'OSNO_22');
    assert.equal(reserveBody.pricing.vatRate, 0.22);
    assert.equal(reserveBody.pricing.vatPercent, 22);
    assert.equal(reserveBody.pricing.amountNet, 1185000);
    assert.equal(reserveBody.pricing.vatAmount, 260700);
    assert.equal(reserveBody.pricing.amountTotal, 1445700);

    // Verify GOST R 56042-2014 ST00012 payment QR string contains 22% VAT and correct kopeck sum
    assert.ok(reserveBody.paymentQr.startsWith('ST00012|'));
    assert.ok(reserveBody.paymentQr.includes('Sum=144570000'));
    assert.ok(reserveBody.paymentQr.includes('в т.ч. НДС 22%'));
    assert.ok(reserveBody.paymentQr.includes('PayerINN=7707083893'));
    assert.ok(reserveBody.order.m15Requisition.stockLocked);
    assert.ok(reserveBody.order.m15Requisition.documentNumber.startsWith('M15-'));

    // 3. Verify stock was deducted from 420 -> 410
    const catRes = await fetch(`${baseUrl}/api/v1/catalog?search=GLX-PIPE-09G2S-159`);
    const catBody = await catRes.json();
    assert.equal(catBody.items[0].stock, 410);
    assert.equal(catBody.items[0].availableStock, 410);

    // 4. Verify GET /api/v1/orders returns the reserved order
    const ordersRes = await fetch(`${baseUrl}/api/v1/orders`);
    assert.equal(ordersRes.status, 200);
    const ordersBody = await ordersRes.json();
    assert.equal(ordersBody.count, 1);
    assert.equal(ordersBody.orders[0].orderId, reserveBody.orderId);
  });
});

test('POST /api/v1/orders/reserve supports optional vat_regime (USN_7, USN_5, EXPORT_0) and validates invalid regimes', async () => {
  await withTestServer({}, async (baseUrl) => {
    // 1. USN_7 regime (7% VAT)
    const usn7Res = await fetch(`${baseUrl}/api/v1/orders/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerInn: '7707083893',
        sku: 'GLX-PIPE-09G2S-159',
        quantity: 10,
        vat_regime: 'USN_7',
      }),
    });
    assert.equal(usn7Res.status, 201);
    const usn7Body = await usn7Res.json();
    // 10 * 118,500 = 1,185,000 net; 7% VAT = 82,950; gross = 1,267,950
    assert.equal(usn7Body.pricing.vatRegime, 'USN_7');
    assert.equal(usn7Body.pricing.vatRate, 0.07);
    assert.equal(usn7Body.pricing.vatPercent, 7);
    assert.equal(usn7Body.pricing.amountNet, 1185000);
    assert.equal(usn7Body.pricing.vatAmount, 82950);
    assert.equal(usn7Body.pricing.amountTotal, 1267950);
    assert.ok(usn7Body.paymentQr.includes('Sum=126795000'));
    assert.ok(usn7Body.paymentQr.includes('в т.ч. НДС 7%'));

    // 2. USN_5 regime (5% VAT)
    const usn5Res = await fetch(`${baseUrl}/api/v1/orders/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerInn: '7707083893',
        sku: 'GLX-PIPE-09G2S-159',
        quantity: 5,
        vat_regime: 'USN_5',
      }),
    });
    assert.equal(usn5Res.status, 201);
    const usn5Body = await usn5Res.json();
    // 5 * 118,500 = 592,500 net; 5% VAT = 29,625; gross = 622,125
    assert.equal(usn5Body.pricing.vatRegime, 'USN_5');
    assert.equal(usn5Body.pricing.vatRate, 0.05);
    assert.equal(usn5Body.pricing.vatPercent, 5);
    assert.equal(usn5Body.pricing.amountNet, 592500);
    assert.equal(usn5Body.pricing.vatAmount, 29625);
    assert.equal(usn5Body.pricing.amountTotal, 622125);
    assert.ok(usn5Body.paymentQr.includes('Sum=62212500'));
    assert.ok(usn5Body.paymentQr.includes('в т.ч. НДС 5%'));

    // 3. EXPORT_0 regime (0% VAT)
    const exportRes = await fetch(`${baseUrl}/api/v1/orders/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerInn: '7707083893',
        sku: 'GLX-PIPE-09G2S-159',
        quantity: 5,
        vat_regime: 'EXPORT_0',
      }),
    });
    assert.equal(exportRes.status, 201);
    const exportBody = await exportRes.json();
    // 5 * 118,500 = 592,500 net; 0% VAT = 0; gross = 592,500
    assert.equal(exportBody.pricing.vatRegime, 'EXPORT_0');
    assert.equal(exportBody.pricing.vatRate, 0.0);
    assert.equal(exportBody.pricing.vatPercent, 0);
    assert.equal(exportBody.pricing.amountNet, 592500);
    assert.equal(exportBody.pricing.vatAmount, 0);
    assert.equal(exportBody.pricing.amountTotal, 592500);
    assert.ok(exportBody.paymentQr.includes('Sum=59250000'));
    assert.ok(exportBody.paymentQr.includes('без НДС (НДС 0%)'));

    // 4. Reject invalid vat_regime
    const badRegimeRes = await fetch(`${baseUrl}/api/v1/orders/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerInn: '7707083893',
        sku: 'GLX-PIPE-09G2S-159',
        quantity: 1,
        vat_regime: 'INVALID_TAX_REGIME',
      }),
    });
    assert.equal(badRegimeRes.status, 400);
    const badRegimeBody = await badRegimeRes.json();
    assert.equal(badRegimeBody.error, 'INVALID_VAT_REGIME');
  });
});

test('GET /api/v1/sync/globlex probes upstream endpoints and returns SLO telemetry with deterministic fallback', async () => {
  // Deterministic mock fetch simulating api.globlex.pro responses
  const mockFetch = async (url) => {
    if (String(url).endsWith('/health')) {
      return new Response(JSON.stringify({ status: 'ok', service: 'globlex-api' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(url).endsWith('/enterprise/overview')) {
      return new Response(
        JSON.stringify({
          platform: 'Globex Enterprise B2B',
          activeSuppliers: 1500,
          openTenders: 82,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    return new Response('Not Found', { status: 404 });
  };

  const bridge = new GlobexBridge({ fetchImpl: mockFetch });

  await withTestServer({ bridge }, async (baseUrl) => {
    const syncRes = await fetch(`${baseUrl}/api/v1/sync/globlex`);
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();

    assert.equal(syncBody.status, 'ok');
    assert.equal(syncBody.syncMode, 'live_upstream');
    assert.equal(syncBody.upstream, 'https://api.globlex.pro');
    assert.equal(syncBody.probes.health.reachable, true);
    assert.equal(syncBody.probes.enterpriseOverview.reachable, true);
    assert.equal(typeof syncBody.slo.totalSyncLatencyMs, 'number');
    assert.equal(syncBody.slo.withinBudget, true);
    assert.equal(syncBody.localCatalog.skuCount, 15);
  });

  // Also test deterministic offline fallback when upstream is unreachable
  const offlineBridge = new GlobexBridge({ offlineMode: true });
  await withTestServer({ bridge: offlineBridge }, async (baseUrl) => {
    const syncRes = await fetch(`${baseUrl}/api/v1/sync/globlex`);
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.equal(syncBody.status, 'ok');
    assert.equal(syncBody.syncMode, 'deterministic_offline_fallback');
    assert.equal(syncBody.probes.health.fallbackUsed, true);
    assert.equal(syncBody.probes.enterpriseOverview.fallbackUsed, true);
    assert.equal(syncBody.probes.enterpriseOverview.data.settlementStandard, 'GOST R 56042-2014 (ST00012)');
  });
});

test('GET /api/v1/openapi.json returns OpenAPI 3.1 contract for globex, launchgate-core, and aco.perfops.shop', async () => {
  await withTestServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/openapi.json`);
    assert.equal(res.status, 200);
    const spec = await res.json();
    assert.equal(spec.openapi, '3.1.0');
    assert.ok(spec.paths['/health']);
    assert.ok(spec.paths['/api/v1/catalog']);
    assert.ok(spec.paths['/api/v1/orders/reserve']);
    assert.ok(spec.paths['/api/v1/orders']);
    assert.ok(spec.paths['/api/v1/sync/globlex']);
    assert.ok(spec['x-perfops-integrations'].consumers.includes('launchgate-core'));
    assert.ok(spec['x-perfops-integrations'].consumers.includes('aco.perfops.shop'));
  });
});
