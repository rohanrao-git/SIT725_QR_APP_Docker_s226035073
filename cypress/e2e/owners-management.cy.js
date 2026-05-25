/**
 * Owners Management Admin Page E2E Tests
 * File: cypress/e2e/owners-management.cy.js
 *
 * Covers:
 *   1. frontend/pages/owners.html
 *   2. frontend/js/admin.js
 *
 * Test groups:
 *   7a. Authentication guard
 *   7b. Page structure
 *   7c. Owners table — loaded from API
 *   7d. Owner count summary card
 *   7e. Remove Access action
 *   7f. Search / filter
 *   7g. API error handling
 *   7h. Logout
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

const PAGE_URL = '/pages/owners.html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubOwners(owners = []) {
  cy.intercept('GET', '/api/admin/owners', {
    statusCode: 200,
    body: { success: true, owners },
  }).as('getOwners');
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

/** admin.js reads owner.restaurantId.name (populated shape from GET /api/admin/owners) */
const FAKE_OWNERS = [
  {
    _id: 'owner1', name: 'Alice Owner', email: 'alice@owner.com',
    status: 'approved', restaurantId: { _id: 'rest1', name: 'Alice Bistro' },
  },
  {
    _id: 'owner2', name: 'Bob Owner', email: 'bob@owner.com',
    status: 'disabled', restaurantId: { _id: 'rest2', name: 'Bob Grill' },
  },
];

// ─── 7a. Authentication guard ─────────────────────────────────────────────────

describe('Owners management page — authentication guard', () => {
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
    stubOwners();
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.url().should('include', 'owners.html');
  });
});

// ─── 7b. Page structure ───────────────────────────────────────────────────────

describe('Owners management page — page structure', () => {
  beforeEach(() => {
    stubOwners();
    visitAsAdmin();
    cy.wait('@getOwners');
  });

  it('shows the "Owner Management" heading', () => {
    cy.get('h4').should('contain.text', 'Owner Management');
  });

  it('shows the owners table', () => {
    cy.get('#ownersTable').should('exist');
  });

  it('shows the search input', () => {
    cy.get('#ownerSearch').should('exist');
  });

  it('shows the owner count summary card', () => {
    cy.get('#ownerCount').should('exist');
  });
});

// ─── 7c. Owners table ─────────────────────────────────────────────────────────

describe('Owners management page — table content', () => {
  it('renders a row for each owner', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable tr').should('have.length', 2);
  });

  it('shows owner name, email and status in each row', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable').should('contain.text', 'Alice Owner');
    cy.get('#ownersTable').should('contain.text', 'alice@owner.com');
    cy.get('#ownersTable').should('contain.text', 'approved');
  });

  it('shows "No owners found" when list is empty', () => {
    stubOwners([]);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable').should('contain.text', 'No owners found');
  });
});

// ─── 7d. Owner count summary card ────────────────────────────────────────────

describe('Owners management page — owner count card', () => {
  it('shows the correct total owner count', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownerCount').should('have.text', '2');
  });

  it('shows 0 when no owners exist', () => {
    stubOwners([]);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownerCount').should('have.text', '0');
  });
});

// ─── 7e. Remove Access action ─────────────────────────────────────────────────

describe('Owners management page — remove access', () => {
  it('calls PATCH /disable when Remove Access is confirmed', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable tr').should('have.length', 2);

    cy.intercept('PATCH', '/api/admin/owners/owner1/disable', {
      statusCode: 200,
      body: { success: true },
    }).as('disableOwner');
    stubOwners([FAKE_OWNERS[1]]);

    cy.on('window:confirm', () => true);
    cy.get('#ownersTable tr').first().contains('button', 'Remove Access').click({ force: true });
    cy.wait('@disableOwner');
  });

  it('does not call PATCH /disable when Remove Access is cancelled', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable tr').should('have.length', 2);

    cy.intercept('PATCH', '/api/admin/owners/owner1/disable').as('disableOwner');
    cy.on('window:confirm', () => false);

    cy.get('#ownersTable tr').first().contains('button', 'Remove Access').click({ force: true });
    cy.get('@disableOwner.all').should('have.length', 0);
  });
});

// ─── 7f. Search / filter ─────────────────────────────────────────────────────

describe('Owners management page — search', () => {
  it('filters rows when typing in the search box', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable tr').should('have.length', 2);

    cy.get('#ownerSearch').clear().type('Alice');
    cy.get('#ownersTable tr').should('have.length', 1);
    cy.get('#ownersTable').should('contain.text', 'Alice Owner');
  });

  it('shows "No owners found" when search matches nothing', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');

    cy.get('#ownerSearch').clear().type('xyzzy_nonexistent');
    cy.get('#ownersTable').should('contain.text', 'No owners found');
  });

  it('restores all rows when search box is cleared', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');

    cy.get('#ownerSearch').clear().type('Alice');
    cy.get('#ownersTable tr').should('have.length', 1);
    cy.get('#ownerSearch').clear();
    cy.get('#ownersTable tr').should('have.length', 2);
  });
});

// ─── 7g. API error handling ───────────────────────────────────────────────────

describe('Owners management page — API errors', () => {
  it('shows an error message when GET /admin/owners returns 401', () => {
    cy.intercept('GET', '/api/admin/owners', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('getOwners');
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable').should('contain.text', 'Unauthorized');
  });

  it('shows an error message when GET /admin/owners returns 500', () => {
    cy.intercept('GET', '/api/admin/owners', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('getOwnersError');
    visitAsAdmin();
    cy.wait('@getOwnersError');
    cy.get('#ownersTable').should('not.be.empty');
  });
});

// ─── 7h. Restore Access action ──────────────────────────────────────────────────
// Frontend bug: renderOwners() builds actionCell with "Restore Access" for disabled
// owners but the template always renders a hardcoded "Remove Access" button (admin.js).
// Tests below assert correct product behaviour — leave failing until frontend is fixed.

describe('Owners management page — restore access', () => {
  it('calls PATCH /enable when Restore Access is confirmed', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');
    cy.get('#ownersTable tr').should('have.length', 2);

    cy.intercept('PATCH', '/api/admin/owners/owner2/enable', {
      statusCode: 200,
      body: { success: true },
    }).as('enableOwner');
    stubOwners([FAKE_OWNERS[0], { ...FAKE_OWNERS[1], status: 'approved' }]);

    cy.on('window:confirm', () => true);
    cy.get('#ownersTable tr').eq(1).contains('button', 'Restore Access').click({ force: true });
    cy.wait('@enableOwner');
  });

  it('does not call PATCH /enable when Restore Access is cancelled', () => {
    stubOwners(FAKE_OWNERS);
    visitAsAdmin();
    cy.wait('@getOwners');

    cy.intercept('PATCH', '/api/admin/owners/owner2/enable').as('enableOwner');
    cy.on('window:confirm', () => false);

    cy.get('#ownersTable tr').eq(1).contains('button', 'Restore Access').click({ force: true });
    cy.get('@enableOwner.all').should('have.length', 0);
  });
});

// ─── 7i. Logout ───────────────────────────────────────────────────────────────

describe('Owners management page — logout', () => {
  it('clears localStorage and redirects to login.html on logout', () => {
    stubOwners();
    visitAsAdmin();
    cy.wait('@getOwners');

    cy.get('#logoutDropdownBtn').click({ force: true });
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
