// node-service/db/index.js
const mongoose = require('mongoose');

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/dependencydb';

const connectDB = async () => {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`Connected to MongoDB at ${mongoUrl}`);
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1); // Stop the Node process if the DB connection fails
  }
};

module.exports = connectDB;
