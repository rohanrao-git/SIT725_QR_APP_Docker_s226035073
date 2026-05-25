/**
 * Admin Integration Tests
 *
 * Tests the full admin stack (controller → service → real MongoDB) using
 * an in-memory MongoDB instance.
 *
 * Endpoints covered:
 *   GET   /api/admin/owners
 *   GET   /api/admin/owners/pending
 *   PATCH /api/admin/owners/:id/approve
 *   PATCH /api/admin/owners/:id/reject
 *   PATCH /api/admin/owners/:id/disable
 *   PATCH /api/admin/owners/:id/enable
 *   GET   /api/admin/restaurants
 *   POST  /api/admin/restaurants/:id/tables
 *   GET   /api/admin/restaurants/:id/tables
 */

const request    = require('supertest');
const { expect } = require('chai');
const bcrypt     = require('bcryptjs');
const User       = require('../../backend/models/User');
const app        = require('../../backend/server');

// Lifecycle is managed by test/integration/hooks.js (Mocha root hooks).

// ─── Seed Helpers ─────────────────────────────────────────────────────────────

async function seedAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  await User.create({
    name: 'System Admin', email: 'admin@system.com',
    password: hash, role: 'super_admin', status: 'approved',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@system.com', password: 'admin123' });
  return res.body.token;
}

async function registerPendingOwner(suffix = 'owner') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: `Owner ${suffix}`, email: `${suffix}@example.com`,
      password: 'password123',
      pendingRestaurantName: `${suffix} Bistro`,
      pendingRestaurantAddress: '42 Collins St Melbourne',
      pendingRestaurantPhone: '0312345678',
      pendingRestaurantEmail: `bistro_${suffix}@example.com`,
    });
  return res.body.user._id;
}

// ─── GET /api/admin/owners ────────────────────────────────────────────────────

describe('GET /api/admin/owners — integration', () => {
  it('returns 200 and lists all owners', async () => {
    const adminToken = await seedAdmin();
    await registerPendingOwner('listowner1');
    await registerPendingOwner('listowner2');

    const res = await request(app)
      .get('/api/admin/owners')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.owners).to.be.an('array').with.lengthOf(2);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/admin/owners');
    expect(res.status).to.equal(401);
  });

  it('returns 403 when called with an owner token', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('forbiddenowner');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'forbiddenowner@example.com', password: 'password123' });

    const res = await request(app)
      .get('/api/admin/owners')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).to.equal(403);
  });
});

// ─── GET /api/admin/owners/pending ───────────────────────────────────────────

describe('GET /api/admin/owners/pending — integration', () => {
  it('returns 200 and only pending owners', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('pendingtest1');
    await registerPendingOwner('pendingtest2');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/admin/owners/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.owners).to.be.an('array').with.lengthOf(1);
    expect(res.body.owners[0].status).to.equal('pending');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/admin/owners/pending');
    expect(res.status).to.equal(401);
  });
});

// ─── PATCH /api/admin/owners/:id/approve ─────────────────────────────────────

describe('PATCH /api/admin/owners/:id/approve — integration', () => {
  it('approves a pending owner, creates their restaurant, and returns 200', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('toapprove');

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);

    const inDB = await User.findById(ownerId);
    expect(inDB.status).to.equal('approved');
    expect(inDB.restaurantId).to.not.be.null;
  });

  it('approved owner can login successfully', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('nowapproved');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nowapproved@example.com', password: 'password123' });

    expect(loginRes.status).to.equal(200);
    expect(loginRes.body).to.have.property('token');
  });

  it('returns 400 when the owner id is not a valid ObjectId', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/not-a-valid-id/approve')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(400);
  });

  it('returns 404 when the owner id does not exist', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/64a1b2c3d4e5f6a7b8c9d0e1/approve')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(404);
  });

  it('returns 409 when the owner is already approved (has a linked restaurant)', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('alreadyapproved');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(409);
  });

  it('returns 401 with no token', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('noapprovetoken');

    const res = await request(app).patch(`/api/admin/owners/${ownerId}/approve`);
    expect(res.status).to.equal(401);
  });
});

// ─── PATCH /api/admin/owners/:id/reject ──────────────────────────────────────

describe('PATCH /api/admin/owners/:id/reject — integration', () => {
  it('rejects a pending owner and returns 200', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('toreject');

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);

    const inDB = await User.findById(ownerId);
    expect(inDB.status).to.equal('rejected');
  });

  it('returns 400 when the owner id is not a valid ObjectId', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/not-a-valid-id/reject')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(400);
  });

  it('returns 404 when the owner id does not exist', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/64a1b2c3d4e5f6a7b8c9d0e1/reject')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(404);
  });

  it('rejected owner cannot login', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('rejectedlogin');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rejectedlogin@example.com', password: 'password123' });

    expect(res.status).to.equal(403);
  });
});

// ─── PATCH /api/admin/owners/:id/disable ─────────────────────────────────────

describe('PATCH /api/admin/owners/:id/disable — integration', () => {
  it('disables a pending owner and returns 200', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('todisable');

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);

    const inDB = await User.findById(ownerId);
    expect(inDB.status).to.equal('disabled');
  });

  it('returns 400 when the owner id is not a valid ObjectId', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/not-a-valid-id/disable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(400);
  });

  it('returns 404 when the owner id does not exist', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/64a1b2c3d4e5f6a7b8c9d0e1/disable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(404);
  });

  it('returns 403 when called with an owner token', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('disableforbidden');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'disableforbidden@example.com', password: 'password123' });

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/disable`)
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).to.equal(403);
  });

  it('disabled owner cannot login', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('disabledlogin');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'disabledlogin@example.com', password: 'password123' });

    expect(res.status).to.equal(403);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .patch('/api/admin/owners/64a1b2c3d4e5f6a7b8c9d0e1/disable');
    expect(res.status).to.equal(401);
  });
});

// ─── PATCH /api/admin/owners/:id/enable ──────────────────────────────────────

describe('PATCH /api/admin/owners/:id/enable — integration', () => {
  it('enables a disabled owner and returns 200', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('toenable');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/enable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);

    const inDB = await User.findById(ownerId);
    expect(inDB.status).to.equal('approved');
  });

  it('enabled owner can login after being re-enabled', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('enablelogin');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/enable`)
      .set('Authorization', `Bearer ${adminToken}`);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'enablelogin@example.com', password: 'password123' });

    expect(loginRes.status).to.equal(200);
    expect(loginRes.body).to.have.property('token');
  });

  it('returns 400 when owner is not currently disabled', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('enablenotdisabled');

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/enable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(400);
  });

  it('returns 400 when the owner id is not a valid ObjectId', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/not-a-valid-id/enable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(400);
  });

  it('returns 404 when the owner id does not exist', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .patch('/api/admin/owners/64a1b2c3d4e5f6a7b8c9d0e1/enable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(404);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .patch('/api/admin/owners/64a1b2c3d4e5f6a7b8c9d0e1/enable');
    expect(res.status).to.equal(401);
  });

  it('returns 403 when called with an owner token', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('enableforbidden');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'enableforbidden@example.com', password: 'password123' });

    const res = await request(app)
      .patch(`/api/admin/owners/${ownerId}/enable`)
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).to.equal(403);
  });
});

// ─── GET /api/admin/restaurants ──────────────────────────────────────────────

describe('GET /api/admin/restaurants — integration', () => {
  it('returns 200 and lists all restaurants after approving owners', async () => {
    const adminToken = await seedAdmin();
    const owner1Id   = await registerPendingOwner('restlist1');
    const owner2Id   = await registerPendingOwner('restlist2');

    await request(app)
      .patch(`/api/admin/owners/${owner1Id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .patch(`/api/admin/owners/${owner2Id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/admin/restaurants')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.restaurants).to.be.an('array').with.lengthOf(2);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/admin/restaurants');
    expect(res.status).to.equal(401);
  });
});

// ─── POST /api/admin/restaurants/:id/tables ───────────────────────────────────

describe('POST /api/admin/restaurants/:id/tables — integration', () => {
  it('creates tables for a restaurant and returns 201 with QR codes', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('tableowner1');

    const approveRes = await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const restaurantId = approveRes.body.user.restaurantId;

    const res = await request(app)
      .post(`/api/admin/restaurants/${restaurantId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ totalTables: 3 });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.tables).to.be.an('array').with.lengthOf(3);
    expect(res.body.tables[0]).to.have.property('qrCodeUrl');
    expect(res.body.tables[0]).to.have.property('tableNumber', 1);
  });

  it('returns 400 when totalTables is not a valid integer', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('tableowner2');

    const approveRes = await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const restaurantId = approveRes.body.user.restaurantId;

    const res = await request(app)
      .post(`/api/admin/restaurants/${restaurantId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ totalTables: -1 });

    expect(res.status).to.equal(400);
  });

  it('returns 404 when the restaurant does not exist', async () => {
    const adminToken    = await seedAdmin();
    const fakeRestaurantId = '64a1b2c3d4e5f6a7b8c9d0e1';

    const res = await request(app)
      .post(`/api/admin/restaurants/${fakeRestaurantId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ totalTables: 2 });

    expect(res.status).to.equal(404);
  });

  it('returns 400 when totalTables is a non-numeric string', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('tableowner5');

    const approveRes = await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const restaurantId = approveRes.body.user.restaurantId;

    const res = await request(app)
      .post(`/api/admin/restaurants/${restaurantId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ totalTables: 'five' });

    expect(res.status).to.equal(400);
  });

  it('returns 400 when the restaurant id is not a valid ObjectId', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .post('/api/admin/restaurants/not-a-valid-id/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ totalTables: 3 });

    expect(res.status).to.equal(400);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/admin/restaurants/64a1b2c3d4e5f6a7b8c9d0e1/tables')
      .send({ totalTables: 2 });
    expect(res.status).to.equal(401);
  });
});

// ─── GET /api/admin/restaurants/:id/tables ────────────────────────────────────

describe('GET /api/admin/restaurants/:id/tables — integration', () => {
  it('returns 200 and the tables for a restaurant', async () => {
    const adminToken = await seedAdmin();
    const ownerId    = await registerPendingOwner('tableowner3');

    const approveRes = await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const restaurantId = approveRes.body.user.restaurantId;

    await request(app)
      .post(`/api/admin/restaurants/${restaurantId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ totalTables: 4 });

    const res = await request(app)
      .get(`/api/admin/restaurants/${restaurantId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.tables).to.be.an('array').with.lengthOf(4);
  });

  it('returns 404 when the restaurant does not exist', async () => {
    const adminToken       = await seedAdmin();
    const fakeRestaurantId = '64a1b2c3d4e5f6a7b8c9d0e1';

    const res = await request(app)
      .get(`/api/admin/restaurants/${fakeRestaurantId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(404);
  });

  it('returns 400 when the restaurant id is not a valid ObjectId', async () => {
    const adminToken = await seedAdmin();

    const res = await request(app)
      .get('/api/admin/restaurants/not-a-valid-id/tables')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(400);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/admin/restaurants/64a1b2c3d4e5f6a7b8c9d0e1/tables');
    expect(res.status).to.equal(401);
  });
});
