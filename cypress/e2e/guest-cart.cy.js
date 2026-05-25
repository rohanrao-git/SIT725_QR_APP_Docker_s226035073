/**
 * Guest Cart & Order E2E Tests
 * File: cypress/e2e/guest-cart.cy.js
 *
 * Covers:
 *   1. frontend/pages/menu.html
 *   2. frontend/js/menu.js — cart and order flow
 *
 * Test groups:
 *   12a. Session start on QR scan
 *   12b. Add item to cart
 *   12c. Cart drawer display
 *   12d. Place order
 *   12e. Cart hidden without table session
 *
 * Notes:
 *   All API calls are stubbed — tests do not require a running backend.
 *   Stubs must be registered BEFORE cy.visit().
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const RESTAURANT_ID = '507f1f77bcf86cd799439011';
const SESSION_ID = '507f1f77bcf86cd799439012';
const MENU_ITEM_ID = '507f1f77bcf86cd799439013';

const mockMenuResponse = {
  success: true,
  menu: [
    {
      _id: MENU_ITEM_ID,
      name: 'Margherita Pizza',
      category: 'Mains',
      description: 'Tomato, mozzarella, basil',
      price: 16.5,
      dietaryType: 'veg',
      isAvailable: true,
    },
  ],
};

const emptyCart = {
  items: [],
  subtotal: 0,
  itemCount: 0,
  tax: 0,
  total: 0,
};

const cartWithItem = {
  items: [{
    menuItemId: MENU_ITEM_ID,
    name: 'Margherita Pizza',
    price: 16.5,
    quantity: 1,
    availabilityStatus: 'available',
  }],
  subtotal: 16.5,
  itemCount: 1,
  tax: 1.65,
  total: 18.15,
};

function stubGuestMenuFlow(cart = emptyCart) {
  cy.intercept('POST', '/api/sessions/start', {
    statusCode: 201,
    body: {
      success: true,
      created: true,
      session: {
        _id: SESSION_ID,
        restaurantId: RESTAURANT_ID,
        tableNumber: 2,
        status: 'active',
      },
    },
  }).as('startSession');

  cy.intercept('GET', `**/api/menu/public/${RESTAURANT_ID}`, {
    statusCode: 200,
    body: mockMenuResponse,
  }).as('getPublicMenu');

  cy.intercept('GET', `/api/cart/${SESSION_ID}`, {
    statusCode: 200,
    body: { success: true, cart },
  }).as('getCart');
}

// ─── 12a. Session start on QR scan ────────────────────────────────────────────

describe('Guest cart — session start', () => {
  it('calls POST /api/sessions/start when visiting with table param', () => {
    stubGuestMenuFlow();
    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@startSession').then((interception) => {
      expect(interception.request.body.restaurantId).to.equal(RESTAURANT_ID);
      expect(interception.request.body.tableNumber).to.equal(2);
    });
  });

  it('stores session id in sessionStorage', () => {
    stubGuestMenuFlow();
    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@startSession');

    cy.window().then((win) => {
      const key = `guestSessionId:${RESTAURANT_ID}:2`;
      expect(win.sessionStorage.getItem(key)).to.equal(SESSION_ID);
    });
  });
});

// ─── 12b. Add item to cart ──────────────────────────────────────────────────────

describe('Guest cart — add item', () => {
  it('calls POST /api/cart/:sessionId/items when add button is clicked', () => {
    stubGuestMenuFlow();

    cy.intercept('POST', `/api/cart/${SESSION_ID}/items`, {
      statusCode: 200,
      body: { success: true, cart: cartWithItem },
    }).as('addToCart');

    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@getPublicMenu');
    cy.wait('@startSession');

    cy.get('.add-to-cart-btn').first().click();
    cy.wait('@addToCart').then((interception) => {
      expect(interception.request.body.menuItemId).to.equal(MENU_ITEM_ID);
      expect(interception.request.body.quantity).to.equal(1);
    });
  });

  it('increments quantity when + is clicked on menu card', () => {
    stubGuestMenuFlow();

    cy.intercept('POST', `/api/cart/${SESSION_ID}/items`, {
      statusCode: 200,
      body: { success: true, cart: cartWithItem },
    }).as('addToCart');

    cy.intercept('PUT', `/api/cart/${SESSION_ID}/items/${MENU_ITEM_ID}`, {
      statusCode: 200,
      body: {
        success: true,
        cart: {
          ...cartWithItem,
          items: [{ ...cartWithItem.items[0], quantity: 2 }],
          itemCount: 2,
        },
      },
    }).as('updateQty');

    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@getPublicMenu');
    cy.wait('@startSession');

    cy.get('.add-to-cart-btn').first().click();
    cy.wait('@addToCart');
    cy.get('.mic-qty-card-inc').first().click();
    cy.wait('@updateQty');
    cy.get('.mic-qty-card-num').first().should('contain.text', '2');
  });

  it('updates cart badge after adding an item', () => {
    stubGuestMenuFlow();

    cy.intercept('POST', `/api/cart/${SESSION_ID}/items`, {
      statusCode: 200,
      body: { success: true, cart: cartWithItem },
    }).as('addToCart');

    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@getPublicMenu');
    cy.wait('@startSession');

    cy.get('.add-to-cart-btn').first().click();
    cy.wait('@addToCart');

    cy.get('#cartBadge').should('not.have.class', 'hide').and('contain.text', '1');
  });
});

// ─── 12c. Cart drawer display ───────────────────────────────────────────────────

describe('Guest cart — cart drawer', () => {
  it('opens cart drawer and shows item details', () => {
    stubGuestMenuFlow(cartWithItem);

    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@getPublicMenu');
    cy.wait('@startSession');
    cy.wait('@getCart');

    cy.get('#cartNavBtn').click({ force: true });
    cy.get('#cartDrawer').should('have.class', 'open');
    cy.get('#cartItemsList').should('contain.text', 'Margherita Pizza');
    cy.get('#cartSubtotal').should('contain.text', '16.50');
    cy.get('#cartTotal').should('contain.text', '18.15');
  });
});

// ─── 12d. Remove item from cart drawer ──────────────────────────────────────────

describe('Guest cart — remove item from cart', () => {
  it('calls DELETE /api/cart/:sessionId/items/:menuItemId when remove button is clicked', () => {
    stubGuestMenuFlow(cartWithItem);

    cy.intercept('DELETE', `/api/cart/${SESSION_ID}/items/${MENU_ITEM_ID}`, {
      statusCode: 200,
      body: { success: true, cart: { ...emptyCart } },
    }).as('removeItem');

    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@getPublicMenu');
    cy.wait('@startSession');
    cy.wait('@getCart');

    cy.get('#cartNavBtn').click({ force: true });
    cy.get('#cartDrawer').should('have.class', 'open');
    cy.get('#cartItemsList').should('contain.text', 'Margherita Pizza');

    cy.get('.cart-item-remove').first().click();
    cy.wait('@removeItem');

    cy.get('#cartBadge').should('have.class', 'hide');
  });
});

// ─── 12e. Place order ───────────────────────────────────────────────────────────

describe('Guest cart — place order', () => {
  it('calls POST /api/orders and shows confirmation modal', () => {
    stubGuestMenuFlow(cartWithItem);

    cy.intercept('POST', '/api/orders', {
      statusCode: 201,
      body: {
        success: true,
        order: {
          _id: 'order123',
          items: cartWithItem.items,
          subtotal: 16.5,
          tax: 1.65,
          totalAmount: 18.15,
        },
      },
    }).as('placeOrder');

    cy.visit(`/menu/${RESTAURANT_ID}?table=2`);
    cy.wait('@getPublicMenu');
    cy.wait('@startSession');
    cy.wait('@getCart');

    cy.get('#cartNavBtn').click({ force: true });
    cy.get('#placeOrderBtn').click();

    cy.wait('@placeOrder').then((interception) => {
      expect(interception.request.body.sessionId).to.equal(SESSION_ID);
    });

    cy.contains('Order Placed!');
    cy.get('#confirmOrderId').should('contain.text', 'order123');
  });
});

// ─── 12f. Cart hidden without table session ─────────────────────────────────────

describe('Guest cart — no table param', () => {
  it('does not show cart controls when table param is missing', () => {
    cy.intercept('GET', `**/api/menu/public/${RESTAURANT_ID}`, {
      statusCode: 200,
      body: mockMenuResponse,
    }).as('getPublicMenu');

    cy.visit(`/menu/${RESTAURANT_ID}`);
    cy.wait('@getPublicMenu');

    cy.get('#cartNavBtn').should('have.class', 'hide');
    cy.get('.add-to-cart-btn').should('not.exist');
  });
});
