/**
 * Owner Profile Navigation E2E Tests
 * File: cypress/e2e/owner-profile-navigation.cy.js
 *
 * Covers:
 *   1. frontend/pages/owner-profile.html
 *   2. frontend/js/owner-profile.js
 *
 * Test groups:
 *   10i. Navigation — Back to Dashboard link
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

function stubProfileApis() {
  cy.intercept('GET', '/api/auth/me', {
    statusCode: 200,
    body: {
      success: true,
      user: {
        _id: 'owner1', name: 'Test Owner', email: 'owner@test.com',
        role: 'owner', status: 'approved',
      },
    },
  }).as('getProfile');

  cy.intercept('GET', '/api/restaurants/my', {
    statusCode: 200,
    body: {
      success: true,
      restaurant: {
        _id: 'rest1', name: 'Test Bistro', address: '42 Collins St',
        phone: '0312345678', email: 'bistro@test.com', totalTables: 5,
      },
    },
  }).as('getRestaurant');
}

function visitAsOwner() {
  cy.visit(PAGE_URL, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake.owner.jwt');
      win.localStorage.setItem('user', JSON.stringify({
        _id: 'owner1', name: 'Test Owner', email: 'owner@test.com', role: 'owner',
      }));
    },
  });
}

describe('Owner profile — navigation', () => {
  beforeEach(() => {
    stubProfileApis();
    visitAsOwner();
    cy.wait('@getProfile');
    cy.wait('@getRestaurant');
  });

  it('navigates back to owner-dashboard.html via Back link', () => {
    cy.contains('a', 'Back to Dashboard').click();
    cy.url().should('include', 'owner-dashboard.html');
  });
});
