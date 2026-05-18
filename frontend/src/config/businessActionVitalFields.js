/**
 * Vital fields per action — synced into headers or request body.
 */
const HEADER_FIELDS = [
  { id: 'appId', label: 'app-id', target: 'header', key: 'app-id' },
  { id: 'currency', label: 'x-currency', target: 'header', key: 'x-currency' },
  { id: 'userEmail', label: 'x-user-email', target: 'header', key: 'x-user-email' },
  { id: 'userId', label: 'x-user-id', target: 'header', key: 'x-user-id' },
];

const CART_HEADER_FIELDS = [...HEADER_FIELDS];

const CHECKOUT_BODY_FIELDS = [
  { id: 'total', label: 'Total', target: 'body', path: ['total'] },
  { id: 'paymentMethod', label: 'Payment method', target: 'body', path: ['payment', 'paymentMethod'] },
  { id: 'checkoutType', label: 'type', target: 'body', path: ['type'] },
];

const COUPON_BODY_FIELDS = [
  { id: 'couponCode', label: 'couponCode', target: 'body', path: ['couponCode'] },
  { id: 'couponLockId', label: 'couponLockId', target: 'body', path: ['couponLockId'] },
];

/** @type {Record<string, Array<{ id: string, label: string, target: 'header'|'body', key?: string, path?: string[] }>>} */
export const VITAL_FIELDS_BY_ACTION = {
  createNewRule: [
    { id: 'clientId', label: 'client-id', target: 'header', key: 'client-id' },
    { id: 'ruleCode', label: 'code', target: 'body', path: ['code'] },
    { id: 'ruleName', label: 'name', target: 'body', path: ['name'] },
    { id: 'description', label: 'description', target: 'body', path: ['description'] },
    { id: 'promotionType', label: 'promotionType', target: 'body', path: ['promotionType'] },
    { id: 'ruleType', label: 'ruleType', target: 'body', path: ['ruleType'] },
    { id: 'entityId', label: 'entityId', target: 'body', path: ['entityId'] },
    { id: 'actionAmount', label: 'action.amount', target: 'body', path: ['action', 'amount'] },
    { id: 'actionLabel', label: 'action.label', target: 'body', path: ['action', 'label'] },
    { id: 'mdrEnabled', label: 'mdrEnabled', target: 'body', path: ['mdrEnabled'] },
  ],
  updateExistingRule: [
    { id: 'clientId', label: 'client-id', target: 'header', key: 'client-id' },
    { id: 'ruleCode', label: 'code', target: 'body', path: ['code'] },
    { id: 'ruleName', label: 'name', target: 'body', path: ['name'] },
  ],
  addMdrToRule: [{ id: 'clientId', label: 'client-id', target: 'header', key: 'client-id' }],
  getMdrOfRule: [{ id: 'accept', label: 'Accept', target: 'header', key: 'Accept' }],

  createEmptyCart: [...CART_HEADER_FIELDS, { id: 'cartType', label: 'type', target: 'body', path: ['type'] }],
  createEmptyCartHotel: [...CART_HEADER_FIELDS, { id: 'cartType', label: 'type', target: 'body', path: ['type'] }],
  addFlightProductToCart: CART_HEADER_FIELDS,
  addHotelProductToCart: CART_HEADER_FIELDS,
  applyCouponToCart: [...CART_HEADER_FIELDS, ...COUPON_BODY_FIELDS],
  prepareCart: [{ id: 'appId', label: 'app-id', target: 'header', key: 'app-id' }],
  checkoutCart: [...CART_HEADER_FIELDS, ...CHECKOUT_BODY_FIELDS],

  createCartWithFlightProduct: [
    ...CART_HEADER_FIELDS,
    { id: 'entityId', label: 'x-entity-id', target: 'header', key: 'x-entity-id' },
    { id: 'userPhone', label: 'x-user-phone', target: 'header', key: 'x-user-phone' },
    { id: 'cartType', label: 'type', target: 'body', path: ['type'] },
    { id: 'contactEmail', label: 'contact.email', target: 'body', path: ['contact', 'email'] },
    { id: 'paymentMethod', label: 'payment.method', target: 'body', path: ['payment', 'method'] },
  ],
  createCartWithHotelProduct: [
    ...CART_HEADER_FIELDS,
    { id: 'entityId', label: 'x-entity-id', target: 'header', key: 'x-entity-id' },
    { id: 'userPhone', label: 'x-user-phone', target: 'header', key: 'x-user-phone' },
    { id: 'cartType', label: 'type', target: 'body', path: ['type'] },
    { id: 'contactEmail', label: 'contact.email', target: 'body', path: ['contact', 'email'] },
    { id: 'paymentMethod', label: 'payment.method', target: 'body', path: ['payment', 'method'] },
  ],
  createCartWithCoupon: [...CART_HEADER_FIELDS, ...COUPON_BODY_FIELDS],
  prepareAndCheckoutCart: [...CART_HEADER_FIELDS, ...CHECKOUT_BODY_FIELDS],

  createSaleWithFlightProduct: [
    ...HEADER_FIELDS,
    { id: 'contactEmail', label: 'Contact email', target: 'body', path: ['contact', 'email'] },
    { id: 'paymentMethod', label: 'Payment method', target: 'body', path: ['payment', 'paymentMethod'] },
  ],
  createSaleWithHotelProduct: [
    ...HEADER_FIELDS,
    { id: 'contactEmail', label: 'Contact email', target: 'body', path: ['contact', 'email'] },
    { id: 'paymentMethod', label: 'Payment method', target: 'body', path: ['payment', 'paymentMethod'] },
  ],
  prepareSale: [...HEADER_FIELDS, ...CHECKOUT_BODY_FIELDS],
  checkoutSale: [...CHECKOUT_BODY_FIELDS],
  prepareAndCheckoutSale: [...CHECKOUT_BODY_FIELDS],
};

export function getVitalFieldsForAction(actionId) {
  return VITAL_FIELDS_BY_ACTION[actionId] || HEADER_FIELDS;
}
