/**
 * General Page Load Tests
 * File: cypress/e2e/pages.cy.js
 *
 * Covers:
 *   1. All frontend pages served by the Express backend
 *   2. Static JS assets
 *
 * Test groups:
 *   - Root route (GET /)
 *   - All HTML pages (login, signup, menu, dashboards, admin, owner, analytics)
 *   - QR menu route (/menu/:restaurantId)
 *   - Static JS/CSS assets
 *
 * Notes:
 *   Pages that are placeholder stubs will surface failing tests intentionally —
 *   these flag unimplemented pages for the development team.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

// ─── Root route ───────────────────────────────────────────────────────────────

describe('GET / — root route serves login page', () => {
  it('returns HTTP 200', () => {
    cy.request('/').its('status').should('equal', 200);
  });

  it('serves the login HTML page at the root', () => {
    cy.visit('/');
    cy.get('#loginForm').should('exist');
    cy.title().should('include', 'Login');
  });
});

// ─── login.html ───────────────────────────────────────────────────────────────

describe('GET /pages/login.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/login.html').its('status').should('equal', 200);
  });

  it('page is accessible and renders the login form', () => {
    cy.visit('/pages/login.html');
    cy.get('#loginForm').should('exist');
  });
});

// ─── index.html ───────────────────────────────────────────────────────────────

describe('GET /pages/index.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/index.html').its('status').should('equal', 200);
  });
});

// ─── menu.html (guest) ───────────────────────────────────────────────────────

describe('GET /pages/menu.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/menu.html').its('status').should('equal', 200);
  });

  it('renders guest menu structure', () => {
    cy.visit('/pages/menu.html?restaurantId=507f1f77bcf86cd799439011&table=1', {
      failOnStatusCode: false,
    });
    cy.get('#menuContainer').should('exist');
    cy.get('#menuStatus').should('exist');
  });
});

describe('GET /menu/:restaurantId — QR route', () => {
  it('returns HTTP 200 for menu page', () => {
    cy.request('/menu/507f1f77bcf86cd799439011?table=1').its('status').should('equal', 200);
  });
});

// ─── admin-dashboard.html ─────────────────────────────────────────────────────

describe('GET /pages/admin-dashboard.html', () => {
  it('page loads successfully (200)', () => {
    cy.request('/pages/admin-dashboard.html').its('status').should('equal', 200);
  });

  it('page contains expected HTML structure', () => {
    cy.visit('/pages/admin-dashboard.html');
    cy.get('body').should('exist');
  });
});

// ─── owner-dashboard.html ─────────────────────────────────────────────────────

describe('GET /pages/owner-dashboard.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/owner-dashboard.html').its('status').should('equal', 200);
  });

  it('page is accessible', () => {
    // Owner dashboard redirects unauthenticated users back to login — that is
    // expected behaviour. Just confirm the page itself is served.
    cy.visit('/pages/owner-dashboard.html', { failOnStatusCode: false });
    cy.get('body').should('exist');
  });
});

// ─── owner_signup.html ────────────────────────────────────────────────────────

describe('GET /pages/owner_signup.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/owner_signup.html').its('status').should('equal', 200);
  });

  it('renders the owner signup form', () => {
    cy.visit('/pages/owner_signup.html');
    cy.get('#ownerSignupForm').should('exist');
    cy.contains('h4', 'Owner Signup').should('be.visible');
  });
});

// ─── owner-profile.html ─────────────────────────────────────────────────────

describe('GET /pages/owner-profile.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/owner-profile.html').its('status').should('equal', 200);
  });
});

// ─── analytics.html ─────────────────────────────────────────────────────────

describe('GET /pages/analytics.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/analytics.html').its('status').should('equal', 200);
  });
});

// ─── Admin pages ────────────────────────────────────────────────────────────

describe('GET /pages/pending_owners.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/pending_owners.html').its('status').should('equal', 200);
  });
});

describe('GET /pages/owners.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/owners.html').its('status').should('equal', 200);
  });
});

describe('GET /pages/restaurants.html', () => {
  it('returns HTTP 200', () => {
    cy.request('/pages/restaurants.html').its('status').should('equal', 200);
  });
});

describe('GET /pages/ind_restaurant.html', () => {
  it('returns HTTP 200 with query params', () => {
    cy.request('/pages/ind_restaurant.html?id=rest1&name=Test').its('status').should('equal', 200);
  });
});

// ─── Static assets ────────────────────────────────────────────────────────────

describe('Static assets are served correctly', () => {
  const assets = [
    '/js/config.js',
    '/js/auth.js',
    '/js/owner.js',
    '/js/owner-profile.js',
    '/js/admin.js',
    '/js/menu.js',
    '/js/analytics.js',
    '/css/style.css',
  ];

  assets.forEach((asset) => {
    it(`${asset} is reachable`, () => {
      cy.request(asset).its('status').should('equal', 200);
    });
  });
});
