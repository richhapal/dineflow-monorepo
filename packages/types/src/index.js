"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableStatus = exports.OrderingMode = exports.FoodType = exports.StaffRole = exports.PaymentMethod = exports.OrderType = exports.OrderStatus = exports.SubscriptionStatus = exports.SubscriptionPlan = void 0;
var SubscriptionPlan;
(function (SubscriptionPlan) {
    SubscriptionPlan["STARTER"] = "STARTER";
    SubscriptionPlan["GROWTH"] = "GROWTH";
    SubscriptionPlan["PRO"] = "PRO";
    SubscriptionPlan["ENTERPRISE"] = "ENTERPRISE";
})(SubscriptionPlan || (exports.SubscriptionPlan = SubscriptionPlan = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["TRIAL"] = "TRIAL";
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["PAST_DUE"] = "PAST_DUE";
    SubscriptionStatus["CANCELLED"] = "CANCELLED";
    SubscriptionStatus["PAUSED"] = "PAUSED";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["PREPARING"] = "PREPARING";
    OrderStatus["READY"] = "READY";
    OrderStatus["SERVED"] = "SERVED";
    OrderStatus["COMPLETED"] = "COMPLETED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var OrderType;
(function (OrderType) {
    OrderType["DINE_IN"] = "DINE_IN";
    OrderType["ROOM_SERVICE"] = "ROOM_SERVICE";
    OrderType["TAKEAWAY"] = "TAKEAWAY";
    OrderType["WAITER_PLACED"] = "WAITER_PLACED";
})(OrderType || (exports.OrderType = OrderType = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["UPI"] = "UPI";
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["ONLINE"] = "ONLINE";
    PaymentMethod["COMPLIMENTARY"] = "COMPLIMENTARY";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var StaffRole;
(function (StaffRole) {
    StaffRole["OWNER"] = "OWNER";
    StaffRole["ADMIN"] = "ADMIN";
    StaffRole["MANAGER"] = "MANAGER";
    StaffRole["WAITER"] = "WAITER";
    StaffRole["KITCHEN"] = "KITCHEN";
    StaffRole["CASHIER"] = "CASHIER";
})(StaffRole || (exports.StaffRole = StaffRole = {}));
var FoodType;
(function (FoodType) {
    FoodType["VEG"] = "VEG";
    FoodType["NON_VEG"] = "NON_VEG";
    FoodType["VEGAN"] = "VEGAN";
    FoodType["EGG"] = "EGG";
    FoodType["CONTAINS_ALCOHOL"] = "CONTAINS_ALCOHOL";
})(FoodType || (exports.FoodType = FoodType = {}));
var OrderingMode;
(function (OrderingMode) {
    OrderingMode["SELF"] = "SELF";
    OrderingMode["WAITER"] = "WAITER";
    OrderingMode["HYBRID"] = "HYBRID";
})(OrderingMode || (exports.OrderingMode = OrderingMode = {}));
var TableStatus;
(function (TableStatus) {
    TableStatus["AVAILABLE"] = "AVAILABLE";
    TableStatus["OCCUPIED"] = "OCCUPIED";
    TableStatus["RESERVED"] = "RESERVED";
    TableStatus["BILL_REQUESTED"] = "BILL_REQUESTED";
    TableStatus["CLEANING"] = "CLEANING";
})(TableStatus || (exports.TableStatus = TableStatus = {}));
//# sourceMappingURL=index.js.map