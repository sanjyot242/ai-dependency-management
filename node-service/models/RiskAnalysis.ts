// models/risk-analysis.model.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

import { IRiskAnalysis } from '../types/models';

const RiskAnalysisSchema = new Schema<IRiskAnalysis>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  repositoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  packageName: {
    type: String,
    required: true,
  },
  currentVersion: {
    type: String,
    required: true,
  },
  targetVersion: {
    type: String,
    required: true,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  breakingChanges: {
    type: Boolean,
    default: false,
  },
  confidenceLevel: {
    type: Number,
    min: 0,
    max: 100,
  },
  recommendations: [String],
  aiAnalysisDetails: Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const RiskAnalysis = mongoose.model<IRiskAnalysis>(
  'RiskAnalysis',
  RiskAnalysisSchema
);
export default RiskAnalysis;
