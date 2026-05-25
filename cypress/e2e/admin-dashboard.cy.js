/**
 * Admin Dashboard E2E Tests
 * File: cypress/e2e/admin-dashboard.cy.js
 *
 * Covers:
 *   1. frontend/pages/admin-dashboard.html
 *   2. frontend/js/admin.js
 *
 * Test groups:
 *   3a. Authentication guard
 *   3b. Page structure
 *   3c. Welcome message
 *   3d. Pending owners — loaded from API
 *   3e. Restaurants table — loaded from API
 *   3f. Owner actions (approve / deny)
 *   3g. Logout
 *
 * Notes:
 *   All API calls are stubbed — tests do not require a running backend.
 *   Stubs must be registered BEFORE cy.visit() as admin.js fires API
 *   calls immediately on DOMContentLoaded.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const DASHBOARD_URL = '/pages/admin-dashboard.html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setAdminSession(role = 'super_admin') {
  cy.window().then((win) => {
    win.localStorage.setItem('token', 'fake.admin.jwt');
    win.localStorage.setItem('user', JSON.stringify({
      _id: 'admin1',
      name: 'Super Admin',
      email: 'admin@system.com',
      role,
    }));
  });
}

function stubPendingOwners(owners = []) {
  cy.intercept('GET', '/api/admin/owners/pending', {
    statusCode: 200,
    body: { owners },
  }).as('pendingOwners');
}

function stubRestaurants(restaurants = []) {
  cy.intercept('GET', '/api/admin/restaurants', {
    statusCode: 200,
    body: { restaurants },
  }).as('restaurants');
}

const FAKE_OWNERS = [
  { _id: 'owner1', name: 'Alice Owner', email: 'alice@owner.com', status: 'pending' },
  { _id: 'owner2', name: 'Bob Owner',   email: 'bob@owner.com',   status: 'pending' },
];

const FAKE_RESTAURANTS = [
  { _id: 'rest1', name: 'Pizza Palace', address: '1 Main St', isActive: true,  totalTables: 5 },
  { _id: 'rest2', name: 'Burger Barn',  address: '2 High St', isActive: false, totalTables: 0 },
];

// ─── 3a. Authentication guard ─────────────────────────────────────────────────

describe('Admin dashboard — authentication guard', () => {
  it('redirects to login.html when no token is stored', () => {
    cy.visit(DASHBOARD_URL);
    cy.url().should('include', 'login.html');
  });

  it('redirects to login.html when localStorage has token but no user', () => {
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'some.token');
      },
    });
    cy.url().should('include', 'login.html');
  });

  it('redirects to login.html when the logged-in user is an owner (not admin)', () => {
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'owner.token');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'owner99', name: 'Some Owner', email: 'owner@test.com', role: 'owner',
        }));
      },
    });
    cy.url().should('include', 'login.html');
  });

  it('loads the dashboard when role is super_admin', () => {
    stubPendingOwners();
    stubRestaurants();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
    cy.url().should('include', 'admin-dashboard.html');
  });

  it('loads the dashboard when role is admin', () => {
    stubPendingOwners();
    stubRestaurants();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin2', name: 'Regular Admin', email: 'radmin@system.com', role: 'admin',
        }));
      },
    });
    cy.url().should('include', 'admin-dashboard.html');
  });
});

// ─── 3b. Page structure ───────────────────────────────────────────────────────

describe('Admin dashboard — page structure', () => {
  beforeEach(() => {
    stubPendingOwners();
    stubRestaurants();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
  });

  it('has the correct page title', () => {
    cy.title().should('include', 'Admin Dashboard');
  });

  it('shows the navbar with brand logo', () => {
    cy.get('nav .brand-logo').should('contain.text', 'Admin');
  });

  it('shows the "Super Admin Dashboard" heading', () => {
    cy.get('h4').should('contain.text', 'Super Admin Dashboard');
  });

  it('shows the Pending Owners summary card', () => {
    cy.contains('.card-title', 'Pending Owners').should('be.visible');
    cy.get('#pendingCount').should('exist');
  });

  it('shows the Restaurants summary card', () => {
    cy.contains('.card-title', 'Restaurants').should('be.visible');
    cy.get('#restaurantCount').should('exist');
  });

  it('shows the restaurants table with correct column headers', () => {
    cy.get('table thead th').then(($ths) => {
      const headers = [...$ths].map(th => th.textContent.trim());
      expect(headers).to.include('Name');
      expect(headers).to.include('Address');
      expect(headers).to.include('Active');
      expect(headers).to.include('Total Tables');
    });
  });

  it('shows the Pending Owner Requests section', () => {
    cy.contains('.card-title', 'Pending Owner Requests').should('be.visible');
  });
});

// ─── 3c. Welcome message ──────────────────────────────────────────────────────

describe('Admin dashboard — welcome message', () => {
  beforeEach(() => {
    stubPendingOwners();
    stubRestaurants();
  });

  it('displays the admin name in the welcome message', () => {
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Ferdinand', email: 'ferd@system.com', role: 'super_admin',
        }));
      },
    });
    cy.get('#adminWelcome').should('contain.text', 'Welcome, Ferdinand');
  });

  it('falls back to email if name is missing', () => {
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: '', email: 'ferd@system.com', role: 'super_admin',
        }));
      },
    });
    cy.get('#adminWelcome').should('contain.text', 'ferd@system.com');
  });
});

// ─── 3d. Pending owners — loaded from API ─────────────────────────────────────

describe('Admin dashboard — pending owners list', () => {
  function visitWithPendingOwners(owners) {
    stubPendingOwners(owners);
    stubRestaurants();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
    cy.wait('@pendingOwners');
  }

  it('renders a row for each pending owner', () => {
    visitWithPendingOwners(FAKE_OWNERS);
    cy.get('#pendingOwnersTable tr').should('have.length', 2);
  });

  it('shows owner name and email in the table', () => {
    visitWithPendingOwners(FAKE_OWNERS);
    cy.get('#pendingOwnersTable').should('contain.text', 'Alice Owner');
    cy.get('#pendingOwnersTable').should('contain.text', 'alice@owner.com');
  });

  it('shows Approve and Deny buttons on each row', () => {
    visitWithPendingOwners(FAKE_OWNERS);
    cy.get('#pendingOwnersTable tr').first().within(() => {
      cy.contains('button', 'Approve').should('be.visible');
      cy.contains('button', 'Deny').should('be.visible');
    });
  });

  it('shows "No pending owners found" when list is empty', () => {
    visitWithPendingOwners([]);
    cy.get('#pendingOwnersTable').should('contain.text', 'No pending owners found');
  });

  it('shows an error message when pending owners API fails', () => {
    cy.intercept('GET', '/api/admin/owners/pending', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('pendingOwners');
    stubRestaurants();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable').should('contain.text', 'Unauthorized');
  });
});

// ─── 3e. Restaurants table — loaded from API ──────────────────────────────────

describe('Admin dashboard — restaurants table', () => {
  function visitWithRestaurants(restaurants) {
    stubPendingOwners();
    stubRestaurants(restaurants);
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
    cy.wait('@restaurants');
  }

  it('renders a row for each restaurant', () => {
    visitWithRestaurants(FAKE_RESTAURANTS);
    cy.get('#restaurantsTable tr').should('have.length', 2);
  });

  it('shows restaurant name and address in the row', () => {
    visitWithRestaurants(FAKE_RESTAURANTS);
    cy.get('#restaurantsTable').should('contain.text', 'Pizza Palace');
    cy.get('#restaurantsTable').should('contain.text', '1 Main St');
  });

  it('shows "Yes" for active restaurants and "No" for inactive', () => {
    visitWithRestaurants(FAKE_RESTAURANTS);
    cy.get('#restaurantsTable tr').eq(0).should('contain.text', 'Yes');
    cy.get('#restaurantsTable tr').eq(1).should('contain.text', 'No');
  });

  it('updates the restaurant count summary card', () => {
    visitWithRestaurants(FAKE_RESTAURANTS);
    cy.get('#restaurantCount').should('have.text', '2');
  });

  it('shows "No restaurants found" when list is empty', () => {
    visitWithRestaurants([]);
    cy.get('#restaurantsTable').should('contain.text', 'No restaurants found');
  });

  it('shows an error message in the table when restaurants API fails', () => {
    stubPendingOwners();
    cy.intercept('GET', '/api/admin/restaurants', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('restaurants');
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
    cy.wait('@restaurants');
    cy.get('#restaurantsTable').should('contain.text', 'Unauthorized');
  });
});

// ─── 3f. Owner actions ────────────────────────────────────────────────────────

describe('Admin dashboard — owner actions', () => {
  beforeEach(() => {
    stubPendingOwners(FAKE_OWNERS);
    stubRestaurants();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable tr').should('have.length', 2);
  });

  it('calls PATCH /approve when Approve button is clicked', () => {
    cy.intercept('PATCH', '/api/admin/owners/owner1/approve', {
      statusCode: 200,
      body: { message: 'Owner approved' },
    }).as('approveOwner');
    stubPendingOwners([FAKE_OWNERS[1]]);

    cy.get('#pendingOwnersTable tr').first()
      .contains('button', 'Approve')
      .click();

    cy.wait('@approveOwner');
  });

  it('calls PATCH /reject when Deny button is clicked', () => {
    cy.intercept('PATCH', '/api/admin/owners/owner1/reject', {
      statusCode: 200,
      body: { message: 'Owner rejected' },
    }).as('rejectOwner');
    stubPendingOwners([FAKE_OWNERS[1]]);

    cy.get('#pendingOwnersTable tr').first()
      .contains('button', 'Deny')
      .click({ force: true });

    cy.wait('@rejectOwner');
  });
});

// ─── 3g. Logout ───────────────────────────────────────────────────────────────

describe('Admin dashboard — logout', () => {
  beforeEach(() => {
    stubPendingOwners();
    stubRestaurants();
    cy.visit(DASHBOARD_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
        }));
      },
    });
  });

  it('clears localStorage and redirects to login.html on logout', () => {
    cy.get('#logoutDropdownBtn').click({ force: true });
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
