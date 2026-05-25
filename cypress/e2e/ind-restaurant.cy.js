/**
 * Individual Restaurant Tables & QR Codes Admin Page E2E Tests
 * File: cypress/e2e/ind-restaurant.cy.js
 *
 * Covers:
 *   1. frontend/pages/ind_restaurant.html
 *   2. frontend/js/admin.js
 *
 * Test groups:
 *   9a. Authentication guard
 *   9b. Page structure
 *   9c. Tables loaded from API
 *   9d. QR code display — https URL, data:image URL, relative path URL, alt text
 *   9e. QR code generation — POST /api/admin/restaurants/:id/tables (set tables)
 *   9f. Missing restaurantId in URL
 *   9g. API error handling
 *   9h. Back button navigation
 *   9i. Logout
 *
 * Notes:
 *   This page reads restaurantId and name from URL query params (?id=...&name=...).
 *   All API calls are stubbed — tests do not require a running backend.
 *   Stubs must be registered BEFORE cy.visit() as admin.js fires API
 *   calls immediately on DOMContentLoaded.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const RESTAURANT_ID   = 'rest1';
const RESTAURANT_NAME = 'Pizza Palace';
const PAGE_URL        = `/pages/ind_restaurant.html?id=${RESTAURANT_ID}&name=${encodeURIComponent(RESTAURANT_NAME)}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubTables(tables = []) {
  cy.intercept('GET', `/api/admin/restaurants/${RESTAURANT_ID}/tables`, {
    statusCode: 200,
    body: { tables },
  }).as('getTables');
}

function visitAsAdmin(url = PAGE_URL) {
  cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake.admin.jwt');
      win.localStorage.setItem('user', JSON.stringify({
        _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
      }));
    },
  });
}

const FAKE_TABLES = [
  { _id: 't1', tableNumber: 1, isActive: true,  qrCodeUrl: 'https://example.com/qr/1' },
  { _id: 't2', tableNumber: 2, isActive: false, qrCodeUrl: 'https://example.com/qr/2' },
  { _id: 't3', tableNumber: 3, isActive: true,  qrCodeUrl: '' },
];

// ─── 9a. Authentication guard ─────────────────────────────────────────────────

describe('Individual restaurant page — authentication guard', () => {
  it('redirects to login.html when no token is stored', () => {
    cy.visit(PAGE_URL);
    cy.url().should('include', 'login.html');
  });

  it('redirects to login.html when user is an owner', () => {
    cy.visit(PAGE_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.owner.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'owner1', name: 'Owner', email: 'owner@test.com', role: 'owner',
        }));
      },
    });
    cy.url().should('include', 'login.html');
  });

  it('loads the page when role is super_admin', () => {
    stubTables();
    visitAsAdmin();
    cy.wait('@getTables');
    cy.url().should('include', 'ind_restaurant.html');
  });
});

// ─── 9b. Page structure ───────────────────────────────────────────────────────

describe('Individual restaurant page — page structure', () => {
  beforeEach(() => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
  });

  it('shows the restaurant name in the page heading', () => {
    cy.get('#restaurantDetailsTitle').should('contain.text', 'Pizza Palace');
  });

  it('shows a Back to Restaurants link', () => {
    cy.contains('a', 'Back to Restaurants')
      .should('have.attr', 'href')
      .and('include', 'restaurants.html');
  });

  it('shows the tables container', () => {
    cy.get('#restaurantTablesContainer').should('exist');
  });
});

// ─── 9c. Tables loaded from API ───────────────────────────────────────────────

describe('Individual restaurant page — tables rendering', () => {
  it('renders a card for each table', () => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer .card').should('have.length', 3);
  });

  it('shows the table number on each card', () => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer')
      .should('contain.text', 'Table 1')
      .and('contain.text', 'Table 2');
  });

  it('shows active/inactive status on each card', () => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer').should('contain.text', 'Active');
    cy.get('#restaurantTablesContainer').should('contain.text', 'Inactive');
  });

  it('shows "No tables found" when the restaurant has no tables', () => {
    stubTables([]);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer').should('contain.text', 'No tables found');
  });
});

// ─── 9d. QR code display ──────────────────────────────────────────────────────

describe('Individual restaurant page — QR code display', () => {
  it('renders a QR code image when qrCodeUrl is an https URL', () => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer img.qr-image')
      .first()
      .should('have.attr', 'src', 'https://example.com/qr/1');
  });

  it('shows "QR code not available" when qrCodeUrl is empty', () => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer').should('contain.text', 'QR code not available');
  });

  it('renders a QR image when qrCodeUrl is a data:image base64 URL (real backend format)', () => {
    const base64Qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    stubTables([{
      _id: 't1', tableNumber: 1, isActive: true, qrCodeUrl: base64Qr,
    }]);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer img.qr-image')
      .should('have.attr', 'src', base64Qr);
  });

  it('resolves a relative-path qrCodeUrl against the backend base URL', () => {
    stubTables([{
      _id: 't1', tableNumber: 1, isActive: true, qrCodeUrl: '/uploads/qr/table1.png',
    }]);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer img.qr-image')
      .should('have.attr', 'src')
      .and('include', '/uploads/qr/table1.png');
  });

  it('sets a descriptive alt attribute on each QR image', () => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer img.qr-image')
      .first()
      .should('have.attr', 'alt', 'QR Code for Table 1');
  });

  it('shows the restaurant name and "Tables & QR Codes" in the page heading', () => {
    stubTables(FAKE_TABLES);
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantDetailsTitle')
      .should('contain.text', RESTAURANT_NAME)
      .and('contain.text', 'Tables & QR Codes');
  });
});

// ─── 9e. QR code generation — POST /api/admin/restaurants/:id/tables ──────────

describe('Individual restaurant page — QR code generation (set tables)', () => {
  it('calls POST /api/admin/restaurants/:id/tables with the correct totalTables payload', () => {
    const generatedTables = [
      { _id: 'g1', tableNumber: 1, isActive: true,  qrCodeUrl: 'data:image/png;base64,abc=' },
      { _id: 'g2', tableNumber: 2, isActive: true,  qrCodeUrl: 'data:image/png;base64,def=' },
    ];

    cy.intercept('POST', `/api/admin/restaurants/${RESTAURANT_ID}/tables`, {
      statusCode: 201,
      body: { success: true, tables: generatedTables },
    }).as('setTables');

    stubTables(generatedTables);
    visitAsAdmin();
    cy.wait('@getTables');

    cy.window().then((win) => {
      win.fetch(`/api/admin/restaurants/${RESTAURANT_ID}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake.admin.jwt' },
        body: JSON.stringify({ totalTables: 2 }),
      });
    });

    cy.wait('@setTables').then((interception) => {
      expect(interception.request.body.totalTables).to.equal(2);
      expect(interception.response.statusCode).to.equal(201);
      expect(interception.response.body.tables).to.have.length(2);
      expect(interception.response.body.tables[0].qrCodeUrl).to.include('data:image');
    });
  });

  it('renders QR images after tables are set with generated data:image URLs', () => {
    const generatedTables = [
      { _id: 'g1', tableNumber: 1, isActive: true,  qrCodeUrl: 'data:image/png;base64,abc=' },
      { _id: 'g2', tableNumber: 2, isActive: true,  qrCodeUrl: 'data:image/png;base64,def=' },
    ];

    stubTables(generatedTables);
    visitAsAdmin();
    cy.wait('@getTables');

    cy.get('#restaurantTablesContainer img.qr-image').should('have.length', 2);
    cy.get('#restaurantTablesContainer img.qr-image').each(($img) => {
      expect($img.attr('src')).to.include('data:image/png;base64');
    });
  });

  it('returns 400 when totalTables is missing from the POST body', () => {
    cy.intercept('POST', `/api/admin/restaurants/${RESTAURANT_ID}/tables`, {
      statusCode: 400,
      body: { success: false, message: 'totalTables must be a non-negative integer' },
    }).as('setTablesError');

    stubTables([]);
    visitAsAdmin();
    cy.wait('@getTables');

    cy.window().then((win) => {
      win.fetch(`/api/admin/restaurants/${RESTAURANT_ID}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake.admin.jwt' },
        body: JSON.stringify({}),
      });
    });

    cy.wait('@setTablesError').then((interception) => {
      expect(interception.response.statusCode).to.equal(400);
      expect(interception.response.body.message).to.include('totalTables');
    });
  });
});

// ─── 9f. Missing restaurantId in URL ──────────────────────────────────────────

describe('Individual restaurant page — missing URL params', () => {
  it('shows an error when no restaurantId is in the URL', () => {
    cy.visit('/pages/ind_restaurant.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
    cy.get('#restaurantTablesContainer').should('contain.text', 'Restaurant ID is missing');
  });
});

// ─── 9g. API error handling ───────────────────────────────────────────────────

describe('Individual restaurant page — API errors', () => {
  it('shows an error message when GET /tables returns 401', () => {
    cy.intercept('GET', `/api/admin/restaurants/${RESTAURANT_ID}/tables`, {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('getTables');
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer').should('contain.text', 'Unauthorized');
  });

  it('shows an error message when the restaurant is not found (404)', () => {
    cy.intercept('GET', `/api/admin/restaurants/${RESTAURANT_ID}/tables`, {
      statusCode: 404,
      body: { message: 'Restaurant not found' },
    }).as('getTables');
    visitAsAdmin();
    cy.wait('@getTables');
    cy.get('#restaurantTablesContainer').should('contain.text', 'Restaurant not found');
  });
});

// ─── 9h. Back button navigation ───────────────────────────────────────────────

describe('Individual restaurant page — navigation', () => {
  it('navigates back to restaurants.html when Back link is clicked', () => {
    stubTables();
    visitAsAdmin();
    cy.wait('@getTables');

    cy.contains('a', 'Back to Restaurants').click();
    cy.url().should('include', 'restaurants.html');
  });
});

// ─── 9i. Logout ───────────────────────────────────────────────────────────────

describe('Individual restaurant page — logout', () => {
  it('clears localStorage and redirects to login.html on logout', () => {
    stubTables();
    visitAsAdmin();
    cy.wait('@getTables');

    cy.get('#logoutDropdownBtn').click({ force: true });
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
