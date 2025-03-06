// models/user.model.js
import mongoose, { Document, Schema } from 'mongoose';

import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  githubId?: string;
  githubToken?: string;
  githubRefreshToken?: string;
  avatarUrl?: string;
  name?: string;
  isOnboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  githubId: {
    type: String,
    unique: true,
    sparse: true,
  },
  githubToken: {
    type: String,
  },
  githubRefreshToken: {
    type: String,
  },
  avatarUrl: String,
  name: String,
  isOnboarded: {
    type: Boolean,
    default: false,
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
UserSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const User = mongoose.model<IUser>('User', UserSchema);
export default User;
