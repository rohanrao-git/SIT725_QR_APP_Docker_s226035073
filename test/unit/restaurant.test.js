/**
 * Restaurant Unit Tests
 *
 * All DB calls and auth middleware are stubbed with sinon.
 * No database or running server required.
 *
 * Endpoints covered:
 *   GET /api/restaurants/my
 *   PUT /api/restaurants/my
 */

process.env.JWT_SECRET     = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT           = '5009';

const request       = require('supertest');
const sinon         = require('sinon');
const { expect }    = require('chai');
const generateToken = require('../../backend/utils/generateToken');

const app        = require('../../backend/server');
const User       = require('../../backend/models/User');
const Restaurant = require('../../backend/models/Restaurant');
const AppError   = require('../../backend/utils/AppError');

// ─── Shared constants ─────────────────────────────────────────────────────────

const VALID_RESTAURANT_ID = '507f1f77bcf86cd799439013';

// ─── Token helpers ────────────────────────────────────────────────────────────

function makeOwnerToken() {
  return generateToken('fake-owner-id');
}

function makeAdminToken() {
  return generateToken('fake-admin-id');
}

// ─── Stub helpers ─────────────────────────────────────────────────────────────

// restaurantController.getOwnerRestaurant calls User.findById once after authMiddleware
// so we need two stubbed calls total.
function stubOwnerAuth() {
  const stub = sinon.stub(User, 'findById');
  // First call: authMiddleware
  stub.onFirstCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id', role: 'owner',
      email: 'owner@test.com', name: 'Test Owner',
    }),
  });
  // Second call: restaurantController.getOwnerRestaurant
  stub.onSecondCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id', role: 'owner',
      status: 'approved', restaurantId: VALID_RESTAURANT_ID,
    }),
  });
  return stub;
}

function stubAdminAuth() {
  sinon.stub(User, 'findById').returns({
    select: sinon.stub().resolves({
      _id: 'fake-admin-id', role: 'super_admin',
      email: 'admin@test.com', name: 'Admin',
    }),
  });
}

function stubUnapprovedOwnerAuth() {
  const stub = sinon.stub(User, 'findById');
  stub.onFirstCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id', role: 'owner',
      email: 'owner@test.com', name: 'Test Owner',
    }),
  });
  stub.onSecondCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id', role: 'owner',
      status: 'pending', restaurantId: null,
    }),
  });
}

function makeFakeRestaurant(overrides = {}) {
  return {
    _id:      VALID_RESTAURANT_ID,
    name:     'Test Bistro',
    address:  '42 Collins St, Melbourne VIC 3000',
    phone:    '0312345678',
    email:    'bistro@test.com',
    isActive: true,
    save:     async () => {},
    ...overrides,
  };
}

// ─── GET /api/restaurants/my ─────────────────────────────────────────────────

describe('GET /api/restaurants/my', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and restaurant data for an approved owner', async () => {
    stubOwnerAuth();
    sinon.stub(Restaurant, 'findById').resolves(makeFakeRestaurant());

    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.restaurant).to.have.property('name', 'Test Bistro');
    expect(res.body.restaurant).to.have.property('address');
  });

  it('should return 404 when the restaurant does not exist in DB', async () => {
    stubOwnerAuth();
    sinon.stub(Restaurant, 'findById').resolves(null);

    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(404);
    expect(res.body.success).to.equal(false);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/restaurants/my');

    expect(res.status).to.equal(401);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(res.status).to.equal(401);
  });

  it('should return 403 when an admin token is used on this owner-only route', async () => {
    stubAdminAuth();

    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(403);
  });

  it('should return 403 for an unapproved owner', async () => {
    stubUnapprovedOwnerAuth();

    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── PUT /api/restaurants/my ─────────────────────────────────────────────────

describe('PUT /api/restaurants/my', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the updated restaurant on success', async () => {
    stubOwnerAuth();
    const updatedRestaurant = makeFakeRestaurant({ name: 'Updated Bistro', address: '99 New St' });
    sinon.stub(Restaurant, 'findById').resolves(updatedRestaurant);

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'Updated Bistro', address: '99 New St' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.restaurant.name).to.equal('Updated Bistro');
    expect(res.body.restaurant.address).to.equal('99 New St');
  });

  it('should return 200 when only the name is updated', async () => {
    stubOwnerAuth();
    sinon.stub(Restaurant, 'findById').resolves(makeFakeRestaurant({ name: 'New Name' }));

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'New Name' });

    expect(res.status).to.equal(200);
    expect(res.body.restaurant.name).to.equal('New Name');
  });

  it('should return 200 when only the phone is updated', async () => {
    stubOwnerAuth();
    sinon.stub(Restaurant, 'findById').resolves(makeFakeRestaurant({ phone: '0400111222' }));

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ phone: '0400111222' });

    expect(res.status).to.equal(200);
  });

  it('should return 400 when no update fields are provided', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Nothing to update');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .put('/api/restaurants/my')
      .send({ name: 'Anything' });

    expect(res.status).to.equal(401);
  });

  it('should return 403 when admin token is used on this owner-only route', async () => {
    stubAdminAuth();

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ name: 'Changed' });

    expect(res.status).to.equal(403);
  });
});
