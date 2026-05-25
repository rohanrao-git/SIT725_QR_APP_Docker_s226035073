require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const generateQR = require('../utils/generateQR');

const ADMIN_EMAIL = 'admin@system.com';
const ADMIN_PASSWORD = 'admin123';
const APPROVED_OWNER_EMAIL = 'owner@example.com';
const APPROVED_OWNER_PASSWORD = 'owner123';
const PENDING_OWNER_EMAIL = 'pending.owner@example.com';
const PENDING_OWNER_PASSWORD = 'owner123';

async function ensureSuperAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  let admin = await User.findOne({ email: ADMIN_EMAIL });

  if (!admin) {
    admin = await User.create({
      name: 'Super Admin',
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: 'super_admin',
      status: 'approved',
    });
    console.log('Created super admin');
    return admin;
  }

  admin.name = 'Super Admin';
  admin.password = passwordHash;
  admin.role = 'super_admin';
  admin.status = 'approved';
  await admin.save();
  console.log('Updated existing super admin');
  return admin;
}

async function ensureApprovedOwner() {
  const passwordHash = await bcrypt.hash(APPROVED_OWNER_PASSWORD, 10);
  let owner = await User.findOne({ email: APPROVED_OWNER_EMAIL });

  if (!owner) {
    owner = await User.create({
      name: 'Demo Owner',
      email: APPROVED_OWNER_EMAIL,
      password: passwordHash,
      role: 'owner',
      status: 'approved',
    });
    console.log('Created approved owner');
    return owner;
  }

  owner.name = 'Demo Owner';
  owner.password = passwordHash;
  owner.role = 'owner';
  owner.status = 'approved';
  owner.pendingRestaurantName = undefined;
  owner.pendingRestaurantAddress = undefined;
  owner.pendingRestaurantPhone = undefined;
  owner.pendingRestaurantEmail = undefined;
  await owner.save();
  console.log('Updated existing approved owner');
  return owner;
}

async function ensurePendingOwner() {
  const passwordHash = await bcrypt.hash(PENDING_OWNER_PASSWORD, 10);
  let owner = await User.findOne({ email: PENDING_OWNER_EMAIL });

  if (!owner) {
    owner = await User.create({
      name: 'Pending Owner',
      email: PENDING_OWNER_EMAIL,
      password: passwordHash,
      role: 'owner',
      status: 'pending',
      pendingRestaurantName: 'Pending Bistro',
      pendingRestaurantAddress: '99 Pending Street',
      pendingRestaurantPhone: '+61 400 000 000',
      pendingRestaurantEmail: 'pending-bistro@example.com',
    });
    console.log('Created pending owner');
    return owner;
  }

  owner.name = 'Pending Owner';
  owner.password = passwordHash;
  owner.role = 'owner';
  owner.status = 'pending';
  owner.restaurantId = undefined;
  owner.pendingRestaurantName = 'Pending Bistro';
  owner.pendingRestaurantAddress = '99 Pending Street';
  owner.pendingRestaurantPhone = '+61 400 000 000';
  owner.pendingRestaurantEmail = 'pending-bistro@example.com';
  await owner.save();
  console.log('Updated existing pending owner');
  return owner;
}

async function ensureRestaurantAndData(owner) {
  let restaurant = null;
  if (owner.restaurantId) {
    restaurant = await Restaurant.findById(owner.restaurantId);
  }
  if (!restaurant) {
    restaurant = await Restaurant.findOne({ ownerId: owner._id });
  }

  if (!restaurant) {
    restaurant = await Restaurant.create({
      name: 'Demo Bistro',
      address: '123 Demo Street',
      phone: '+61 433 111 222',
      email: 'demo-bistro@example.com',
      ownerId: owner._id,
      totalTables: 0,
      isActive: true,
    });
    console.log('Created restaurant for approved owner');
  } else {
    restaurant.name = 'Demo Bistro';
    restaurant.address = '123 Demo Street';
    restaurant.phone = '+61 433 111 222';
    restaurant.email = 'demo-bistro@example.com';
    restaurant.isActive = true;
    await restaurant.save();
    console.log('Updated restaurant for approved owner');
  }

  owner.restaurantId = restaurant._id;
  await owner.save();

  const totalTables = 4;
  await Table.deleteMany({ restaurantId: restaurant._id });
  const tableDocs = [];
  for (let tableNumber = 1; tableNumber <= totalTables; tableNumber += 1) {
    const qrCodeUrl = await generateQR(String(restaurant._id), tableNumber);
    tableDocs.push({
      restaurantId: restaurant._id,
      tableNumber,
      qrCodeUrl,
      isActive: true,
    });
  }
  await Table.insertMany(tableDocs);
  await Restaurant.findByIdAndUpdate(restaurant._id, { totalTables });
  console.log(`Seeded ${totalTables} table QR codes`);

  await MenuItem.deleteMany({ restaurantId: restaurant._id });
  await MenuItem.insertMany([
    {
      restaurantId: restaurant._id,
      name: 'Garlic Bread',
      category: 'Appetizers',
      dietaryType: 'veg',
      description: 'Toasted bread with garlic butter',
      price: 7.0,
      isAvailable: true,
    },
    {
      restaurantId: restaurant._id,
      name: 'Margherita Pizza',
      category: 'Mains',
      dietaryType: 'veg',
      description: 'Classic pizza with tomato and mozzarella',
      price: 18.5,
      isAvailable: true,
    },
    {
      restaurantId: restaurant._id,
      name: 'Grilled Chicken Burger',
      category: 'Mains',
      dietaryType: 'non_veg',
      description: 'Juicy chicken fillet with lettuce and mayo',
      price: 16.0,
      isAvailable: true,
    },
    {
      restaurantId: restaurant._id,
      name: 'Caesar Salad',
      category: 'Sides',
      dietaryType: 'veg',
      description: 'Romaine lettuce, croutons, parmesan',
      price: 12.0,
      isAvailable: true,
    },
    {
      restaurantId: restaurant._id,
      name: 'Tiramisu',
      category: 'Desserts',
      description: 'Coffee-flavoured Italian dessert',
      price: 9.5,
      isAvailable: true,
    },
    {
      restaurantId: restaurant._id,
      name: 'Lemonade',
      category: 'Beverages',
      description: 'Fresh squeezed lemonade',
      price: 4.5,
      isAvailable: true,
    },
  ]);
  console.log('Seeded demo menu items');

  return restaurant;
}

async function seed() {
  await connectDB();

  await ensureSuperAdmin();
  const approvedOwner = await ensureApprovedOwner();
  const pendingOwner = await ensurePendingOwner();
  const restaurant = await ensureRestaurantAndData(approvedOwner);

  console.log('\nSeeding complete');
  console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Approved owner login: ${APPROVED_OWNER_EMAIL} / ${APPROVED_OWNER_PASSWORD}`);
  console.log(`Pending owner login (should be blocked until approved): ${PENDING_OWNER_EMAIL} / ${PENDING_OWNER_PASSWORD}`);
  console.log(`Pending owner id: ${pendingOwner._id}`);
  console.log(`Approved owner restaurant id: ${restaurant._id}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
