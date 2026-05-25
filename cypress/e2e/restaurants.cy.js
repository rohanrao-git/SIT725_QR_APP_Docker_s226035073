/**
 * Restaurants Admin Page E2E Tests
 * File: cypress/e2e/restaurants.cy.js
 *
 * Covers:
 *   1. frontend/pages/restaurants.html
 *   2. frontend/js/admin.js
 *
 * Test groups:
 *   8a. Authentication guard
 *   8b. Page structure
 *   8c. Restaurants table — loaded from API
 *   8d. Restaurant count summary card
 *   8e. Row click navigates to individual restaurant page
 *   8f. Search / filter
 *   8g. API error handling
 *   8h. Logout
 *
 * Notes:
 *   All API calls are stubbed — tests do not require a running backend.
 *   Stubs must be registered BEFORE cy.visit() as admin.js fires API
 *   calls immediately on DOMContentLoaded.
 *   Previously split across restaurant.cy.js (basic suite) and this file —
 *   merged into one complete spec.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const PAGE_URL = '/pages/restaurants.html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubRestaurants(restaurants = []) {
  cy.intercept('GET', '/api/admin/restaurants', {
    statusCode: 200,
    body: { restaurants },
  }).as('getRestaurants');
}

function visitAsAdmin() {
  cy.visit(PAGE_URL, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake.admin.jwt');
      win.localStorage.setItem('user', JSON.stringify({
        _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
      }));
    },
  });
}

const FAKE_RESTAURANTS = [
  { _id: 'rest1', name: 'Pizza Palace', address: '1 Main St', isActive: true,  totalTables: 5 },
  { _id: 'rest2', name: 'Burger Barn',  address: '2 High St', isActive: false, totalTables: 0 },
];

// ─── 8a. Authentication guard ─────────────────────────────────────────────────

describe('Restaurants page — authentication guard', () => {
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
    stubRestaurants();
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.url().should('include', 'restaurants.html');
  });
});

// ─── 8b. Page structure ───────────────────────────────────────────────────────

describe('Restaurants page — page structure', () => {
  beforeEach(() => {
    stubRestaurants();
    visitAsAdmin();
    cy.wait('@getRestaurants');
  });

  it('shows the "Restaurants" heading', () => {
    cy.get('h4').should('contain.text', 'Restaurants');
  });

  it('shows the restaurants table', () => {
    cy.get('#restaurantsTable').should('exist');
  });

  it('shows the search input', () => {
    cy.get('#restaurantSearch').should('exist');
  });

  it('shows the restaurant count summary card', () => {
    cy.get('#restaurantCount').should('exist');
  });
});

// ─── 8c. Restaurants table ────────────────────────────────────────────────────

describe('Restaurants page — table content', () => {
  it('renders a row for each restaurant', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantsTable tr').should('have.length', 2);
  });

  it('shows restaurant name, address and active status in each row', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantsTable').should('contain.text', 'Pizza Palace');
    cy.get('#restaurantsTable').should('contain.text', '1 Main St');
    cy.get('#restaurantsTable').should('contain.text', 'Yes');
  });

  it('shows inactive status for restaurants that are not active', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantsTable').should('contain.text', 'No');
  });

  it('shows "No restaurants found" when list is empty', () => {
    stubRestaurants([]);
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantsTable').should('contain.text', 'No restaurants found');
  });
});

// ─── 8d. Restaurant count card ────────────────────────────────────────────────

describe('Restaurants page — count card', () => {
  it('shows the correct restaurant count', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantCount').should('have.text', '2');
  });

  it('shows 0 when there are no restaurants', () => {
    stubRestaurants([]);
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantCount').should('have.text', '0');
  });
});

// ─── 8e. Row click navigates to individual restaurant page ────────────────────

describe('Restaurants page — row navigation', () => {
  it('navigates to ind_restaurant.html with the correct id when a row is clicked', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');

    cy.get('#restaurantsTable tr').first().click();
    cy.url()
      .should('include', 'ind_restaurant.html')
      .and('include', 'rest1');
  });
});

// ─── 8f. Search / filter ─────────────────────────────────────────────────────

describe('Restaurants page — search', () => {
  it('filters rows when typing in the search box', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantsTable tr').should('have.length', 2);

    cy.get('#restaurantSearch').clear().type('Pizza');
    cy.get('#restaurantsTable tr').should('have.length', 1);
    cy.get('#restaurantsTable').should('contain.text', 'Pizza Palace');
    cy.get('#restaurantsTable').should('not.contain.text', 'Burger Barn');
  });

  it('updates the restaurant count card after filtering', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');

    cy.get('#restaurantSearch').clear().type('Pizza');
    cy.get('#restaurantCount').should('have.text', '1');
  });

  it('shows "No restaurants found" when search matches nothing', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');

    cy.get('#restaurantSearch').clear().type('xyzzy_nonexistent');
    cy.get('#restaurantsTable').should('contain.text', 'No restaurants found');
  });

  it('restores all rows when search box is cleared', () => {
    stubRestaurants(FAKE_RESTAURANTS);
    visitAsAdmin();
    cy.wait('@getRestaurants');

    cy.get('#restaurantSearch').clear().type('Pizza');
    cy.get('#restaurantsTable tr').should('have.length', 1);
    cy.get('#restaurantSearch').clear();
    cy.get('#restaurantsTable tr').should('have.length', 2);
  });
});

// ─── 8g. API error handling ───────────────────────────────────────────────────

describe('Restaurants page — API errors', () => {
  it('shows an error message when GET /admin/restaurants returns 401', () => {
    cy.intercept('GET', '/api/admin/restaurants', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('getRestaurants');
    visitAsAdmin();
    cy.wait('@getRestaurants');
    cy.get('#restaurantsTable').should('contain.text', 'Unauthorized');
  });

  it('shows an error message when GET /admin/restaurants returns 500', () => {
    cy.intercept('GET', '/api/admin/restaurants', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('getRestaurantsError');
    visitAsAdmin();
    cy.wait('@getRestaurantsError');
    cy.get('#restaurantsTable').should('not.be.empty');
  });
});

// ─── 8h. Logout ───────────────────────────────────────────────────────────────

describe('Restaurants page — logout', () => {
  it('clears localStorage and redirects to login.html on logout', () => {
    stubRestaurants();
    visitAsAdmin();
    cy.wait('@getRestaurants');

    cy.get('#logoutDropdownBtn').click({ force: true });
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
