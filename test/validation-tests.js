/**
 * SIT725 – QR App Validation Tests
 *
 * HOW TO RUN: (Node.js 18+ required)
 *   1. Start MongoDB
 *   2. cd backend && npm run seed:admin
 *   3. cd backend && npm start
 *   4. node test/validation-tests.js
 *
 * Extended coverage: T51–T94 (auth profile, restaurant, public menu,
 * images, sessions, cart, orders, analytics).
 *
 * PREREQUISITE: seed:admin must have run at least once.
 *   Seeded credentials:
 *     Admin:  admin@system.com  / admin123
 *     Owner:  owner@example.com / owner123
 *
 * DO NOT MODIFY:
 *   - Output format (TEST|, SUMMARY|, COVERAGE|)
 *   - test() function signature
 *   - Exit behaviour
 *   - coverageTracker object
 *   - Logging structure
 *
 */

const BASE_URL  = process.env.BASE_URL || 'http://localhost:5001';
const AUTH_BASE  = '/api/auth';
const MENU_BASE  = '/api/menu';
const ADMIN_BASE = '/api/admin';
const RESTAURANT_BASE = '/api/restaurants';
const SESSION_BASE = '/api/sessions';
const CART_BASE = '/api/cart';
const ORDER_BASE = '/api/orders';
const ANALYTICS_BASE = '/api/analytics';

// =============================
// INTERNAL STATE (DO NOT MODIFY)
// =============================

const results = [];

const coverageTracker = {
  AUTH_FAIL:     0,
  REGISTER_FAIL: 0,
  REQUIRED:      0,
  TYPE:          0,
  BOUNDARY:      0,
  UNAUTHORIZED:  0,
  FORBIDDEN:     0,
  NOT_FOUND:     0,
  MENU_FAIL:     0,
  ADMIN_FAIL:    0,
};

// =============================
// OUTPUT FORMAT (DO NOT MODIFY)
// =============================

function logHeader(uniqueId) {
  console.log('SIT725_VALIDATION_TESTS');
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`AUTH_BASE=${AUTH_BASE}`);
  console.log(`INFO|Generated uniqueId=${uniqueId}`);
}

function logResult(r) {
  console.log(
    `TEST|${r.id}|${r.name}|${r.method}|${r.path}` +
    `|expected=${r.expected}|actual=${r.actual}|pass=${r.pass ? 'Y' : 'N'}`
  );
}

function logSummary() {
  const failed = results.filter(r => !r.pass).length;
  console.log(
    `SUMMARY|pass=${failed === 0 ? 'Y' : 'N'}|failed=${failed}|total=${results.length}`
  );
  return failed === 0;
}

function logCoverage() {
  console.log(
    `COVERAGE` +
    `|AUTH_FAIL=${coverageTracker.AUTH_FAIL}` +
    `|REGISTER_FAIL=${coverageTracker.REGISTER_FAIL}` +
    `|REQUIRED=${coverageTracker.REQUIRED}` +
    `|TYPE=${coverageTracker.TYPE}` +
    `|BOUNDARY=${coverageTracker.BOUNDARY}` +
    `|UNAUTHORIZED=${coverageTracker.UNAUTHORIZED}` +
    `|FORBIDDEN=${coverageTracker.FORBIDDEN}` +
    `|NOT_FOUND=${coverageTracker.NOT_FOUND}` +
    `|MENU_FAIL=${coverageTracker.MENU_FAIL}` +
    `|ADMIN_FAIL=${coverageTracker.ADMIN_FAIL}`
  );
}

// =============================
// HTTP HELPER
// =============================

async function http(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

/** Multipart upload helper (menu images). Uses same TEST| output via testMultipart(). */
async function testMultipart({ id, name, path, expected, token, fieldName, buffer, filename, mimeType, tags }) {
  const form = new FormData();
  form.append(fieldName, new Blob([buffer], { type: mimeType }), filename);
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: form });
  const text = await res.text();
  const pass = res.status === expected;

  const result = { id, name, method: 'POST', path, expected, actual: res.status, pass };
  results.push(result);
  logResult(result);

  const safeTags = Array.isArray(tags) ? tags : [];
  safeTags.forEach(tag => {
    if (Object.prototype.hasOwnProperty.call(coverageTracker, tag)) {
      coverageTracker[tag]++;
    }
  });

  try { return JSON.parse(text); } catch { return {}; }
}

// =============================
// TEST REGISTRATION FUNCTION (DO NOT MODIFY)
// =============================

async function test({ id, name, method, path, expected, body, token, tags }) {
  const { status, text } = await http(method, path, body, token);
  const pass = status === expected;

  const result = { id, name, method, path, expected, actual: status, pass };
  results.push(result);
  logResult(result);

  const safeTags = Array.isArray(tags) ? tags : [];
  safeTags.forEach(tag => {
    if (Object.prototype.hasOwnProperty.call(coverageTracker, tag)) {
      coverageTracker[tag]++;
    }
  });

  // Return parsed body so callers can capture IDs for chained tests
  try { return JSON.parse(text); } catch { return {}; }
}

// =============================
// SETUP — obtain auth tokens
// =============================

async function setup() {
  const adminRes  = await http('POST', `${AUTH_BASE}/login`, { email: 'admin@system.com',  password: 'admin123'  });
  const ownerRes  = await http('POST', `${AUTH_BASE}/login`, { email: 'owner@example.com', password: 'owner123' });

  const adminData = JSON.parse(adminRes.text);
  const ownerData = JSON.parse(ownerRes.text);

  if (!adminData.token) throw new Error('Setup failed: admin login returned no token. Run npm run seed:admin first.');
  if (!ownerData.token) throw new Error('Setup failed: owner login returned no token. Run npm run seed:admin first.');

  return {
    adminToken:        adminData.token,
    ownerToken:        ownerData.token,
    ownerRestaurantId: ownerData.user?.restaurantId ?? null,
  };
}

// =============================
// TEST DATA FACTORIES
// =============================

function makeValidOwner(suffix) {
  return {
    name:                     'Test Restaurant Owner',
    email:                    `testowner_${suffix}@example.com`,
    password:                 'password123',
    pendingRestaurantName:    'Test Bistro',
    pendingRestaurantAddress: '42 Collins St, Melbourne VIC 3000',
    pendingRestaurantPhone:   '0312345678',
    pendingRestaurantEmail:   `testbistro_${suffix}@example.com`,
  };
}

function makeValidMenuItem() {
  return {
    name:        'Margherita Pizza',
    category:    'Mains',
    description: 'Classic tomato and mozzarella pizza.',
    price:       18.5,
    image:       'https://example.com/pizza.jpg',
    isAvailable: true,
  };
}

function makeValidMenuUpdate() {
  return {
    name:        'Hawaiian Pizza',
    category:    'Mains',
    description: 'Tomato, mozzarella, ham and pineapple.',
    price:       20.0,
  };
}

// =============================
// RUN ALL TESTS
// =============================

async function run() {
  const uniqueId = `q${Date.now()}`;
  logHeader(uniqueId);

  // ---- Setup ----
  let adminToken, ownerToken, ownerRestaurantId;
  try {
    ({ adminToken, ownerToken, ownerRestaurantId } = await setup());
    console.log('INFO|Setup complete — admin and owner tokens acquired');
  } catch (err) {
    console.error(`FATAL|${err.message}`);
    process.exit(2);
  }

  // IDs shared across tests
  let testOwner1Id       = null;
  let testOwner2Id       = null;
  let createdItemId      = null;
  let testDisableOwner   = null;
  let testDisableOwnerEmail = null;

  // =============================
  // REGISTRATION
  // =============================

  // ---- T01 Valid owner register ----
  {
    const resp = await test({
      id:       'T01',
      name:     'Valid owner register',
      method:   'POST',
      path:     `${AUTH_BASE}/register`,
      expected: 201,
      body:     makeValidOwner(uniqueId),
      tags:     [],
    });
    testOwner1Id = resp?.user?._id ?? null;
  }

  // ---- T02 Duplicate email register ----
  await test({
    id:       'T02',
    name:     'Duplicate email register',
    method:   'POST',
    path:     `${AUTH_BASE}/register`,
    expected: 409,
    body:     makeValidOwner(uniqueId),
    tags:     ['REGISTER_FAIL'],
  });

  // ---- T03 Missing name on register ----
  await test({
    id:       'T03',
    name:     'Missing name on register',
    method:   'POST',
    path:     `${AUTH_BASE}/register`,
    expected: 400,
    body:     (({ name, ...rest }) => rest)(makeValidOwner(`${uniqueId}a`)),
    tags:     ['REGISTER_FAIL', 'REQUIRED'],
  });

  // ---- T04 Missing email on register ----
  await test({
    id:       'T04',
    name:     'Missing email on register',
    method:   'POST',
    path:     `${AUTH_BASE}/register`,
    expected: 400,
    body:     (({ email, ...rest }) => rest)(makeValidOwner(`${uniqueId}b`)),
    tags:     ['REGISTER_FAIL', 'REQUIRED'],
  });

  // ---- T05 Missing password on register ----
  await test({
    id:       'T05',
    name:     'Missing password on register',
    method:   'POST',
    path:     `${AUTH_BASE}/register`,
    expected: 400,
    body:     (({ password, ...rest }) => rest)(makeValidOwner(`${uniqueId}c`)),
    tags:     ['REGISTER_FAIL', 'REQUIRED'],
  });

  // ---- T06 Missing restaurant name on register ----
  await test({
    id:       'T06',
    name:     'Missing restaurant name on register',
    method:   'POST',
    path:     `${AUTH_BASE}/register`,
    expected: 400,
    body:     (({ pendingRestaurantName, ...rest }) => rest)(makeValidOwner(`${uniqueId}d`)),
    tags:     ['REGISTER_FAIL', 'REQUIRED'],
  });

  // ---- T07 Missing restaurant address on register ----
  await test({
    id:       'T07',
    name:     'Missing restaurant address on register',
    method:   'POST',
    path:     `${AUTH_BASE}/register`,
    expected: 400,
    body:     (({ pendingRestaurantAddress, ...rest }) => rest)(makeValidOwner(`${uniqueId}e`)),
    tags:     ['REGISTER_FAIL', 'REQUIRED'],
  });

  // =============================
  // LOGIN
  // =============================

  // ---- T08 Valid admin login ----
  await test({
    id:       'T08',
    name:     'Valid admin login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 200,
    body:     { email: 'admin@system.com', password: 'admin123' },
    tags:     [],
  });

  // ---- T09 Valid owner login ----
  await test({
    id:       'T09',
    name:     'Valid owner login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 200,
    body:     { email: 'owner@example.com', password: 'owner123' },
    tags:     [],
  });

  // ---- T10 Wrong password ----
  await test({
    id:       'T10',
    name:     'Wrong password login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 401,
    body:     { email: 'owner@example.com', password: 'wrongpassword' },
    tags:     ['AUTH_FAIL'],
  });

  // ---- T11 Non-existent email ----
  await test({
    id:       'T11',
    name:     'Non-existent email login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 401,
    body:     { email: 'nobody@example.com', password: 'password123' },
    tags:     ['AUTH_FAIL'],
  });

  // ---- T12 Missing email on login ----
  await test({
    id:       'T12',
    name:     'Missing email on login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 400,
    body:     { password: 'password123' },
    tags:     ['AUTH_FAIL', 'REQUIRED'],
  });

  // ---- T13 Missing password on login ----
  await test({
    id:       'T13',
    name:     'Missing password on login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 400,
    body:     { email: 'owner@example.com' },
    tags:     ['AUTH_FAIL', 'REQUIRED'],
  });

  // ---- T14 Pending owner account cannot login ----
  // Must run before T45 (approve) so the account is still pending
  await test({
    id:       'T14',
    name:     'Pending owner account cannot login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 403,
    body:     { email: `testowner_${uniqueId}@example.com`, password: 'password123' },
    tags:     ['AUTH_FAIL', 'FORBIDDEN'],
  });

  // =============================
  // SECURITY / AUTHORISATION
  // =============================

  // ---- T15 Protected route with no token ----
  await test({
    id:       'T15',
    name:     'Access protected route without token',
    method:   'GET',
    path:     `${MENU_BASE}/my`,
    expected: 401,
    tags:     ['UNAUTHORIZED'],
  });

  // ---- T16 Owner token on admin-only route ----
  await test({
    id:       'T16',
    name:     'Owner token on admin-only route',
    method:   'GET',
    path:     `${ADMIN_BASE}/owners`,
    expected: 403,
    token:    ownerToken,
    tags:     ['FORBIDDEN'],
  });

  // ---- T17 Invalid JWT token ----
  await test({
    id:       'T17',
    name:     'Invalid JWT token on protected route',
    method:   'GET',
    path:     `${MENU_BASE}/my`,
    expected: 401,
    token:    'not.a.valid.jwt.token',
    tags:     ['UNAUTHORIZED'],
  });

  // ---- T18 No token on admin pending owners endpoint ----
  await test({
    id:       'T18',
    name:     'No token on admin pending owners endpoint',
    method:   'GET',
    path:     `${ADMIN_BASE}/owners/pending`,
    expected: 401,
    tags:     ['UNAUTHORIZED'],
  });

  // ---- T19 Owner token on pending owners endpoint returns 403 ----
  await test({
    id:       'T19',
    name:     'Owner token on pending owners endpoint returns 403',
    method:   'GET',
    path:     `${ADMIN_BASE}/owners/pending`,
    expected: 403,
    token:    ownerToken,
    tags:     ['FORBIDDEN'],
  });

  // ---- T20 No token on admin restaurants endpoint returns 401 ----
  await test({
    id:       'T20',
    name:     'No token on admin restaurants endpoint returns 401',
    method:   'GET',
    path:     `${ADMIN_BASE}/restaurants`,
    expected: 401,
    tags:     ['UNAUTHORIZED'],
  });

  // =============================
  // MENU CRUD
  // =============================

  // ---- T21 Owner creates valid menu item ----
  {
    const resp = await test({
      id:       'T21',
      name:     'Owner creates valid menu item',
      method:   'POST',
      path:     `${MENU_BASE}/my`,
      expected: 201,
      body:     makeValidMenuItem(),
      token:    ownerToken,
      tags:     [],
    });
    createdItemId = resp?.item?._id ?? null;
  }

  // ---- T22 Create menu item — missing name ----
  await test({
    id:       'T22',
    name:     'Create menu item missing name',
    method:   'POST',
    path:     `${MENU_BASE}/my`,
    expected: 400,
    body:     (({ name, ...rest }) => rest)(makeValidMenuItem()),
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'REQUIRED'],
  });

  // ---- T23 Create menu item — missing price ----
  await test({
    id:       'T23',
    name:     'Create menu item missing price',
    method:   'POST',
    path:     `${MENU_BASE}/my`,
    expected: 400,
    body:     (({ price, ...rest }) => rest)(makeValidMenuItem()),
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'REQUIRED'],
  });

  // ---- T24 Create menu item with all optional fields populated ----
  await test({
    id:       'T24',
    name:     'Create menu item with all optional fields',
    method:   'POST',
    path:     `${MENU_BASE}/my`,
    expected: 201,
    body: {
      name:        'Truffle Fries',
      category:    'Sides',
      description: 'Crispy fries tossed in truffle oil and parmesan.',
      price:       12.0,
      image:       'https://example.com/truffle-fries.jpg',
      isAvailable: true,
    },
    token: ownerToken,
    tags:  [],
  });

  // ---- T25 Create menu item without authentication ----
  await test({
    id:       'T25',
    name:     'Create menu item without authentication',
    method:   'POST',
    path:     `${MENU_BASE}/my`,
    expected: 401,
    body:     makeValidMenuItem(),
    tags:     ['MENU_FAIL', 'UNAUTHORIZED'],
  });

  // ---- T26 Owner gets their own menu ----
  await test({
    id:       'T26',
    name:     'Owner gets their own menu',
    method:   'GET',
    path:     `${MENU_BASE}/my`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  // ---- T27 Owner updates a menu item ----
  await test({
    id:       'T27',
    name:     'Owner updates a menu item',
    method:   'PUT',
    path:     `${MENU_BASE}/my/${createdItemId}`,
    expected: 200,
    body:     makeValidMenuUpdate(),
    token:    ownerToken,
    tags:     [],
  });

  // ---- T28 Toggle item availability to false ----
  await test({
    id:       'T28',
    name:     'Toggle menu item availability to false',
    method:   'PATCH',
    path:     `${MENU_BASE}/my/${createdItemId}/availability`,
    expected: 200,
    body:     { isAvailable: false },
    token:    ownerToken,
    tags:     [],
  });

  // ---- T29 Toggle item availability back to true ----
  await test({
    id:       'T29',
    name:     'Toggle menu item availability to true',
    method:   'PATCH',
    path:     `${MENU_BASE}/my/${createdItemId}/availability`,
    expected: 200,
    body:     { isAvailable: true },
    token:    ownerToken,
    tags:     [],
  });

  // ---- T30 Toggle availability with non-boolean string ----
  await test({
    id:       'T30',
    name:     'Toggle availability with non-boolean string',
    method:   'PATCH',
    path:     `${MENU_BASE}/my/${createdItemId}/availability`,
    expected: 400,
    body:     { isAvailable: 'yes' },
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'TYPE'],
  });

  // ---- T31 Owner deletes menu item ----
  await test({
    id:       'T31',
    name:     'Owner deletes menu item',
    method:   'DELETE',
    path:     `${MENU_BASE}/my/${createdItemId}`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  // ---- T32 Update already-deleted menu item ----
  await test({
    id:       'T32',
    name:     'Update already-deleted menu item',
    method:   'PUT',
    path:     `${MENU_BASE}/my/${createdItemId}`,
    expected: 404,
    body:     makeValidMenuUpdate(),
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'NOT_FOUND'],
  });

  // ---- T33 Delete already-deleted menu item ----
  await test({
    id:       'T33',
    name:     'Delete already-deleted menu item',
    method:   'DELETE',
    path:     `${MENU_BASE}/my/${createdItemId}`,
    expected: 404,
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'NOT_FOUND'],
  });

  // =============================
  // MENU — BOUNDARY / EDGE CASES
  // =============================

  // ---- T34 Owner gets their own tables ----
  await test({
    id:       'T34',
    name:     'Owner gets their own tables',
    method:   'GET',
    path:     `${MENU_BASE}/my/tables`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  // ---- T35 Update menu item with malformed ObjectId ----
  await test({
    id:       'T35',
    name:     'Update menu item with malformed ObjectId',
    method:   'PUT',
    path:     `${MENU_BASE}/my/not-a-valid-id`,
    expected: 400,
    body:     makeValidMenuUpdate(),
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'TYPE'],
  });

  // ---- T36 Delete menu item with malformed ObjectId ----
  await test({
    id:       'T36',
    name:     'Delete menu item with malformed ObjectId',
    method:   'DELETE',
    path:     `${MENU_BASE}/my/not-a-valid-id`,
    expected: 400,
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'TYPE'],
  });

  // ---- T37 Toggle availability with malformed ObjectId ----
  await test({
    id:       'T37',
    name:     'Toggle availability with malformed ObjectId',
    method:   'PATCH',
    path:     `${MENU_BASE}/my/not-a-valid-id/availability`,
    expected: 400,
    body:     { isAvailable: true },
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'TYPE'],
  });

  // =============================
  // ADMIN ROUTES — LISTS
  // =============================

  // ---- T38 Admin gets all owners list ----
  await test({
    id:       'T38',
    name:     'Admin gets all owners list',
    method:   'GET',
    path:     `${ADMIN_BASE}/owners`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // ---- T39 Admin gets pending owners list ----
  await test({
    id:       'T39',
    name:     'Admin gets pending owners list',
    method:   'GET',
    path:     `${ADMIN_BASE}/owners/pending`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // ---- T40 Admin gets all restaurants ----
  await test({
    id:       'T40',
    name:     'Admin gets all restaurants',
    method:   'GET',
    path:     `${ADMIN_BASE}/restaurants`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // ---- T41 Super admin views full menu by restaurantId ----
  await test({
    id:       'T41',
    name:     'Super admin views menu by restaurantId',
    method:   'GET',
    path:     `${MENU_BASE}/${ownerRestaurantId}`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // =============================
  // ADMIN ROUTES — TABLES
  // =============================

  // ---- T42 Admin sets tables for a restaurant ----
  await test({
    id:       'T42',
    name:     'Admin sets tables for a restaurant',
    method:   'POST',
    path:     `${ADMIN_BASE}/restaurants/${ownerRestaurantId}/tables`,
    expected: 201,
    body:     { totalTables: 5 },
    token:    adminToken,
    tags:     [],
  });

  // ---- T43 Admin gets tables for a restaurant ----
  await test({
    id:       'T43',
    name:     'Admin gets tables for a restaurant',
    method:   'GET',
    path:     `${ADMIN_BASE}/restaurants/${ownerRestaurantId}/tables`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // =============================
  // ADMIN ROUTES — OWNER MANAGEMENT
  // =============================

  // Register a throwaway owner specifically for the disable/enable flow
  {
    const suffixDis        = `${uniqueId}dis`;
    const respDis          = await http('POST', `${AUTH_BASE}/register`, makeValidOwner(suffixDis));
    const dataDis          = JSON.parse(respDis.text);
    testDisableOwner       = dataDis?.user?._id ?? null;
    testDisableOwnerEmail  = `testowner_${suffixDis}@example.com`;
  }

  // ---- T44 Admin disables a pending owner ----
  await test({
    id:       'T44',
    name:     'Admin disables a pending owner',
    method:   'PATCH',
    path:     `${ADMIN_BASE}/owners/${testDisableOwner}/disable`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // ---- T45 Disabled owner cannot login ----
  await test({
    id:       'T45',
    name:     'Disabled owner cannot login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 403,
    body:     { email: testDisableOwnerEmail, password: 'password123' },
    tags:     ['AUTH_FAIL', 'FORBIDDEN'],
  });

  // ---- T46 Admin enables a disabled owner ----
  await test({
    id:       'T46',
    name:     'Admin enables a disabled owner',
    method:   'PATCH',
    path:     `${ADMIN_BASE}/owners/${testDisableOwner}/enable`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // ---- T47 Re-enabled owner can login again ----
  await test({
    id:       'T47',
    name:     'Re-enabled owner can login again',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 200,
    body:     { email: testDisableOwnerEmail, password: 'password123' },
    tags:     [],
  });

  // ---- T48 Admin approves pending owner (registered in T01) ----
  await test({
    id:       'T48',
    name:     'Admin approves pending owner',
    method:   'PATCH',
    path:     `${ADMIN_BASE}/owners/${testOwner1Id}/approve`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // ---- T49 Approved owner can now login ----
  await test({
    id:       'T49',
    name:     'Approved owner can now login',
    method:   'POST',
    path:     `${AUTH_BASE}/login`,
    expected: 200,
    body:     { email: `testowner_${uniqueId}@example.com`, password: 'password123' },
    tags:     [],
  });

  // Register a second pending owner for the reject test
  {
    const suffix2 = `${uniqueId}rej`;
    const resp2   = await http('POST', `${AUTH_BASE}/register`, makeValidOwner(suffix2));
    const data2   = JSON.parse(resp2.text);
    testOwner2Id  = data2?.user?._id ?? null;
  }

  // ---- T50 Admin rejects a pending owner ----
  await test({
    id:       'T50',
    name:     'Admin rejects a pending owner',
    method:   'PATCH',
    path:     `${ADMIN_BASE}/owners/${testOwner2Id}/reject`,
    expected: 200,
    token:    adminToken,
    tags:     [],
  });

  // IDs shared across extended validation tests (T51+)
  let guestMenuItemId = null;
  let guestSessionId = null;
  let guestOrderId = null;
  let uploadedImageId = null;

  // =============================
  // AUTH PROFILE (T51–T56)
  // =============================

  await test({
    id:       'T51',
    name:     'Owner gets own profile',
    method:   'GET',
    path:     `${AUTH_BASE}/me`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  await test({
    id:       'T52',
    name:     'Get profile without token',
    method:   'GET',
    path:     `${AUTH_BASE}/me`,
    expected: 401,
    tags:     ['UNAUTHORIZED'],
  });

  await test({
    id:       'T53',
    name:     'Owner updates profile name',
    method:   'PUT',
    path:     `${AUTH_BASE}/me`,
    expected: 200,
    body:     { name: 'Seeded Owner Updated' },
    token:    ownerToken,
    tags:     [],
  });

  await test({
    id:       'T54',
    name:     'Update profile with no fields',
    method:   'PUT',
    path:     `${AUTH_BASE}/me`,
    expected: 400,
    body:     {},
    token:    ownerToken,
    tags:     ['REQUIRED'],
  });

  await test({
    id:       'T55',
    name:     'Change password with wrong current password',
    method:   'PUT',
    path:     `${AUTH_BASE}/me/password`,
    expected: 401,
    body:     { currentPassword: 'wrongpassword', newPassword: 'newpass123' },
    token:    ownerToken,
    tags:     ['AUTH_FAIL'],
  });

  await test({
    id:       'T56',
    name:     'Change password with password too short',
    method:   'PUT',
    path:     `${AUTH_BASE}/me/password`,
    expected: 400,
    body:     { currentPassword: 'owner123', newPassword: '12345' },
    token:    ownerToken,
    tags:     ['AUTH_FAIL', 'BOUNDARY'],
  });

  // =============================
  // RESTAURANT (T57–T60)
  // =============================

  await test({
    id:       'T57',
    name:     'Owner gets linked restaurant',
    method:   'GET',
    path:     `${RESTAURANT_BASE}/my`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  await test({
    id:       'T58',
    name:     'Owner updates restaurant phone',
    method:   'PUT',
    path:     `${RESTAURANT_BASE}/my`,
    expected: 200,
    body:     { phone: '0399998888' },
    token:    ownerToken,
    tags:     [],
  });

  await test({
    id:       'T59',
    name:     'Update restaurant with no fields',
    method:   'PUT',
    path:     `${RESTAURANT_BASE}/my`,
    expected: 400,
    body:     {},
    token:    ownerToken,
    tags:     ['REQUIRED'],
  });

  await test({
    id:       'T60',
    name:     'Get restaurant without token',
    method:   'GET',
    path:     `${RESTAURANT_BASE}/my`,
    expected: 401,
    tags:     ['UNAUTHORIZED'],
  });

  // =============================
  // PUBLIC MENU (T61–T63)
  // =============================

  await test({
    id:       'T61',
    name:     'Guest gets public menu by restaurantId',
    method:   'GET',
    path:     `${MENU_BASE}/public/${ownerRestaurantId}`,
    expected: 200,
    tags:     [],
  });

  await test({
    id:       'T62',
    name:     'Public menu with malformed restaurantId',
    method:   'GET',
    path:     `${MENU_BASE}/public/not-a-valid-id`,
    expected: 400,
    tags:     ['MENU_FAIL', 'TYPE'],
  });

  await test({
    id:       'T63',
    name:     'Public menu for non-existent restaurant',
    method:   'GET',
    path:     `${MENU_BASE}/public/507f1f77bcf86cd799439099`,
    expected: 404,
    tags:     ['MENU_FAIL', 'NOT_FOUND'],
  });

  // =============================
  // MENU ITEM FOR GUEST FLOW (T64)
  // =============================

  {
    const resp = await test({
      id:       'T64',
      name:     'Owner creates menu item for guest cart flow',
      method:   'POST',
      path:     `${MENU_BASE}/my`,
      expected: 201,
      body:     {
        name:        'Validation Burger',
        category:    'Mains',
        description: 'Item used for cart and order validation tests.',
        price:       14.5,
        isAvailable: true,
      },
      token:    ownerToken,
      tags:     [],
    });
    guestMenuItemId = resp?.item?._id ?? null;
  }

  // =============================
  // MENU IMAGES (T65–T67)
  // =============================

  await test({
    id:       'T65',
    name:     'Upload menu image without file',
    method:   'POST',
    path:     `${MENU_BASE}/my/images`,
    expected: 400,
    token:    ownerToken,
    tags:     ['MENU_FAIL', 'REQUIRED'],
  });

  {
    const resp = await testMultipart({
      id:       'T66',
      name:     'Owner uploads menu image',
      path:     `${MENU_BASE}/my/images`,
      expected: 201,
      token:    ownerToken,
      fieldName: 'image',
      buffer:   Buffer.from('fake-png-validation'),
      filename: 'validation-test.png',
      mimeType: 'image/png',
      tags:     [],
    });
    uploadedImageId = resp?.imageFileId ?? null;
  }

  if (uploadedImageId) {
    await test({
      id:       'T67',
      name:     'Get uploaded menu image by id',
      method:   'GET',
      path:     `${MENU_BASE}/images/${uploadedImageId}`,
      expected: 200,
      tags:     [],
    });
  } else {
    await test({
      id:       'T67',
      name:     'Get uploaded menu image by id',
      method:   'GET',
      path:     `${MENU_BASE}/images/507f1f77bcf86cd799439088`,
      expected: 404,
      tags:     ['MENU_FAIL', 'NOT_FOUND'],
    });
  }

  await test({
    id:       'T68',
    name:     'Get menu image with malformed id',
    method:   'GET',
    path:     `${MENU_BASE}/images/not-a-valid-id`,
    expected: 400,
    tags:     ['MENU_FAIL', 'TYPE'],
  });

  // =============================
  // SESSIONS (T69–T74)
  // =============================

  {
    const resp = await test({
      id:       'T69',
      name:     'Guest starts table session',
      method:   'POST',
      path:     `${SESSION_BASE}/start`,
      expected: 201,
      body:     { restaurantId: ownerRestaurantId, tableNumber: 1 },
      tags:     [],
    });
    guestSessionId = resp?.session?._id ?? null;
  }

  await test({
    id:       'T70',
    name:     'Start session missing restaurantId',
    method:   'POST',
    path:     `${SESSION_BASE}/start`,
    expected: 400,
    body:     { tableNumber: 2 },
    tags:     ['REQUIRED'],
  });

  if (guestSessionId && ownerRestaurantId) {
    await test({
      id:       'T71',
      name:     'Get active session for table',
      method:   'GET',
      path:     `${SESSION_BASE}/active?restaurantId=${ownerRestaurantId}&tableNumber=1`,
      expected: 200,
      tags:     [],
    });

    await test({
      id:       'T72',
      name:     'Get session by id',
      method:   'GET',
      path:     `${SESSION_BASE}/${guestSessionId}`,
      expected: 200,
      tags:     [],
    });
  }

  await test({
    id:       'T73',
    name:     'Get active session missing query params',
    method:   'GET',
    path:     `${SESSION_BASE}/active`,
    expected: 400,
    tags:     ['REQUIRED'],
  });

  await test({
    id:       'T74',
    name:     'Get session with malformed id',
    method:   'GET',
    path:     `${SESSION_BASE}/not-a-valid-id`,
    expected: 400,
    tags:     ['TYPE'],
  });

  // =============================
  // CART (T75–T80)
  // =============================

  if (guestSessionId && guestMenuItemId) {
    await test({
      id:       'T75',
      name:     'Get empty or new cart for session',
      method:   'GET',
      path:     `${CART_BASE}/${guestSessionId}`,
      expected: 200,
      tags:     [],
    });

    await test({
      id:       'T76',
      name:     'Add menu item to cart',
      method:   'POST',
      path:     `${CART_BASE}/${guestSessionId}/items`,
      expected: 200,
      body:     { menuItemId: guestMenuItemId, quantity: 2 },
      tags:     [],
    });

    await test({
      id:       'T77',
      name:     'Add to cart missing menuItemId',
      method:   'POST',
      path:     `${CART_BASE}/${guestSessionId}/items`,
      expected: 400,
      body:     { quantity: 1 },
      tags:     ['REQUIRED'],
    });

    await test({
      id:       'T78',
      name:     'Update cart item quantity',
      method:   'PUT',
      path:     `${CART_BASE}/${guestSessionId}/items/${guestMenuItemId}`,
      expected: 200,
      body:     { quantity: 1 },
      tags:     [],
    });

    await test({
      id:       'T79',
      name:     'Remove item from cart',
      method:   'DELETE',
      path:     `${CART_BASE}/${guestSessionId}/items/${guestMenuItemId}`,
      expected: 200,
      tags:     [],
    });

    await test({
      id:       'T80',
      name:     'Re-add item to cart before order',
      method:   'POST',
      path:     `${CART_BASE}/${guestSessionId}/items`,
      expected: 200,
      body:     { menuItemId: guestMenuItemId, quantity: 1 },
      tags:     [],
    });

    await test({
      id:       'T81',
      name:     'Get cart with malformed session id',
      method:   'GET',
      path:     `${CART_BASE}/not-a-valid-id`,
      expected: 400,
      tags:     ['TYPE'],
    });
  }

  // =============================
  // ORDERS (T82–T86)
  // =============================

  if (guestSessionId) {
    {
      const resp = await test({
        id:       'T82',
        name:     'Guest places order from cart',
        method:   'POST',
        path:     `${ORDER_BASE}/`,
        expected: 201,
        body:     { sessionId: guestSessionId },
        tags:     [],
      });
      guestOrderId = resp?.order?._id ?? null;
    }

    if (guestOrderId) {
      await test({
        id:       'T83',
        name:     'Get order by id',
        method:   'GET',
        path:     `${ORDER_BASE}/${guestOrderId}`,
        expected: 200,
        tags:     [],
      });
    }

    await test({
      id:       'T84',
      name:     'Place order missing sessionId',
      method:   'POST',
      path:     `${ORDER_BASE}/`,
      expected: 400,
      body:     {},
      tags:     ['REQUIRED'],
    });

    await test({
      id:       'T85',
      name:     'Get order with malformed id',
      method:   'GET',
      path:     `${ORDER_BASE}/not-a-valid-id`,
      expected: 400,
      tags:     ['TYPE'],
    });
  }

  // Second session on table 2 for empty-cart order test
  {
    const resp2 = await test({
      id:       'T86',
      name:     'Guest starts session on table 2',
      method:   'POST',
      path:     `${SESSION_BASE}/start`,
      expected: 201,
      body:     { restaurantId: ownerRestaurantId, tableNumber: 2 },
      tags:     [],
    });
    const session2Id = resp2?.session?._id ?? null;
    if (session2Id) {
      await test({
        id:       'T87',
        name:     'Place order with empty cart',
        method:   'POST',
        path:     `${ORDER_BASE}/`,
        expected: 400,
        body:     { sessionId: session2Id },
        tags:     ['REQUIRED'],
      });

      await test({
        id:       'T88',
        name:     'Clear cart for session',
        method:   'DELETE',
        path:     `${CART_BASE}/${session2Id}`,
        expected: 200,
        tags:     [],
      });
    }
  }

  // =============================
  // ANALYTICS (T89–T92)
  // =============================

  await test({
    id:       'T89',
    name:     'Owner gets analytics summary',
    method:   'GET',
    path:     `${ANALYTICS_BASE}/my/summary`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  await test({
    id:       'T90',
    name:     'Owner gets peak hours analytics',
    method:   'GET',
    path:     `${ANALYTICS_BASE}/my/peak-hours`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  await test({
    id:       'T91',
    name:     'Owner gets item forecast analytics',
    method:   'GET',
    path:     `${ANALYTICS_BASE}/my/item-forecast`,
    expected: 200,
    token:    ownerToken,
    tags:     [],
  });

  await test({
    id:       'T92',
    name:     'Analytics summary without token',
    method:   'GET',
    path:     `${ANALYTICS_BASE}/my/summary`,
    expected: 401,
    tags:     ['UNAUTHORIZED'],
  });

  // =============================
  // SESSION CLOSE (T93–T94) — after guest flows
  // =============================

  if (guestSessionId) {
    await test({
      id:       'T93',
      name:     'Owner closes guest session',
      method:   'PATCH',
      path:     `${SESSION_BASE}/${guestSessionId}/close`,
      expected: 200,
      token:    ownerToken,
      tags:     [],
    });

    if (guestMenuItemId) {
      await test({
        id:       'T94',
        name:     'Add to cart on closed session',
        method:   'POST',
        path:     `${CART_BASE}/${guestSessionId}/items`,
        expected: 400,
        body:     { menuItemId: guestMenuItemId, quantity: 1 },
        tags:     ['REQUIRED'],
      });
    }
  }

  // Restore seeded owner display name after T53
  await http('PUT', `${AUTH_BASE}/me`, { name: 'Demo Owner' }, ownerToken);

  // ---- FINAL OUTPUT ----
  const pass = logSummary();
  logCoverage();

  process.exit(pass ? 0 : 1);
}

run().catch(err => {
  console.error('ERROR', err);
  process.exit(2);
});
