/**
 * Owner Dashboard E2E Tests
 * File: cypress/e2e/owner-dashboard.cy.js
 *
 * Covers:
 *   1. frontend/pages/owner-dashboard.html
 *   2. frontend/js/owner.js
 *
 * Test groups:
 *   4a. Authentication guard
 *   4b. Page structure
 *   4c. Welcome message
 *   4d. Menu table — loaded from API
 *   4e. Stats summary cards
 *   4f. Add menu item (modal form)
 *   4g. Edit menu item
 *   4h. Toggle availability
 *   4i. Delete menu item
 *   4j. Search / filter
 *   4k. API error handling
 *   4l. Logout
 *
 * Notes:
 *   All API calls are stubbed — tests do not require a running backend.
 *   Stubs must be registered BEFORE cy.visit() as owner.js fires API
 *   calls immediately on DOMContentLoaded.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const DASHBOARD_URL = '/pages/owner-dashboard.html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubAnalytics() {
  cy.intercept('GET', '/api/analytics/my/summary*', {
    statusCode: 200,
    body: { success: true, summary: { totalOrders: 0, totalRevenue: 0, topItem: null, busiestTable: null } },
  });
  cy.intercept('GET', '/api/analytics/my/peak-hours*', {
    statusCode: 200,
    body: { success: true, peakHours: { peakHoursByDay: {} } },
  });
  cy.intercept('GET', '/api/analytics/my/item-forecast*', {
    statusCode: 200,
    body: { success: true, forecast: { forecastedItems: [] } },
  });
}

function stubMenu(items = []) {
  stubAnalytics();
  cy.intercept('GET', '/api/menu/my', {
    statusCode: 200,
    body: { success: true, menu: items },
  }).as('getMenu');
}

/** #ownerMenuTable is the <tbody> — rows are #ownerMenuTable tr, not tbody tr inside it */
function menuTableRows() {
  return cy.get('#ownerMenuTable tr');
}

function visitAsOwner(name = 'Test Owner', email = 'owner@test.com') {
  cy.visit(DASHBOARD_URL, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake.owner.jwt');
      win.localStorage.setItem('user', JSON.stringify({
        _id: 'owner1', name, email, role: 'owner',
      }));
    },
  });
}

function fillMenuItemForm({
  name = 'New Dish',
  price = '20',
  category = 'Mains',
  dietary = 'veg',
  description = 'A tasty test dish',
} = {}) {
  cy.get('#itemName').clear().type(name);
  cy.get('#itemCategory').select(category, { force: true });
  cy.get('#itemDietaryType').select(dietary, { force: true });
  cy.get('#itemDescription').clear().type(description, { force: true });
  cy.get('#itemPrice').clear().type(price);
}

function submitMenuItemForm() {
  cy.get('button[form="menuItemForm"]').click({ force: true });
}

const FAKE_ITEMS = [
  {
    _id: 'item1', name: 'Burger', category: 'Mains',
    dietaryType: 'non_veg', price: 12.50, isAvailable: true, description: 'Tasty burger',
  },
  {
    _id: 'item2', name: 'Garden Salad', category: 'Appetizers',
    dietaryType: 'veg', price: 8.00, isAvailable: false, description: 'Fresh salad',
  },
];

// ─── 4a. Authentication guard ─────────────────────────────────────────────────

describe('Owner dashboard — authentication guard', () => {
  it('redirects to login.html when no token is stored', () => {
    cy.visit(DASHBOARD_URL);
    cy.url().should('include', 'login.html');
  });

  it('redirects to login.html when user is an admin (not owner)', () => {
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Admin', email: 'admin@test.com', role: 'super_admin',
        }));
      },
    });
    cy.url().should('include', 'login.html');
  });

  it('loads the dashboard when role is owner', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
    cy.url().should('include', 'owner-dashboard.html');
  });
});

// ─── 4b. Page structure ───────────────────────────────────────────────────────

describe('Owner dashboard — page structure', () => {
  beforeEach(() => {
    stubMenu();
    visitAsOwner();
    cy.wait('@getMenu');
  });

  it('has the correct page title', () => {
    cy.title().should('include', 'Owner Dashboard');
  });

  it('shows the "Owner Dashboard" heading', () => {
    cy.get('h4').should('contain.text', 'Owner Dashboard');
  });

  it('shows the menu table with correct column headers', () => {
    cy.get('.owner-menu-table thead th').should('contain.text', 'Item');
    cy.get('.owner-menu-table thead th').should('contain.text', 'Category');
    cy.get('.owner-menu-table thead th').should('contain.text', 'Price');
  });

  it('shows the Add Item button', () => {
    cy.get('#addItemBtn').should('be.visible');
  });

  it('shows the search input', () => {
    cy.get('#ownerMenuSearch').should('be.visible');
  });
});

// ─── 4c. Welcome message ──────────────────────────────────────────────────────

describe('Owner dashboard — welcome message', () => {
  it('displays the owner name in the welcome message', () => {
    stubMenu();
    visitAsOwner('Ferdinand');
    cy.wait('@getMenu');
    cy.get('#ownerWelcome').should('contain.text', 'Ferdinand');
  });

  it('falls back to email if name is missing', () => {
    stubMenu();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.owner.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'owner1', name: '', email: 'myemail@test.com', role: 'owner',
        }));
      },
    });
    cy.wait('@getMenu');
    cy.get('#ownerWelcome').should('contain.text', 'myemail@test.com');
  });
});

// ─── 4d. Menu table — loaded from API ────────────────────────────────────────

describe('Owner dashboard — menu table', () => {
  it('renders a row for each menu item', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
    cy.get('#ownerMenuTable tr').should('have.length', 2);
  });

  it('shows item name, price and availability in the row', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
    cy.get('#ownerMenuTable').should('contain.text', 'Burger');
    cy.get('#ownerMenuTable').should('contain.text', '12.50');
    cy.get('#ownerMenuTable').should('contain.text', 'Available');
  });

  it('shows "No menu items found" when menu is empty', () => {
    stubMenu([]);
    visitAsOwner();
    cy.wait('@getMenu');
    cy.get('#ownerMenuTable').should('contain.text', 'No menu items found');
  });

  it('shows an error message when menu API fails', () => {
    stubAnalytics();
    cy.intercept('GET', '/api/menu/my', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('getMenuFail');
    visitAsOwner();
    cy.wait('@getMenuFail');
    cy.get('#ownerMenuTable').should('contain.text', 'Unauthorized');
  });
});

// ─── 4e. Stats summary cards ──────────────────────────────────────────────────

describe('Owner dashboard — stats cards', () => {
  it('shows the correct total menu item count', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
    cy.get('#menuCount').should('have.text', '2');
  });

  it('shows the correct available item count', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
    cy.get('#availableCount').should('have.text', '1');
  });

  it('shows the correct unavailable item count', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
    cy.get('#unavailableCount').should('have.text', '1');
  });
});

// ─── 4f. Add menu item ────────────────────────────────────────────────────────

describe('Owner dashboard — add menu item', () => {
  beforeEach(() => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
  });

  it('opens the Add Item modal when Add Item button is clicked', () => {
    cy.get('#addItemBtn').click({ force: true });
    cy.get('#menuItemModal').should('be.visible');
  });

  it('modal heading says "Add Menu Item"', () => {
    cy.get('#addItemBtn').click({ force: true });
    cy.get('#menuModalHeading').should('contain.text', 'Add Menu Item');
  });

  it('calls POST /api/menu/my when form is submitted with valid data', () => {
    cy.intercept('POST', '/api/menu/my', {
      statusCode: 201,
      body: {
        success: true,
        item: { _id: 'newitem', name: 'New Dish', price: 20, category: 'Mains', isAvailable: true },
      },
    }).as('createItem');
    stubMenu([...FAKE_ITEMS, { _id: 'newitem', name: 'New Dish', price: 20, isAvailable: true, category: 'Mains' }]);

    cy.get('#addItemBtn').click({ force: true });
    fillMenuItemForm({ name: 'New Dish', price: '20' });
    submitMenuItemForm();
    cy.wait('@createItem');
  });

  it('does not submit when required fields are missing', () => {
    cy.intercept('POST', '/api/menu/my').as('createItem');

    cy.get('#addItemBtn').click({ force: true });
    submitMenuItemForm();
    cy.get('@createItem.all').should('have.length', 0);
  });

  it('uploads image via POST /api/menu/my/images when file is selected', () => {
    cy.intercept('POST', '/api/menu/my/images', {
      statusCode: 201,
      body: {
        success: true,
        imageFileId: 'img123',
        imageUrl: '/api/menu/images/img123',
      },
    }).as('uploadImage');
    cy.intercept('POST', '/api/menu/my', {
      statusCode: 201,
      body: {
        success: true,
        item: {
          _id: 'newimg', name: 'Photo Dish', price: 22, category: 'Mains',
          isAvailable: true, image: '/api/menu/images/img123',
        },
      },
    }).as('createItem');
    stubMenu(FAKE_ITEMS);

    cy.get('#addItemBtn').click({ force: true });
    fillMenuItemForm({ name: 'Photo Dish', price: '22' });
    cy.get('#itemImageFile').selectFile({
      contents: Cypress.Buffer.from('fake-image'),
      fileName: 'dish.png',
      mimeType: 'image/png',
    }, { force: true });
    submitMenuItemForm();
    cy.wait('@uploadImage');
    cy.wait('@createItem');
  });
});

// ─── 4g. Edit menu item ───────────────────────────────────────────────────────

describe('Owner dashboard — edit menu item', () => {
  beforeEach(() => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
  });

  it('opens the Edit modal with pre-filled values when Edit is clicked', () => {
    cy.get('#ownerMenuTable tr').first().contains('button', 'Edit').click({ force: true });
    cy.get('#menuModalHeading').should('contain.text', 'Edit Menu Item');
    cy.get('#itemName').should('have.value', 'Burger');
  });

  it('calls PUT /api/menu/my/:id when the edit form is submitted', () => {
    cy.intercept('PUT', '/api/menu/my/item1', {
      statusCode: 200,
      body: { success: true, item: { ...FAKE_ITEMS[0], name: 'Updated Burger' } },
    }).as('updateItem');
    stubMenu(FAKE_ITEMS);

    cy.get('#ownerMenuTable tr').first().contains('button', 'Edit').click({ force: true });
    fillMenuItemForm({ name: 'Updated Burger', price: '12.50', description: 'Tasty burger' });
    submitMenuItemForm();
    cy.wait('@updateItem');
  });
});

// ─── 4h. Toggle availability ──────────────────────────────────────────────────

describe('Owner dashboard — toggle availability', () => {
  it('calls PATCH /api/menu/my/:id/availability when toggle button is clicked', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');

    cy.intercept('PATCH', '/api/menu/my/item1/availability', {
      statusCode: 200,
      body: { success: true, item: { ...FAKE_ITEMS[0], isAvailable: false } },
    }).as('toggleAvailability');
    stubMenu(FAKE_ITEMS);

    cy.get('#ownerMenuTable tr').first().contains('button', 'Mark Unavailable').click({ force: true });
    cy.wait('@toggleAvailability').its('request.body.isAvailable').should('equal', false);
  });
});

// ─── 4i. Delete menu item ─────────────────────────────────────────────────────

describe('Owner dashboard — delete menu item', () => {
  it('calls DELETE /api/menu/my/:id after confirming the dialog', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');

    cy.intercept('DELETE', '/api/menu/my/item1', {
      statusCode: 200,
      body: { success: true, message: 'Menu item deleted' },
    }).as('deleteItem');
    stubMenu([FAKE_ITEMS[1]]);

    cy.on('window:confirm', () => true);
    cy.get('#ownerMenuTable tr').first().contains('button', 'Delete').click({ force: true });
    cy.wait('@deleteItem');
  });

  it('does not call DELETE when the confirm dialog is cancelled', () => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');

    cy.intercept('DELETE', '/api/menu/my/item1').as('deleteItem');
    cy.on('window:confirm', () => false);

    cy.get('#ownerMenuTable tr').first().contains('button', 'Delete').click({ force: true });
    cy.get('@deleteItem.all').should('have.length', 0);
  });
});

// ─── 4j. Search / filter ─────────────────────────────────────────────────────

describe('Owner dashboard — search', () => {
  beforeEach(() => {
    stubMenu(FAKE_ITEMS);
    visitAsOwner();
    cy.wait('@getMenu');
  });

  it('filters rows when typing in the search box', () => {
    cy.get('#ownerMenuSearch').clear().type('Burger');
    cy.get('#ownerMenuTable tr').should('have.length', 1);
    cy.get('#ownerMenuTable').should('contain.text', 'Burger');
  });

  it('shows "No menu items found" when search matches nothing', () => {
    cy.get('#ownerMenuSearch').clear().type('xyzzy_nonexistent');
    cy.get('#ownerMenuTable').should('contain.text', 'No menu items found');
  });

  it('clears the filter when search box is emptied', () => {
    cy.get('#ownerMenuSearch').clear().type('Burger');
    cy.get('#ownerMenuTable tr').should('have.length', 1);
    cy.get('#ownerMenuSearch').clear();
    cy.get('#ownerMenuTable tr').should('have.length', 2);
  });
});

// ─── 4k. API error handling ───────────────────────────────────────────────────

describe('Owner dashboard — API errors', () => {
  it('shows error message in table when GET /menu/my returns 401', () => {
    stubAnalytics();
    cy.intercept('GET', '/api/menu/my', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('getMenu');
    visitAsOwner();
    cy.wait('@getMenu');
    cy.get('#ownerMenuTable').should('contain.text', 'Unauthorized');
  });

  it('shows error message when GET /menu/my returns 500', () => {
    stubAnalytics();
    cy.intercept('GET', '/api/menu/my', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('getMenuError');
    visitAsOwner();
    cy.wait('@getMenuError');
    cy.get('#ownerMenuTable').should('not.be.empty');
  });
});

// ─── 4l. Navigation ───────────────────────────────────────────────────────────

describe('Owner dashboard — navigation', () => {
  beforeEach(() => {
    stubMenu();
    visitAsOwner();
    cy.wait('@getMenu');
  });

  it('navigates to analytics.html via View Analytics button', () => {
    cy.contains('a', 'View Analytics').click();
    cy.url().should('include', 'analytics.html');
  });

  it('navigates to owner-profile.html via Profile nav link', () => {
    cy.contains('nav a', 'Profile').click();
    cy.url().should('include', 'owner-profile.html');
  });
});

// ─── 4m. Logout ───────────────────────────────────────────────────────────────

describe('Owner dashboard — logout', () => {
  it('clears localStorage and redirects to login.html on logout', () => {
    stubMenu();
    visitAsOwner();
    cy.wait('@getMenu');

    cy.get('#logoutBtn').click();
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
