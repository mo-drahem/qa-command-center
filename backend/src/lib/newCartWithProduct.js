const path = require('path');
const fs = require('fs');
const { fastTrackIdentityDefaults } = require('../config/fastTrackDefaults');
const { getExampleFixtures } = require('./exampleFixtures');

const EXAMPLES_DIR = path.resolve(__dirname, '../../../examples');
const SHELL = require('../fixtures/newCartShell.json');

function newCartWithProductHeaders(runtime = {}) {
  const defaults = fastTrackIdentityDefaults;
  const { cartProductExtraHeaders } = getExampleFixtures();
  return {
    'app-id': String(runtime.appId || defaults.appId).trim(),
    'Content-Type': 'application/json',
    'x-currency': String(runtime.currency || defaults.currency).trim(),
    'x-entity-id': String(runtime.entityId || defaults.entityId).trim(),
    'x-user-email': String(runtime.userEmail || defaults.userEmail).trim(),
    'x-user-id': String(runtime.userId || defaults.userId).trim(),
    'x-user-phone': String(runtime.userPhone || defaults.userPhone).trim(),
    ...cartProductExtraHeaders,
  };
}

function readJsonIfExists(name) {
  const filePath = path.join(EXAMPLES_DIR, name);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function wrapProductAsNewCart(type, productWrapper) {
  return {
    type,
    product: productWrapper.product,
    ...SHELL,
  };
}

function buildNewCartWithProductBody(type) {
  const ex = getExampleFixtures();
  if (type === 'flight' && ex.newCartWithProductFlightBody) return ex.newCartWithProductFlightBody;
  if (type === 'hotel' && ex.newCartWithProductHotelBody) return ex.newCartWithProductHotelBody;

  if (type === 'flight') {
    const fromFile = readJsonIfExists('new-cart-with-product-flight.json');
    if (fromFile) return fromFile;
    return wrapProductAsNewCart('flight', ex.addFlightProductBody);
  }

  const fromHotelFile = readJsonIfExists('new-cart-with-product-hotel.json');
  if (fromHotelFile) return fromHotelFile;
  return wrapProductAsNewCart('hotel', ex.addHotelProductBody);
}

module.exports = {
  newCartWithProductHeaders,
  buildNewCartWithProductBody,
  wrapProductAsNewCart,
};
