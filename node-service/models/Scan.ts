import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  references?: string[];
  fixedIn?: string;
}

export interface IDependency {
  packageName: string;
  currentVersion: string;
  latestVersion?: string;
  isOutdated: boolean;
  vulnerabilities?: IVulnerability[];
  filePath?: string;
  dependencyType?: string;
}

export interface IScan extends Document {
  _id: Types.ObjectId;
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  branch?: string;
  commit?: string;
  dependencies: IDependency[];
  outdatedCount: number;
  vulnerabilityCount: number;
  highSeverityCount: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VulnerabilitySchema = new Schema<IVulnerability>({
  id: {
    type: String,
    required: true,
  },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'info'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  references: [String],
  fixedIn: String,
});

const DependencySchema = new Schema<IDependency>({
  packageName: {
    type: String,
    required: true,
  },
  currentVersion: {
    type: String,
    required: true,
  },
  latestVersion: String,
  isOutdated: {
    type: Boolean,
    default: false,
  },
  vulnerabilities: [VulnerabilitySchema],
  filePath: String,
  dependencyType: {
    type: String,
    enum: ['dependencies', 'devDependencies', 'peerDependencies'],
  },
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
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed'],
    default: 'pending',
  },
  branch: String,
  commit: String,
  dependencies: [DependencySchema],
  outdatedCount: {
    type: Number,
    default: 0,
  },
  vulnerabilityCount: {
    type: Number,
    default: 0,
  },
  highSeverityCount: {
    type: Number,
    default: 0,
  },
  startedAt: Date,
  completedAt: Date,
  errorMessage: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for faster queries
ScanSchema.index({ repositoryId: 1, createdAt: -1 });
ScanSchema.index({ userId: 1, createdAt: -1 });

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
