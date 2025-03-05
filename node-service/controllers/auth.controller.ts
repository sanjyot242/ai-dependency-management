// server/src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// In-memory state store for OAuth flow
// In production, use Redis or another distributed store
interface StateData {
  redirectUri: string;
  expiresAt: number;
}

class AuthController {
  private stateStore: Map<string, StateData>;
  private readonly jwtSecret: string;
  private readonly githubClientId: string;
  private readonly githubClientSecret: string;
  private readonly githubRedirectUri: string;
  private readonly frontendUrl: string;
  private readonly serverUrl: string;
  
  constructor() {
    this.stateStore = new Map<string, StateData>();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.githubClientId = process.env.GITHUB_CLIENT_ID || '';
    this.githubClientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    this.githubRedirectUri = process.env.GITHUB_REDIRECT_URI || '';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    this.serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
    
    // Periodically clean up expired states
    setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000);
  }
  
  /**
   * Initiates the GitHub OAuth flow
   */
  initiateGithubAuth = (req: Request, res: Response): void => {
    try {
      const redirectUri = req.query.redirectUri as string || '/dashboard';
      
      // Generate a random state parameter to prevent CSRF attacks
      const state = crypto.randomBytes(20).toString('hex');
      
      // Store the state and associated redirect URI
      // Set expiration to 10 minutes from now
      this.stateStore.set(state, {
        redirectUri,
        expiresAt: Date.now() + 10 * 60 * 1000
      });
      
      // Build GitHub OAuth URL
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${this.githubClientId}&redirect_uri=${this.githubRedirectUri}&scope=repo,user:email&state=${state}`;
      
      res.json({ authUrl: githubAuthUrl });
    } catch (error) {
      console.error('Error initiating GitHub auth:', error);
      res.status(500).json({ error: 'Failed to initiate GitHub authentication' });
    }
  };
  
  /**
   * Handles the OAuth callback from GitHub
   */
  handleGithubCallback = async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect(`${this.frontendUrl}/login?error=oauth_error`);
    }
    
    // Verify state to prevent CSRF attacks
    const storedState = this.stateStore.get(state as string);
    if (!storedState || storedState.expiresAt < Date.now()) {
      // Invalid or expired state
      this.stateStore.delete(state as string);
      return res.redirect(`${this.frontendUrl}/login?error=invalid_state`);
    }
    
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.githubClientId,
          client_secret: this.githubClientSecret,
          code,
          redirect_uri: `${this.serverUrl}/api/auth/github/callback`
        },
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );
      
      const { access_token } = tokenResponse.data;
      
      if (!access_token) {
        return res.redirect(`${this.frontendUrl}/login?error=token_error`);
      }
      
      // Get user info
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${access_token}`,
        },
      });
      
      // Get user emails
      const emailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `token ${access_token}`,
        },
      });
      
      // Find primary email
      const primaryEmail = emailsResponse.data.find((email: any) => email.primary)?.email || emailsResponse.data[0]?.email;
      
      const user = {
        id: userResponse.data.id.toString(),
        name: userResponse.data.name || userResponse.data.login,
        email: primaryEmail || userResponse.data.email,
        avatarUrl: userResponse.data.avatar_url,
        githubUsername: userResponse.data.login,
        githubToken: access_token,
      };
      
      // In a real app, you would save the user to the database here
      
      // Check if this is a new user (in a real app, you would check your database)
      const isNewUser = true; // Placeholder, replace with actual logic
      
      // Create JWT
      const token = jwt.sign(user, this.jwtSecret, { expiresIn: '24h' });
      
      // Clean up state
      const { redirectUri } = storedState;
      this.stateStore.delete(state as string);
      
      // Set JWT as HTTP-only cookie
      // maxAge is in milliseconds - 24 hours
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Secure in production
        sameSite: 'lax', // Prevents CSRF
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      // Set a separate, non-HTTP-only cookie just to indicate authenticated state to the UI
      // This doesn't contain sensitive data, just a flag
      res.cookie('is_authenticated', 'true', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
      
      // Redirect back to the frontend
      const redirectPath = isNewUser ? '/onboarding/welcome' : redirectUri;
      return res.redirect(`${this.frontendUrl}${redirectPath}`);
    } catch (error) {
      console.error('GitHub authentication error:', error);
      return res.redirect(`${this.frontendUrl}/login?error=authentication_failed`);
    }
  };
  
  /**
   * Gets the current authenticated user
   */
  getCurrentUser = (req: Request, res: Response): void => {
    // User is attached to the request by the auth middleware
    res.json((req as any).user);
  };
  
  /**
   * Logs the user out by clearing cookies
   */
  logout = (req: Request, res: Response): void => {
    // Clear the auth cookies
    res.clearCookie('auth_token');
    res.clearCookie('is_authenticated');
    
    res.json({ success: true });
  };
  
  /**
   * Cleans up expired states from the state store
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (data.expiresAt < now) {
        this.stateStore.delete(state);
      }
    }
  }
}

export default new AuthController();