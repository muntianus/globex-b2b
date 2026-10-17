import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SUPPLIER_REQUISITES = Object.freeze({
  name: 'ООО "ГЛОБЕКС ПРОМЫШЛЕННЫЕ СИСТЕМЫ"',
  inn: '7707083893',
  kpp: '770701001',
  personalAcc: '40702810938000148201',
  bankName: 'ПАО СБЕРБАНК Г. МОСКВА',
  bic: '044525225',
  correspAcc: '30101810400000000225',
});

export const VAT_REGIMES = Object.freeze({
  OSNO_22: Object.freeze({
    code: 'OSNO_22',
    rate: 0.22,
    percent: 22,
    name: 'ОСНО (НДС 22%)',
    description: 'Общая система налогообложения — ставка НДС 22% (налоговая реформа 2026)',
  }),
  USN_7: Object.freeze({
    code: 'USN_7',
    rate: 0.07,
    percent: 7,
    name: 'УСН (НДС 7%)',
    description: 'Упрощенная система налогообложения — специальная ставка НДС 7%',
  }),
  USN_5: Object.freeze({
    code: 'USN_5',
    rate: 0.05,
    percent: 5,
    name: 'УСН (НДС 5%)',
    description: 'Упрощенная система налогообложения — специальная ставка НДС 5%',
  }),
  EXPORT_0: Object.freeze({
    code: 'EXPORT_0',
    rate: 0.00,
    percent: 0,
    name: 'Экспорт (НДС 0%)',
    description: 'Экспортные операции / нулевая ставка НДС 0%',
  }),
});

export const DEFAULT_VAT_REGIME = 'OSNO_22';
export const DEFAULT_VAT_RATE = 0.22;

export function resolveVatRegime(regimeInput) {
  if (!regimeInput) {
    return VAT_REGIMES[DEFAULT_VAT_REGIME];
  }
  const key = String(regimeInput).trim().toUpperCase();
  const found = VAT_REGIMES[key];
  if (!found) {
    const err = new Error(
      `Invalid vat_regime "${regimeInput}". Allowed values: ${Object.keys(VAT_REGIMES).join(', ')}`
    );
    err.statusCode = 400;
    err.code = 'INVALID_VAT_REGIME';
    throw err;
  }
  return found;
}

export const SEED_SKUS = Object.freeze([
  {
    sku: 'GLX-CNC-500X',
    name: 'Токарно-фрезерный обрабатывающий центр с ЧПУ Globex CNC-500X',
    category: 'cnc_machinery',
    unit: 'шт',
    priceNet: 4850000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 14,
    reserved: 2,
    warehouse: 'MSK-NORTH-01',
    gost: 'ГОСТ 18097-93',
    minOrderQty: 1,
    leadTimeDays: 10,
  },
  {
    sku: 'GLX-CNC-VMC850',
    name: 'Вертикально-фрезерный станок с ЧПУ VMC-850 Pro',
    category: 'cnc_machinery',
    unit: 'шт',
    priceNet: 6200000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 9,
    reserved: 1,
    warehouse: 'MSK-NORTH-01',
    gost: 'ГОСТ 9726-89',
    minOrderQty: 1,
    leadTimeDays: 14,
  },
  {
    sku: 'GLX-CNC-LASER3K',
    name: 'Оптоволоконный станок лазерной резки металла 3000Вт',
    category: 'cnc_machinery',
    unit: 'шт',
    priceNet: 3900000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 11,
    reserved: 0,
    warehouse: 'EKB-URAL-02',
    gost: 'ГОСТ Р МЭК 60825-1',
    minOrderQty: 1,
    leadTimeDays: 7,
  },
  {
    sku: 'GLX-PIPE-09G2S-159',
    name: 'Труба стальная бесшовная г/д 159х8 мм ст. 09Г2С',
    category: 'rolled_metal',
    unit: 'т',
    priceNet: 118500,
    vatRate: 0.22,
    vatEligible: true,
    stock: 420,
    reserved: 35,
    warehouse: 'EKB-URAL-02',
    gost: 'ГОСТ 8732-78',
    minOrderQty: 5,
    leadTimeDays: 3,
  },
  {
    sku: 'GLX-PIPE-09G2S-219',
    name: 'Труба стальная бесшовная г/д 219х10 мм ст. 09Г2С',
    category: 'rolled_metal',
    unit: 'т',
    priceNet: 124000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 310,
    reserved: 20,
    warehouse: 'EKB-URAL-02',
    gost: 'ГОСТ 8732-78',
    minOrderQty: 5,
    leadTimeDays: 3,
  },
  {
    sku: 'GLX-PIPE-09G2S-325',
    name: 'Труба стальная бесшовная нефтегазовая 325х12 мм ст. 09Г2С',
    category: 'rolled_metal',
    unit: 'т',
    priceNet: 132000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 260,
    reserved: 15,
    warehouse: 'KZN-VOLGA-03',
    gost: 'ГОСТ 8732-78',
    minOrderQty: 10,
    leadTimeDays: 4,
  },
  {
    sku: 'GLX-TR-TMG-1000',
    name: 'Трансформатор силовой масляный ТМГ-1000/10-У1 10/0.4 кВ',
    category: 'power_equipment',
    unit: 'шт',
    priceNet: 980000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 28,
    reserved: 3,
    warehouse: 'MSK-SOUTH-04',
    gost: 'ГОСТ Р 52719-2007',
    minOrderQty: 1,
    leadTimeDays: 5,
  },
  {
    sku: 'GLX-TR-TSL-1600',
    name: 'Трансформатор сухой с литой изоляцией ТСЛ-1600/10/0.4',
    category: 'power_equipment',
    unit: 'шт',
    priceNet: 1840000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 16,
    reserved: 2,
    warehouse: 'MSK-SOUTH-04',
    gost: 'ГОСТ Р 54827-2011',
    minOrderQty: 1,
    leadTimeDays: 7,
  },
  {
    sku: 'GLX-TR-KTP-630',
    name: 'Комплектная трансформаторная подстанция КТП-630/10/0.4 У1',
    category: 'power_equipment',
    unit: 'компл',
    priceNet: 1490000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 12,
    reserved: 1,
    warehouse: 'KZN-VOLGA-03',
    gost: 'ГОСТ 14695-90',
    minOrderQty: 1,
    leadTimeDays: 10,
  },
  {
    sku: 'GLX-SRV-RACK42U',
    name: 'Шкаф серверный телекоммуникационный 42U 800х1200 Перфорированный',
    category: 'server_infrastructure',
    unit: 'шт',
    priceNet: 89500,
    vatRate: 0.22,
    vatEligible: true,
    stock: 95,
    reserved: 10,
    warehouse: 'MSK-NORTH-01',
    gost: 'ГОСТ 28601.2-90',
    minOrderQty: 2,
    leadTimeDays: 2,
  },
  {
    sku: 'GLX-SRV-PDU32A',
    name: 'Блок распределения питания интеллектуальный PDU 32A 3-фазный SNMP',
    category: 'server_infrastructure',
    unit: 'шт',
    priceNet: 54000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 150,
    reserved: 12,
    warehouse: 'MSK-NORTH-01',
    gost: 'ГОСТ IEC 60950-1',
    minOrderQty: 2,
    leadTimeDays: 2,
  },
  {
    sku: 'GLX-SRV-UPS20K',
    name: 'ИБП промышленный трёхфазный Online 20 кВА в стойку 19"',
    category: 'server_infrastructure',
    unit: 'шт',
    priceNet: 365000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 34,
    reserved: 4,
    warehouse: 'MSK-NORTH-01',
    gost: 'ГОСТ IEC 62040-3',
    minOrderQty: 1,
    leadTimeDays: 3,
  },
  {
    sku: 'GLX-POLY-HDPE276',
    name: 'Полиэтилен низкого давления в гранулах ПНД 276-73 (выдувной)',
    category: 'polymers',
    unit: 'т',
    priceNet: 146000,
    vatRate: 0.22,
    vatEligible: true,
    stock: 540,
    reserved: 40,
    warehouse: 'KZN-VOLGA-03',
    gost: 'ГОСТ 16338-85',
    minOrderQty: 5,
    leadTimeDays: 3,
  },
  {
    sku: 'GLX-POLY-PP01030',
    name: 'Полипропилен гомополимер в гранулах ПП 01030 Бален',
    category: 'polymers',
    unit: 'т',
    priceNet: 138500,
    vatRate: 0.22,
    vatEligible: true,
    stock: 610,
    reserved: 55,
    warehouse: 'KZN-VOLGA-03',
    gost: 'ГОСТ 26996-86',
    minOrderQty: 5,
    leadTimeDays: 3,
  },
  {
    sku: 'GLX-POLY-PA6-TECH',
    name: 'Полиамид-6 стеклонаполненный гранулированный ПА6-210/310 (лицензия РИД)',
    category: 'polymers',
    unit: 'т',
    priceNet: 295000,
    vatRate: 0.00,
    vatEligible: false,
    stock: 85,
    reserved: 5,
    warehouse: 'KZN-VOLGA-03',
    gost: 'ОСТ 6-06-С9-93',
    minOrderQty: 1,
    leadTimeDays: 5,
  },
]);

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function validateInn(inn) {
  if (typeof inn !== 'string' && typeof inn !== 'number') {
    return { valid: false, reason: 'INN must be a string or number' };
  }
  const normalized = String(inn).trim();
  if (!/^\d{10}(\d{2})?$/.test(normalized)) {
    return {
      valid: false,
      reason: 'INN must contain exactly 10 digits (legal entity) or 12 digits (sole proprietor)',
    };
  }
  if (/^0+$/.test(normalized)) {
    return { valid: false, reason: 'INN cannot be all zeros' };
  }
  return {
    valid: true,
    inn: normalized,
    entityType: normalized.length === 10 ? 'LEGAL_ENTITY_10' : 'SOLE_PROPRIETOR_12',
  };
}

export function calculateVat(priceNet, quantity = 1, vatRate = DEFAULT_VAT_RATE) {
  const unitNet = roundMoney(priceNet);
  const qty = Number(quantity);
  const rate = Number(vatRate);
  const amountNet = roundMoney(unitNet * qty);
  const vatAmount = roundMoney(amountNet * rate);
  const amountTotal = roundMoney(amountNet + vatAmount);
  return {
    unitPriceNet: unitNet,
    quantity: qty,
    vatRate: rate,
    vatPercent: Math.round(rate * 100),
    amountNet,
    vatAmount,
    amountTotal,
  };
}

export function calculateVat22(priceNet, quantity = 1) {
  return calculateVat(priceNet, quantity, 0.22);
}

export function calculateVat20(priceNet, quantity = 1) {
  return calculateVat(priceNet, quantity, 0.20);
}

export function buildGostPaymentQr({ orderId, buyerInn, amountTotal, purpose, vatPercent = 22 }) {
  // GOST R 56042-2014 payment order QR format (ST00012)
  // Sum in kopecks per GOST R 56042-2014 specification
  const sumKopecks = Math.round(roundMoney(amountTotal) * 100);
  const vatDescription = vatPercent > 0 ? `в т.ч. НДС ${vatPercent}%` : 'без НДС (НДС 0%)';
  const paymentPurpose =
    purpose ||
    `Оплата по заказу ${orderId} (накладная М-15), ${vatDescription}. Покупатель ИНН ${buyerInn}`;

  return [
    'ST00012',
    `Name=${SUPPLIER_REQUISITES.name}`,
    `PersonalAcc=${SUPPLIER_REQUISITES.personalAcc}`,
    `BankName=${SUPPLIER_REQUISITES.bankName}`,
    `BIC=${SUPPLIER_REQUISITES.bic}`,
    `CorrespAcc=${SUPPLIER_REQUISITES.correspAcc}`,
    `PayeeINN=${SUPPLIER_REQUISITES.inn}`,
    `KPP=${SUPPLIER_REQUISITES.kpp}`,
    `Sum=${sumKopecks}`,
    `Purpose=${paymentPurpose}`,
    `PayerINN=${buyerInn}`,
    `DocNo=${orderId}`,
  ].join('|');
}

function enrichSku(raw) {
  const availableStock = Math.max(0, Number(raw.stock));
  const vatRate =
    raw.vatEligible === false
      ? 0.0
      : raw.vatRate !== undefined
      ? Number(raw.vatRate)
      : DEFAULT_VAT_RATE;
  const vatCalc = calculateVat(raw.priceNet, 1, vatRate);
  return {
    ...raw,
    availableStock,
    priceGrossVat22: vatCalc.amountTotal,
    priceGrossVat20: roundMoney(raw.priceNet * 1.20),
    vatUnitAmount: vatCalc.vatAmount,
  };
}

export class CatalogStore {
  constructor(options = {}) {
    this.persistPath = options.persistPath || null;
    this.items = new Map();
    this.orders = [];
    this.m15Counter = 1000;
    this.#init();
  }

  #init() {
    if (this.persistPath && fs.existsSync(this.persistPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
        if (Array.isArray(raw.items)) {
          for (const item of raw.items) {
            this.items.set(item.sku, { ...item });
          }
        }
        if (Array.isArray(raw.orders)) {
          this.orders = raw.orders;
        }
        if (typeof raw.m15Counter === 'number') {
          this.m15Counter = raw.m15Counter;
        }
        if (this.items.size > 0) {
          return;
        }
      } catch {
        // Fallback to clean seed if snapshot is unreadable
      }
    }

    for (const skuItem of SEED_SKUS) {
      this.items.set(skuItem.sku, { ...skuItem });
    }
    this.#persist();
  }

  #persist() {
    if (!this.persistPath) return;
    const dir = path.dirname(this.persistPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      this.persistPath,
      JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          m15Counter: this.m15Counter,
          items: Array.from(this.items.values()),
          orders: this.orders,
        },
        null,
        2
      ),
      'utf8'
    );
  }

  listCatalog(filters = {}) {
    const { category, search, vat_only } = filters;
    const vatOnlyBool =
      vat_only === true || vat_only === 'true' || vat_only === '1';

    let list = Array.from(this.items.values()).map(enrichSku);

    if (category && String(category).trim() !== '') {
      const catLower = String(category).trim().toLowerCase();
      list = list.filter((item) => item.category.toLowerCase() === catLower);
    }

    if (search && String(search).trim() !== '') {
      const q = String(search).trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.gost && item.gost.toLowerCase().includes(q))
      );
    }

    if (vatOnlyBool) {
      list = list.filter(
        (item) => item.vatEligible === true && Number(item.vatRate) > 0
      );
    }

    return list;
  }

  getSku(sku) {
    const found = this.items.get(sku);
    return found ? enrichSku(found) : null;
  }

  createSku(payload = {}) {
    const sku = String(payload.sku || '').trim().toUpperCase();
    const name = String(payload.name || '').trim();
    const category = String(payload.category || 'industrial_general').trim();
    const unit = String(payload.unit || 'шт').trim();
    const priceNet = Number(payload.priceNet);
    const stock = Number(payload.stock ?? 0);

    if (!sku || !name) {
      const err = new Error('Fields "sku" and "name" are required');
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isFinite(priceNet) || priceNet <= 0) {
      const err = new Error('Field "priceNet" must be a positive number');
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      const err = new Error('Field "stock" must be a non-negative number');
      err.statusCode = 400;
      throw err;
    }
    if (this.items.has(sku)) {
      const err = new Error(`SKU "${sku}" already exists in catalog`);
      err.statusCode = 409;
      throw err;
    }

    const vatRate =
      payload.vatRate !== undefined ? Number(payload.vatRate) : DEFAULT_VAT_RATE;
    const vatEligible =
      payload.vatEligible !== undefined
        ? Boolean(payload.vatEligible)
        : vatRate > 0;

    const record = {
      sku,
      name,
      category,
      unit,
      priceNet: roundMoney(priceNet),
      vatRate,
      vatEligible,
      stock: Math.floor(stock),
      reserved: Number(payload.reserved || 0),
      warehouse: String(payload.warehouse || 'MSK-NORTH-01'),
      gost: String(payload.gost || 'ГОСТ Р ИСО 9001-2015'),
      minOrderQty: Number(payload.minOrderQty || 1),
      leadTimeDays: Number(payload.leadTimeDays || 5),
    };

    this.items.set(sku, record);
    this.#persist();
    return enrichSku(record);
  }

  reserveOrder(payload = {}) {
    const buyerInn = payload.buyerInn ?? payload.inn;
    const buyerName = String(payload.buyerName || 'ООО "КОНТРАГЕНТ Б2Б"').trim();
    const innCheck = validateInn(buyerInn);
    if (!innCheck.valid) {
      const err = new Error(innCheck.reason);
      err.statusCode = 400;
      err.code = 'INVALID_INN';
      throw err;
    }

    const regime = resolveVatRegime(payload.vat_regime ?? payload.vatRegime);

    const linesInput = Array.isArray(payload.items)
      ? payload.items
      : payload.sku
      ? [{ sku: payload.sku, quantity: payload.quantity ?? 1 }]
      : [];

    if (linesInput.length === 0) {
      const err = new Error('Order reservation requires "sku"/"quantity" or non-empty "items" array');
      err.statusCode = 400;
      err.code = 'EMPTY_ORDER';
      throw err;
    }

    // First pass: validate all items and stock availability atomically
    const validatedLines = [];
    for (const line of linesInput) {
      const skuCode = String(line.sku || '').trim();
      const qty = Number(line.quantity);
      if (!skuCode || !Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        const err = new Error(`Invalid SKU or quantity for "${skuCode}"`);
        err.statusCode = 400;
        err.code = 'INVALID_LINE_ITEM';
        throw err;
      }

      const record = this.items.get(skuCode);
      if (!record) {
        const err = new Error(`SKU "${skuCode}" not found`);
        err.statusCode = 404;
        err.code = 'SKU_NOT_FOUND';
        throw err;
      }

      const available = record.stock;
      if (qty > available) {
        const err = new Error(
          `Insufficient available stock for ${skuCode}: requested ${qty}, available ${available}`
        );
        err.statusCode = 409;
        err.code = 'INSUFFICIENT_STOCK';
        throw err;
      }

      validatedLines.push({ record, qty });
    }

    // Second pass: lock warehouse stock and calculate totals with selected VAT regime (default: 22%)
    let totalNet = 0;
    let totalVat = 0;
    let totalGross = 0;
    const reservedItems = [];

    for (const { record, qty } of validatedLines) {
      record.stock -= qty;
      record.reserved += qty;

      const itemRate = record.vatEligible === false ? 0.0 : regime.rate;
      const calc = calculateVat(record.priceNet, qty, itemRate);
      totalNet = roundMoney(totalNet + calc.amountNet);
      totalVat = roundMoney(totalVat + calc.vatAmount);
      totalGross = roundMoney(totalGross + calc.amountTotal);

      reservedItems.push({
        sku: record.sku,
        name: record.name,
        unit: record.unit,
        warehouse: record.warehouse,
        gost: record.gost,
        quantity: qty,
        unitPriceNet: calc.unitPriceNet,
        vatRegime: regime.code,
        vatRate: itemRate,
        vatPercent: calc.vatPercent,
        amountNet: calc.amountNet,
        vatAmount: calc.vatAmount,
        amountTotal: calc.amountTotal,
        remainingStock: record.stock,
        lockedReserved: record.reserved,
      });
    }

    this.m15Counter += 1;
    const orderId = `GLX-ORD-${this.m15Counter}`;
    const m15DocNumber = `M15-${new Date().getFullYear()}-${this.m15Counter}`;
    const lockToken = `LOCK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const paymentQr = buildGostPaymentQr({
      orderId,
      buyerInn: innCheck.inn,
      amountTotal: totalGross,
      vatPercent: regime.percent,
    });

    const order = {
      orderId,
      status: 'RESERVED_LOCKED',
      createdAt: new Date().toISOString(),
      buyer: {
        inn: innCheck.inn,
        entityType: innCheck.entityType,
        name: buyerName,
      },
      m15Requisition: {
        documentNumber: m15DocNumber,
        formCode: 'ОКУД 0315007 (М-15)',
        stockLocked: true,
        lockToken,
      },
      items: reservedItems,
      pricing: {
        currency: 'RUB',
        vatRegime: regime.code,
        vatRate: regime.rate,
        vatPercent: regime.percent,
        amountNet: totalNet,
        vatAmount: totalVat,
        amountTotal: totalGross,
      },
      payment: {
        standard: 'GOST R 56042-2014',
        formatPrefix: 'ST00012',
        qrPayload: paymentQr,
      },
    };

    this.orders.unshift(order);
    this.#persist();
    return order;
  }

  listOrders() {
    return [...this.orders];
  }
}
