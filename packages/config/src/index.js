"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_ROOMS = exports.WEBSOCKET_EVENTS = exports.IMAGE_LIMITS = exports.TRIAL_DAYS = exports.HSN_CODE = exports.GST_RATES = exports.PLAN_LIMITS = exports.APP_CONFIG = void 0;
exports.APP_CONFIG = {
    name: 'DineFlow',
    tagline: 'The operating system for modern restaurants',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://dineflow.app',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    supportEmail: 'hello@dineflow.app',
    supportWhatsApp: '+919876543210',
};
exports.PLAN_LIMITS = {
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
        menuItems: -1,
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
};
exports.GST_RATES = {
    STANDARD: 0.05,
    WITH_LIQUOR: 0.18,
    CATERING: 0.18,
};
exports.HSN_CODE = '996331';
exports.TRIAL_DAYS = 30;
exports.IMAGE_LIMITS = {
    maxSizeMB: 10,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxWidthPx: 1200,
    webpQuality: 85,
};
exports.WEBSOCKET_EVENTS = {
    ORDER_NEW: 'order:new',
    ORDER_STATUS: 'order:status',
    ORDER_ITEM_ADDED: 'order:item_added',
    SESSION_JOIN_REQUEST: 'session:join_request',
    SESSION_MEMBER_APPROVED: 'session:member_approved',
    SESSION_MEMBER_REJECTED: 'session:member_rejected',
    SESSION_MEMBER_ORDERED: 'session:member_ordered',
    SESSION_HOST_CHANGED: 'session:host_changed',
    SESSION_BILL_REQUESTED: 'session:bill_requested',
    TABLE_STATUS: 'table:status',
    RESTAURANT_STATUS: 'restaurant:status',
};
exports.SOCKET_ROOMS = {
    restaurantOrders: (id) => `restaurant:${id}:orders`,
    restaurantKitchen: (id) => `restaurant:${id}:kitchen`,
    restaurantWaiters: (id) => `restaurant:${id}:waiters`,
    restaurantDashboard: (id) => `restaurant:${id}:dashboard`,
    order: (id) => `order:${id}`,
    session: (id) => `session:${id}`,
    sessionHost: (id) => `session:${id}:host`,
};
//# sourceMappingURL=index.js.map