/**
 * Cart Unit Tests
 *
 * All service calls are stubbed with sinon. No database or running server required.
 *
 * Endpoints covered:
 *   GET    /api/cart/:sessionId
 *   POST   /api/cart/:sessionId/items
 *   PUT    /api/cart/:sessionId/items/:menuItemId
 *   DELETE /api/cart/:sessionId/items/:menuItemId
 *   DELETE /api/cart/:sessionId
 */

process.env.JWT_SECRET     = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.PORT           = '5006';

const request    = require('supertest');
const sinon      = require('sinon');
const { expect } = require('chai');

const app         = require('../../backend/server');
const cartService = require('../../backend/services/cartService');
const AppError    = require('../../backend/utils/AppError');

// ─── Shared fake data ─────────────────────────────────────────────────────────

const VALID_SESSION_ID   = '507f1f77bcf86cd799439011';
const VALID_MENU_ITEM_ID = '507f1f77bcf86cd799439012';

function makeCart(overrides = {}) {
  return {
    sessionId:    VALID_SESSION_ID,
    restaurantId: '507f1f77bcf86cd799439013',
    tableNumber:  1,
    items: [
      { menuItemId: VALID_MENU_ITEM_ID, name: 'Burger', price: 15, quantity: 2 },
    ],
    subtotal:  30,
    itemCount: 2,
    ...overrides,
  };
}

function emptyCart() {
  return {
    sessionId:    VALID_SESSION_ID,
    restaurantId: '507f1f77bcf86cd799439013',
    tableNumber:  1,
    items:    [],
    subtotal: 0,
    itemCount: 0,
  };
}

// ─── GET /api/cart/:sessionId ─────────────────────────────────────────────────

describe('GET /api/cart/:sessionId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and cart data when cart exists', async () => {
    sinon.stub(cartService, 'getCart').resolves(makeCart());

    const res = await request(app).get(`/api/cart/${VALID_SESSION_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.itemCount).to.equal(2);
    expect(res.body.cart.subtotal).to.equal(30);
  });

  it('should return 200 with an empty cart when no cart exists', async () => {
    sinon.stub(cartService, 'getCart').resolves(emptyCart());

    const res = await request(app).get(`/api/cart/${VALID_SESSION_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.cart.items).to.have.lengthOf(0);
    expect(res.body.cart.itemCount).to.equal(0);
  });

  it('should return 404 when the session does not exist', async () => {
    sinon.stub(cartService, 'getCart').rejects(
      new AppError('Session not found', 404, 'SESSION_NOT_FOUND')
    );

    const res = await request(app).get(`/api/cart/${VALID_SESSION_ID}`);

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Session not found');
  });

  it('should return 400 for an invalid session id', async () => {
    sinon.stub(cartService, 'getCart').rejects(
      new AppError('Invalid session id', 400, 'INVALID_SESSION_ID')
    );

    const res = await request(app).get('/api/cart/not-a-valid-id');

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });
});

// ─── POST /api/cart/:sessionId/items ─────────────────────────────────────────

describe('POST /api/cart/:sessionId/items', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and updated cart when item is added', async () => {
    sinon.stub(cartService, 'addItem').resolves(makeCart());

    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({ menuItemId: VALID_MENU_ITEM_ID, quantity: 2 });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.itemCount).to.equal(2);
  });

  it('should return 200 with default quantity 1 when quantity is omitted', async () => {
    sinon.stub(cartService, 'addItem').resolves(makeCart({ itemCount: 1 }));

    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({ menuItemId: VALID_MENU_ITEM_ID });

    expect(res.status).to.equal(200);
  });

  it('should return 400 when menuItemId is missing', async () => {
    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({ quantity: 1 });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('menuItemId is required');
  });

  it('should return 400 when the request body is empty', async () => {
    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('should return 404 when the menu item does not exist', async () => {
    sinon.stub(cartService, 'addItem').rejects(
      new AppError('Menu item not found', 404, 'MENU_ITEM_NOT_FOUND')
    );

    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({ menuItemId: VALID_MENU_ITEM_ID });

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Menu item not found');
  });

  it('should return 400 when the menu item is not available', async () => {
    sinon.stub(cartService, 'addItem').rejects(
      new AppError('Menu item is not available', 400, 'ITEM_UNAVAILABLE')
    );

    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({ menuItemId: VALID_MENU_ITEM_ID });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Menu item is not available');
  });

  it('should return 400 when the session is no longer active', async () => {
    sinon.stub(cartService, 'addItem').rejects(
      new AppError('Session is no longer active', 400, 'SESSION_CLOSED')
    );

    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({ menuItemId: VALID_MENU_ITEM_ID });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Session is no longer active');
  });

  it('should return 404 when session does not exist', async () => {
    sinon.stub(cartService, 'addItem').rejects(
      new AppError('Session not found', 404, 'SESSION_NOT_FOUND')
    );

    const res = await request(app)
      .post(`/api/cart/${VALID_SESSION_ID}/items`)
      .send({ menuItemId: VALID_MENU_ITEM_ID });

    expect(res.status).to.equal(404);
  });
});

// ─── PUT /api/cart/:sessionId/items/:menuItemId ───────────────────────────────

describe('PUT /api/cart/:sessionId/items/:menuItemId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and updated cart when quantity is updated', async () => {
    const updated = makeCart({
      items: [{ menuItemId: VALID_MENU_ITEM_ID, name: 'Burger', price: 15, quantity: 3 }],
      subtotal: 45,
      itemCount: 3,
    });
    sinon.stub(cartService, 'updateQuantity').resolves(updated);

    const res = await request(app)
      .put(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`)
      .send({ quantity: 3 });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.itemCount).to.equal(3);
    expect(res.body.cart.subtotal).to.equal(45);
  });

  it('should return 200 and remove item when quantity is set to 0', async () => {
    sinon.stub(cartService, 'updateQuantity').resolves(emptyCart());

    const res = await request(app)
      .put(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`)
      .send({ quantity: 0 });

    expect(res.status).to.equal(200);
    expect(res.body.cart.itemCount).to.equal(0);
  });

  it('should return 400 when quantity is missing', async () => {
    const res = await request(app)
      .put(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`)
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.message).to.equal('quantity is required');
  });

  it('should return 404 when the item is not found in the cart', async () => {
    sinon.stub(cartService, 'updateQuantity').rejects(
      new AppError('Item not found in cart', 404, 'CART_ITEM_NOT_FOUND')
    );

    const res = await request(app)
      .put(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`)
      .send({ quantity: 2 });

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Item not found in cart');
  });

  it('should return 404 when cart does not exist', async () => {
    sinon.stub(cartService, 'updateQuantity').rejects(
      new AppError('Cart not found', 404, 'CART_NOT_FOUND')
    );

    const res = await request(app)
      .put(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`)
      .send({ quantity: 1 });

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Cart not found');
  });
});

// ─── DELETE /api/cart/:sessionId/items/:menuItemId ────────────────────────────

describe('DELETE /api/cart/:sessionId/items/:menuItemId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and updated cart after item removal', async () => {
    sinon.stub(cartService, 'removeItem').resolves(emptyCart());

    const res = await request(app)
      .delete(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.itemCount).to.equal(0);
  });

  it('should return 404 when the item is not in the cart', async () => {
    sinon.stub(cartService, 'removeItem').rejects(
      new AppError('Item not found in cart', 404, 'CART_ITEM_NOT_FOUND')
    );

    const res = await request(app)
      .delete(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`);

    expect(res.status).to.equal(404);
    expect(res.body.message).to.equal('Item not found in cart');
  });

  it('should return 404 when the session does not exist', async () => {
    sinon.stub(cartService, 'removeItem').rejects(
      new AppError('Session not found', 404, 'SESSION_NOT_FOUND')
    );

    const res = await request(app)
      .delete(`/api/cart/${VALID_SESSION_ID}/items/${VALID_MENU_ITEM_ID}`);

    expect(res.status).to.equal(404);
  });
});

// ─── DELETE /api/cart/:sessionId ──────────────────────────────────────────────

describe('DELETE /api/cart/:sessionId', () => {
  afterEach(() => sinon.restore());

  it('should return 200 and a cleared cart', async () => {
    sinon.stub(cartService, 'clearCart').resolves(emptyCart());

    const res = await request(app).delete(`/api/cart/${VALID_SESSION_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.items).to.have.lengthOf(0);
    expect(res.body.cart.subtotal).to.equal(0);
  });

  it('should return 200 when cart did not exist (idempotent clear)', async () => {
    sinon.stub(cartService, 'clearCart').resolves(emptyCart());

    const res = await request(app).delete(`/api/cart/${VALID_SESSION_ID}`);

    expect(res.status).to.equal(200);
    expect(res.body.cart.itemCount).to.equal(0);
  });

  it('should return 400 for an invalid session id', async () => {
    sinon.stub(cartService, 'clearCart').rejects(
      new AppError('Invalid session id', 400, 'INVALID_SESSION_ID')
    );

    const res = await request(app).delete('/api/cart/not-valid');

    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
  });
});
