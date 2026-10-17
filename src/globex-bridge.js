import { performance } from 'node:perf_hooks';

export const GLOBEX_ECOSYSTEM = Object.freeze({
  upstreamApi: 'https://api.globlex.pro',
  domains: ['https://globlex.pro', 'https://globlex.shop', 'https://globlex.online'],
  legacyOrigin: 'https://globex.perfops.tech',
  consumers: ['globex', 'launchgate-core', 'aco.perfops.shop'],
  slo: {
    maxProbeLatencyMs: 1500,
    targetP95Ms: 250,
    minAvailabilityPercent: 99.9,
  },
});

export const FALLBACK_ENTERPRISE_OVERVIEW = Object.freeze({
  platform: 'Globex Enterprise B2B',
  mode: 'deterministic_offline_fallback',
  activeSuppliers: 1240,
  verifiedB2BCompanies: 892,
  openTenders: 64,
  settlementStandard: 'GOST R 56042-2014 (ST00012)',
  warehouseStandard: 'OKUD 0315007 (M-15)',
  vatPolicy: 'RU_NDS_22_PERCENT',
});

export class GlobexBridge {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.GLOBEX_UPSTREAM_URL || GLOBEX_ECOSYSTEM.upstreamApi).replace(/\/+$/, '');
    this.timeoutMs = Number(options.timeoutMs || process.env.GLOBEX_BRIDGE_TIMEOUT_MS || 2500);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.offlineMode = Boolean(options.offlineMode || process.env.GLOBEX_OFFLINE_FALLBACK === '1');
    this.history = [];
  }

  async #probeEndpoint(pathname, fallbackPayload) {
    const url = `${this.baseUrl}${pathname}`;
    const started = performance.now();

    if (this.offlineMode || typeof this.fetchImpl !== 'function') {
      const latencyMs = Number((performance.now() - started).toFixed(2));
      return {
        url,
        reachable: false,
        fallbackUsed: true,
        statusCode: 200,
        latencyMs,
        data: fallbackPayload,
        error: this.offlineMode ? 'offline_mode_enabled' : 'fetch_unavailable',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'globex-b2b-sync/1.2.0 (+https://globlex.pro)',
        },
        signal: controller.signal,
      });

      const latencyMs = Number((performance.now() - started).toFixed(2));
      let body = null;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { rawPreview: text.slice(0, 200) };
      }

      if (!res.ok) {
        return {
          url,
          reachable: false,
          fallbackUsed: true,
          statusCode: res.status,
          latencyMs,
          data: fallbackPayload,
          upstreamResponse: body,
          error: `HTTP_${res.status}`,
        };
      }

      return {
        url,
        reachable: true,
        fallbackUsed: false,
        statusCode: res.status,
        latencyMs,
        data: body,
        error: null,
      };
    } catch (err) {
      const latencyMs = Number((performance.now() - started).toFixed(2));
      return {
        url,
        reachable: false,
        fallbackUsed: true,
        statusCode: 503,
        latencyMs,
        data: fallbackPayload,
        error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async syncEcosystem(localSummary = {}) {
    const syncStarted = performance.now();

    const [healthProbe, overviewProbe] = await Promise.all([
      this.#probeEndpoint('/health', {
        status: 'degraded_fallback',
        upstream: this.baseUrl,
        service: 'globlex-api-fallback',
      }),
      this.#probeEndpoint('/enterprise/overview', FALLBACK_ENTERPRISE_OVERVIEW),
    ]);

    const totalLatencyMs = Number((performance.now() - syncStarted).toFixed(2));
    const maxEndpointLatencyMs = Math.max(healthProbe.latencyMs, overviewProbe.latencyMs);

    this.history.push(totalLatencyMs);
    if (this.history.length > 50) {
      this.history.shift();
    }

    const sorted = [...this.history].sort((a, b) => a - b);
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const observedP95Ms = sorted[p95Index] ?? totalLatencyMs;

    const liveConnected = healthProbe.reachable || overviewProbe.reachable;

    return {
      status: 'ok',
      syncMode: liveConnected ? 'live_upstream' : 'deterministic_offline_fallback',
      syncedAt: new Date().toISOString(),
      upstream: this.baseUrl,
      ecosystem: {
        domains: GLOBEX_ECOSYSTEM.domains,
        consumers: GLOBEX_ECOSYSTEM.consumers,
      },
      probes: {
        health: healthProbe,
        enterpriseOverview: overviewProbe,
      },
      slo: {
        targetP95Ms: GLOBEX_ECOSYSTEM.slo.targetP95Ms,
        maxProbeBudgetMs: GLOBEX_ECOSYSTEM.slo.maxProbeLatencyMs,
        healthLatencyMs: healthProbe.latencyMs,
        overviewLatencyMs: overviewProbe.latencyMs,
        totalSyncLatencyMs: totalLatencyMs,
        observedP95Ms,
        withinBudget: maxEndpointLatencyMs <= GLOBEX_ECOSYSTEM.slo.maxProbeLatencyMs,
      },
      localCatalog: localSummary,
    };
  }
}
