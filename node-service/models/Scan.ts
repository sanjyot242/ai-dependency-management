import mongoose, { Document, Schema, Types } from 'mongoose';

import { IVulnerability } from '../types/models';

import { IDependency } from '../types/models';

import { ScanState } from '../types/models';

import { StateTransition } from '../types/models';

import { IScan } from '../types/models';

const VulnerabilitySchema = new Schema<IVulnerability>({
  id: { type: String, required: true },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'info'],
    required: true,
  },
  description: { type: String, required: true },
  references: [String],
  fixedIn: String,
});

const DependencySchema = new Schema<IDependency>({
  packageName: { type: String, required: true },
  currentVersion: { type: String, required: true },
  latestVersion: String,
  isOutdated: { type: Boolean, default: false },
  vulnerabilities: [VulnerabilitySchema],
  filePath: String,
  dependencyType: {
    type: String,
    enum: ['dependencies', 'devDependencies', 'peerDependencies'],
  },
});

const StateTransitionSchema = new Schema<StateTransition>({
  state: {
    type: String,
    enum: [
      'initiated',
      'dependency-scanning',
      'dependencies-scanned',
      'vulnerability-scanning',
      'vulnerabilities-scanned',
      'pr-creation',
      'pr-created',
      'completed',
      'failed',
    ],
    required: true,
  },
  timestamp: { type: Date, required: true },
  metadata: { type: Schema.Types.Mixed },
});

const ScanSchema = new Schema<IScan>({
  repositoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Traditional status fields
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed'],
    default: 'pending',
  },

  // New state machine fields
  state: {
    type: String,
    enum: [
      'initiated',
      'dependency-scanning',
      'dependencies-scanned',
      'vulnerability-scanning',
      'vulnerabilities-scanned',
      'pr-creation',
      'pr-created',
      'completed',
      'failed',
    ],
    default: 'initiated',
  },
  stateHistory: [StateTransitionSchema],

  // Options
  includeVulnerabilities: { type: Boolean, default: true },
  createPR: { type: Boolean, default: false },

  //new field for trigger type
  triggerType: {
    type: String,
    enum: ['scheduled', 'manual', 'push'],
    default: 'manual',
  },

  branch: String,
  commit: String,
  dependencies: [DependencySchema],
  outdatedCount: { type: Number, default: 0 },
  vulnerabilityCount: { type: Number, default: 0 },
  highSeverityCount: { type: Number, default: 0 },

  // PR information
  prNumber: Number,
  prUrl: String,

  // Error information
  errorMessage: String,

  // Timestamps
  startedAt: Date,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for faster queries
ScanSchema.index({ repositoryId: 1, createdAt: -1 });
ScanSchema.index({ userId: 1, createdAt: -1 });
ScanSchema.index({ state: 1 });
ScanSchema.index({ status: 1 });

// Update timestamp on save
ScanSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Calculate counts before saving
ScanSchema.pre('save', function (next) {
  if (this.dependencies && Array.isArray(this.dependencies)) {
    this.outdatedCount = this.dependencies.filter(
      (dep) => dep.isOutdated
    ).length;

    let vulnCount = 0;
    let highSevCount = 0;

    this.dependencies.forEach((dep) => {
      if (dep.vulnerabilities && Array.isArray(dep.vulnerabilities)) {
        vulnCount += dep.vulnerabilities.length;
        highSevCount += dep.vulnerabilities.filter(
          (v) => v.severity === 'critical' || v.severity === 'high'
        ).length;
      }
    });

    this.vulnerabilityCount = vulnCount;
    this.highSeverityCount = highSevCount;
  }
  next();
});

const Scan = mongoose.model<IScan>('Scan', ScanSchema);
export default Scan;
