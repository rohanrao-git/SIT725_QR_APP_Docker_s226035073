/**
 * Analytics Page E2E Tests
 * File: cypress/e2e/analytics.cy.js
 *
 * Covers:
 *   1. frontend/pages/analytics.html
 *   2. frontend/js/analytics.js
 *
 * Test groups:
 *   11a. Authentication guard
 *   11b. Page structure
 *   11c. Analytics data loaded from API
 *   11d. Refresh button
 *   11e. API error handling
 *   11f. Logout
 *
 * Notes:
 *   All API calls are stubbed — tests do not require a running backend.
 *   Stubs must be registered BEFORE cy.visit() as analytics.js fires API
 *   calls immediately on DOMContentLoaded.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const PAGE_URL = '/pages/analytics.html';

const FAKE_SUMMARY = {
  totalOrders: 12,
  totalRevenue: 450.5,
  topItem: 'Margherita Pizza',
  busiestTable: 3,
};

const FAKE_PEAK_HOURS = {
  peakHoursByDay: {
    // analytics.js renderPeakHours() reads data.peakHours — must use peakHours not topHours
    Monday: { peakHours: [12, 13], confidence: 'high' },
  },
  message: 'Peak hours analysis complete',
};

const FAKE_FORECAST = {
  forecastedItems: [
    { itemName: 'Margherita Pizza', totalQuantity: 25 },
    { itemName: 'Caesar Salad', totalQuantity: 10 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubAnalyticsApis() {
  cy.intercept('GET', '/api/analytics/my/summary*', {
    statusCode: 200,
    body: { success: true, summary: FAKE_SUMMARY },
  }).as('getSummary');

  cy.intercept('GET', '/api/analytics/my/peak-hours*', {
    statusCode: 200,
    body: { success: true, peakHours: FAKE_PEAK_HOURS },
  }).as('getPeakHours');

  cy.intercept('GET', '/api/analytics/my/item-forecast*', {
    statusCode: 200,
    body: { success: true, forecast: FAKE_FORECAST },
  }).as('getForecast');
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

// ─── 11a. Authentication guard ────────────────────────────────────────────────

describe('Analytics page — authentication guard', () => {
  it('redirects to login.html when no token is stored', () => {
    cy.visit(PAGE_URL);
    cy.url().should('include', 'login.html');
  });

  it('loads the page when owner token is present', () => {
    stubAnalyticsApis();
    visitAsOwner();
    cy.wait('@getSummary');
    cy.url().should('include', 'analytics.html');
  });
});

// ─── 11b. Page structure ──────────────────────────────────────────────────────

describe('Analytics page — page structure', () => {
  beforeEach(() => {
    stubAnalyticsApis();
    visitAsOwner();
    cy.wait('@getSummary');
    cy.wait('@getPeakHours');
    cy.wait('@getForecast');
  });

  it('has the correct page title', () => {
    cy.title().should('include', 'Analytics');
  });

  it('shows the Analytics heading', () => {
    cy.get('h4').should('contain.text', 'Analytics');
  });

  it('shows date filter inputs and refresh button', () => {
    cy.get('#analyticsFromDate').should('exist');
    cy.get('#analyticsToDate').should('exist');
    cy.get('#refreshAnalyticsBtn').should('be.visible');
  });

  it('shows summary stat cards', () => {
    cy.get('#analyticsTotalOrders').should('exist');
    cy.get('#analyticsTotalRevenue').should('exist');
    cy.get('#analyticsTopItem').should('exist');
    cy.get('#analyticsBusiestTable').should('exist');
  });
});

// ─── 11c. Analytics data loaded from API ──────────────────────────────────────

describe('Analytics page — data display', () => {
  it('displays summary stats from GET /analytics/my/summary', () => {
    stubAnalyticsApis();
    visitAsOwner();
    cy.wait('@getSummary');

    cy.get('#analyticsTotalOrders').should('contain.text', '12');
    cy.get('#analyticsTotalRevenue').should('contain.text', '450.50');
    cy.get('#analyticsTopItem').should('contain.text', 'Margherita Pizza');
    cy.get('#analyticsBusiestTable').should('contain.text', 'Table 3');
  });

  it('renders peak hours table from GET /analytics/my/peak-hours', () => {
    stubAnalyticsApis();
    visitAsOwner();
    cy.wait('@getPeakHours');

    cy.get('#analyticsPeakHoursTable').should('contain.text', 'Monday');
    // Verify actual hours are rendered (analytics.js reads data.peakHours as integer array)
    cy.get('#analyticsPeakHoursTable').should('contain.text', '12:00');
    cy.get('#analyticsPeakHoursTable').should('contain.text', 'high');
  });
});

// ─── 11d. Refresh button ──────────────────────────────────────────────────────

describe('Analytics page — refresh', () => {
  it('re-fetches all analytics endpoints when Refresh is clicked', () => {
    stubAnalyticsApis();
    visitAsOwner();
    cy.wait('@getSummary');
    cy.wait('@getPeakHours');
    cy.wait('@getForecast');

    cy.get('#refreshAnalyticsBtn').click();

    cy.wait('@getSummary');
    cy.wait('@getPeakHours');
    cy.wait('@getForecast');
  });
});

// ─── 11e. API error handling ────────────────────────────────────────────────────

describe('Analytics page — API errors', () => {
  it('shows error message when summary API returns 500', () => {
    cy.intercept('GET', '/api/analytics/my/summary*', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('getSummaryError');

    cy.intercept('GET', '/api/analytics/my/peak-hours*', {
      statusCode: 200,
      body: { success: true, peakHours: FAKE_PEAK_HOURS },
    }).as('getPeakHours');

    cy.intercept('GET', '/api/analytics/my/item-forecast*', {
      statusCode: 200,
      body: { success: true, forecast: FAKE_FORECAST },
    }).as('getForecast');

    visitAsOwner();
    cy.wait('@getSummaryError');
    cy.get('#analyticsMessage').should('contain.text', 'Internal Server Error');
  });
});

// ─── 11f. Navigation ──────────────────────────────────────────────────────────

describe('Analytics page — navigation', () => {
  beforeEach(() => {
    stubAnalyticsApis();
    visitAsOwner();
    cy.wait('@getSummary');
  });

  it('navigates back to owner-dashboard.html via Back button', () => {
    cy.contains('a', 'Back').click();
    cy.url().should('include', 'owner-dashboard.html');
  });
});

// ─── 11g. Logout ───────────────────────────────────────────────────────────────

describe('Analytics page — logout', () => {
  it('clears localStorage and redirects to login.html on logout', () => {
    stubAnalyticsApis();
    visitAsOwner();
    cy.wait('@getSummary');

    cy.get('#logoutBtn').click();
    cy.url().should('include', 'login.html');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });
  });
});
