// Deterministic synthetic data for a fictional lifestyle/apparel store.
// One generator feeds both the in-memory mock repository and scripts/seed.ts,
// so mock mode and a freshly seeded Neon database show the same shop.
// (The seed CLI runs with --conditions=react-server, so `server-only` resolves to a no-op there.)

import 'server-only';
import type { OrderStatus } from '@/types';
import { DAY_MS, zonedParts } from '@/lib/time';
import { roundMoney } from '@/lib/money';

export type Rng = () => number;

/** mulberry32: tiny, fast, seedable PRNG (not for cryptography; only synthetic data). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const randomInt = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick() needs a non-empty list');
  return item;
}


export interface FakeProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  createdAt: Date;
}

export interface FakeOrder {
  id: number;
  customerName: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
}

export interface FakeOrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface FakeDataset {
  products: FakeProduct[];
  orders: FakeOrder[];
  items: FakeOrderItem[];
}

export interface LineItemDraft {
  productId: number;
  quantity: number;
  unitPrice: number;
}

// [name, category code, price]
const CATALOG: ReadonlyArray<readonly [string, string, number]> = [
  ['Driftwood Linen Shirt', 'TOP', 68],
  ['Harbor Canvas Tote', 'BAG', 42],
  ['Cloudstep Knit Runner', 'SHO', 124],
  ['Tidepool Organic Tee', 'TOP', 29],
  ['Sierra Fleece Pullover', 'TOP', 89],
  ['Meadow Wide-Leg Trouser', 'BTM', 78],
  ['Saltmarsh Chore Jacket', 'OUT', 148],
  ['Lagoon Swim Short', 'BTM', 45],
  ['Pinecone Wool Beanie', 'ACC', 24],
  ['Brookside Denim Jacket', 'OUT', 132],
  ['Aurora Ribbed Tank', 'TOP', 26],
  ['Juniper Cargo Pant', 'BTM', 84],
  ['Seaglass Recycled Bottle', 'LIF', 32],
  ['Fern Leather Card Wallet', 'ACC', 38],
  ['Coastline Rain Shell', 'OUT', 169],
  ['Willow Merino Crew Sock', 'ACC', 18],
  ['Canyon Suede Chelsea Boot', 'SHO', 189],
  ['Lumen Bamboo Sunglasses', 'ACC', 58],
  ['Orchard Cotton Hoodie', 'TOP', 72],
  ['Riverstone Daypack', 'BAG', 96],
  ['Prairie Linen Dress', 'DRS', 112],
  ['Glacier Puffer Vest', 'OUT', 118],
  ['Marigold Silk Scarf', 'ACC', 46],
  ['Dune Leather Sandal', 'SHO', 74],
  ['Evergreen Yoga Legging', 'BTM', 64],
  ['Cove Waffle Robe', 'LIF', 88],
  ['Summit Trail Cap', 'ACC', 28],
  ['Horizon Oxford Shirt', 'TOP', 76],
  ['Reef Ceramic Mug Set', 'LIF', 36],
  ['Nimbus Weekender Duffel', 'BAG', 154],
];

const FIRST_NAMES = [
  'Ava', 'Noah', 'Mia', 'Liam', 'Sofia', 'Arjun', 'Yuki', 'Mateo', 'Amara', 'Lucas',
  'Chloe', 'Kenji', 'Zara', 'Ethan', 'Priya', 'Omar', 'Elena', 'Kai', 'Nadia', 'Leo',
  'Hana', 'Diego', 'Isla', 'Rafael', 'Maya', 'Tariq', 'Freya', 'Jonas', 'Ines', 'Dewi',
] as const;

const LAST_NAMES = [
  'Hartono', 'Nguyen', 'Okafor', 'Silva', 'Tanaka', 'Rossi', 'Kowalski', 'Haddad', 'Larsen', 'Moreau',
  'Patel', 'Garcia', 'Schmidt', 'Kim', 'Andersson', 'Santoso', 'Mensah', 'Fischer', 'Novak', 'Reyes',
] as const;

// Relative order volume per store-local hour: quiet nights, lunch bump, evening peak.
const HOUR_WEIGHTS = [
  0.15, 0.08, 0.05, 0.04, 0.05, 0.1, 0.25, 0.45, 0.65, 0.8, 0.9, 1.0,
  1.05, 0.95, 0.85, 0.85, 0.9, 1.0, 1.2, 1.35, 1.3, 1.05, 0.7, 0.35,
] as const;
const MAX_HOUR_WEIGHT = Math.max(...HOUR_WEIGHTS);

export const SEED = 20_241_028;
export const PRODUCT_COUNT = CATALOG.length;
export const ORDER_COUNT = 300;
const LOW_STOCK_PRODUCT_IDS = new Set([3, 9, 17, 23]);

export function randomCustomerName(rng: Rng): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

/** 1–3 distinct products with small quantities, priced at the current catalogue price. */
export function buildLineItems(
  rng: Rng,
  products: ReadonlyArray<Pick<FakeProduct, 'id' | 'price'>>,
): LineItemDraft[] {
  const wanted = Math.min(products.length, rng() < 0.6 ? 1 : randomInt(rng, 2, 3));
  const chosen = new Map<number, LineItemDraft>();
  while (chosen.size < wanted) {
    const product = pick(rng, products);
    if (!chosen.has(product.id)) {
      chosen.set(product.id, { productId: product.id, quantity: rng() < 0.8 ? 1 : 2, unitPrice: product.price });
    }
  }
  return [...chosen.values()];
}

export const lineItemsTotal = (items: readonly LineItemDraft[]): number =>
  roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));

function statusForAge(rng: Rng, ageMs: number): OrderStatus {
  const roll = rng();
  if (ageMs < 2 * 3_600_000) return roll < 0.55 ? 'pending' : 'paid';
  if (ageMs < DAY_MS) {
    if (roll < 0.2) return 'pending';
    if (roll < 0.75) return 'paid';
    return roll < 0.95 ? 'shipped' : 'cancelled';
  }
  if (roll < 0.03) return 'pending';
  if (roll < 0.22) return 'paid';
  return roll < 0.93 ? 'shipped' : 'cancelled';
}

function buildProducts(rng: Rng, now: Date): FakeProduct[] {
  return CATALOG.map(([name, category, price], index) => {
    const id = index + 1;
    const lowStockThreshold = pick(rng, [8, 10, 12, 15]);
    const stock = LOW_STOCK_PRODUCT_IDS.has(id)
      ? randomInt(rng, 1, lowStockThreshold - 2)
      : randomInt(rng, lowStockThreshold + 15, 180);
    return {
      id,
      name,
      sku: `PUL-${category}-${String(id).padStart(3, '0')}`,
      price,
      stock,
      lowStockThreshold,
      imageUrl: null,
      createdAt: new Date(now.getTime() - (60 - index) * DAY_MS),
    };
  });
}

/** Rejection sampling over the last 7 days, weighted by store-local hour. */
function sampleOrderTimes(rng: Rng, now: Date, count: number): Date[] {
  const start = now.getTime() - 7 * DAY_MS;
  const times: number[] = [];
  while (times.length < count) {
    const candidate = start + rng() * (now.getTime() - start);
    const weight = HOUR_WEIGHTS[zonedParts(new Date(candidate)).hour] ?? 0;
    if (rng() * MAX_HOUR_WEIGHT < weight) times.push(Math.floor(candidate));
  }
  return times.sort((a, b) => a - b).map((ms) => new Date(ms));
}

export function generateDataset(now: Date = new Date(), seed: number = SEED): FakeDataset {
  const rng = createRng(seed);
  const products = buildProducts(rng, now);
  const orders: FakeOrder[] = [];
  const items: FakeOrderItem[] = [];

  sampleOrderTimes(rng, now, ORDER_COUNT).forEach((createdAt, index) => {
    const orderId = index + 1;
    const lines = buildLineItems(rng, products);
    for (const line of lines) {
      items.push({ id: items.length + 1, orderId, ...line });
    }
    orders.push({
      id: orderId,
      customerName: randomCustomerName(rng),
      status: statusForAge(rng, now.getTime() - createdAt.getTime()),
      total: lineItemsTotal(lines),
      createdAt,
    });
  });

  return { products, orders, items };
}
