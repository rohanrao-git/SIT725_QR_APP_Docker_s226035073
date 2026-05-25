/**
 * Menu Unit Tests
 *
 * All service calls, DB queries, and auth middleware are stubbed with sinon.
 * No database or running server required.
 *
 * Endpoints covered:
 *   GET    /api/menu/my
 *   GET    /api/menu/my/tables
 *   POST   /api/menu/my
 *   PUT    /api/menu/my/:itemId
 *   PATCH  /api/menu/my/:itemId/availability
 *   DELETE /api/menu/my/:itemId
 *   GET    /api/menu/:restaurantId  (admin only)
 *   GET    /api/menu/public/:restaurantId  (guest, no auth)
 *   POST   /api/menu/my/images
 *   GET    /api/menu/images/:imageFileId
 */

// Set env vars before any module is required
process.env.JWT_SECRET     = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT           = '5004';

const request       = require('supertest');
const sinon         = require('sinon');
const { expect }    = require('chai');
const generateToken = require('../../backend/utils/generateToken');

const app         = require('../../backend/server');
const menuService = require('../../backend/services/menuService');
const User        = require('../../backend/models/User');
const MenuItem    = require('../../backend/models/MenuItem');
const Restaurant  = require('../../backend/models/Restaurant');
const AppError    = require('../../backend/utils/AppError');
const Table       = require('../../backend/models/Table');

// ─── Token helpers ────────────────────────────────────────────────────────────

function makeOwnerToken() {
  return generateToken('fake-owner-id');
}

function makeAdminToken() {
  return generateToken('fake-admin-id');
}

// ─── Stub helpers ─────────────────────────────────────────────────────────────

// authMiddleware calls User.findById first, then getOwnerContext calls it again.
// onFirstCall → middleware result, onSecondCall → controller result.
function stubOwnerAuth() {
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
      status: 'approved', restaurantId: 'fake-restaurant-id',
    }),
  });
  return stub;
}

// Admin auth only needs one findById (no getOwnerContext in admin-accessible routes).
function stubAdminAuth() {
  sinon.stub(User, 'findById').returns({
    select: sinon.stub().resolves({
      _id: 'fake-admin-id', role: 'super_admin',
      email: 'admin@test.com', name: 'Admin',
    }),
  });
}

// ─── Shared fake data ─────────────────────────────────────────────────────────

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011';

const fakeItem = {
  _id: VALID_OBJECT_ID,
  restaurantId: 'fake-restaurant-id',
  name: 'Margherita Pizza',
  category: 'Mains',
  description: 'Classic tomato and mozzarella.',
  price: 18.5,
  isAvailable: true,
};

// ─── GET /api/menu/my ─────────────────────────────────────────────────────────

describe('GET /api/menu/my', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a menu array for an approved owner', async () => {
    stubOwnerAuth();
    sinon.stub(MenuItem, 'find').returns({ sort: sinon.stub().resolves([fakeItem]) });

    const res = await request(app)
      .get('/api/menu/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.menu).to.be.an('array');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/menu/my');
    expect(res.status).to.equal(401);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/menu/my')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).to.equal(401);
  });

  it('should return 403 when account is not approved', async () => {
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

    const res = await request(app)
      .get('/api/menu/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
    expect(res.body.success).to.equal(false);
  });

  it('should return 403 when an admin token is used on an owner-only route', async () => {
    stubAdminAuth();

    const res = await request(app)
      .get('/api/menu/my')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── GET /api/menu/my/tables ──────────────────────────────────────────────────

describe('GET /api/menu/my/tables', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a tables array for an approved owner', async () => {
    stubOwnerAuth();
    sinon.stub(Table, 'find').returns({
      sort: sinon.stub().resolves([{ tableNumber: 1 }, { tableNumber: 2 }]),
    });

    const res = await request(app)
      .get('/api/menu/my/tables')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.tables).to.be.an('array');
  });

  it('should return 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/menu/my/tables')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).to.equal(401);
  });

  it('should return 403 when an admin token is used on an owner-only route', async () => {
    stubAdminAuth();

    const res = await request(app)
      .get('/api/menu/my/tables')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(403);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/menu/my/tables');
    expect(res.status).to.equal(401);
  });
});

// ─── POST /api/menu/my ────────────────────────────────────────────────────────

describe('POST /api/menu/my', () => {
  afterEach(() => sinon.restore());

  it('should return 201 and the created item on success', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'createMenuItem').resolves(fakeItem);

    const res = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'Margherita Pizza', price: 18.5, category: 'Mains' });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.item).to.have.property('name', 'Margherita Pizza');
  });

  it('should return 400 when name is missing', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ price: 18.5 });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Name and price are required');
  });

  it('should return 400 when price is missing', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'Garlic Bread' });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 400 when request body is empty', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({});

    expect(res.status).to.equal(400);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .post('/api/menu/my')
      .send({ name: 'Pizza', price: 15 });
    expect(res.status).to.equal(401);
  });
});

// ─── PUT /api/menu/my/:itemId ─────────────────────────────────────────────────

describe('PUT /api/menu/my/:itemId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the updated item on success', async () => {
    stubOwnerAuth();
    const updatedItem = { ...fakeItem, name: 'Hawaiian Pizza', price: 20 };
    sinon.stub(menuService, 'updateMenuItem').resolves(updatedItem);

    const res = await request(app)
      .put(`/api/menu/my/${VALID_OBJECT_ID}`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'Hawaiian Pizza', price: 20 });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.item.name).to.equal('Hawaiian Pizza');
  });

  it('should return 404 when the item does not exist', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'updateMenuItem').rejects(new AppError('Menu item not found', 404));

    const res = await request(app)
      .put(`/api/menu/my/${VALID_OBJECT_ID}`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'Ghost Item' });

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Menu item not found');
  });

  it('should return 400 for a malformed ObjectId', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'updateMenuItem').rejects(new AppError('Invalid item id', 400));

    const res = await request(app)
      .put('/api/menu/my/not-a-valid-id')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'X' });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Invalid item id');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .put(`/api/menu/my/${VALID_OBJECT_ID}`)
      .send({ name: 'X' });
    expect(res.status).to.equal(401);
  });
});

// ─── PATCH /api/menu/my/:itemId/availability ──────────────────────────────────

describe('PATCH /api/menu/my/:itemId/availability', () => {
  afterEach(() => sinon.restore());

  it('should return 200 when toggling availability to false', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'setAvailability').resolves({ ...fakeItem, isAvailable: false });

    const res = await request(app)
      .patch(`/api/menu/my/${VALID_OBJECT_ID}/availability`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ isAvailable: false });

    expect(res.status).to.equal(200);
    expect(res.body.item.isAvailable).to.equal(false);
  });

  it('should return 200 when toggling availability to true', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'setAvailability').resolves({ ...fakeItem, isAvailable: true });

    const res = await request(app)
      .patch(`/api/menu/my/${VALID_OBJECT_ID}/availability`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ isAvailable: true });

    expect(res.status).to.equal(200);
    expect(res.body.item.isAvailable).to.equal(true);
  });

  it('should return 400 when isAvailable is a string', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .patch(`/api/menu/my/${VALID_OBJECT_ID}/availability`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ isAvailable: 'yes' });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('isAvailable must be a boolean');
  });

  it('should return 400 when isAvailable is a number', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .patch(`/api/menu/my/${VALID_OBJECT_ID}/availability`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ isAvailable: 1 });

    expect(res.status).to.equal(400);
  });

  it('should return 404 when the item does not exist', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'setAvailability').rejects(new AppError('Menu item not found', 404));

    const res = await request(app)
      .patch(`/api/menu/my/${VALID_OBJECT_ID}/availability`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ isAvailable: false });

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Menu item not found');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .patch(`/api/menu/my/${VALID_OBJECT_ID}/availability`)
      .send({ isAvailable: true });
    expect(res.status).to.equal(401);
  });
});

// ─── DELETE /api/menu/my/:itemId ──────────────────────────────────────────────

describe('DELETE /api/menu/my/:itemId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and success message on deletion', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'deleteMenuItem').resolves();

    const res = await request(app)
      .delete(`/api/menu/my/${VALID_OBJECT_ID}`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.message).to.equal('Menu item deleted');
  });

  it('should return 404 when the item does not exist', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'deleteMenuItem').rejects(new AppError('Menu item not found', 404));

    const res = await request(app)
      .delete(`/api/menu/my/${VALID_OBJECT_ID}`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Menu item not found');
  });

  it('should return 400 for a malformed ObjectId', async () => {
    stubOwnerAuth();
    sinon.stub(menuService, 'deleteMenuItem').rejects(new AppError('Invalid item id', 400));

    const res = await request(app)
      .delete('/api/menu/my/not-a-valid-id')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Invalid item id');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).delete(`/api/menu/my/${VALID_OBJECT_ID}`);
    expect(res.status).to.equal(401);
  });
});

// ─── GET /api/menu/:restaurantId (admin only) ─────────────────────────────────

describe('GET /api/menu/:restaurantId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a menu array when called with admin token', async () => {
    stubAdminAuth();
    sinon.stub(MenuItem, 'find').returns({ sort: sinon.stub().resolves([fakeItem]) });

    const res = await request(app)
      .get(`/api/menu/${VALID_OBJECT_ID}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.menu).to.be.an('array');
  });

  it('should return 400 for a malformed restaurantId', async () => {
    stubAdminAuth();

    const res = await request(app)
      .get('/api/menu/not-a-valid-id')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Invalid restaurant id');
  });

  it('should return 403 when called with an owner token', async () => {
    sinon.stub(User, 'findById').returns({
      select: sinon.stub().resolves({
        _id: 'fake-owner-id', role: 'owner',
        email: 'owner@test.com', name: 'Test Owner',
      }),
    });

    const res = await request(app)
      .get(`/api/menu/${VALID_OBJECT_ID}`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get(`/api/menu/${VALID_OBJECT_ID}`);
    expect(res.status).to.equal(401);
  });
});

// ─── GET /api/menu/public/:restaurantId (guest, no auth) ──────────────────────

describe('GET /api/menu/public/:restaurantId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and available menu items without a token', async () => {
    sinon.stub(Restaurant, 'findById').returns({
      select: sinon.stub().resolves({ _id: VALID_OBJECT_ID, isActive: true }),
    });
    sinon.stub(MenuItem, 'find').returns({
      sort: sinon.stub().resolves([fakeItem]),
    });

    const res = await request(app).get(`/api/menu/public/${VALID_OBJECT_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.menu).to.be.an('array').with.lengthOf(1);
  });

  it('should return 400 for a malformed restaurantId', async () => {
    const res = await request(app).get('/api/menu/public/not-a-valid-id');

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Invalid restaurant id');
  });

  it('should return 404 when restaurant does not exist', async () => {
    sinon.stub(Restaurant, 'findById').returns({
      select: sinon.stub().resolves(null),
    });

    const res = await request(app).get(`/api/menu/public/${VALID_OBJECT_ID}`);

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Restaurant not found');
  });

  it('should return 404 when restaurant is inactive', async () => {
    sinon.stub(Restaurant, 'findById').returns({
      select: sinon.stub().resolves({ _id: VALID_OBJECT_ID, isActive: false }),
    });

    const res = await request(app).get(`/api/menu/public/${VALID_OBJECT_ID}`);

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Restaurant not found');
  });
});

// ─── POST /api/menu/my/images ─────────────────────────────────────────────────

describe('POST /api/menu/my/images', () => {
  afterEach(() => sinon.restore());

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .post('/api/menu/my/images')
      .attach('image', Buffer.from('fake'), { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).to.equal(401);
    expect(res.body.success).to.equal(false);
  });

  it('should return 400 when no image file is provided', async () => {
    stubOwnerAuth();

    const res = await request(app)
      .post('/api/menu/my/images')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Image file is required');
  });
});

// ─── GET /api/menu/images/:imageFileId ────────────────────────────────────────

describe('GET /api/menu/images/:imageFileId', () => {
  afterEach(() => sinon.restore());

  it('should return 400 for a malformed image id', async () => {
    const res = await request(app).get('/api/menu/images/not-a-valid-id');

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Invalid image id');
  });
});
