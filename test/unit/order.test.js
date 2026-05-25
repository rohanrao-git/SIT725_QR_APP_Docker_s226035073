/**
 * Order Unit Tests
 *
 * All service calls are stubbed with sinon. No database or running server required.
 *
 * Endpoints covered:
 *   GET  /api/orders/:orderId
 *   POST /api/orders
 */

process.env.JWT_SECRET     = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT           = '5007';

const request       = require('supertest');
const sinon         = require('sinon');
const { expect }    = require('chai');

const app          = require('../../backend/server');
const orderService = require('../../backend/services/orderService');
const AppError     = require('../../backend/utils/AppError');

// ─── Shared fake data ─────────────────────────────────────────────────────────

const VALID_SESSION_ID = '507f1f77bcf86cd799439011';
const VALID_ORDER_ID   = '507f1f77bcf86cd799439014';

const fakeOrder = {
  _id:          VALID_ORDER_ID,
  sessionId:    VALID_SESSION_ID,
  restaurantId: '507f1f77bcf86cd799439013',
  tableNumber:  1,
  sessionNumber: 1,
  items: [
    { menuItemId: '507f1f77bcf86cd799439012', name: 'Burger', price: 15, quantity: 2 },
  ],
  subtotal:    30,
  tax:          3,
  totalAmount: 33,
  status:      'pending',
};

// ─── GET /api/orders/:orderId ─────────────────────────────────────────────────

describe('GET /api/orders/:orderId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and order data when the order exists', async () => {
    sinon.stub(orderService, 'getOrderById').resolves(fakeOrder);

    const res = await request(app).get(`/api/orders/${VALID_ORDER_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.order.totalAmount).to.equal(33);
    expect(res.body.order._id).to.equal(VALID_ORDER_ID);
  });

  it('should return 404 when the order does not exist', async () => {
    sinon.stub(orderService, 'getOrderById').rejects(
      new AppError('Order not found', 404, 'ORDER_NOT_FOUND')
    );

    const res = await request(app).get(`/api/orders/${VALID_ORDER_ID}`);

    expect(res.status).to.equal(404);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('Order not found');
  });

  it('should return 400 for an invalid order id', async () => {
    sinon.stub(orderService, 'getOrderById').rejects(
      new AppError('Invalid order id', 400, 'INVALID_ORDER_ID')
    );

    const res = await request(app).get('/api/orders/not-a-valid-id');

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────

describe('POST /api/orders', () => {
  afterEach(() => sinon.restore());

  it('should return 201 and the placed order on success', async () => {
    sinon.stub(orderService, 'placeOrder').resolves(fakeOrder);

    const res = await request(app)
      .post('/api/orders')
      .send({ sessionId: VALID_SESSION_ID });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.order.totalAmount).to.equal(33);
    expect(res.body.order.items).to.have.lengthOf(1);
  });

  it('should return 400 when sessionId is missing', async () => {
    const res = await request(app).post('/api/orders').send({});

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('sessionId is required');
  });

  it('should return 400 when the cart is empty', async () => {
    sinon.stub(orderService, 'placeOrder').rejects(
      new AppError('Cart is empty', 400, 'CART_EMPTY')
    );

    const res = await request(app)
      .post('/api/orders')
      .send({ sessionId: VALID_SESSION_ID });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Cart is empty');
  });

  it('should return 404 when the session does not exist', async () => {
    sinon.stub(orderService, 'placeOrder').rejects(
      new AppError('Session not found', 404, 'SESSION_NOT_FOUND')
    );

    const res = await request(app)
      .post('/api/orders')
      .send({ sessionId: VALID_SESSION_ID });

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Session not found');
  });

  it('should return 400 when the session is no longer active', async () => {
    sinon.stub(orderService, 'placeOrder').rejects(
      new AppError('Session is no longer active', 400, 'SESSION_CLOSED')
    );

    const res = await request(app)
      .post('/api/orders')
      .send({ sessionId: VALID_SESSION_ID });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Session is no longer active');
  });

  it('should return 400 when a cart item is no longer available', async () => {
    sinon.stub(orderService, 'placeOrder').rejects(
      new AppError('Burger is no longer available. Please remove it from your cart.', 400, 'CART_ITEM_UNAVAILABLE')
    );

    const res = await request(app)
      .post('/api/orders')
      .send({ sessionId: VALID_SESSION_ID });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });
});
