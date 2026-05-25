/**
 * Restaurant Integration Tests
 *
 * Uses MongoMemoryServer (via hooks.js). Each test gets a clean DB.
 *
 * Endpoints covered:
 *   GET /api/restaurants/my
 *   PUT /api/restaurants/my
 */

const request = require('supertest');
const { expect } = require('chai');
const bcrypt = require('bcryptjs');
const User = require('../../backend/models/User');
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

async function seedApprovedOwner(suffix = 'restapi') {
  const { token: adminToken } = await seedAdmin();

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name:                     'Test Owner',
      email:                    `${suffix}@example.com`,
      password:                 'password123',
      pendingRestaurantName:    `${suffix} Bistro`,
      pendingRestaurantAddress: '1 Test St, Melbourne',
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

// ─── GET /api/restaurants/my — integration ────────────────────────────────────

describe('GET /api/restaurants/my — integration', () => {
  it('returns the owner restaurant with correct fields', async () => {
    const { ownerToken, restaurantId } = await seedApprovedOwner('getrest');

    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.restaurant).to.have.property('name');
    expect(res.body.restaurant).to.have.property('address');
    expect(res.body.restaurant._id.toString()).to.equal(restaurantId.toString());
  });

  it('returns the restaurant name matching the registration data', async () => {
    const { ownerToken } = await seedApprovedOwner('getnamecheck');

    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.restaurant.name).to.equal('getnamecheck Bistro');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/restaurants/my');

    expect(res.status).to.equal(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', 'Bearer not.valid.token');

    expect(res.status).to.equal(401);
  });

  it('returns 403 when caller is an admin (not owner)', async () => {
    const { token: adminToken } = await seedAdmin();

    const res = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(403);
  });
});

// ─── PUT /api/restaurants/my — integration ────────────────────────────────────

describe('PUT /api/restaurants/my — integration', () => {
  it('updates the restaurant name and persists the change', async () => {
    const { ownerToken } = await seedApprovedOwner('updatename');

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated Bistro' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.restaurant.name).to.equal('Updated Bistro');

    // Verify persistence
    const getRes = await request(app)
      .get('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(getRes.body.restaurant.name).to.equal('Updated Bistro');
  });

  it('updates the restaurant address', async () => {
    const { ownerToken } = await seedApprovedOwner('updateaddress');

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ address: '99 New Street, Melbourne VIC 3000' });

    expect(res.status).to.equal(200);
    expect(res.body.restaurant.address).to.equal('99 New Street, Melbourne VIC 3000');
  });

  it('updates the restaurant phone and email', async () => {
    const { ownerToken } = await seedApprovedOwner('updatecontact');

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '0412345678', email: 'newemail@bistro.com' });

    expect(res.status).to.equal(200);
    expect(res.body.restaurant.phone).to.equal('0412345678');
    expect(res.body.restaurant.email).to.equal('newemail@bistro.com');
  });

  it('returns 400 when no update fields are provided', async () => {
    const { ownerToken } = await seedApprovedOwner('updateempty');

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Nothing to update');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .put('/api/restaurants/my')
      .send({ name: 'Anything' });

    expect(res.status).to.equal(401);
  });

  it('returns 403 when owner is not approved', async () => {
    await seedAdmin();
    const payload = {
      name: 'Pending Owner',
      email: 'pending_rest@example.com',
      password: 'password123',
      pendingRestaurantName: 'Pending Bistro',
      pendingRestaurantAddress: '1 Pending St',
    };
    await request(app).post('/api/auth/register').send(payload);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(loginRes.status).to.equal(403);
  });

  it('trims whitespace from the name field', async () => {
    const { ownerToken } = await seedApprovedOwner('updatetrim');

    const res = await request(app)
      .put('/api/restaurants/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '  Trimmed Bistro  ' });

    expect(res.status).to.equal(200);
    expect(res.body.restaurant.name).to.equal('Trimmed Bistro');
  });
});
