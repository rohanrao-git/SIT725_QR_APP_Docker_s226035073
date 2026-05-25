/**
 * Owner Signup E2E Tests
 * File: cypress/e2e/owner-signup.cy.js
 *
 * Covers:
 *   1. frontend/pages/owner_signup.html
 *   2. frontend/js/auth.js
 *
 * Test groups:
 *   5a. Page structure
 *   5b. Form validation — required fields
 *   5c. Successful registration
 *   5d. Error handling (duplicate email, server errors)
 *   5e. Navigation link
 *
 * Notes:
 *   API calls are stubbed for error/success cases.
 *   No backend session required — page is publicly accessible.
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *
 * Run: npm run test:e2e
 */

const SIGNUP_URL = '/pages/owner_signup.html';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Materialize labels can block Cypress; never .type('') — Cypress rejects empty strings */
function fillSignupField(selector, value) {
  cy.get(selector).click({ force: true }).clear({ force: true });
  if (value !== '') {
    cy.get(selector).type(value, { force: true });
  }
}

function fillSignupForm(overrides = {}) {
  const data = {
    name: 'Test Owner',
    email: 'newowner@test.com',
    password: 'password123',
    restaurantName: 'Test Bistro',
    restaurantAddress: '42 Collins St',
    restaurantPhone: '0312345678',
    restaurantEmail: 'bistro@test.com',
    ...overrides,
  };

  if (data.name !== undefined) fillSignupField('#name', data.name);
  if (data.email !== undefined) fillSignupField('#email', data.email);
  if (data.password !== undefined) fillSignupField('#password', data.password);
  if (data.restaurantName !== undefined) fillSignupField('#pendingRestaurantName', data.restaurantName);
  if (data.restaurantAddress !== undefined) fillSignupField('#pendingRestaurantAddress', data.restaurantAddress);
  if (data.restaurantPhone !== undefined) fillSignupField('#pendingRestaurantPhone', data.restaurantPhone);
  if (data.restaurantEmail !== undefined) fillSignupField('#pendingRestaurantEmail', data.restaurantEmail);
}

function submitSignupForm() {
  cy.get('#ownerSignupForm button[type="submit"]').click();
}

// ─── 5a. Page structure ───────────────────────────────────────────────────────

describe('Owner signup — page structure', () => {
  beforeEach(() => cy.visit(SIGNUP_URL));

  it('has the correct page title', () => {
    cy.title().should('include', 'Owner Signup');
  });

  it('shows the "Owner Signup" heading', () => {
    cy.contains('h4', 'Owner Signup').should('be.visible');
  });

  it('shows all required input fields', () => {
    cy.get('#name').should('exist');
    cy.get('#email').should('exist');
    cy.get('#password').should('exist');
    cy.get('#pendingRestaurantName').should('exist');
    cy.get('#pendingRestaurantAddress').should('exist');
    cy.get('#pendingRestaurantPhone').should('exist');
    cy.get('#pendingRestaurantEmail').should('exist');
  });

  it('shows the Submit Request button', () => {
    cy.get('button[type="submit"]').should('contain.text', 'Submit Request');
  });

  it('shows a link back to login page', () => {
    cy.contains('a', 'Login here').should('have.attr', 'href').and('include', 'login.html');
  });
});

// ─── 5b. Form validation — required fields ────────────────────────────────────

describe('Owner signup — form validation', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/register').as('registerRequest');
    cy.visit(SIGNUP_URL);
  });

  it('does not submit when all fields are empty', () => {
    submitSignupForm();
    cy.get('@registerRequest.all').should('have.length', 0);
  });

  it('does not submit when owner name is missing', () => {
    fillSignupForm({ name: '' });
    submitSignupForm();
    cy.get('@registerRequest.all').should('have.length', 0);
  });

  it('does not submit when email is invalid format', () => {
    fillSignupForm({ email: 'notanemail' });
    submitSignupForm();
    cy.get('@registerRequest.all').should('have.length', 0);
  });

  it('does not submit when password is missing', () => {
    fillSignupForm({ password: '' });
    submitSignupForm();
    cy.get('@registerRequest.all').should('have.length', 0);
  });

  it('does not submit when restaurant name is missing', () => {
    fillSignupForm({ restaurantName: '' });
    submitSignupForm();
    cy.get('@registerRequest.all').should('have.length', 0);
  });

  it('does not submit when restaurant address is missing', () => {
    fillSignupForm({ restaurantAddress: '' });
    submitSignupForm();
    cy.get('@registerRequest.all').should('have.length', 0);
  });
});

// ─── 5c. Successful registration ──────────────────────────────────────────────

describe('Owner signup — successful registration', () => {
  it('calls POST /api/auth/register with correct payload', () => {
    cy.visit(SIGNUP_URL);
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 201,
      body: { success: true, message: 'Registration request submitted' },
    }).as('registerRequest');

    fillSignupForm();
    submitSignupForm();

    cy.wait('@registerRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.name).to.equal('Test Owner');
      expect(body.email).to.equal('newowner@test.com');
      expect(body.password).to.equal('password123');
      expect(body.pendingRestaurantName).to.equal('Test Bistro');
      expect(body.pendingRestaurantAddress).to.equal('42 Collins St');
      expect(body.pendingRestaurantPhone).to.equal('0312345678');
      expect(body.pendingRestaurantEmail).to.equal('bistro@test.com');
    });
  });

  it('shows a success message after submission', () => {
    cy.visit(SIGNUP_URL);
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 201,
      body: { success: true, message: 'Registration request submitted' },
    }).as('registerRequest');

    fillSignupForm();
    submitSignupForm();
    cy.wait('@registerRequest');

    cy.get('#signupMessage').should('contain.text', 'Signup request submitted');
  });
});

// ─── 5d. Error handling ───────────────────────────────────────────────────────

describe('Owner signup — error handling', () => {
  it('shows an error message for duplicate email (409)', () => {
    cy.visit(SIGNUP_URL);
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 409,
      body: { success: false, message: 'Email already registered' },
    }).as('registerRequest');

    fillSignupForm();
    submitSignupForm();
    cy.wait('@registerRequest');

    cy.get('#signupMessage').should('contain.text', 'Email already registered');
  });

  it('shows an error message for server errors (500)', () => {
    cy.visit(SIGNUP_URL);
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 500,
      body: { success: false, message: 'Internal Server Error' },
    }).as('registerRequest');

    fillSignupForm();
    submitSignupForm();
    cy.wait('@registerRequest');

    cy.get('#signupMessage').should('contain.text', 'Internal Server Error');
  });
});

// ─── 5e. Navigation ───────────────────────────────────────────────────────────

describe('Owner signup — navigation', () => {
  it('navigates to login page when "Login here" link is clicked', () => {
    cy.visit(SIGNUP_URL);
    cy.contains('a', 'Login here').click();
    cy.url().should('include', 'login.html');
  });
});
