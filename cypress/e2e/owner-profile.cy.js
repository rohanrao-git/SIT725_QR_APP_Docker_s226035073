/**
 * Owner Profile E2E Tests
 * File: cypress/e2e/owner-profile.cy.js
 *
 * Covers:
 *   1. frontend/pages/owner-profile.html
 *   2. frontend/js/owner-profile.js
 *
 * Test groups:
 *   10a. Authentication guard
 *   10b. Page structure
 *   10c. Profile data loaded from API
 *   10d. Edit personal information
 *   10e. Change password
 *   10f. Edit restaurant information
 *   10g. API error handling
 *   10h. Logout
 *
 * Notes:
 *   All API calls are stubbed — tests do not require a running backend.
 *   Stubs must be registered BEFORE cy.visit() as owner-profile.js fires API
 *   calls immediately on DOMContentLoaded.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const PAGE_URL = '/pages/owner-profile.html';

const FAKE_USER = {
  _id: 'owner1',
  name: 'Test Owner',
  email: 'owner@test.com',
  role: 'owner',
  status: 'approved',
};

const FAKE_RESTAURANT = {
  _id: 'rest1',
  name: 'Test Bistro',
  address: '42 Collins St',
  phone: '0312345678',
  email: 'bistro@test.com',
  totalTables: 5,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubProfileApis(user = FAKE_USER, restaurant = FAKE_RESTAURANT) {
  cy.intercept('GET', '/api/auth/me', {
    statusCode: 200,
    body: { success: true, user },
  }).as('getProfile');

  cy.intercept('GET', '/api/restaurants/my', {
    statusCode: 200,
    body: { success: true, restaurant },
  }).as('getRestaurant');
}

function visitAsOwner() {
  cy.visit(PAGE_URL, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake.owner.jwt');
      win.localStorage.setItem('user', JSON.stringify(FAKE_USER));
    },
  });
}

/** Materialize labels can block typing on lower password fields without force */
function fillPasswordFields({ current, newPass, confirm }) {
  if (current !== undefined) {
    cy.get('#currentPassword').click({ force: true }).clear({ force: true }).type(current, { force: true });
  }
  if (newPass !== undefined) {
    cy.get('#newPassword').click({ force: true }).clear({ force: true }).type(newPass, { force: true });
  }
  if (confirm !== undefined) {
    cy.get('#confirmPassword').click({ force: true }).clear({ force: true }).type(confirm, { force: true });
  }
}

// ─── 10a. Authentication guard ────────────────────────────────────────────────

describe('Owner profile — authentication guard', () => {
  it('redirects to login.html when no token is stored', () => {
    cy.visit(PAGE_URL);
    cy.url().should('include', 'login.html');
  });

  it('redirects to login.html when user is an admin', () => {
    cy.visit(PAGE_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake.admin.jwt');
        win.localStorage.setItem('user', JSON.stringify({
          _id: 'admin1', name: 'Admin', email: 'admin@test.com', role: 'super_admin',
        }));
      },
    });
    cy.url().should('include', 'login.html');
  });

  it('loads the page when role is owner', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');
    cy.url().should('include', 'owner-profile.html');
  });
});

// ─── 10b. Page structure ──────────────────────────────────────────────────────

describe('Owner profile — page structure', () => {
  beforeEach(() => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');
  });

  it('has the correct page title', () => {
    cy.title().should('include', 'Profile');
  });

  it('shows the "Profile & Settings" heading', () => {
    cy.get('h4.profile-page-title').should('contain.text', 'Profile & Settings');
  });

  it('shows personal, password, and restaurant sections', () => {
    cy.contains('.card-title', 'Personal Information').should('be.visible');
    cy.contains('.card-title', 'Change Password').should('be.visible');
    cy.contains('.card-title', 'Restaurant Information').should('be.visible');
  });
});

// ─── 10c. Profile data loaded from API ────────────────────────────────────────

describe('Owner profile — profile data', () => {
  it('displays owner name and email from GET /auth/me', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');

    cy.get('#bannerName').should('contain.text', 'Test Owner');
    cy.get('#bannerEmail').should('contain.text', 'owner@test.com');
    cy.get('#viewName').should('contain.text', 'Test Owner');
    cy.get('#viewEmail').should('contain.text', 'owner@test.com');
  });

  it('displays restaurant details from GET /restaurants/my', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getRestaurant');

    cy.get('#viewRestaurantName').should('contain.text', 'Test Bistro');
    cy.get('#viewRestaurantAddress').should('contain.text', '42 Collins St');
    cy.get('#viewRestaurantPhone').should('contain.text', '0312345678');
    cy.get('#viewTotalTables').should('contain.text', '5');
  });
});

// ─── 10d. Edit personal information ───────────────────────────────────────────

describe('Owner profile — edit personal information', () => {
  it('calls PUT /auth/me when saving profile changes', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');

    cy.intercept('PUT', '/api/auth/me', {
      statusCode: 200,
      body: {
        success: true,
        user: { ...FAKE_USER, name: 'Updated Owner', email: 'updated@test.com' },
      },
    }).as('updateProfile');

    cy.get('#editInfoBtn').click();
    cy.get('#profileName').clear().type('Updated Owner');
    cy.get('#profileEmail').clear().type('updated@test.com');
    cy.get('#saveInfoBtn').click();

    cy.wait('@updateProfile').then((interception) => {
      expect(interception.request.body.name).to.equal('Updated Owner');
      expect(interception.request.body.email).to.equal('updated@test.com');
    });

    cy.get('#viewName').should('contain.text', 'Updated Owner');
  });
});

// ─── 10e. Change password ─────────────────────────────────────────────────────

describe('Owner profile — change password', () => {
  it('calls PUT /auth/me/password with correct payload', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');

    cy.intercept('PUT', '/api/auth/me/password', {
      statusCode: 200,
      body: { success: true, message: 'Password updated' },
    }).as('updatePassword');

    fillPasswordFields({
      current: 'oldpassword',
      newPass: 'newpassword123',
      confirm: 'newpassword123',
    });
    cy.get('#savePasswordBtn').click();

    cy.wait('@updatePassword').then((interception) => {
      expect(interception.request.body.currentPassword).to.equal('oldpassword');
      expect(interception.request.body.newPassword).to.equal('newpassword123');
    });
  });

  it('shows error when new passwords do not match', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');

    cy.intercept('PUT', '/api/auth/me/password').as('updatePassword');

    fillPasswordFields({
      current: 'oldpassword',
      newPass: 'newpassword123',
      confirm: 'differentpassword',
    });
    cy.get('#savePasswordBtn').click();

    cy.get('@updatePassword.all').should('have.length', 0);
    cy.get('#passwordError').should('not.have.class', 'hide');
  });
});

// ─── 10f. Edit restaurant information ─────────────────────────────────────────

describe('Owner profile — edit restaurant information', () => {
  it('calls PUT /restaurants/my when saving restaurant changes', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');

    cy.intercept('PUT', '/api/restaurants/my', {
      statusCode: 200,
      body: {
        success: true,
        restaurant: { ...FAKE_RESTAURANT, name: 'New Bistro Name' },
      },
    }).as('updateRestaurant');

    cy.get('#editRestaurantBtn').click();
    cy.get('#restaurantName').clear().type('New Bistro Name');
    cy.get('#saveRestaurantBtn').click();

    cy.wait('@updateRestaurant').then((interception) => {
      expect(interception.request.body.name).to.equal('New Bistro Name');
    });

    cy.get('#viewRestaurantName').should('contain.text', 'New Bistro Name');
  });
});

// ─── 10g. API error handling ────────────────────────────────────────────────────

describe('Owner profile — API errors', () => {
  it('shows toast when GET /auth/me returns 401', () => {
    cy.intercept('GET', '/api/auth/me', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('getProfile');

    cy.intercept('GET', '/api/restaurants/my', {
      statusCode: 200,
      body: { success: true, restaurant: FAKE_RESTAURANT },
    }).as('getRestaurant');

    visitAsOwner();
    cy.wait('@getProfile');
    cy.contains('Failed to load profile').should('exist');
  });
});

// ─── 10h. Logout ───────────────────────────────────────────────────────────────

describe('Owner profile — logout', () => {
  it('clears localStorage and redirects to login.html on logout', () => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');

    cy.get('#logoutBtn').click();
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
