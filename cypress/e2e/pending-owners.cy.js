/**
 * Pending Owners Admin Page E2E Tests
 * File: cypress/e2e/pending-owners.cy.js
 *
 * Covers:
 *   1. frontend/pages/pending_owners.html
 *   2. frontend/js/admin.js
 *
 * Test groups:
 *   6a. Authentication guard
 *   6b. Page structure
 *   6c. Pending owners table — loaded from API
 *   6d. Approve / Deny actions
 *   6e. Search / filter
 *   6f. API error handling
 *   6g. Logout
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

const PAGE_URL = '/pages/pending_owners.html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubPendingOwners(owners = []) {
  cy.intercept('GET', '/api/admin/owners/pending', {
    statusCode: 200,
    body: { owners },
  }).as('pendingOwners');
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

const FAKE_PENDING = [
  { _id: 'owner1', name: 'Alice Owner', email: 'alice@owner.com', status: 'pending' },
  { _id: 'owner2', name: 'Bob Owner',   email: 'bob@owner.com',   status: 'pending' },
];

// ─── 6a. Authentication guard ─────────────────────────────────────────────────

describe('Pending owners page — authentication guard', () => {
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
    stubPendingOwners();
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.url().should('include', 'pending_owners.html');
  });
});

// ─── 6b. Page structure ───────────────────────────────────────────────────────

describe('Pending owners page — page structure', () => {
  beforeEach(() => {
    stubPendingOwners();
    visitAsAdmin();
    cy.wait('@pendingOwners');
  });

  it('shows the "Pending Owner Requests" heading', () => {
    cy.get('h4').should('contain.text', 'Pending Owner Requests');
  });

  it('shows the pending owners table', () => {
    cy.get('#pendingOwnersTable').should('exist');
  });

  it('shows the search input', () => {
    cy.get('#pendingOwnerSearch').should('exist');
  });
});

// ─── 6c. Pending owners table ─────────────────────────────────────────────────

describe('Pending owners page — table content', () => {
  it('renders a row for each pending owner', () => {
    stubPendingOwners(FAKE_PENDING);
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable tr').should('have.length', 2);
  });

  it('shows owner name and email in each row', () => {
    stubPendingOwners(FAKE_PENDING);
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable').should('contain.text', 'Alice Owner');
    cy.get('#pendingOwnersTable').should('contain.text', 'alice@owner.com');
  });

  it('shows Approve and Deny buttons on each row', () => {
    stubPendingOwners(FAKE_PENDING);
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable tr').first().within(() => {
      cy.contains('button', 'Approve').should('be.visible');
      cy.contains('button', 'Deny').should('be.visible');
    });
  });

  it('shows "No pending owners found" when list is empty', () => {
    stubPendingOwners([]);
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable').should('contain.text', 'No pending owners found');
  });
});

// ─── 6d. Approve / Deny actions ───────────────────────────────────────────────

describe('Pending owners page — actions', () => {
  beforeEach(() => {
    stubPendingOwners(FAKE_PENDING);
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable tr').should('have.length', 2);
  });

  it('calls PATCH /approve when Approve button is clicked', () => {
    cy.intercept('PATCH', '/api/admin/owners/owner1/approve', {
      statusCode: 200,
      body: { success: true },
    }).as('approveOwner');
    stubPendingOwners([FAKE_PENDING[1]]);

    cy.get('#pendingOwnersTable tr').first().contains('button', 'Approve').click({ force: true });
    cy.wait('@approveOwner');
  });

  it('calls PATCH /reject when Deny button is clicked', () => {
    cy.intercept('PATCH', '/api/admin/owners/owner1/reject', {
      statusCode: 200,
      body: { success: true },
    }).as('rejectOwner');
    stubPendingOwners([FAKE_PENDING[1]]);

    cy.get('#pendingOwnersTable tr').first().contains('button', 'Deny').click({ force: true });
    cy.wait('@rejectOwner');
  });
});

// ─── 6e. Search / filter ─────────────────────────────────────────────────────

describe('Pending owners page — search', () => {
  it('filters rows when typing in the search box', () => {
    stubPendingOwners(FAKE_PENDING);
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable tr').should('have.length', 2);

    cy.get('#pendingOwnerSearch').clear().type('Alice');
    cy.get('#pendingOwnersTable tr').should('have.length', 1);
    cy.get('#pendingOwnersTable').should('contain.text', 'Alice Owner');
  });

  it('shows "No pending owners found" when search matches nothing', () => {
    stubPendingOwners(FAKE_PENDING);
    visitAsAdmin();
    cy.wait('@pendingOwners');

    cy.get('#pendingOwnerSearch').clear().type('xyzzy_nonexistent');
    cy.get('#pendingOwnersTable').should('contain.text', 'No pending owners found');
  });

  it('restores all rows when search is cleared', () => {
    stubPendingOwners(FAKE_PENDING);
    visitAsAdmin();
    cy.wait('@pendingOwners');

    cy.get('#pendingOwnerSearch').clear().type('Alice');
    cy.get('#pendingOwnersTable tr').should('have.length', 1);
    cy.get('#pendingOwnerSearch').clear();
    cy.get('#pendingOwnersTable tr').should('have.length', 2);
  });
});

// ─── 6f. API error handling ───────────────────────────────────────────────────

describe('Pending owners page — API errors', () => {
  it('shows an error message when the API returns 401', () => {
    cy.intercept('GET', '/api/admin/owners/pending', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('pendingOwners');
    visitAsAdmin();
    cy.wait('@pendingOwners');
    cy.get('#pendingOwnersTable').should('contain.text', 'Unauthorized');
  });

  it('shows an error message when the API returns 500', () => {
    cy.intercept('GET', '/api/admin/owners/pending', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('pendingOwnersError');
    visitAsAdmin();
    cy.wait('@pendingOwnersError');
    cy.get('#pendingOwnersTable').should('not.be.empty');
  });
});

// ─── 6g. Logout ───────────────────────────────────────────────────────────────

describe('Pending owners page — logout', () => {
  it('clears localStorage and redirects to login.html on logout', () => {
    stubPendingOwners();
    visitAsAdmin();
    cy.wait('@pendingOwners');

    cy.get('#logoutDropdownBtn').click({ force: true });
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
