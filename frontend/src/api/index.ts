// web/src/api/index.ts

import axios, { AxiosInstance } from 'axios';

const API_URL = 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;
  
  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important: This ensures cookies are sent with requests
    });
    
    // Add response interceptor to handle common errors
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        // Handle 401 Unauthorized errors (token expired)
        if (error.response?.status === 401) {
          // Redirect to login page on auth errors
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }
  
  // Auth API
  
  async getAuthUrl(redirectUri?: string) {
    return this.client.get('/auth/github/login', {
      params: { redirectUri }
    });
  }
  
  async getCurrentUser() {
    return this.client.get('/auth/me');
  }
  
  async logout() {
    return this.client.post('/auth/logout');
  }
  
  // Repository API
  
  async getGithubRepositories() {
    return this.client.get('/repositories/github');
  }
  
  async saveSelectedRepositories(repositories: any[]) {
    return this.client.post('/onboarding/repositories', { repositories });
  }
  
  async getUserRepositories() {
    return this.client.get('/repositories');
  }
  
  // Configuration API
  
  async saveConfiguration(config: any) {
    return this.client.post('/onboarding/config', { config });
  }
  
  async getOnboardingStatus() {
    return this.client.get('/onboarding/status');
  }
  
  // Dependency API
  
  async scanRepository(repoId: string) {
    return this.client.post('/dependencies/scan', { repoId });
  }
  
  async getLatestScan(repoId: string) {
    return this.client.get(`/dependencies/repo/${repoId}/latest-scan`);
  }
  
  async getDependencyHistory(repoId: string, limit?: number) {
    return this.client.get(`/dependencies/repo/${repoId}/history`, {
      params: { limit },
    });
  }
  
  async getVulnerabilityReports(repoId: string) {
    return this.client.get(`/dependencies/repo/${repoId}/vulnerabilities`);
  }
  
  async analyzeDependencyRisk(packageName: string, currentVersion: string, newVersion: string) {
    return this.client.post('/dependencies/analyze-risk', {
      packageName,
      currentVersion,
      newVersion,
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;