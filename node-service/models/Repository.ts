import mongoose from 'mongoose';

import { IRepository } from '../types/models';

const RepositorySchema = new mongoose.Schema<IRepository>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  githubId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  description: String,
  url: String,
  isPrivate: Boolean,
  isRepoSelected: {
    type: Boolean,
    default: false, // Changed from true to false
  },
  defaultBranch: String,
  language: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for unique repositories per user
RepositorySchema.index({ userId: 1, githubId: 1 }, { unique: true });

// Update timestamp on save
RepositorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Repository = mongoose.model<IRepository>('Repository', RepositorySchema);
export default Repository;
