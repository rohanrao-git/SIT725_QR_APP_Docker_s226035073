/**
 * Auth Unit Tests
 *
 * All service calls are stubbed with sinon. No database or running server required.
 *
 * Endpoints covered:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 *   PUT  /api/auth/me
 *   PUT  /api/auth/me/password
 */

// Set env vars before any module is required
process.env.JWT_SECRET     = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT           = '5002';

const request    = require('supertest');
const { expect } = require('chai');
const sinon      = require('sinon');

const app         = require('../../backend/server');
const authService = require('../../backend/services/authService');
const User        = require('../../backend/models/User');
const AppError    = require('../../backend/utils/AppError');

const generateToken = require('../../backend/utils/generateToken');

function makeOwnerToken() {
  return generateToken('fake-user-id');
}

// Stub authMiddleware's User.findById call (single call for protected routes)
function stubUserAuth(role = 'owner') {
  sinon.stub(User, 'findById').returns({
    select: sinon.stub().resolves({
      _id: 'fake-user-id', role,
      email: 'user@test.com', name: 'Test User',
    }),
  });
}

// ─── Shared fake data ─────────────────────────────────────────────────────────

function validRegisterPayload(overrides = {}) {
  return {
    name:                     'John Doe',
    email:                    'john@test.com',
    password:                 'password123',
    pendingRestaurantName:    'Test Bistro',
    pendingRestaurantAddress: '42 Collins St, Melbourne VIC 3000',
    pendingRestaurantPhone:   '0312345678',
    pendingRestaurantEmail:   'bistro@test.com',
    ...overrides,
  };
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  afterEach(() => sinon.restore());

  it('should return 201 and the new user on successful registration', async () => {
    const fakeUser = {
      _id: 'abc123', name: 'John Doe',
      email: 'john@test.com', role: 'owner', status: 'pending',
    };
    sinon.stub(authService, 'registerOwner').resolves(fakeUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload());

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.user).to.have.property('email', 'john@test.com');
    expect(res.body.user).to.have.property('status', 'pending');
    expect(res.body.user).not.to.have.property('password');
  });

  it('should return 400 when name is missing', async () => {
    const { name, ...body } = validRegisterPayload();
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 400 when email is missing', async () => {
    const { email, ...body } = validRegisterPayload();
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 400 when password is missing', async () => {
    const { password, ...body } = validRegisterPayload();
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 400 when restaurant name is missing', async () => {
    const { pendingRestaurantName, ...body } = validRegisterPayload();
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 400 when restaurant address is missing', async () => {
    const { pendingRestaurantAddress, ...body } = validRegisterPayload();
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 409 when the email is already registered', async () => {
    sinon.stub(authService, 'registerOwner').rejects(new AppError('Email already registered', 409, 'EMAIL_ALREADY_REGISTERED'));

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload());

    expect(res.status).to.equal(409);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Email already registered');
  });

  it('should return 400 when the request body is completely empty', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a token on successful login', async () => {
    const fakeResult = {
      token: 'fake.jwt.token',
      user: { _id: 'abc123', name: 'John', email: 'john@test.com', role: 'owner', status: 'approved' },
    };
    sinon.stub(authService, 'loginUser').resolves(fakeResult);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@test.com', password: 'password123' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body).to.have.property('token');
    expect(res.body.user).to.have.property('role', 'owner');
  });

  it('should return 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Email and password are required');
  });

  it('should return 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@test.com' });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 400 when the request body is completely empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 401 when credentials are invalid', async () => {
    sinon.stub(authService, 'loginUser').rejects(new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'wrongpassword' });

    expect(res.status).to.equal(401);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Invalid email or password');
  });

  it('should return 401 for a non-existent email', async () => {
    sinon.stub(authService, 'loginUser').rejects(new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).to.equal(401);
    expect(res.body.success).to.equal(false);
  });

  it('should return 403 when the account is not yet approved', async () => {
    sinon.stub(authService, 'loginUser').rejects(new AppError('Account is not approved', 403, 'OWNER_NOT_APPROVED'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pending@test.com', password: 'password123' });

    expect(res.status).to.equal(403);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Account is not approved');
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the current user profile', async () => {
    stubUserAuth();
    const fakeUser = {
      _id: 'fake-user-id', name: 'Test User',
      email: 'user@test.com', role: 'owner', status: 'approved',
    };
    sinon.stub(authService, 'getMe').resolves(fakeUser);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user).to.have.property('email', 'user@test.com');
    expect(res.body.user).not.to.have.property('password');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).to.equal(401);
    expect(res.body.success).to.equal(false);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(res.status).to.equal(401);
  });

  it('should return 404 when the user no longer exists in DB', async () => {
    stubUserAuth();
    sinon.stub(authService, 'getMe').rejects(new AppError('User not found', 404, 'USER_NOT_FOUND'));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('User not found');
  });
});

// ─── PUT /api/auth/me ─────────────────────────────────────────────────────────

describe('PUT /api/auth/me', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and the updated user when name is changed', async () => {
    stubUserAuth();
    const updatedUser = {
      _id: 'fake-user-id', name: 'New Name',
      email: 'user@test.com', role: 'owner',
    };
    sinon.stub(authService, 'updateMe').resolves(updatedUser);

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ name: 'New Name' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.name).to.equal('New Name');
  });

  it('should return 200 when email is updated', async () => {
    stubUserAuth();
    const updatedUser = {
      _id: 'fake-user-id', name: 'Test User',
      email: 'newemail@test.com', role: 'owner',
    };
    sinon.stub(authService, 'updateMe').resolves(updatedUser);

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ email: 'newemail@test.com' });

    expect(res.status).to.equal(200);
    expect(res.body.user.email).to.equal('newemail@test.com');
  });

  it('should return 400 when no update fields are provided', async () => {
    stubUserAuth();
    sinon.stub(authService, 'updateMe').rejects(new AppError('Nothing to update', 400, 'NO_CHANGES'));

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Nothing to update');
  });

  it('should return 409 when email is already taken', async () => {
    stubUserAuth();
    sinon.stub(authService, 'updateMe').rejects(new AppError('Email already in use', 409, 'EMAIL_TAKEN'));

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ email: 'taken@test.com' });

    expect(res.status).to.equal(409);
    expect(res.body.message).to.equal('Email already in use');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).put('/api/auth/me').send({ name: 'X' });

    expect(res.status).to.equal(401);
  });
});

// ─── PUT /api/auth/me/password ────────────────────────────────────────────────

describe('PUT /api/auth/me/password', () => {
  afterEach(() => sinon.restore());

  it('should return 200 when password is changed successfully', async () => {
    stubUserAuth();
    sinon.stub(authService, 'updatePassword').resolves();

    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.message).to.equal('Password updated successfully');
  });

  it('should return 401 when the current password is incorrect', async () => {
    stubUserAuth();
    sinon.stub(authService, 'updatePassword').rejects(
      new AppError('Current password is incorrect', 401, 'WRONG_PASSWORD')
    );

    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ currentPassword: 'WrongPass!', newPassword: 'NewPass1!' });

    expect(res.status).to.equal(401);
    expect(res.body.message).to.equal('Current password is incorrect');
  });

  it('should return 400 when current or new password is missing', async () => {
    stubUserAuth();
    sinon.stub(authService, 'updatePassword').rejects(
      new AppError('Current and new password are required', 400, 'MISSING_FIELDS')
    );

    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ currentPassword: 'OldPass1!' });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Current and new password are required');
  });

  it('should return 400 when new password is too short', async () => {
    stubUserAuth();
    sinon.stub(authService, 'updatePassword').rejects(
      new AppError('New password must be at least 6 characters', 400, 'PASSWORD_TOO_SHORT')
    );

    const res = await request(app)
      .put('/api/auth/me/password')
      .set('Authorization', `Bearer ${makeOwnerToken()}`)
      .send({ currentPassword: 'OldPass1!', newPassword: 'abc' });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('New password must be at least 6 characters');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app)
      .put('/api/auth/me/password')
      .send({ currentPassword: 'old', newPassword: 'new123' });

    expect(res.status).to.equal(401);
  });
});
