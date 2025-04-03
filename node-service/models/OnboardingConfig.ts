import mongoose, { Document, Schema, Types } from 'mongoose';
import { IOnboardingConfig } from '../types/models';


const OnboardingConfigSchema = new Schema<IOnboardingConfig>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  scanVulnerabilities: { type: Boolean, default: true },
  scanFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'weekly',
  },
  notificationPreferences: {
    email: {
      enabled: {
        type: Boolean,
        default: true,
      },
      vulnerabilities: {
        type: Boolean,
        default: true,
      },
      outdatedDependencies: {
        type: Boolean,
        default: true,
      },
    },
    slack: {
      enabled: {
        type: Boolean,
        default: false,
      },
      webhookUrl: String,
      vulnerabilities: {
        type: Boolean,
        default: true,
      },
      outdatedDependencies: {
        type: Boolean,
        default: true,
      },
    },
  },
  autoScanOnPush: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
OnboardingConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const OnboardingConfig = mongoose.model<IOnboardingConfig>(
  'OnboardingConfig',
  OnboardingConfigSchema
);
export default OnboardingConfig;
