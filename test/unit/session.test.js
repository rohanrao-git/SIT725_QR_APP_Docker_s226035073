/**
 * Session Unit Tests
 *
 * Endpoints covered:
 *   POST   /api/sessions/start
 *   GET    /api/sessions/active
 *   GET    /api/sessions/:sessionId
 *   PATCH  /api/sessions/:sessionId/close  (owner only)
 */

process.env.JWT_SECRET = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT = '5010';

const request = require('supertest');
const sinon = require('sinon');
const { expect } = require('chai');
const generateToken = require('../../backend/utils/generateToken');

const app = require('../../backend/server');
const sessionService = require('../../backend/services/sessionService');
const User = require('../../backend/models/User');

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011';

const fakeSession = {
  _id: VALID_OBJECT_ID,
  restaurantId: '507f1f77bcf86cd799439012',
  tableId: '507f1f77bcf86cd799439013',
  tableNumber: 3,
  sessionNumber: 1,
  status: 'active',
};

function makeOwnerToken() {
  return generateToken('fake-owner-id');
}

function stubOwnerAuth() {
  const stub = sinon.stub(User, 'findById');
  stub.onFirstCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id',
      role: 'owner',
      email: 'owner@test.com',
      name: 'Test Owner',
    }),
  });
  stub.onSecondCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id',
      role: 'owner',
      status: 'approved',
      restaurantId: fakeSession.restaurantId,
    }),
  });
  return stub;
}

describe('POST /api/sessions/start', () => {
  afterEach(() => sinon.restore());

  it('should return 201 when a new session is created', async () => {
    sinon.stub(sessionService, 'startOrGetActiveSession').resolves({
      session: fakeSession,
      created: true,
    });

    const res = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId: fakeSession.restaurantId, tableNumber: 3 });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.created).to.equal(true);
    expect(res.body.session.tableNumber).to.equal(3);
  });

  it('should return 200 when an active session already exists', async () => {
    sinon.stub(sessionService, 'startOrGetActiveSession').resolves({
      session: fakeSession,
      created: false,
    });

    const res = await request(app)
      .post('/api/sessions/start')
      .send({ restaurantId: fakeSession.restaurantId, tableNumber: 3 });

    expect(res.status).to.equal(200);
    expect(res.body.created).to.equal(false);
  });

  it('should return 400 when restaurantId or tableNumber is missing', async () => {
    const res = await request(app).post('/api/sessions/start').send({ restaurantId: fakeSession.restaurantId });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('restaurantId and tableNumber are required');
  });
});

describe('GET /api/sessions/active', () => {
  afterEach(() => sinon.restore());

  it('should return 200 with active session', async () => {
    sinon.stub(sessionService, 'getActiveSession').resolves(fakeSession);

    const res = await request(app)
      .get('/api/sessions/active')
      .query({ restaurantId: fakeSession.restaurantId, tableNumber: 3 });

    expect(res.status).to.equal(200);
    expect(res.body.session._id).to.equal(VALID_OBJECT_ID);
  });

  it('should return 400 when query params are missing', async () => {
    const res = await request(app).get('/api/sessions/active');

    expect(res.status).to.equal(400);
  });
});

describe('GET /api/sessions/:sessionId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 with session details', async () => {
    sinon.stub(sessionService, 'getSessionById').resolves(fakeSession);

    const res = await request(app).get(`/api/sessions/${VALID_OBJECT_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.session.status).to.equal('active');
  });
});

describe('PATCH /api/sessions/:sessionId/close', () => {
  afterEach(() => sinon.restore());

  it('should return 200 when owner closes session', async () => {
    stubOwnerAuth();
    sinon.stub(sessionService, 'closeSession').resolves({
      ...fakeSession,
      status: 'closed',
      closedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/sessions/${VALID_OBJECT_ID}/close`)
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.session.status).to.equal('closed');
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).patch(`/api/sessions/${VALID_OBJECT_ID}/close`);

    expect(res.status).to.equal(401);
  });
});
