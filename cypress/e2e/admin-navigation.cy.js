/**
 * Admin Navigation E2E Tests
 * File: cypress/e2e/admin-navigation.cy.js
 *
 * Covers navbar links on admin pages (admin-dashboard.html)
 */

const DASHBOARD_URL = '/pages/admin-dashboard.html';

function visitAsAdmin() {
  cy.visit(DASHBOARD_URL, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake.admin.jwt');
      win.localStorage.setItem('user', JSON.stringify({
        _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin',
      }));
    },
  });
}

function stubDashboardApis() {
  cy.intercept('GET', '/api/admin/owners/pending', {
    statusCode: 200,
    body: { owners: [] },
  }).as('pendingOwners');

  cy.intercept('GET', '/api/admin/restaurants', {
    statusCode: 200,
    body: { restaurants: [] },
  }).as('restaurants');
}

describe('Admin dashboard — navbar navigation', () => {
  beforeEach(() => {
    stubDashboardApis();
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.wait('@restaurants');
  });

  it('navigates to owners.html from Manage dropdown', () => {
    cy.contains('nav a', 'Manage').click({ force: true });
    cy.contains('.dropdown-content a', 'Manage Owners').click({ force: true });
    cy.url().should('include', 'owners.html');
  });

  it('navigates to pending_owners.html from Admin dropdown', () => {
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.contains('nav a', 'Admin').click({ force: true });
    // Must use "Pending Owners" — cy.contains('Owners') matches "Manage Owners" first
    cy.get('#adminDropdown a[href="pending_owners.html"]').click({ force: true });
    cy.url().should('include', 'pending_owners.html');
  });

  it('navigates to restaurants.html from Admin dropdown', () => {
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.contains('nav a', 'Admin').click({ force: true });
    cy.contains('.dropdown-content a', 'Restaurants').click({ force: true });
    cy.url().should('include', 'restaurants.html');
  });
});
