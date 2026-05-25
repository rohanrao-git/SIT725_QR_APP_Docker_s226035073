/**
 * Login Page E2E Tests
 * File: cypress/e2e/login.cy.js
 *
 * Covers:
 *   1. frontend/pages/login.html
 *   2. frontend/js/auth.js
 *
 * Test groups:
 *   1a. Page structure
 *   1b. Form validation — required fields
 *   1c. Form validation — email format
 *   1d. Form validation — password field
 *   1e. Input interaction
 *   1f. API responses — stubbed
 *   1g. Successful login — redirects
 *   1h. Live API tests
 *
 * Prerequisites:
 *   1. cd backend && npm start
 *   2. cd backend && npm run seed:admin   (creates admin@system.com / admin123)
 *
 * Run: npm run test:e2e
 */

const LOGIN_URL = '/pages/login.html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fillAndSubmit(email, password) {
  if (email)    cy.get('#email').clear().type(email);
  if (password) cy.get('#password').clear().type(password);
  cy.get('button[type="submit"]').click();
}

function stubLogin(statusCode, body) {
  cy.intercept('POST', '/api/auth/login', { statusCode, body }).as('loginRequest');
}

// ─── 1. Page structure ────────────────────────────────────────────────────────

describe('Login page — structure', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
  });

  it('loads with the correct page title', () => {
    cy.title().should('include', 'Login');
  });

  it('renders the login form', () => {
    cy.get('#loginForm').should('exist');
  });

  it('has an email input field', () => {
    cy.get('#email')
      .should('exist')
      .and('have.attr', 'type', 'email')
      .and('have.attr', 'required');
  });

  it('has a password input field', () => {
    cy.get('#password')
      .should('exist')
      .and('have.attr', 'type', 'password')
      .and('have.attr', 'required');
  });

  it('has a submit button', () => {
    cy.get('button[type="submit"]')
      .should('exist')
      .and('contain.text', 'Login');
  });

  it('has an empty status message container on load', () => {
    cy.get('#loginMessage').should('exist').and('be.empty');
  });

  it('shows a link to the owner signup page', () => {
    cy.contains('a', 'Sign Up')
      .should('have.attr', 'href')
      .and('include', 'owner_signup.html');
  });
});

describe('Login page — navigation', () => {
  it('navigates to owner signup when Sign Up is clicked', () => {
    cy.visit(LOGIN_URL);
    cy.contains('a', 'Sign Up').click();
    cy.url().should('include', 'owner_signup.html');
  });
});

// ─── 2. Form validation ───────────────────────────────────────────────────────

describe('Login page — form validation — required fields', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
  });

  it('does not submit when both fields are empty', () => {
    cy.get('button[type="submit"]').click();
    cy.get('#loginMessage').should('be.empty');
  });

  it('does not submit when email is empty', () => {
    cy.get('#password').type('somepassword');
    cy.get('button[type="submit"]').click();
    cy.get('#loginMessage').should('be.empty');
  });

  it('does not submit when password is empty', () => {
    cy.get('#email').type('someone@test.com');
    cy.get('button[type="submit"]').click();
    cy.get('#loginMessage').should('be.empty');
  });
});

// ─── 2b. Email field format validation ───────────────────────────────────────

describe('Login page — form validation — email format', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
  });

  it('accepts a correctly formatted email — form submits and API is called', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('valid@example.com');
    cy.get('#password').type('anypassword');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.email).to.equal('valid@example.com');
    });
  });

  it('does not submit when email has no @ symbol', () => {
    cy.get('#email').type('notanemail');
    cy.get('#password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.get('#loginMessage').should('be.empty');
  });

  it('does not submit when email has no domain (e.g. "test@")', () => {
    cy.get('#email').type('test@');
    cy.get('#password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.get('#loginMessage').should('be.empty');
  });

  it('does not submit when email has no local part (e.g. "@example.com")', () => {
    cy.get('#email').type('@example.com');
    cy.get('#password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.get('#loginMessage').should('be.empty');
  });

  it('accepts email with subdomain — form submits and API is called', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('user@mail.example.com');
    cy.get('#password').type('anypassword');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.email).to.equal('user@mail.example.com');
    });
  });

  it('accepts email with plus sign — form submits and API is called', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('user+tag@example.com');
    cy.get('#password').type('anypassword');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.email).to.equal('user+tag@example.com');
    });
  });
});

// ─── 2c. Password field behaviour ────────────────────────────────────────────

describe('Login page — form validation — password field', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
  });

  it('password input masks characters (type="password")', () => {
    cy.get('#password').should('have.attr', 'type', 'password');
  });

  it('password with special characters is sent correctly to API', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('admin@system.com');
    cy.get('#password').type('P@ssw0rd!#$%');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.password).to.equal('P@ssw0rd!#$%');
    });
  });

  it('single character password is sent to API (no frontend minimum length)', () => {
    // Frontend has no minimum length validation — the backend handles this.
    // Test confirms the form submits and sends the single char password as-is.
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('admin@system.com');
    cy.get('#password').type('x');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.password).to.equal('x');
    });
  });

  it('very long password is sent correctly to API (no frontend minimum length)', () => {
    // Frontend has no minimum length validation — the backend handles this.
    // Test confirms the form submits and sends the long password as-is.
    stubLogin(401, { success: false, message: 'Invalid email or password' });
    const longPassword = 'a'.repeat(100);

    cy.get('#email').type('admin@system.com');
    cy.get('#password').type(longPassword);
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.password).to.equal(longPassword);
    });
  });
});

// ─── 2d. Input field interaction ─────────────────────────────────────────────

describe('Login page — form validation — input interaction', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
  });

  it('email field is focusable and accepts keyboard input', () => {
    cy.get('#email').click().type('test@example.com');
    cy.focused().should('have.attr', 'id', 'email');
  });

  it('auth.js trims whitespace from email before sending to API', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('  admin@system.com  ');
    cy.get('#password').type('admin123');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.email).to.equal('admin@system.com');
    });
  });

  it('auth.js trims whitespace from password before sending to API', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('admin@system.com');
    cy.get('#password').type('  admin123  ');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body.password).to.equal('admin123');
    });
  });

  it('form fields retain their values after a failed submission', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    cy.get('#email').type('wrong@test.com');
    cy.get('#password').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');

    cy.get('#email').should('have.value', 'wrong@test.com');
    cy.get('#password').should('have.value', 'wrongpassword');
  });

  it('can re-submit with different credentials after a failed login', () => {
    // First attempt — fail
    stubLogin(401, { success: false, message: 'Invalid email or password' });
    fillAndSubmit('wrong@test.com', 'wrongpassword');
    cy.wait('@loginRequest');
    cy.get('#loginMessage').should('contain.text', 'Invalid email or password');

    // Second attempt — succeed
    stubLogin(200, {
      success: true,
      token: 'fake.jwt',
      user: { _id: 'u1', name: 'Admin', email: 'admin@system.com', role: 'super_admin' },
    });
    cy.get('#email').clear().type('admin@system.com');
    cy.get('#password').clear().type('admin123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');

    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.equal('fake.jwt');
    });
  });
});

// ─── 3. Error handling (API stubbed) ─────────────────────────────────────────

describe('Login page — error handling', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
  });

  it('shows an error message when credentials are invalid (401)', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    fillAndSubmit('wrong@test.com', 'wrongpassword');
    cy.wait('@loginRequest');

    cy.get('#loginMessage')
      .should('be.visible')
      .and('contain.text', 'Invalid email or password');
  });

  it('shows an error message when the account is not yet approved (403)', () => {
    stubLogin(403, { success: false, message: 'Account is not approved' });

    fillAndSubmit('pending@test.com', 'owner123');
    cy.wait('@loginRequest');

    cy.get('#loginMessage')
      .should('be.visible')
      .and('contain.text', 'Account is not approved');
  });

  it('shows a red error style on #loginMessage after failure', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    fillAndSubmit('wrong@test.com', 'wrongpassword');
    cy.wait('@loginRequest');

    cy.get('#loginMessage').should('have.class', 'red-text');
  });

  it('shows "Logging in..." status while the request is in flight', () => {
    cy.intercept('POST', '/api/auth/login', (req) => {
      req.reply((res) => {
        res.delay = 500;
        res.send({ statusCode: 200, body: { success: false, message: 'error' } });
      });
    }).as('slowLogin');

    fillAndSubmit('admin@system.com', 'admin123');

    cy.get('#loginMessage').should('contain.text', 'Logging in...');
  });

  it('"Logging in..." message uses blue-text style while in flight', () => {
    cy.intercept('POST', '/api/auth/login', (req) => {
      req.reply((res) => {
        res.delay = 500;
        res.send({ statusCode: 200, body: { success: false, message: 'error' } });
      });
    }).as('slowLogin');

    fillAndSubmit('admin@system.com', 'admin123');

    cy.get('#loginMessage').should('have.class', 'blue-text');
  });

  it('shows an error message when the server returns 500', () => {
    stubLogin(500, { success: false, message: 'Internal server error' });

    fillAndSubmit('admin@system.com', 'admin123');
    cy.wait('@loginRequest');

    cy.get('#loginMessage')
      .should('be.visible')
      .and('have.class', 'red-text')
      .should('contain.text', 'Internal server error');
  });

  it('sends the correct JSON payload format to the API', () => {
    stubLogin(401, { success: false, message: 'Invalid email or password' });

    fillAndSubmit('admin@system.com', 'admin123');

    cy.wait('@loginRequest').then((interception) => {
      const body = interception.request.body;
      expect(body).to.have.all.keys('email', 'password');
      expect(body.email).to.equal('admin@system.com');
      expect(body.password).to.equal('admin123');
    });
  });

  it('shows an error message when the network request fails completely', () => {
    // Simulate network failure — e.g. backend is down
    cy.intercept('POST', '/api/auth/login', { forceNetworkError: true }).as('failedRequest');

    fillAndSubmit('admin@system.com', 'admin123');

    // auth.js catch block handles this — loginMessage should show an error
    cy.get('#loginMessage', { timeout: 8000 })
      .should('not.be.empty')
      .and('have.class', 'red-text');
  });
});

// ─── 4. Successful login — token & redirect (API stubbed) ────────────────────

describe('Login page — successful login flow', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
    // Clear localStorage before each test
    cy.clearLocalStorage();
  });

  it('stores the token in localStorage after admin login', () => {
    stubLogin(200, {
      success: true,
      token: 'fake.admin.jwt',
      user: { _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin' },
    });

    fillAndSubmit('admin@system.com', 'admin123');
    cy.wait('@loginRequest');

    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.equal('fake.admin.jwt');
    });
  });

  it('stores the user object in localStorage after login', () => {
    stubLogin(200, {
      success: true,
      token: 'fake.admin.jwt',
      user: { _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin' },
    });

    fillAndSubmit('admin@system.com', 'admin123');
    cy.wait('@loginRequest');

    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem('user'));
      expect(stored.role).to.equal('super_admin');
      expect(stored.email).to.equal('admin@system.com');
    });
  });

  it('redirects admin to admin-dashboard.html after login', () => {
    stubLogin(200, {
      success: true,
      token: 'fake.admin.jwt',
      user: { _id: 'admin1', name: 'Super Admin', email: 'admin@system.com', role: 'super_admin' },
    });

    fillAndSubmit('admin@system.com', 'admin123');
    cy.wait('@loginRequest');

    cy.url().should('include', 'admin-dashboard.html');
  });

  it('redirects owner to owner-dashboard.html after login', () => {
    stubLogin(200, {
      success: true,
      token: 'fake.owner.jwt',
      user: { _id: 'owner1', name: 'Test Owner', email: 'owner@example.com', role: 'owner' },
    });

    fillAndSubmit('owner@example.com', 'owner123');
    cy.wait('@loginRequest');

    cy.url().should('include', 'owner-dashboard.html');
  });
});

// ─── 5. Live API tests (requires backend running + seed:admin) ────────────────

describe('Login page — live API', () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
    cy.clearLocalStorage();
  });

  it('returns 401 for a real wrong password request', () => {
    cy.intercept('POST', '/api/auth/login').as('loginRequest');

    fillAndSubmit('admin@system.com', 'definitelywrong');
    cy.wait('@loginRequest').its('response.statusCode').should('equal', 401);

    cy.get('#loginMessage').should('not.be.empty');
  });

  it('shows error for a real non-existent email request', () => {
    fillAndSubmit('nobody@doesnotexist.com', 'password123');

    cy.get('#loginMessage', { timeout: 6000 })
      .should('not.be.empty')
      .and('have.class', 'red-text');
  });
});
