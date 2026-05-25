/**
 * Admin Unit Tests
 *
 * All service calls are stubbed with sinon. No database or running server required.
 * Unlike auth/menu controllers, adminController passes errors to next(error),
 * so service failures return 500 via Express's default error handler.
 *
 * Endpoints covered:
 *   GET   /api/admin/owners/pending
 *   GET   /api/admin/owners
 *   PATCH /api/admin/owners/:id/approve
 *   PATCH /api/admin/owners/:id/reject
 *   PATCH /api/admin/owners/:id/disable
 *   PATCH /api/admin/owners/:id/enable
 *   GET   /api/admin/restaurants
 *   POST  /api/admin/restaurants/:id/tables
 *   GET   /api/admin/restaurants/:id/tables
 */

// Set env vars before any module is required
process.env.JWT_SECRET     = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT           = '5005';

const request       = require('supertest');
const { expect }    = require('chai');
const sinon         = require('sinon');
const generateToken = require('../../backend/utils/generateToken');
const AppError      = require('../../backend/utils/AppError');

const app          = require('../../backend/server');
const adminService = require('../../backend/services/adminService');
const User         = require('../../backend/models/User');

// ─── Token helpers ────────────────────────────────────────────────────────────

function makeAdminToken() {
  return generateToken('fake-admin-id');
}

function makeOwnerToken() {
  return generateToken('fake-owner-id');
}

// ─── Stub helpers ─────────────────────────────────────────────────────────────

// Admin routes only have one User.findById call (auth middleware).
// No getOwnerContext second call like in menu routes.
function stubAdminAuth() {
  sinon.stub(User, 'findById').returns({
    select: sinon.stub().resolves({
      _id: 'fake-admin-id', role: 'super_admin',
      email: 'admin@test.com', name: 'Admin',
    }),
  });
}

function stubOwnerAuth() {
  sinon.stub(User, 'findById').returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id', role: 'owner',
      email: 'owner@test.com', name: 'Owner',
    }),
  });
}

// ─── Shared fake data ─────────────────────────────────────────────────────────

const FAKE_OWNER_ID      = '507f1f77bcf86cd799439011';
const FAKE_RESTAURANT_ID = '507f1f77bcf86cd799439012';

const fakeOwners = [
  { _id: FAKE_OWNER_ID, name: 'Test Owner', email: 'owner@test.com', role: 'owner', status: 'pending' },
];

const fakeApprovedUser  = { _id: FAKE_OWNER_ID, name: 'Test Owner', role: 'owner', status: 'approved' };
const fakeRejectedUser  = { _id: FAKE_OWNER_ID, name: 'Test Owner', role: 'owner', status: 'rejected' };
const fakeDisabledUser  = { _id: FAKE_OWNER_ID, name: 'Test Owner', role: 'owner', status: 'disabled' };

const fakeRestaurants = [
  { _id: FAKE_RESTAURANT_ID, name: 'Test Bistro', address: '42 Collins St' },
];

const fakeTables = [
  { tableNumber: 1, restaurantId: FAKE_RESTAURANT_ID, qrCodeUrl: 'https://example.com/qr/1' },
  { tableNumber: 2, restaurantId: FAKE_RESTAURANT_ID, qrCodeUrl: 'https://example.com/qr/2' },
];

// ─── GET /api/admin/owners/pending ───────────────────────────────────────────

describe('GET /api/admin/owners/pending', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a list of pending owners', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'getPendingOwners').resolves(fakeOwners);

    const res = await request(app)
      .get('/api/admin/owners/pending')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.owners).to.be.an('array');
    expect(res.body.owners[0].status).to.equal('pending');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/admin/owners/pending');
    expect(res.status).to.equal(401);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .get('/api/admin/owners/pending')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── GET /api/admin/owners ────────────────────────────────────────────────────

describe('GET /api/admin/owners', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a list of all owners', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'getAllOwners').resolves(fakeOwners);

    const res = await request(app)
      .get('/api/admin/owners')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.owners).to.be.an('array');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/admin/owners');
    expect(res.status).to.equal(401);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .get('/api/admin/owners')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── PATCH /api/admin/owners/:id/approve ─────────────────────────────────────

describe('PATCH /api/admin/owners/:id/approve', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the approved user', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'approveOwner').resolves(fakeApprovedUser);

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/approve`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.status).to.equal('approved');
  });

  it('should return 404 when the owner is not found', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'approveOwner')
      .rejects(new AppError('Owner not found', 404, 'OWNER_NOT_FOUND'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/approve`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(404);
  });

  it('should return 400 when the owner id is invalid', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'approveOwner')
      .rejects(new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/approve`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(400);
  });

  it('should return 409 when the owner already has a linked restaurant', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'approveOwner')
      .rejects(new AppError('Owner already has a linked restaurant', 409, 'OWNER_ALREADY_LINKED'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/approve`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(409);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).patch(`/api/admin/owners/${FAKE_OWNER_ID}/approve`);
    expect(res.status).to.equal(401);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/approve`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── PATCH /api/admin/owners/:id/reject ──────────────────────────────────────

describe('PATCH /api/admin/owners/:id/reject', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the rejected user', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'rejectOwner').resolves(fakeRejectedUser);

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/reject`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.status).to.equal('rejected');
  });

  it('should return 404 when the owner is not found', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'rejectOwner')
      .rejects(new AppError('Owner not found', 404, 'OWNER_NOT_FOUND'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/reject`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(404);
  });

  it('should return 400 when the owner id is invalid', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'rejectOwner')
      .rejects(new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/reject`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(400);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).patch(`/api/admin/owners/${FAKE_OWNER_ID}/reject`);
    expect(res.status).to.equal(401);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/reject`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── PATCH /api/admin/owners/:id/disable ─────────────────────────────────────

describe('PATCH /api/admin/owners/:id/disable', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the disabled user', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'disableOwner').resolves(fakeDisabledUser);

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/disable`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.status).to.equal('disabled');
  });

  it('should return 404 when the owner is not found', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'disableOwner')
      .rejects(new AppError('Owner not found', 404, 'OWNER_NOT_FOUND'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/disable`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(404);
  });

  it('should return 400 when the owner id is invalid', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'disableOwner')
      .rejects(new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/disable`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(400);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).patch(`/api/admin/owners/${FAKE_OWNER_ID}/disable`);
    expect(res.status).to.equal(401);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/disable`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── PATCH /api/admin/owners/:id/enable ──────────────────────────────────────

describe('PATCH /api/admin/owners/:id/enable', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the re-enabled user', async () => {
    stubAdminAuth();
    const fakeEnabledUser = { _id: FAKE_OWNER_ID, name: 'Test Owner', role: 'owner', status: 'approved' };
    sinon.stub(adminService, 'enableOwner').resolves(fakeEnabledUser);

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/enable`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.status).to.equal('approved');
  });

  it('should return 404 when the owner is not found', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'enableOwner')
      .rejects(new AppError('Owner not found', 404, 'OWNER_NOT_FOUND'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/enable`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(404);
  });

  it('should return 400 when the owner id is invalid', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'enableOwner')
      .rejects(new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/enable`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(400);
  });

  it('should return 400 when the owner is not currently disabled', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'enableOwner')
      .rejects(new AppError('Owner account is not disabled', 400, 'OWNER_NOT_DISABLED'));

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/enable`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(400);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).patch(`/api/admin/owners/${FAKE_OWNER_ID}/enable`);
    expect(res.status).to.equal(401);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .patch(`/api/admin/owners/${FAKE_OWNER_ID}/enable`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── GET /api/admin/restaurants ──────────────────────────────────────────────

describe('GET /api/admin/restaurants', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a list of all restaurants', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'getAllRestaurants').resolves(fakeRestaurants);

    const res = await request(app)
      .get('/api/admin/restaurants')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.restaurants).to.be.an('array');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/admin/restaurants');
    expect(res.status).to.equal(401);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .get('/api/admin/restaurants')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── POST /api/admin/restaurants/:id/tables ──────────────────────────────────

describe('POST /api/admin/restaurants/:id/tables', () => {
  afterEach(() => sinon.restore());

  it('should return 201 and the created tables', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'setTables').resolves(fakeTables);

    const res = await request(app)
      .post(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ totalTables: 2 });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.tables).to.be.an('array').with.lengthOf(2);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .post(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ totalTables: 2 });

    expect(res.status).to.equal(403);
  });

  it('should return 400 when totalTables is missing from the body', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'setTables')
      .rejects(new AppError('totalTables must be a non-negative integer', 400, 'INVALID_TOTAL_TABLES'));

    const res = await request(app)
      .post(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({});

    expect(res.status).to.equal(400);
  });

  it('should return 404 when the restaurant does not exist', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'setTables')
      .rejects(new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND'));

    const res = await request(app)
      .post(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ totalTables: 3 });

    expect(res.status).to.equal(404);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .post(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .send({ totalTables: 2 });
    expect(res.status).to.equal(401);
  });
});

// ─── GET /api/admin/restaurants/:id/tables ───────────────────────────────────

describe('GET /api/admin/restaurants/:id/tables', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the tables for a restaurant', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'getTablesByRestaurant').resolves(fakeTables);

    const res = await request(app)
      .get(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.tables).to.be.an('array').with.lengthOf(2);
    expect(res.body.tables[0]).to.have.property('tableNumber', 1);
  });

  it('should return 403 when called with an owner token', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .get(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });

  it('should return 404 when the restaurant does not exist', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'getTablesByRestaurant')
      .rejects(new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND'));

    const res = await request(app)
      .get(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(404);
  });

  it('should return 400 for a malformed restaurant id', async () => {
    stubAdminAuth();
    sinon.stub(adminService, 'getTablesByRestaurant')
      .rejects(new AppError('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID'));

    const res = await request(app)
      .get('/api/admin/restaurants/not-a-valid-id/tables')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(400);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .get(`/api/admin/restaurants/${FAKE_RESTAURANT_ID}/tables`);
    expect(res.status).to.equal(401);
  });
});
