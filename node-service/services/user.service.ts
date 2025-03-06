// services/user.service.ts
import User, { IUser } from '../models/User';
import { Types } from 'mongoose';

interface GithubUserData {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export const findOrCreateGithubUser = async (
  githubUserData: GithubUserData,
  githubToken: string
): Promise<IUser> => {
  try {
    // Try to find user by GitHub ID
    let user = await User.findOne({ githubId: githubUserData.id.toString() });

    if (user) {
      // Update existing user with latest data
      user.githubToken = githubToken;
      user.username = githubUserData.login;
      user.name = githubUserData.name || user.name;
      user.avatarUrl = githubUserData.avatar_url || user.avatarUrl;

      if (githubUserData.email) {
        user.email = githubUserData.email;
      }

      await user.save();
      return user;
    }

    // Create new user
    user = new User({
      githubId: githubUserData.id.toString(),
      githubToken,
      username: githubUserData.login,
      name: githubUserData.name || githubUserData.login,
      email: githubUserData.email || `${githubUserData.login}@github.com`,
      avatarUrl: githubUserData.avatar_url,
      isOnboarded: false,
    });

    await user.save();
    return user;
  } catch (error) {
    console.error('Error in findOrCreateGithubUser:', error);
    throw error;
  }
};

export const getUserById = async (userId: string): Promise<IUser | null> => {
  try {
    return await User.findById(userId);
  } catch (error) {
    console.error('Error in getUserById:', error);
    throw error;
  }
};

export const updateUserOnboardingStatus = async (
  userId: string,
  isOnboarded: boolean = true
): Promise<IUser | null> => {
  try {
    return await User.findByIdAndUpdate(userId, { isOnboarded }, { new: true });
  } catch (error) {
    console.error('Error in updateUserOnboardingStatus:', error);
    throw error;
  }
};
