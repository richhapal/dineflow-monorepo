export declare const APP_CONFIG: {
    readonly name: "DineFlow";
    readonly tagline: "The operating system for modern restaurants";
    readonly url: string;
    readonly apiUrl: string;
    readonly supportEmail: "hello@dineflow.app";
    readonly supportWhatsApp: "+919876543210";
};
export declare const PLAN_LIMITS: {
    readonly STARTER: {
        readonly menuItems: 60;
        readonly languages: 5;
        readonly tables: 10;
        readonly staff: 5;
        readonly ordering: false;
        readonly themes: 3;
        readonly analytics: "basic";
    };
    readonly GROWTH: {
        readonly menuItems: -1;
        readonly languages: 26;
        readonly tables: 50;
        readonly staff: 20;
        readonly ordering: true;
        readonly themes: 3;
        readonly analytics: "standard";
    };
    readonly PRO: {
        readonly menuItems: -1;
        readonly languages: 26;
        readonly tables: -1;
        readonly staff: -1;
        readonly ordering: true;
        readonly themes: 6;
        readonly analytics: "advanced";
    };
    readonly ENTERPRISE: {
        readonly menuItems: -1;
        readonly languages: 26;
        readonly tables: -1;
        readonly staff: -1;
        readonly ordering: true;
        readonly themes: 6;
        readonly analytics: "advanced";
    };
};
export declare const GST_RATES: {
    readonly STANDARD: 0.05;
    readonly WITH_LIQUOR: 0.18;
    readonly CATERING: 0.18;
};
export declare const HSN_CODE = "996331";
export declare const TRIAL_DAYS = 30;
export declare const IMAGE_LIMITS: {
    readonly maxSizeMB: 10;
    readonly allowedMimeTypes: readonly ["image/jpeg", "image/png", "image/webp"];
    readonly maxWidthPx: 1200;
    readonly webpQuality: 85;
};
export declare const WEBSOCKET_EVENTS: {
    readonly ORDER_NEW: "order:new";
    readonly ORDER_STATUS: "order:status";
    readonly ORDER_ITEM_ADDED: "order:item_added";
    readonly SESSION_JOIN_REQUEST: "session:join_request";
    readonly SESSION_MEMBER_APPROVED: "session:member_approved";
    readonly SESSION_MEMBER_REJECTED: "session:member_rejected";
    readonly SESSION_MEMBER_ORDERED: "session:member_ordered";
    readonly SESSION_HOST_CHANGED: "session:host_changed";
    readonly SESSION_BILL_REQUESTED: "session:bill_requested";
    readonly TABLE_STATUS: "table:status";
    readonly RESTAURANT_STATUS: "restaurant:status";
};
export declare const SOCKET_ROOMS: {
    readonly restaurantOrders: (id: string) => string;
    readonly restaurantKitchen: (id: string) => string;
    readonly restaurantWaiters: (id: string) => string;
    readonly restaurantDashboard: (id: string) => string;
    readonly order: (id: string) => string;
    readonly session: (id: string) => string;
    readonly sessionHost: (id: string) => string;
};
//# sourceMappingURL=index.d.ts.map