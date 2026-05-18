/** Fast-track scenario catalog (UI step groups). */
const FAST_TRACK_SCENARIOS = [
  {
    id: 'scenario1',
    title: 'Scenario 1 - Cart + Flight',
    steps: [{ id: 'newCartWithFlightProduct', title: 'Create Cart With Flight Product' }],
  },
  {
    id: 'scenario2',
    title: 'Scenario 2 - Cart + Hotel',
    steps: [{ id: 'newCartWithHotelProduct', title: 'Create Cart With Hotel Product' }],
  },
  {
    id: 'scenario3',
    title: 'Scenario 3 - Sale + Flight',
    steps: [
      { id: 'createSaleWithFlightProduct', title: 'Create Sale With Flight Product' },
      { id: 'prepareSaleCheckout', title: 'Prepare To Checkout' },
      { id: 'checkoutSale', title: 'Checkout Sale' },
    ],
  },
  {
    id: 'scenario4',
    title: 'Scenario 4 - Sale + Hotel',
    steps: [
      { id: 'createSaleWithHotelProduct', title: 'Create Sale With Hotel Product' },
      { id: 'prepareSaleCheckout', title: 'Prepare To Checkout' },
      { id: 'checkoutSale', title: 'Checkout Sale' },
    ],
  },
  {
    id: 'scenario5',
    title: 'Scenario 5 - Cart + Coupon',
    steps: [
      { id: 'createEmptyCart', title: 'Create Empty Cart' },
      { id: 'addFlightProduct', title: 'Add Flight Product' },
      { id: 'applyCouponToCart', title: 'Apply Coupon On Cart' },
    ],
  },
  {
    id: 'scenario6',
    title: 'Scenario 6 - Cart Prepare',
    steps: [
      { id: 'createEmptyCart', title: 'Create Empty Cart' },
      { id: 'addFlightProduct', title: 'Add Flight Product' },
      { id: 'prepareCart', title: 'Prepare Cart' },
    ],
  },
];

module.exports = { FAST_TRACK_SCENARIOS };
