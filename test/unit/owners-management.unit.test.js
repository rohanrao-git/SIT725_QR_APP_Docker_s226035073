process.env.JWT_SECRET = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');

const app = require('../../backend/server');
const generateToken = require('../../backend/utils/generateToken');
const AppError = require('../../backend/utils/AppError');
const User = require('../../backend/models/User');
const adminService = require('../../backend/services/adminService');

function makeAdminToken() {
  return generateToken('fake-admin-id');
}

function stubAdminAuth() {
  sinon.stub(User, 'findById').returns({
    select: sinon.stub().resolves({
      _id: 'fake-admin-id',
      role: 'super_admin',
      email: 'admin@test.com',
      name: 'Admin',
    }),
  });
}

describe('Owners management routes — unit', () => {
  afterEach(() => sinon.restore());

  it('GET /api/admin/owners returns frontend-ready owner shape', async () => {
    stubAdminAuth();

    sinon.stub(adminService, 'getAllOwners').resolves([
      {
        _id: 'owner1',
        name: 'Alice Owner',
        email: 'alice@owner.com',
        role: 'owner',
        status: 'approved',
        restaurantId: {
          _id: 'rest1',
          name: 'Alice Bistro',
          address: '42 Collins St',
        },
      },
    ]);

    const res = await request(app)
      .get('/api/admin/owners')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.owners).to.have.lengthOf(1);
    expect(res.body.owners[0]).to.have.nested.property('restaurantId.name', 'Alice Bistro');
  });

  it('PATCH /api/admin/owners/:id/disable returns disabled owner', async () => {
    stubAdminAuth();

    sinon.stub(adminService, 'disableOwner').resolves({
      _id: 'owner1',
      name: 'Alice Owner',
      role: 'owner',
      status: 'disabled',
    });

    const res = await request(app)
      .patch('/api/admin/owners/507f1f77bcf86cd799439011/disable')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.status).to.equal('disabled');
  });

  it('PATCH /api/admin/owners/:id/disable returns 404 when owner is missing', async () => {
    stubAdminAuth();

    sinon
      .stub(adminService, 'disableOwner')
      .rejects(new AppError('Owner not found', 404, 'OWNER_NOT_FOUND'));

    const res = await request(app)
      .patch('/api/admin/owners/507f1f77bcf86cd799439011/disable')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(404);
  });

  it('PATCH /api/admin/owners/:id/enable returns approved owner', async () => {
    stubAdminAuth();

    sinon.stub(adminService, 'enableOwner').resolves({
      _id: 'owner1',
      name: 'Alice Owner',
      role: 'owner',
      status: 'approved',
    });

    const res = await request(app)
      .patch('/api/admin/owners/507f1f77bcf86cd799439011/enable')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.user.status).to.equal('approved');
  });
});
