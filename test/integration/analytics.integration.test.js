/**
 * Analytics Integration Tests
 *
 * Uses MongoMemoryServer (via hooks.js). Each test gets a clean DB.
 *
 * Endpoints covered:
 *   GET /api/analytics/my/summary
 *   GET /api/analytics/my/peak-hours
 *   GET /api/analytics/my/item-forecast
 */

const request = require('supertest');
const { expect } = require('chai');
const bcrypt = require('bcryptjs');
const User = require('../../backend/models/User');
const Order = require('../../backend/models/Order');
const app = require('../../backend/server');

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  await User.create({
    name:     'System Admin',
    email:    'admin@system.com',
    password: hash,
    role:     'super_admin',
    status:   'approved',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@system.com', password: 'admin123' });
  return { token: res.body.token };
}

async function seedApprovedOwner(suffix = 'analytics') {
  const { token: adminToken } = await seedAdmin();

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name:                     'Test Owner',
      email:                    `${suffix}@example.com`,
      password:                 'password123',
      pendingRestaurantName:    'Test Bistro',
      pendingRestaurantAddress: '1 Test St',
      pendingRestaurantPhone:   '0400000000',
      pendingRestaurantEmail:   `bistro_${suffix}@example.com`,
    });

  const ownerId = regRes.body.user._id;
  await request(app)
    .patch(`/api/admin/owners/${ownerId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: `${suffix}@example.com`, password: 'password123' });

  return {
    ownerToken:   loginRes.body.token,
    restaurantId: loginRes.body.user.restaurantId,
  };
}

async function seedOwnerWithOrders(suffix, orderCount = 1) {
  const { ownerToken, restaurantId } = await seedApprovedOwner(suffix);

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@system.com', password: 'admin123' });
  const adminToken = adminRes.body.token;

  await request(app)
    .post(`/api/admin/restaurants/${restaurantId}/tables`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ totalTables: 3 });

  const sessionRes = await request(app)
    .post('/api/sessions/start')
    .send({ restaurantId, tableNumber: 1 });

  const { _id: sessionId, tableId, tableNumber } = sessionRes.body.session;

  for (let i = 0; i < orderCount; i++) {
    await Order.create({
      restaurantId,
      tableId,
      tableNumber,
      sessionId,
      sessionNumber: 1,
      items: [{ name: 'Burger', price: 15, quantity: 2 }],
      subtotal:    30,
      tax:          3,
      totalAmount: 33,
    });
  }

  return { ownerToken, restaurantId, sessionId, tableId, tableNumber };
}

// ─── GET /api/analytics/my/summary — integration ─────────────────────────────

describe('GET /api/analytics/my/summary — integration', () => {
  it('returns zero values when owner has no orders', async () => {
    const { ownerToken } = await seedApprovedOwner('sumempty');

    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.summary.totalOrders).to.equal(0);
    expect(res.body.summary.totalRevenue).to.equal(0);
    expect(res.body.summary.topItem).to.equal(null);
  });

  it('reflects correct totals when orders exist', async () => {
    const { ownerToken } = await seedOwnerWithOrders('sumorders', 2);

    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.summary.totalOrders).to.equal(2);
    expect(res.body.summary.totalRevenue).to.equal(66);
    expect(res.body.summary.topItem).to.equal('Burger');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/analytics/my/summary');

    expect(res.status).to.equal(401);
  });

  it('returns 403 when owner account is no longer approved', async () => {
    const { ownerToken } = await seedApprovedOwner('an403');

    await User.updateOne(
      { email: 'an403@example.com' },
      { status: 'pending' }
    );

    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(403);
    expect(res.body.message).to.equal('Account is not approved');
  });
});

// ─── GET /api/analytics/my/peak-hours — integration ──────────────────────────

describe('GET /api/analytics/my/peak-hours — integration', () => {
  it('returns peakHoursByDay structure for owner with no orders', async () => {
    const { ownerToken } = await seedApprovedOwner('peakempty');

    const res = await request(app)
      .get('/api/analytics/my/peak-hours')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.peakHours).to.have.property('peakHoursByDay');
    expect(res.body.peakHours.message).to.equal('Insufficient data for peak hours analysis');
  });

  it('returns structured day-of-week data when orders exist', async () => {
    const { ownerToken } = await seedOwnerWithOrders('peakorders', 1);

    const res = await request(app)
      .get('/api/analytics/my/peak-hours')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.peakHours).to.have.property('peakHoursByDay');
    expect(res.body.peakHours).to.have.property('analysisWindow');
  });

  it('accepts optional from/to date range query params', async () => {
    const { ownerToken } = await seedApprovedOwner('peakdates');

    const res = await request(app)
      .get('/api/analytics/my/peak-hours')
      .query({ from: '2026-05-01', to: '2026-05-22' })
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/analytics/my/peak-hours');

    expect(res.status).to.equal(401);
  });
});

// ─── GET /api/analytics/my/item-forecast — integration ───────────────────────

describe('GET /api/analytics/my/item-forecast — integration', () => {
  it('returns empty forecastedItems when owner has no orders', async () => {
    const { ownerToken } = await seedApprovedOwner('forecastempty');

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.forecast.forecastedItems).to.be.an('array').with.lengthOf(0);
    expect(res.body.forecast.message).to.equal('No orders found for this period');
  });

  it('returns item names and quantities when orders exist', async () => {
    const { ownerToken } = await seedOwnerWithOrders('forecastorders', 1);

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.forecast.forecastedItems).to.have.lengthOf(1);
    expect(res.body.forecast.forecastedItems[0].itemName).to.equal('Burger');
    expect(res.body.forecast.forecastedItems[0].totalQuantity).to.equal(2);
  });

  it('sorts items by total quantity (highest first)', async () => {
    const { ownerToken, restaurantId, sessionId, tableId, tableNumber } =
      await seedOwnerWithOrders('forecastsort', 0);

    await Order.create({
      restaurantId, tableId, tableNumber, sessionId, sessionNumber: 1,
      items: [
        { name: 'Burger', price: 15, quantity: 5 },
        { name: 'Salad',  price:  8, quantity: 2 },
      ],
      subtotal: 91, tax: 9.1, totalAmount: 100.1,
    });

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.forecast.forecastedItems[0].itemName).to.equal('Burger');
    expect(res.body.forecast.forecastedItems[1].itemName).to.equal('Salad');
  });

  it('accepts optional from/to date range query params', async () => {
    const { ownerToken } = await seedApprovedOwner('forecastdates');

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .query({ from: '2026-04-01', to: '2026-05-22' })
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/analytics/my/item-forecast');

    expect(res.status).to.equal(401);
  });
});
