// node-service/models/Repository.js
const mongoose = require('mongoose');

const RepositorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    repoId: {
      type: Number,
      unique: true, //can be false if you want to allow multiple repos with the same ID( org level)
    },
    name: String,
    private: Boolean,
    htmlUrl: String,
    owner: String,
    description: String,
    baseBranch: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Repository', RepositorySchema);


