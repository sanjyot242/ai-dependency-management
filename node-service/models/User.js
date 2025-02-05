// node-service/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  githubId: {
    type: Number,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  githubToken: {
    type: String,
    required: false,
  },
}, {
  timestamps: true // automatically add createdAt, updatedAt
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
