/**
 * Cart, Order & Analytics Integration Tests
 *
 * Covers:
 *   GET    /api/cart/:sessionId
 *   POST   /api/cart/:sessionId/items
 *   PUT    /api/cart/:sessionId/items/:menuItemId
 *   DELETE /api/cart/:sessionId/items/:menuItemId
 *   DELETE /api/cart/:sessionId
 *   POST   /api/orders
 *   GET    /api/orders/:orderId
 *   GET    /api/analytics/my/summary
 */

const request = require('supertest');
const { expect } = require('chai');
const bcrypt = require('bcryptjs');
const User = require('../../backend/models/User');
const Cart = require('../../backend/models/Cart');
const Order = require('../../backend/models/Order');
const MenuItem = require('../../backend/models/MenuItem');
const app = require('../../backend/server');

async function seedAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  await User.create({
    name: 'System Admin',
    email: 'admin@system.com',
    password: hash,
    role: 'super_admin',
    status: 'approved',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@system.com', password: 'admin123' });
  return { token: res.body.token };
}

async function seedOwnerWithSession(suffix = 'getapi') {
  const { token: adminToken } = await seedAdmin();

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Test Owner',
      email: `${suffix}@example.com`,
      password: 'password123',
      pendingRestaurantName: 'Test Bistro',
      pendingRestaurantAddress: '1 Test St',
      pendingRestaurantPhone: '0400000000',
      pendingRestaurantEmail: `bistro_${suffix}@example.com`,
    });

  const ownerId = regRes.body.user._id;
  await request(app)
    .patch(`/api/admin/owners/${ownerId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: `${suffix}@example.com`, password: 'password123' });

  const restaurantId = loginRes.body.user.restaurantId;
  const ownerToken = loginRes.body.token;

  await request(app)
    .post(`/api/admin/restaurants/${restaurantId}/tables`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ totalTables: 3 });

  const sessionRes = await request(app)
    .post('/api/sessions/start')
    .send({ restaurantId, tableNumber: 1 });

  return {
    ownerToken,
    restaurantId,
    sessionId: sessionRes.body.session._id,
    tableId: sessionRes.body.session.tableId,
    tableNumber: sessionRes.body.session.tableNumber,
  };
}

describe('GET /api/cart/:sessionId — integration', () => {
  it('returns cart with items when cart exists in db', async () => {
    const { sessionId, restaurantId, tableId, tableNumber } = await seedOwnerWithSession('getcart');

    await Cart.create({
      sessionId,
      restaurantId,
      tableId,
      tableNumber,
      items: [{ menuItemId: '507f1f77bcf86cd799439012', name: 'Burger', price: 15, quantity: 2 }],
      subtotal: 30,
    });

    const res = await request(app).get(`/api/cart/${sessionId}`);
    expect(res.status).to.equal(200);
    expect(res.body.cart.itemCount).to.equal(2);
    expect(res.body.cart.subtotal).to.equal(30);
  });

  it('returns empty cart when none exists', async () => {
    const { sessionId } = await seedOwnerWithSession('emptycart');

    const res = await request(app).get(`/api/cart/${sessionId}`);
    expect(res.status).to.equal(200);
    expect(res.body.cart.items).to.have.lengthOf(0);
    expect(res.body.cart.itemCount).to.equal(0);
  });
});

describe('GET /api/orders/:orderId — integration', () => {
  it('returns order by id', async () => {
    const { sessionId, restaurantId, tableId, tableNumber } = await seedOwnerWithSession('getorder');

    const order = await Order.create({
      restaurantId,
      tableId,
      tableNumber,
      sessionId,
      sessionNumber: 1,
      items: [{ menuItemId: '507f1f77bcf86cd799439012', name: 'Burger', price: 15, quantity: 1 }],
      subtotal: 15,
      tax: 1.5,
      totalAmount: 16.5,
    });

    const res = await request(app).get(`/api/orders/${order._id}`);
    expect(res.status).to.equal(200);
    expect(res.body.order.totalAmount).to.equal(16.5);
  });
});

describe('GET /api/analytics/my/summary — integration', () => {
  it('returns summary for owner restaurant', async () => {
    const { ownerToken, restaurantId, sessionId, tableId, tableNumber } =
      await seedOwnerWithSession('analytics');

    await Order.create({
      restaurantId,
      tableId,
      tableNumber,
      sessionId,
      sessionNumber: 1,
      items: [{ name: 'Burger', price: 15, quantity: 2 }],
      subtotal: 30,
      tax: 3,
      totalAmount: 33,
    });

    const res = await request(app)
      .get('/api/analytics/my/summary')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.summary.totalOrders).to.equal(1);
    expect(res.body.summary.totalRevenue).to.equal(33);
    expect(res.body.summary.topItem).to.equal('Burger');
    expect(res.body.summary.busiestTable).to.equal(1);
  });
});

// ─── Helper: seed owner + session + menu item ─────────────────────────────────

async function seedOwnerWithMenuItem(suffix) {
  const data = await seedOwnerWithSession(suffix);

  const menuItem = await MenuItem.create({
    restaurantId: data.restaurantId,
    name:         'Test Burger',
    price:        15,
    category:     'Mains',
    isAvailable:  true,
  });

  return { ...data, menuItemId: menuItem._id.toString(), ownerToken: data.ownerToken };
}

// ─── POST /api/cart/:sessionId/items — integration ───────────────────────────

describe('POST /api/cart/:sessionId/items — integration', () => {
  it('adds a menu item to the cart and returns the updated cart', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('additem');

    const res = await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 2 });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.itemCount).to.equal(2);
    expect(res.body.cart.items[0].name).to.equal('Test Burger');
  });

  it('increments quantity when the same item is added again', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('adddup');

    await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 1 });

    const res = await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 2 });

    expect(res.status).to.equal(200);
    expect(res.body.cart.itemCount).to.equal(3);
  });

  it('returns 400 when menuItemId is missing', async () => {
    const { sessionId } = await seedOwnerWithSession('addnoitem');

    const res = await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ quantity: 1 });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('menuItemId is required');
  });

  it('returns 404 when the menu item does not exist', async () => {
    const { sessionId } = await seedOwnerWithSession('addghost');
    const fakeMenuItemId = '507f1f77bcf86cd799439099';

    const res = await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId: fakeMenuItemId });

    expect(res.status).to.equal(404);
  });
});

// ─── PUT /api/cart/:sessionId/items/:menuItemId — integration ─────────────────

describe('PUT /api/cart/:sessionId/items/:menuItemId — integration', () => {
  it('updates the item quantity in the cart', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('updateqty');

    await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 1 });

    const res = await request(app)
      .put(`/api/cart/${sessionId}/items/${menuItemId}`)
      .send({ quantity: 3 });

    expect(res.status).to.equal(200);
    expect(res.body.cart.itemCount).to.equal(3);
    expect(res.body.cart.subtotal).to.equal(45);
  });

  it('removes the item when quantity is set to 0', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('updatezero');

    await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 2 });

    const res = await request(app)
      .put(`/api/cart/${sessionId}/items/${menuItemId}`)
      .send({ quantity: 0 });

    expect(res.status).to.equal(200);
    expect(res.body.cart.itemCount).to.equal(0);
    expect(res.body.cart.items).to.have.lengthOf(0);
  });

  it('returns 400 when quantity is missing from request', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('updatenoquantity');

    const res = await request(app)
      .put(`/api/cart/${sessionId}/items/${menuItemId}`)
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('quantity is required');
  });
});

// ─── DELETE /api/cart/:sessionId/items/:menuItemId — integration ──────────────

describe('DELETE /api/cart/:sessionId/items/:menuItemId — integration', () => {
  it('removes a specific item from the cart', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('removeitem');

    await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 2 });

    const res = await request(app)
      .delete(`/api/cart/${sessionId}/items/${menuItemId}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.itemCount).to.equal(0);
    expect(res.body.cart.items).to.have.lengthOf(0);
  });

  it('returns 404 when the item is not in the cart', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('removenotfound');

    const res = await request(app)
      .delete(`/api/cart/${sessionId}/items/${menuItemId}`);

    expect(res.status).to.equal(404);
  });
});

// ─── DELETE /api/cart/:sessionId — integration ────────────────────────────────

describe('DELETE /api/cart/:sessionId — integration', () => {
  it('clears all items from the cart', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('clearcart');

    await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 2 });

    const res = await request(app).delete(`/api/cart/${sessionId}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.cart.items).to.have.lengthOf(0);
    expect(res.body.cart.subtotal).to.equal(0);
  });

  it('returns 200 even when cart does not exist (idempotent)', async () => {
    const { sessionId } = await seedOwnerWithSession('clearempty');

    const res = await request(app).delete(`/api/cart/${sessionId}`);

    expect(res.status).to.equal(200);
    expect(res.body.cart.items).to.have.lengthOf(0);
  });
});

// ─── POST /api/orders — integration ──────────────────────────────────────────

describe('POST /api/orders — integration', () => {
  it('places an order from the cart and clears the cart', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('placeorder');

    await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 2 });

    const res = await request(app)
      .post('/api/orders')
      .send({ sessionId });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.order.totalAmount).to.be.a('number').and.above(0);
    expect(res.body.order.items[0].name).to.equal('Test Burger');
  });

  it('calculates tax correctly (10% of subtotal)', async () => {
    const { sessionId, menuItemId } = await seedOwnerWithMenuItem('ordertax');

    await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 1 });

    const res = await request(app).post('/api/orders').send({ sessionId });

    expect(res.status).to.equal(201);
    expect(res.body.order.subtotal).to.equal(15);
    expect(res.body.order.tax).to.equal(1.5);
    expect(res.body.order.totalAmount).to.equal(16.5);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app).post('/api/orders').send({});

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('sessionId is required');
  });

  it('returns 400 when the cart is empty', async () => {
    const { sessionId } = await seedOwnerWithSession('emptycartorder');

    const res = await request(app).post('/api/orders').send({ sessionId });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Cart is empty');
  });

  it('returns 404 when order id does not exist', async () => {
    const fakeOrderId = '507f1f77bcf86cd799439099';
    const res = await request(app).get(`/api/orders/${fakeOrderId}`);
    expect(res.status).to.equal(404);
  });

  it('returns 400 for malformed order id', async () => {
    const res = await request(app).get('/api/orders/not-a-valid-id');
    expect(res.status).to.equal(400);
  });
});

describe('GET /api/cart/:sessionId — invalid session — integration', () => {
  it('returns 404 for unknown session id', async () => {
    const fakeSessionId = '507f1f77bcf86cd799439099';
    const res = await request(app).get(`/api/cart/${fakeSessionId}`);
    expect(res.status).to.equal(404);
  });
});

describe('POST /api/cart/:sessionId/items — edge cases — integration', () => {
  it('returns 400 when session is closed', async () => {
    const { sessionId, menuItemId, ownerToken } = await seedOwnerWithMenuItem('closedsession');

    await request(app)
      .patch(`/api/sessions/${sessionId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const res = await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId, quantity: 1 });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Session is no longer active');
  });

  it('returns 400 when menu item is unavailable', async () => {
    const { sessionId, restaurantId } = await seedOwnerWithSession('unavailitem');

    const menuItem = await MenuItem.create({
      restaurantId,
      name: 'Sold Out Item',
      price: 10,
      category: 'Mains',
      isAvailable: false,
    });

    const res = await request(app)
      .post(`/api/cart/${sessionId}/items`)
      .send({ menuItemId: menuItem._id.toString(), quantity: 1 });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Menu item is not available');
  });
});
