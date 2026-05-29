// Shared config constants used across all apps

export const APP_CONFIG = {
  name: 'DineFlow',
  tagline: 'The operating system for modern restaurants',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://dineflow.app',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  supportEmail: 'hello@dineflow.app',
  supportWhatsApp: '+919876543210',
} as const;

export const PLAN_LIMITS = {
  STARTER: {
    menuItems: 60,
    languages: 5,
    tables: 10,
    staff: 5,
    ordering: false,
    themes: 3,
    analytics: 'basic',
  },
  GROWTH: {
    menuItems: -1, // unlimited
    languages: 26,
    tables: 50,
    staff: 20,
    ordering: true,
    themes: 3,
    analytics: 'standard',
  },
  PRO: {
    menuItems: -1,
    languages: 26,
    tables: -1,
    staff: -1,
    ordering: true,
    themes: 6,
    analytics: 'advanced',
  },
  ENTERPRISE: {
    menuItems: -1,
    languages: 26,
    tables: -1,
    staff: -1,
    ordering: true,
    themes: 6,
    analytics: 'advanced',
  },
} as const;

export const GST_RATES = {
  STANDARD: 0.05,    // 5%  — dine-in without liquor
  WITH_LIQUOR: 0.18, // 18% — with liquor licence
  CATERING: 0.18,    // 18% — outdoor catering
} as const;

export const HSN_CODE = '996331'; // Restaurant services SAC code

export const TRIAL_DAYS = 30;

export const IMAGE_LIMITS = {
  maxSizeMB: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxWidthPx: 1200,
  webpQuality: 85,
} as const;

export const WEBSOCKET_EVENTS = {
  // Order events
  ORDER_NEW: 'order:new',
  ORDER_STATUS: 'order:status',
  ORDER_ITEM_ADDED: 'order:item_added',
  // Table session events  
  SESSION_JOIN_REQUEST: 'session:join_request',
  SESSION_MEMBER_APPROVED: 'session:member_approved',
  SESSION_MEMBER_REJECTED: 'session:member_rejected',
  SESSION_MEMBER_ORDERED: 'session:member_ordered',
  SESSION_HOST_CHANGED: 'session:host_changed',
  SESSION_BILL_REQUESTED: 'session:bill_requested',
  // Table events
  TABLE_STATUS: 'table:status',
  // Restaurant events
  RESTAURANT_STATUS: 'restaurant:status',
} as const;

export const SOCKET_ROOMS = {
  restaurantOrders: (id: string) => `restaurant:${id}:orders`,
  restaurantKitchen: (id: string) => `restaurant:${id}:kitchen`,
  restaurantWaiters: (id: string) => `restaurant:${id}:waiters`,
  restaurantDashboard: (id: string) => `restaurant:${id}:dashboard`,
  order: (id: string) => `order:${id}`,
  session: (id: string) => `session:${id}`,
  sessionHost: (id: string) => `session:${id}:host`,
} as const;
