const mongoosee = require('mongoose');

const DependencySchema = new mongoosee.Schema(
  {
    packageName: String,
    currentVersion: String,
    latestVersion: String,
    isOutdated: Boolean,
  },
  { _id: false }
);

const DependencyScanSchema = new mongoosee.Schema({
  userId: {
    type: mongoosee.Schema.Types.ObjectId,
    ref: 'User',
  },
  repoId: {
    type: mongoosee.Schema.Types.ObjectId,
    ref: 'Repository',
  },
  scannedAt: {
    type: Date,
    default: Date.now,
  },
  depedencis: [DependencySchema],
});

module.exports = mongoosee.model('DependencyScan', DependencyScanSchema);
