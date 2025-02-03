// node-service/models/Repository.js
const mongoose = require('mongoose');

const RepositorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  repoName: String,
  // Option A: embed dependencies directly
  dependencies: [{
    name: String,
    currentVersion: String,
    latestVersion: String,
    riskScore: Number,
    lastCheckedAt: Date,
  }]
}, { timestamps: true });

module.exports = mongoose.model('Repository', RepositorySchema);
