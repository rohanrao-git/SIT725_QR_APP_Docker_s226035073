/**
 * Auth Integration Tests
 *
 * Tests the full auth stack (controller → service → real MongoDB) using
 * an in-memory MongoDB instance. No mocking — every assertion reflects
 * actual database writes and JWT generation.
 *
 * Endpoints covered:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 *   PUT  /api/auth/me
 *   PUT  /api/auth/me/password
 */

const request  = require('supertest');
const { expect } = require('chai');
const bcrypt   = require('bcryptjs');
const User     = require('../../backend/models/User');
const app      = require('../../backend/server');

// Lifecycle is managed by test/integration/hooks.js (Mocha root hooks).

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validOwnerPayload(suffix = 'a') {
  return {
    name:                     'Test Owner',
    email:                    `owner_${suffix}@example.com`,
    password:                 'password123',
    pendingRestaurantName:    'Test Bistro',
    pendingRestaurantAddress: '42 Collins St, Melbourne VIC 3000',
    pendingRestaurantPhone:   '0312345678',
    pendingRestaurantEmail:   `bistro_${suffix}@example.com`,
  };
}

async function seedAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  return User.create({
    name:     'System Admin',
    email:    'admin@system.com',
    password: hash,
    role:     'super_admin',
    status:   'approved',
  });
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register — integration', () => {
  it('creates a new pending owner and returns 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validOwnerPayload('reg1'));

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.user).to.have.property('email', 'owner_reg1@example.com');
    expect(res.body.user).to.have.property('status', 'pending');
    expect(res.body.user).not.to.have.property('password');

    const inDB = await User.findOne({ email: 'owner_reg1@example.com' });
    expect(inDB).to.not.be.null;
    expect(inDB.role).to.equal('owner');
  });

  it('returns 409 when email is already registered', async () => {
    await request(app).post('/api/auth/register').send(validOwnerPayload('dup'));

    const res = await request(app)
      .post('/api/auth/register')
      .send(validOwnerPayload('dup'));

    expect(res.status).to.equal(409);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Email already registered');
  });

  it('returns 400 when name is missing', async () => {
    const { name, ...body } = validOwnerPayload('noname');
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('returns 400 when email is missing', async () => {
    const { email, ...body } = validOwnerPayload('noemail');
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).to.equal(400);
  });

  it('returns 400 when password is missing', async () => {
    const { password, ...body } = validOwnerPayload('nopass');
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).to.equal(400);
  });

  it('returns 400 when restaurant name is missing', async () => {
    const { pendingRestaurantName, ...body } = validOwnerPayload('norestname');
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).to.equal(400);
  });

  it('returns 400 when restaurant address is missing', async () => {
    const { pendingRestaurantAddress, ...body } = validOwnerPayload('noaddr');
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).to.equal(400);
  });

  it('returns 400 when body is completely empty', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login — integration', () => {
  it('returns 200 and a JWT token for a valid admin login', async () => {
    await seedAdmin();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@system.com', password: 'admin123' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body).to.have.property('token');
    expect(res.body.user.role).to.equal('super_admin');
  });

  it('returns 403 for a pending owner trying to login', async () => {
    await request(app).post('/api/auth/register').send(validOwnerPayload('pending'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner_pending@example.com', password: 'password123' });

    expect(res.status).to.equal(403);
    expect(res.body.message).to.equal('Account is not approved');
  });

  it('returns 401 for wrong password', async () => {
    await seedAdmin();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@system.com', password: 'wrongpassword' });

    expect(res.status).to.equal(401);
    expect(res.body.message).to.equal('Invalid email or password');
  });

  it('returns 401 for a non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).to.equal(401);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Email and password are required');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@system.com' });

    expect(res.status).to.equal(400);
  });

  it('returns 200 after a pending owner is manually approved', async () => {
    await request(app).post('/api/auth/register').send(validOwnerPayload('toapprove'));
    await User.updateOne({ email: 'owner_toapprove@example.com' }, { status: 'approved' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner_toapprove@example.com', password: 'password123' });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token');
  });
});

// ─── Helpers: approved owner with token ───────────────────────────────────────

async function seedApprovedOwner(suffix = 'profile') {
  await seedAdmin();

  const payload = validOwnerPayload(suffix);
  const regRes = await request(app)
    .post('/api/auth/register')
    .send(payload);

  const ownerId = regRes.body.user._id;
  await User.updateOne({ email: payload.email }, { status: 'approved' });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: payload.email, password: 'password123' });

  return {
    ownerToken: loginRes.body.token,
    ownerEmail: payload.email,
    userId: ownerId,
  };
}

// ─── GET /api/auth/me — integration ───────────────────────────────────────────

describe('GET /api/auth/me — integration', () => {
  it('returns the authenticated user profile', async () => {
    const { ownerToken, ownerEmail } = await seedApprovedOwner('getme');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.email).to.equal(ownerEmail);
    expect(res.body.user).not.to.have.property('password');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).to.equal(401);
  });
});

// ─── PUT /api/auth/me — integration ───────────────────────────────────────────

describe('PUT /api/auth/me — integration', () => {
  it('updates the user name and persists the change', async () => {
    const { ownerToken } = await seedApprovedOwner('updateme');

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated Owner Name' });

    expect(res.status).to.equal(200);
    expect(res.body.user.name).to.equal('Updated Owner Name');

    const getRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(getRes.body.user.name).to.equal('Updated Owner Name');
  });

  it('returns 400 when no update fields are provided', async () => {
    const { ownerToken } = await seedApprovedOwner('updateempty');

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Nothing to update');
  });

  it('returns 409 when email is already taken by another user', async () => {
    await seedAdmin();
    const existingPayload = validOwnerPayload('existing');
    const conflictPayload = validOwnerPayload('updateconflict');

    await request(app).post('/api/auth/register').send(existingPayload);
    await request(app).post('/api/auth/register').send(conflictPayload);
    await User.updateOne({ email: conflictPayload.email }, { status: 'approved' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: conflictPayload.email, password: 'password123' });

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ email: existingPayload.email });

    expect(res.status).to.equal(409);
    expect(res.body.message).to.equal('Email already in use');
  });
});

// ─── PUT /api/auth/me/password — integration ──────────────────────────────────

describe('PUT /api/auth/me/password — integration', () => {
  it('changes the password and allows login with the new password', async () => {
    const suffix = 'changepass';
    const { ownerToken, ownerEmail } = await seedApprovedOwner(suffix);

    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'password123' });
    expect(oldLogin.status).to.equal(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'newpassword456' });
    expect(newLogin.status).to.equal(200);
    expect(newLogin.body).to.have.property('token');
  });

  it('returns 400 when current password is wrong', async () => {
    const { ownerToken } = await seedApprovedOwner('wrongpass');

    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });

    expect(res.status).to.equal(401);
    expect(res.body.message).to.equal('Current password is incorrect');
  });

  it('returns 400 when new password is too short', async () => {
    const { ownerToken } = await seedApprovedOwner('shortpass');

    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'password123', newPassword: '12345' });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('New password must be at least 6 characters');
  });
});
