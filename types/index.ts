// Shared response types: the single contract between API route handlers and the UI.

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_SORT_FIELDS = ['created_at', 'total', 'customer_name'] as const;
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  createdAt: string;
}

export interface OrderSummary {
  id: number;
  customerName: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface Kpis {
  revenueToday: number;
  ordersToday: number;
  averageOrderValue: number;
  pendingOrders: number;
  generatedAt: string;
}

export interface RecentOrdersResponse {
  orders: OrderSummary[];
  generatedAt: string;
}

export interface OrdersQuery {
  status?: OrderStatus;
  from?: string;
  to?: string;
  q?: string;
  page: number;
  pageSize: number;
  sort: OrderSortField;
  dir: SortDirection;
}

export interface OrdersPage {
  items: OrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RevenueBucket {
  /** ISO timestamp of the start of the hour. */
  hourStart: string;
  revenue: number;
  orders: number;
}

export interface RevenueSeries {
  buckets: RevenueBucket[];
  total: number;
  generatedAt: string;
}

export interface HeatmapDay {
  /** Store-local calendar date, YYYY-MM-DD. */
  date: string;
  /** Short weekday label, e.g. "Sat". */
  label: string;
  /** 24 order counts, index = store-local hour. */
  counts: number[];
}

export interface Heatmap {
  days: HeatmapDay[];
  max: number;
  generatedAt: string;
}

export interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
}

export interface LowStockResponse {
  products: LowStockProduct[];
  generatedAt: string;
}

export interface SimulateResult {
  created: number;
  orders: OrderSummary[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryAfterSeconds?: number;
  };
}
