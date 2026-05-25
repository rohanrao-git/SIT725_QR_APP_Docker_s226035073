const request = require('supertest');
const { expect } = require('chai');
const bcrypt = require('bcryptjs');

const app = require('../../backend/server');
const User = require('../../backend/models/User');

async function seedAdminAndLogin() {
  const password = await bcrypt.hash('admin123', 10);
  await User.create({
    name: 'System Admin',
    email: 'admin@system.com',
    password,
    role: 'super_admin',
    status: 'approved',
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@system.com', password: 'admin123' });

  return res.body.token;
}

async function registerPendingOwner(suffix) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: `Owner ${suffix}`,
      email: `${suffix}@example.com`,
      password: 'password123',
      pendingRestaurantName: `${suffix} Bistro`,
      pendingRestaurantAddress: '42 Collins St',
      pendingRestaurantPhone: '0312345678',
      pendingRestaurantEmail: `${suffix}.bistro@example.com`,
    });

  return res.body.user._id;
}

describe('Owners management API contract — integration', () => {
  it('GET /api/admin/owners returns owners with status and populated restaurant', async () => {
    const adminToken = await seedAdminAndLogin();
    const ownerId = await registerPendingOwner('ownerspage1');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/admin/owners')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.owners).to.be.an('array').with.lengthOf(1);
    expect(res.body.owners[0]).to.include({ status: 'approved', role: 'owner' });
    expect(res.body.owners[0]).to.have.nested.property('restaurantId.name').that.is.a('string');
  });

  it('PATCH /api/admin/owners/:id/disable updates status to disabled and list reflects it', async () => {
    const adminToken = await seedAdminAndLogin();
    const ownerId = await registerPendingOwner('ownerspage2');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const disableRes = await request(app)
      .patch(`/api/admin/owners/${ownerId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(disableRes.status).to.equal(200);
    expect(disableRes.body.user.status).to.equal('disabled');

    const listRes = await request(app)
      .get('/api/admin/owners')
      .set('Authorization', `Bearer ${adminToken}`);

    const owner = listRes.body.owners.find((o) => String(o._id) === String(ownerId));
    expect(owner).to.exist;
    expect(owner.status).to.equal('disabled');
  });

  it('PATCH /api/admin/owners/:id/enable moves disabled owner back to approved', async () => {
    const adminToken = await seedAdminAndLogin();
    const ownerId = await registerPendingOwner('ownerspage3');

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .patch(`/api/admin/owners/${ownerId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    const enableRes = await request(app)
      .patch(`/api/admin/owners/${ownerId}/enable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(enableRes.status).to.equal(200);
    expect(enableRes.body.user.status).to.equal('approved');
  });
});
