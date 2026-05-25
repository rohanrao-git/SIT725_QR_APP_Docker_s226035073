/**
 * Session Integration Tests
 *
 * Endpoints covered:
 *   POST   /api/sessions/start
 *   GET    /api/sessions/active
 *   GET    /api/sessions/:sessionId
 *   PATCH  /api/sessions/:sessionId/close
 */

const request = require('supertest');
const { expect } = require('chai');
const bcrypt = require('bcryptjs');
const mongoose = require('../../backend/testUtils');
const User = require('../../backend/models/User');
const app = require('../../backend/server');

async function seedAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  await User.create({
    name: 'System Admin',
    email: 'admin@system.com',
    password: hash,
    role: 'super_admin',
    status: 'approved',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@system.com', password: 'admin123' });
  return { token: res.body.token };
}

async function seedApprovedOwnerWithTables(suffix = 'session') {
  const { token: adminToken } = await seedAdmin();

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Test Owner',
      email: `${suffix}@example.com`,
      password: 'password123',
      pendingRestaurantName: 'Session Bistro',
      pendingRestaurantAddress: '42 Collins St Melbourne',
      pendingRestaurantPhone: '0312345678',
      pendingRestaurantEmail: `bistro_${suffix}@example.com`,
    });

  const ownerId = regRes.body.user._id;
  await request(app)
    .patch(`/api/admin/owners/${ownerId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: `${suffix}@example.com`, password: 'password123' });

  const restaurantId = loginRes.body.user.restaurantId;

  await request(app)
    .post(`/api/admin/restaurants/${restaurantId}/tables`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ totalTables: 4 });

  return {
    ownerToken: loginRes.body.token,
    adminToken,
    restaurantId,
  };
}

describe('POST /api/sessions/start — integration', () => {
  it('creates a new active session for a table', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessstart');

    const res = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 2 });

    expect(res.status).to.equal(201);
    expect(res.body.created).to.equal(true);
    expect(res.body.session.status).to.equal('active');
    expect(res.body.session.tableNumber).to.equal(2);
    expect(res.body.session.sessionNumber).to.equal(1);
  });

  it('returns existing active session on second start for same table', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessreuse');

    const first = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 1 });

    const second = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 1 });

    expect(second.status).to.equal(200);
    expect(second.body.created).to.equal(false);
    expect(String(second.body.session._id)).to.equal(String(first.body.session._id));
  });

  it('assigns a new sessionNumber after previous session is closed', async () => {
    const { restaurantId, ownerToken } = await seedApprovedOwnerWithTables('sessreopen');

    const first = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 3 });

    await request(app)
      .patch(`/api/sessions/${first.body.session._id}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const second = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 3 });

    expect(second.status).to.equal(201);
    expect(second.body.created).to.equal(true);
    expect(second.body.session.sessionNumber).to.equal(2);
    expect(second.body.session.status).to.equal('active');
  });

  it('returns 404 when table does not exist', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessnotable');

    const res = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 99 });

    expect(res.status).to.equal(404);
  });

  it('returns 400 when restaurantId is missing', async () => {
    const res = await request(app)
      .post('/api/sessions/start')
      .send({ tableNumber: 1 });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('restaurantId and tableNumber are required');
  });

  it('returns 400 when tableNumber is missing', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessmissingtable');

    const res = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('restaurantId and tableNumber are required');
  });
});

describe('GET /api/sessions/active — integration', () => {
  it('returns active session for table', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessactive');

    await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 4 });

    const res = await request(app)
      .get('/api/sessions/active')
      .query({ restaurantId, tableNumber: 4 });

    expect(res.status).to.equal(200);
    expect(res.body.session.tableNumber).to.equal(4);
    expect(res.body.session.status).to.equal('active');
  });

  it('returns 400 when query params are missing', async () => {
    const res = await request(app).get('/api/sessions/active');
    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('restaurantId and tableNumber query params are required');
  });

  it('returns 404 when no active session exists for table', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessnoactive');

    const res = await request(app)
      .get('/api/sessions/active')
      .query({ restaurantId, tableNumber: 1 });

    expect(res.status).to.equal(404);
  });
});

describe('PATCH /api/sessions/:sessionId/close — integration', () => {
  it('owner can close session at their restaurant', async () => {
    const { restaurantId, ownerToken } = await seedApprovedOwnerWithTables('sessclose');

    const startRes = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 2 });

    const res = await request(app)
      .patch(`/api/sessions/${startRes.body.session._id}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.session.status).to.equal('closed');
    expect(res.body.session.closedAt).to.exist;
  });

  it('returns 400 when closing an already closed session', async () => {
    const { restaurantId, ownerToken } = await seedApprovedOwnerWithTables('sessclosedtwice');

    const startRes = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 1 });

    const sessionId = startRes.body.session._id;

    await request(app)
      .patch(`/api/sessions/${sessionId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const res = await request(app)
      .patch(`/api/sessions/${sessionId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(400);
  });

  it('returns 401 when closing session without auth token', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessnoauth');

    const startRes = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 2 });

    const res = await request(app)
      .patch(`/api/sessions/${startRes.body.session._id}/close`);

    expect(res.status).to.equal(401);
  });
});

describe('GET /api/sessions/:sessionId — integration', () => {
  it('returns session by id without auth', async () => {
    const { restaurantId } = await seedApprovedOwnerWithTables('sessget');

    const startRes = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId, tableNumber: 1 });

    const res = await request(app).get(`/api/sessions/${startRes.body.session._id}`);

    expect(res.status).to.equal(200);
    expect(res.body.session.tableNumber).to.equal(1);
  });

  it('returns 404 for unknown session id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/sessions/${fakeId}`);
    expect(res.status).to.equal(404);
  });
});
