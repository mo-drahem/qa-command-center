const fs = require('fs');
const path = require('path');

const EXAMPLES_DIR = path.resolve(__dirname, '../../../examples');

/** @type {Record<string, { body: object, headers: Record<string, string>, url: string }> | null} */
let fileCache = null;

/** @type {ReturnType<typeof buildFixtureExports> | null} */
let exportsCache = null;

function parseCurlExport(raw) {
  const headers = {};
  for (const match of raw.matchAll(/--header\s+'([^:]+):\s*([^']*)'/gi)) {
    headers[match[1].trim()] = match[2].trim();
  }

  let url = '';
  const urlMatch = raw.match(/--(?:location|url)\s+'([^']+)'/i);
  if (urlMatch) url = urlMatch[1];

  let body = null;
  const dataMarker = raw.match(/--data(?:-raw)?\s+'/i);
  if (dataMarker) {
    const start = dataMarker.index + dataMarker[0].length;
    const end = raw.lastIndexOf("'");
    const jsonText = raw.slice(start, end > start ? end : undefined).trim();
    if (jsonText) body = JSON.parse(jsonText);
  }

  return { url, headers, body };
}

function readExampleFile(name) {
  const filePath = path.join(EXAMPLES_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing example file: ${name}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (raw.startsWith('curl')) return parseCurlExport(raw);
  return { body: JSON.parse(raw), headers: {}, url: '' };
}

function loadAllExampleFiles() {
  if (fileCache) return fileCache;
  fileCache = {};
  if (!fs.existsSync(EXAMPLES_DIR)) return fileCache;

  fs.readdirSync(EXAMPLES_DIR)
    .filter((name) => name.endsWith('.json'))
    .forEach((name) => {
      fileCache[name] = readExampleFile(name);
    });
  return fileCache;
}

function pickHeaders(headers, keys) {
  const picked = {};
  keys.forEach((key) => {
    if (headers[key] !== undefined) picked[key] = headers[key];
  });
  return picked;
}

function bodyFrom(files, name) {
  const entry = files[name];
  if (!entry?.body) throw new Error(`Example ${name} has no JSON body`);
  return entry.body;
}

function buildFixtureExports(files) {
  const hotelCurl = files['add-product-to-cart-hotel.json'] || { headers: {} };

  const newCartFlight = files['new-cart-with-product-flight.json'];
  const newCartHotel = files['new-cart-with-product-hotel.json'];

  return {
    files,
    fileNames: Object.keys(files).sort(),
    addFlightProductBody: bodyFrom(files, 'add-product-to-cart.json'),
    addHotelProductBody: bodyFrom(files, 'add-hotel-product-to-cart.json'),
    newCartWithProductFlightBody: newCartFlight?.body || null,
    newCartWithProductHotelBody: newCartHotel?.body || null,
    prepareCheckoutBody: bodyFrom(files, 'prepare-checkout.json'),
    applyCouponBody: bodyFrom(files, 'apply-coupon-to-cart.json'),
    cartProductExtraHeaders: pickHeaders(hotelCurl.headers, [
      'x-user-account-role',
      'x-include-total-with-vat',
    ]),
  };
}

function getExampleFixtures() {
  if (exportsCache) return exportsCache;
  const files = loadAllExampleFiles();
  exportsCache = buildFixtureExports(files);
  return exportsCache;
}

function getExampleFile(name) {
  const files = loadAllExampleFiles();
  return files[name] || null;
}

function resetExampleFixturesCache() {
  fileCache = null;
  exportsCache = null;
}

module.exports = {
  EXAMPLES_DIR,
  getExampleFixtures,
  getExampleFile,
  loadAllExampleFiles,
  resetExampleFixturesCache,
  parseCurlExport,
  readExampleFile,
};
