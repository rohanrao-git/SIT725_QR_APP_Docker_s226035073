/**
 * Mocha Root Hooks — shared lifecycle for ALL integration test files.
 *
 * One MongoMemoryServer instance is started before the entire suite and
 * torn down after. Each individual test gets a clean database via
 * beforeEach (dropDatabase), so tests never share state.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose              = require('../../backend/testUtils');
const connectDB             = require('../../backend/config/db');

let mongod;

exports.mochaHooks = {
  async beforeAll() {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI       = mongod.getUri();
    process.env.JWT_SECRET      = 'integration_test_secret';
    process.env.JWT_EXPIRES_IN  = '1d';
    process.env.BASE_URL        = 'http://localhost:5001';
    await connectDB();
  },

  async beforeEach() {
    if (mongoose.connection.readyState === 1) {
      const collections = await mongoose.connection.db.collections();
      await Promise.all(collections.map(c => c.deleteMany({})));
    }
  },

  async afterAll() {
    await mongoose.disconnect();
    await mongod.stop();
  },
};
