/**
 * Menu Integration Tests
 *
 * Tests the full menu stack (controller → service → real MongoDB) using
 * an in-memory MongoDB instance. A seeded admin and approved owner are
 * created in beforeEach so every test starts from a clean, consistent state.
 *
 * Endpoints covered:
 *   GET    /api/menu/my
 *   GET    /api/menu/my/tables
 *   POST   /api/menu/my
 *   PUT    /api/menu/my/:itemId
 *   PATCH  /api/menu/my/:itemId/availability
 *   DELETE /api/menu/my/:itemId
 *   GET    /api/menu/:restaurantId   (admin only)
 *   GET    /api/menu/public/:restaurantId   (guest, no auth)
 */

const request    = require('supertest');
const { expect } = require('chai');
const bcrypt     = require('bcryptjs');
const mongoose   = require('../../backend/testUtils');
const User       = require('../../backend/models/User');
const app        = require('../../backend/server');

// Lifecycle is managed by test/integration/hooks.js (Mocha root hooks).

// ─── Seed Helpers ─────────────────────────────────────────────────────────────

async function seedAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  const admin = await User.create({
    name: 'System Admin', email: 'admin@system.com',
    password: hash, role: 'super_admin', status: 'approved',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@system.com', password: 'admin123' });
  return { admin, token: res.body.token };
}

async function seedApprovedOwner(suffix = 'owner') {
  const { token: adminToken } = await seedAdmin();

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Test Owner', email: `${suffix}@example.com`,
      password: 'password123',
      pendingRestaurantName: 'Test Bistro',
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

  return { ownerToken: loginRes.body.token, restaurantId: loginRes.body.user.restaurantId };
}

function validItem() {
  return {
    name: 'Margherita Pizza', category: 'Mains',
    description: 'Classic tomato and mozzarella.', price: 18.5,
    image: 'https://example.com/pizza.jpg', isAvailable: true,
  };
}

// ─── GET /api/menu/my ─────────────────────────────────────────────────────────

describe('GET /api/menu/my — integration', () => {
  it('returns 200 and an empty array for a fresh owner', async () => {
    const { ownerToken } = await seedApprovedOwner();

    const res = await request(app)
      .get('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.menu).to.be.an('array').with.lengthOf(0);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/menu/my');
    expect(res.status).to.equal(401);
  });
});

// ─── GET /api/menu/my/tables ──────────────────────────────────────────────────

describe('GET /api/menu/my/tables — integration', () => {
  it('returns 200 and an empty array when no tables have been set', async () => {
    const { ownerToken } = await seedApprovedOwner('tablesnone');

    const res = await request(app)
      .get('/api/menu/my/tables')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.tables).to.be.an('array').with.lengthOf(0);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/menu/my/tables');
    expect(res.status).to.equal(401);
  });
});

// ─── POST /api/menu/my ────────────────────────────────────────────────────────

describe('POST /api/menu/my — integration', () => {
  it('creates a menu item and returns 201', async () => {
    const { ownerToken } = await seedApprovedOwner();

    const res = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.item).to.have.property('name', 'Margherita Pizza');
    expect(res.body.item).to.have.property('_id');
  });

  it('returns 400 when name is missing', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const { name, ...body } = validItem();

    const res = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(body);

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Name and price are required');
  });

  it('returns 400 when price is missing', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const { price, ...body } = validItem();

    const res = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(body);

    expect(res.status).to.equal(400);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).post('/api/menu/my').send(validItem());
    expect(res.status).to.equal(401);
  });

  it('menu item persists in DB after creation', async () => {
    const { ownerToken } = await seedApprovedOwner();
    await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const listRes = await request(app)
      .get('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(listRes.body.menu).to.have.lengthOf(1);
    expect(listRes.body.menu[0].name).to.equal('Margherita Pizza');
  });
});

// ─── PUT /api/menu/my/:itemId ─────────────────────────────────────────────────

describe('PUT /api/menu/my/:itemId — integration', () => {
  it('updates a menu item and returns 200', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const createRes = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const itemId = createRes.body.item._id;

    const res = await request(app)
      .put(`/api/menu/my/${itemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Hawaiian Pizza', price: 22.0 });

    expect(res.status).to.equal(200);
    expect(res.body.item.name).to.equal('Hawaiian Pizza');
    expect(res.body.item.price).to.equal(22.0);
  });

  it('returns 404 when the item does not exist', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/api/menu/my/${fakeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Ghost Item' });

    expect(res.status).to.equal(404);
  });

  it('returns 400 for a malformed ObjectId', async () => {
    const { ownerToken } = await seedApprovedOwner();

    const res = await request(app)
      .put('/api/menu/my/not-a-valid-id')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'X' });

    expect(res.status).to.equal(400);
  });
});

// ─── PATCH /api/menu/my/:itemId/availability ──────────────────────────────────

describe('PATCH /api/menu/my/:itemId/availability — integration', () => {
  it('toggles availability to false and returns 200', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const { body: { item } } = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const res = await request(app)
      .patch(`/api/menu/my/${item._id}/availability`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isAvailable: false });

    expect(res.status).to.equal(200);
    expect(res.body.item.isAvailable).to.equal(false);
  });

  it('returns 400 when isAvailable is not a boolean', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const { body: { item } } = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const res = await request(app)
      .patch(`/api/menu/my/${item._id}/availability`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isAvailable: 'yes' });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('isAvailable must be a boolean');
  });

  it('returns 404 when the item does not exist', async () => {
    const { ownerToken } = await seedApprovedOwner('avail404');
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .patch(`/api/menu/my/${fakeId}/availability`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isAvailable: false });

    expect(res.status).to.equal(404);
  });

  it('returns 400 when isAvailable is missing from the request body', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const { body: { item } } = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const res = await request(app)
      .patch(`/api/menu/my/${item._id}/availability`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).to.equal(400);
  });
});

// ─── DELETE /api/menu/my/:itemId ──────────────────────────────────────────────

describe('DELETE /api/menu/my/:itemId — integration', () => {
  it('deletes a menu item and returns 200', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const { body: { item } } = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const res = await request(app)
      .delete(`/api/menu/my/${item._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal('Menu item deleted');
  });

  it('returns 404 when deleting an already-deleted item', async () => {
    const { ownerToken } = await seedApprovedOwner();
    const { body: { item } } = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    await request(app)
      .delete(`/api/menu/my/${item._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const res = await request(app)
      .delete(`/api/menu/my/${item._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(404);
  });
});

// ─── GET /api/menu/:restaurantId (admin) ──────────────────────────────────────

describe('GET /api/menu/:restaurantId — integration (admin only)', () => {
  it('admin can view any restaurant menu by restaurantId', async () => {
    const { ownerToken, restaurantId } = await seedApprovedOwner('menuview');
    await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@system.com', password: 'admin123' });

    const res = await request(app)
      .get(`/api/menu/${restaurantId}`)
      .set('Authorization', `Bearer ${adminLoginRes.body.token}`);

    expect(res.status).to.equal(200);
    expect(res.body.menu).to.be.an('array').with.lengthOf(1);
  });

  it('returns 403 when owner tries to view menu by restaurantId', async () => {
    const { ownerToken, restaurantId } = await seedApprovedOwner('menuview403');

    const res = await request(app)
      .get(`/api/menu/${restaurantId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(403);
  });

  it('returns 400 when restaurantId is not a valid ObjectId', async () => {
    const { token: adminToken } = await seedAdmin();

    const res = await request(app)
      .get('/api/menu/not-a-valid-id')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(400);
  });
});

// ─── GET /api/menu/public/:restaurantId (guest) ───────────────────────────────

describe('GET /api/menu/public/:restaurantId — integration (no auth)', () => {
  it('returns only available items without a token', async () => {
    const { ownerToken, restaurantId } = await seedApprovedOwner('publicmenu');

    await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validItem());

    const unavailableRes = await request(app)
      .post('/api/menu/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...validItem(), name: 'Sold Out Soup', isAvailable: false });

    const res = await request(app).get(`/api/menu/public/${restaurantId}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.menu).to.be.an('array').with.lengthOf(1);
    expect(res.body.menu[0].name).to.equal('Margherita Pizza');
    expect(res.body.menu.every((item) => item.isAvailable === true)).to.equal(true);
    expect(res.body.menu.some((item) => item._id === unavailableRes.body.item._id)).to.equal(false);
  });

  it('returns 400 when restaurantId is not a valid ObjectId', async () => {
    const res = await request(app).get('/api/menu/public/not-a-valid-id');
    expect(res.status).to.equal(400);
  });

  it('returns 404 when restaurant does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/menu/public/${fakeId}`);
    expect(res.status).to.equal(404);
  });

  it('returns 404 when restaurant is inactive', async () => {
    const { ownerToken, restaurantId } = await seedApprovedOwner('inactivepublic');

    await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Inactive Bistro' });

    const Restaurant = require('../../backend/models/Restaurant');
    await Restaurant.updateOne({ _id: restaurantId }, { isActive: false });

    const res = await request(app).get(`/api/menu/public/${restaurantId}`);
    expect(res.status).to.equal(404);
  });
});

// ─── POST /api/menu/my/images & GET /api/menu/images/:id — integration ───────

describe('Menu image upload — integration', () => {
  it('uploads an image and returns imageUrl', async () => {
    const { ownerToken } = await seedApprovedOwner('imgupload');

    const res = await request(app)
      .post('/api/menu/my/images')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('image', Buffer.from('fake-png-content'), {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.imageFileId).to.exist;
    expect(res.body.imageUrl).to.include('/api/menu/images/');
  });

  it('returns 400 when no image file is uploaded', async () => {
    const { ownerToken } = await seedApprovedOwner('imgmissing');

    const res = await request(app)
      .post('/api/menu/my/images')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Image file is required');
  });

  it('returns image bytes for a valid uploaded image id', async () => {
    const { ownerToken } = await seedApprovedOwner('imgget');

    const uploadRes = await request(app)
      .post('/api/menu/my/images')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('image', Buffer.from('fake-png-content'), {
        filename: 'menu.png',
        contentType: 'image/png',
      });

    const imageId = uploadRes.body.imageFileId;
    const getRes = await request(app).get(`/api/menu/images/${imageId}`);

    expect(getRes.status).to.equal(200);
    expect(getRes.headers['content-type']).to.include('image');
  });

  it('returns 400 for malformed image id', async () => {
    const res = await request(app).get('/api/menu/images/not-a-valid-id');
    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Invalid image id');
  });

  it('returns 404 when image id does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/menu/images/${fakeId}`);
    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Image not found');
  });
});
