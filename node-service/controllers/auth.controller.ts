import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { findOrCreateGithubUser, getUserById } from '../services/user.service';
import { IUser } from '../types/models';
import { GithubUserData, JwtPayload, StateStore } from '../types/dto';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
const FRONTEND_URL = 'http://localhost:8080';
const TOKEN_EXPIRY = '7d'; // JWT expiry time

// Store OAuth state to prevent CSRF attacks
// In a production app, use Redis or another persistent store
const stateStore: StateStore = {};

const generateState = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const generateToken = (user: IUser): string => {
  const payload: JwtPayload = {
    githubToken: user.githubToken,
    id: user._id.toString(),
    username: user.username,
    githubId: user.githubId,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

const authController = {
  // Initiate GitHub OAuth flow
  initiateGithubAuth: (req: Request, res: Response): void => {
    try {
      // Generate and store state for CSRF protection
      const state = generateState();
      stateStore[state] = {
        redirectUri: (req.query.redirectUri as string) || '/dashboard',
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
      };

      // Build GitHub OAuth URL
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=user:email%20repo%20admin:repo_hook&state=${state}`;

      res.json({ authUrl: githubAuthUrl });
    } catch (error) {
      console.error('Error initiating GitHub auth:', error);
      res.status(500).json({ error: 'Auth initiation failed' });
    }
  },

  // Handle GitHub OAuth callback
  handleGithubCallback: async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };

      // Validate state to prevent CSRF attacks
      if (!state || !stateStore[state]) {
        res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
        return;
      }

      // Clean up expired states
      Object.keys(stateStore).forEach((key) => {
        if (stateStore[key].expiresAt < Date.now()) {
          delete stateStore[key];
        }
      });

      // Get redirect URI from state store
      const { redirectUri } = stateStore[state];
      delete stateStore[state];

      if (!code) {
        return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
      }

      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      const { access_token: githubToken } = tokenResponse.data;

      if (!githubToken) {
        res.status(400).json({ error: 'Failed to obtain access token' });
        return;
      }

      // Get user info from GitHub
      const userResponse = await axios.get<GithubUserData>(
        'https://api.github.com/user',
        {
          headers: {
            Authorization: `token ${githubToken}`,
          },
        }
      );

      // Find or create user in our database
      const user = await findOrCreateGithubUser(userResponse.data, githubToken);

      // Generate JWT
      const token = generateToken(user);

      // Set JWT as cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      if (!user.isOnboarded) {
        return res.redirect(`${FRONTEND_URL}/onboarding/welcome`);
      } else {
        return res.redirect(`${FRONTEND_URL}${redirectUri}`);
      }
    } catch (error) {
      console.error('Error handling GitHub callback:', error);
      return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
    }
  },

  // Get current authenticated user
  getCurrentUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const user = await getUserById(userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Return user data without sensitive information
      res.json({
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnboarded: user.isOnboarded,
      });
    } catch (error) {
      console.error('Error getting current user:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  },

  // Logout user
  logout: (req: Request, res: Response): void => {
    try {
      // Clear auth cookie
      res.clearCookie('auth_token');
      res.json({ success: true });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  },
};

export default authController;
