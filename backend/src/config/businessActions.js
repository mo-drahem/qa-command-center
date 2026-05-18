/**
 * Business Scenarios action catalog.
 * Step-backed cart/sale actions delegate to fastTrackRegistry; bodies from examples/.
 */
const BUSINESS_ACTIONS = [
  // Rules & MDR
  {
    id: 'createNewRule',
    title: 'Create new rule',
    category: 'rules',
    description: 'POST pricing-core /rule',
    requiresRuntime: [],
  },
  {
    id: 'updateExistingRule',
    title: 'Update existing rule',
    category: 'rules',
    description: 'PUT pricing-core /rule/{ruleId}',
    requiresRuntime: ['ruleId'],
  },
  {
    id: 'addMdrToRule',
    title: 'Add MDR to rule',
    category: 'rules',
    description: 'POST MDR on an existing rule',
    requiresRuntime: ['ruleId'],
  },
  {
    id: 'getMdrOfRule',
    title: 'Get MDR of rule',
    category: 'rules',
    description:
      'GET pricing-mdr /mdr/export-csv/{rule-id} — rule-id is 24-char hex (e.g. 6a0996c6f81d20586f29f59c)',
    requiresRuntime: ['ruleId'],
  },
  // Cart — discrete steps (Bruno / fast-track collection)
  {
    id: 'createEmptyCart',
    title: 'Create empty cart (flight)',
    category: 'cart',
    description: 'POST /cart — empty manual flight cart',
    requiresRuntime: [],
    fastTrackStepId: 'createEmptyCart',
  },
  {
    id: 'createEmptyCartHotel',
    title: 'Create empty cart (hotel)',
    category: 'cart',
    description: 'POST /cart — empty manual hotel cart',
    requiresRuntime: [],
    fastTrackStepId: 'createEmptyCartHotel',
  },
  {
    id: 'addFlightProductToCart',
    title: 'Add flight product to cart',
    category: 'cart',
    description: 'POST /cart/{cartId}/product — body from examples/add-product-to-cart.json',
    requiresRuntime: ['cartId'],
    fastTrackStepId: 'addFlightProduct',
  },
  {
    id: 'addHotelProductToCart',
    title: 'Add hotel product to cart',
    category: 'cart',
    description: 'POST /cart/{cartId}/product — body from examples/add-hotel-product-to-cart.json',
    requiresRuntime: ['cartId'],
    fastTrackStepId: 'addHotelProduct',
  },
  {
    id: 'applyCouponToCart',
    title: 'Apply coupon on cart',
    category: 'cart',
    description: 'POST /cart/{cartId}/apply/on-cart',
    requiresRuntime: ['cartId'],
    fastTrackStepId: 'applyCouponToCart',
  },
  {
    id: 'prepareCart',
    title: 'Prepare cart',
    category: 'cart',
    description: 'GET /cart/{cartId}/prepare',
    requiresRuntime: ['cartId'],
    fastTrackStepId: 'prepareCart',
  },
  {
    id: 'checkoutCart',
    title: 'Checkout cart',
    category: 'cart',
    description: 'POST /cart/{cartId}/checkout — body from examples/prepare-checkout.json',
    requiresRuntime: ['cartId'],
    fastTrackStepId: 'checkoutCart',
  },
  // Cart — composites
  {
    id: 'createCartWithFlightProduct',
    title: 'Create cart + flight product',
    category: 'cart',
    description: 'POST /cart/newCartWithProduct — flight body from examples/new-cart-with-product-flight.json',
    requiresRuntime: [],
  },
  {
    id: 'createCartWithHotelProduct',
    title: 'Create cart + hotel product',
    category: 'cart',
    description: 'POST /cart/newCartWithProduct — hotel body from examples/new-cart-with-product-hotel.json',
    requiresRuntime: [],
  },
  {
    id: 'createCartWithCoupon',
    title: 'Create cart + flight + coupon',
    category: 'cart',
    description: 'Create cart, add flight product, apply coupon (3 steps)',
    requiresRuntime: [],
    composite: ['createEmptyCart', 'addFlightProduct', 'applyCouponToCart'],
  },
  {
    id: 'prepareAndCheckoutCart',
    title: 'Prepare and checkout cart',
    category: 'cart',
    description: 'GET prepare then POST checkout on cart',
    requiresRuntime: ['cartId'],
    composite: ['prepareCart', 'checkoutCart'],
  },
  // Sale
  {
    id: 'createSaleWithFlightProduct',
    title: 'Create sale with flight product',
    category: 'sale',
    description: 'POST /sale/create-list-products (flight)',
    requiresRuntime: [],
    fastTrackStepId: 'createSaleWithFlightProduct',
  },
  {
    id: 'createSaleWithHotelProduct',
    title: 'Create sale with hotel product',
    category: 'sale',
    description: 'POST /sale/create-list-products (hotel)',
    requiresRuntime: [],
    fastTrackStepId: 'createSaleWithHotelProduct',
  },
  {
    id: 'prepareSale',
    title: 'Prepare sale checkout',
    category: 'sale',
    description: 'POST /sale/{saleId}/prepare',
    requiresRuntime: ['saleId'],
    fastTrackStepId: 'prepareSaleCheckout',
  },
  {
    id: 'checkoutSale',
    title: 'Checkout sale',
    category: 'sale',
    description: 'POST /sale/{saleId}/checkout',
    requiresRuntime: ['saleId'],
    fastTrackStepId: 'checkoutSale',
  },
  {
    id: 'prepareAndCheckoutSale',
    title: 'Prepare and checkout sale',
    category: 'sale',
    description: 'POST prepare then POST checkout on sale',
    requiresRuntime: ['saleId'],
    composite: ['prepareSaleCheckout', 'checkoutSale'],
  },
];

const BUSINESS_ACTION_CATEGORIES = [
  { id: 'rules', label: 'Rules & MDR' },
  { id: 'cart', label: 'Cart' },
  { id: 'sale', label: 'Sale' },
];

module.exports = { BUSINESS_ACTIONS, BUSINESS_ACTION_CATEGORIES };
