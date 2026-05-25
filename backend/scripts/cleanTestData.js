require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function clean() {
  await connectDB();
  const result = await User.deleteMany({ email: /^testowner_q/ });
  console.log(`Deleted ${result.deletedCount} test users`);
  await mongoose.disconnect();
}

clean();