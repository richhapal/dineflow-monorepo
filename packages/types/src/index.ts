// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SubscriptionPlan {
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  ROOM_SERVICE = 'ROOM_SERVICE',
  TAKEAWAY = 'TAKEAWAY',
  WAITER_PLACED = 'WAITER_PLACED',
}

export enum PaymentMethod {
  UPI = 'UPI',
  CASH = 'CASH',
  CARD = 'CARD',
  ONLINE = 'ONLINE',
  COMPLIMENTARY = 'COMPLIMENTARY',
}

export enum StaffRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  WAITER = 'WAITER',
  KITCHEN = 'KITCHEN',
  CASHIER = 'CASHIER',
}

export enum FoodType {
  VEG = 'VEG',
  NON_VEG = 'NON_VEG',
  VEGAN = 'VEGAN',
  EGG = 'EGG',
  CONTAINS_ALCOHOL = 'CONTAINS_ALCOHOL',
}

export enum OrderingMode {
  SELF = 'SELF',
  WAITER = 'WAITER',
  HYBRID = 'HYBRID',
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  BILL_REQUESTED = 'BILL_REQUESTED',
  CLEANING = 'CLEANING',
}

// ─── Restaurant ───────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  timezone: string;
  gstin?: string;
  fssai_number?: string;
  gst_rate: number;
  upi_id?: string;
  logo_public_id?: string;
  hero_public_id?: string;
  active_theme_id?: string;
  theme_config?: ThemeConfig;
  default_language: string;
  enabled_languages: string[];
  is_ordering_enabled: boolean;
  is_open: boolean;
  is_disabled: boolean;
  disabled_reason?: string;
  is_ordering_paused: boolean;
  ordering_mode: OrderingMode;
  plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ThemeConfig {
  id: string;
  bg: string;
  card: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
  btnText: string;
  font: string;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  image_public_id?: string;
  sort_order: number;
  is_active: boolean;
  translations: MenuTranslation[];
  items?: MenuItem[];
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string;
  image_public_id?: string;
  base_price: number;
  food_type: FoodType;
  tags: string[];
  allergens: string[];
  calories?: number;
  prep_time_mins?: number;
  is_available: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  sort_order: number;
  translations: MenuTranslation[];
  variants: MenuItemVariant[];
  addon_groups: AddonGroup[];
}

export interface MenuTranslation {
  lang_code: string;
  name: string;
  description?: string;
  is_ai: boolean;
}

export interface MenuItemVariant {
  id: string;
  item_id: string;
  name: string;
  price: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface AddonGroup {
  id: string;
  item_id: string;
  name: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  addons: Addon[];
}

export interface Addon {
  id: string;
  group_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  restaurant_id: string;
  table_id?: string;
  room_id?: string;
  waiter_id?: string;
  order_type: OrderType;
  status: OrderStatus;
  customer_name?: string;
  customer_phone?: string;
  customer_lang: string;
  covers: number;
  notes?: string;
  idempotency_key: string;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  service_charge: number;
  discount_amount: number;
  total_amount: number;
  items: OrderItem[];
  confirmed_at?: string;
  prepared_at?: string;
  served_at?: string;
  completed_at?: string;
  estimated_ready?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_name: string;
  notes?: string;
  is_cancelled: boolean;
  addons: OrderItemAddon[];
}

export interface OrderItemAddon {
  addon_id: string;
  addon_name: string;
  price: number;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface Staff {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  email?: string;
  role: StaffRole;
  salary_type: string;
  salary_amount: number;
  is_active: boolean;
  joined_at: string;
}

// ─── WebSocket events ────────────────────────────────────────────────────────

export interface WsOrderNew {
  order: Order;
  restaurant_id: string;
}

export interface WsOrderStatusUpdate {
  order_id: string;
  status: OrderStatus;
  restaurant_id: string;
  updated_at: string;
}

export interface WsSessionJoinRequest {
  session_id: string;
  member_id: string;
  name: string;
}

export interface WsTableStatusUpdate {
  table_id: string;
  status: TableStatus;
  restaurant_id: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ─── Availability ─────────────────────────────────────────────────────────────

export type AvailabilityState =
  | 'OPEN'
  | 'CLOSED'
  | 'DISABLED'
  | 'HOLIDAY'
  | 'WEEKLY_OFF'
  | 'BREAK'
  | 'ORDERING_PAUSED'
  | 'SUBSCRIPTION_LAPSED';

export interface AvailabilityResult {
  state: AvailabilityState;
  message?: string;
  opens_at?: string;
  closes_at?: string;
  next_open?: string;
  resumes_at?: string;
  reason?: string;
  reopen?: string;
}
