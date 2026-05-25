/**
 * Analytics Unit Tests
 *
 * All service calls are stubbed with sinon. No database or running server required.
 *
 * Endpoints covered:
 *   GET /api/analytics/my/summary
 *   GET /api/analytics/my/peak-hours
 *   GET /api/analytics/my/item-forecast
 */

process.env.JWT_SECRET     = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT           = '5008';

const request          = require('supertest');
const sinon            = require('sinon');
const { expect }       = require('chai');
const generateToken    = require('../../backend/utils/generateToken');

const app              = require('../../backend/server');
const analyticsService = require('../../backend/services/analyticsService');
const User             = require('../../backend/models/User');
const AppError         = require('../../backend/utils/AppError');

// ─── Token helpers ────────────────────────────────────────────────────────────

function makeOwnerToken() {
  return generateToken('fake-owner-id');
}

// ─── Stub helpers ─────────────────────────────────────────────────────────────

function stubOwnerAuth(restaurantId = 'fake-restaurant-id') {
  const stub = sinon.stub(User, 'findById');
  // First call: authMiddleware
  stub.onFirstCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id', role: 'owner',
      email: 'owner@test.com', name: 'Test Owner',
    }),
  });
  // Second call: analyticsController.getOwnerContext
  stub.onSecondCall().returns({
    select: sinon.stub().resolves({
      _id: 'fake-owner-id', role: 'owner',
      status: 'approved', restaurantId,
    }),
  });
  return stub;
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
  return stub;
}

// ─── Shared fake data ─────────────────────────────────────────────────────────

const fakeSummary = {
  totalOrders:   5,
  totalRevenue:  120.50,
  topItem:       'Burger',
  busiestTable:  2,
  from:          '2026-04-22',
  to:            '2026-05-22',
};

const fakePeakHours = {
  peakHoursByDay: {
    Monday:    { peakHours: [12, 13, 18], confidence: 'High',   avgOrdersPerHour: 0.5  },
    Tuesday:   { peakHours: [11, 12, 19], confidence: 'Medium', avgOrdersPerHour: 0.3  },
    Wednesday: { peakHours: [12, 13, 14], confidence: 'Low',    avgOrdersPerHour: 0.1  },
  },
  analysisWindow: 'Last 30 days',
};

const fakeForecast = {
  forecastedItems: [
    {
      itemName:       'Burger',
      totalQuantity:  20,
      orderCount:     10,
      forecast:       20,
      trend:          'stable',
      trendPercentage: 0,
    },
    {
      itemName:       'Salad',
      totalQuantity:  8,
      orderCount:     4,
      forecast:       8,
      trend:          'stable',
      trendPercentage: 0,
    },
  ],
  analysisWindow: 'Last 30 days',
  generatedAt:    new Date().toISOString(),
};

// ─── GET /api/analytics/my/summary ───────────────────────────────────────────

describe('GET /api/analytics/my/summary', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and summary data for an approved owner', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getSummaryForRestaurant').resolves(fakeSummary);

    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.summary.totalOrders).to.equal(5);
    expect(res.body.summary.totalRevenue).to.equal(120.50);
    expect(res.body.summary.topItem).to.equal('Burger');
  });

  it('should return 200 with empty summary when there are no orders', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getSummaryForRestaurant').resolves({
      totalOrders: 0, totalRevenue: 0, topItem: null, busiestTable: null,
    });

    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.summary.totalOrders).to.equal(0);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/analytics/my/summary');

    expect(res.status).to.equal(401);
    expect(res.body.success).to.equal(false);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(res.status).to.equal(401);
  });

  it('should return 403 for an unapproved owner', async () => {
    stubUnapprovedOwnerAuth();

    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
    expect(res.body.success).to.equal(false);
  });
});

// ─── GET /api/analytics/my/peak-hours ────────────────────────────────────────

describe('GET /api/analytics/my/peak-hours', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and peak hours data for an approved owner', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getPeakHours').resolves(fakePeakHours);

    const res = await request(app)
      .get('/api/analytics/my/peak-hours')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.peakHours).to.have.property('peakHoursByDay');
    expect(res.body.peakHours).to.have.property('analysisWindow');
  });

  it('should return 200 with insufficient data message when no orders exist', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getPeakHours').resolves({
      peakHoursByDay: {},
      message: 'Insufficient data for peak hours analysis',
    });

    const res = await request(app)
      .get('/api/analytics/my/peak-hours')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.peakHours.message).to.include('Insufficient data');
  });

  it('should accept optional date range query params', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getPeakHours').resolves(fakePeakHours);

    const res = await request(app)
      .get('/api/analytics/my/peak-hours')
      .query({ from: '2026-05-01', to: '2026-05-22' })
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/analytics/my/peak-hours');

    expect(res.status).to.equal(401);
  });

  it('should return 403 for an unapproved owner', async () => {
    stubUnapprovedOwnerAuth();

    const res = await request(app)
      .get('/api/analytics/my/peak-hours')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});

// ─── GET /api/analytics/my/item-forecast ─────────────────────────────────────

describe('GET /api/analytics/my/item-forecast', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and forecast data for an approved owner', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getItemSalesForecast').resolves(fakeForecast);

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.forecast.forecastedItems).to.be.an('array').with.lengthOf(2);
    expect(res.body.forecast.forecastedItems[0].itemName).to.equal('Burger');
  });

  it('should return 200 with empty forecast when there are no orders', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getItemSalesForecast').resolves({
      forecastedItems: [],
      message: 'No orders found for this period',
      analysisWindow: 'Last 30 days',
      generatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.forecast.forecastedItems).to.have.lengthOf(0);
  });

  it('should accept optional date range query params', async () => {
    stubOwnerAuth();
    sinon.stub(analyticsService, 'getItemSalesForecast').resolves(fakeForecast);

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .query({ from: '2026-04-01', to: '2026-05-22' })
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(200);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/analytics/my/item-forecast');

    expect(res.status).to.equal(401);
  });

  it('should return 403 for an unapproved owner', async () => {
    stubUnapprovedOwnerAuth();

    const res = await request(app)
      .get('/api/analytics/my/item-forecast')
      .set('Authorization', `Bearer ${makeOwnerToken()}`);

    expect(res.status).to.equal(403);
  });
});
