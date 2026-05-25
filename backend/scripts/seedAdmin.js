require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const generateQR = require('../utils/generateQR');

async function seed() {
  await connectDB();

  const adminEmail = 'admin@system.com';
  const ownerEmail = 'owner@example.com';

  let superAdmin = await User.findOne({ email: adminEmail });
  if (!superAdmin) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    superAdmin = await User.create({
      name: 'Super Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'super_admin',
      status: 'approved',
    });
    console.log('Super admin created');
  } else {
    console.log('Super admin already exists');
  }

  let owner = await User.findOne({ email: ownerEmail });
  if (!owner) {
    const ownerPassword = await bcrypt.hash('owner123', 10);
    owner = await User.create({
      name: 'Demo Owner',
      email: ownerEmail,
      password: ownerPassword,
      role: 'owner',
      status: 'approved',
    });
    console.log('Owner user created');
  } else {
    owner.status = 'approved';
    await owner.save();
    console.log('Owner user already exists (ensured approved)');
  }

  let restaurant = await Restaurant.findOne({ ownerId: owner._id });
  if (!restaurant) {
    restaurant = await Restaurant.create({
      name: `${owner.name} Restaurant`,
      address: '123 Demo Street',
      ownerId: owner._id,
      totalTables: 0,
    });
    console.log('Restaurant created');
  } else {
    console.log('Restaurant already exists for owner');
  }

  owner.restaurantId = restaurant._id;
  await owner.save();

  const totalTables = 5;
  await Table.deleteMany({ restaurantId: restaurant._id });
  const tableDocs = [];
  for (let tableNumber = 1; tableNumber <= totalTables; tableNumber += 1) {
    const qrCodeUrl = await generateQR(String(restaurant._id), tableNumber);
    tableDocs.push({
      restaurantId: restaurant._id,
      tableNumber,
      qrCodeUrl,
    });
  }
  await Table.insertMany(tableDocs);
  await Restaurant.findByIdAndUpdate(restaurant._id, { totalTables });
  console.log(`Seeded ${totalTables} tables with QR codes`);

  console.log('Seeding complete');
  console.log(`Admin login: ${adminEmail} / admin123`);
  console.log(`Owner login: ${ownerEmail} / owner123`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
