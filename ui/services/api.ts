// ui/services/api.ts
import axios from 'axios';

// Use environment variable or fallback to hardcoded URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth header to all requests
api.interceptors.request.use(
  (config) => {
    const authType = sessionStorage.getItem('auth_type') || 'api_key';

    if (authType === 'keycloak') {
      // Use Keycloak JWT token
      const accessToken = sessionStorage.getItem('access_token');
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
    } else {
      // Use API key authentication
      const apiKey = sessionStorage.getItem('api_key');
      if (apiKey) {
        config.headers['Authorization'] = `Bearer ${apiKey}`;
        config.headers['X-API-Key'] = apiKey;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear session and redirect to login with expired flag
      sessionStorage.clear();
      window.location.href = '/login?expired=true';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  created_at: string;
  last_active?: string;
}

export interface MemoryMetadata {
  category?: string;
  tags?: string[];
  priority?: string;
  [key: string]: any; // Allow additional custom metadata
}

export interface Memory {
  id: string;
  content: string;
  user_id: string;
  user?: User;
  app_id: string;
  created_at: string;
  updated_at?: string;
  state: 'active' | 'archived' | 'deleted';
  metadata?: MemoryMetadata; // Matches API JSON response (uses column name, not Python attribute)
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

class ApiService {
  // Auth endpoints
  async login(apiKey: string) {
    const response = await api.post('/api/v1/auth/login', { api_key: apiKey });
    return response.data;
  }

  async validateApiKey(apiKey: string) {
    const response = await api.post('/api/v1/auth/validate', { api_key: apiKey });
    return response.data;
  }

  async getCurrentUser() {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  }

  // User endpoints
  async getAllUsers(): Promise<User[]> {
    const response = await api.get('/api/v1/users');
    return response.data;
  }

  async getUserStats(userId?: string) {
    const params = userId ? { user_id: userId } : {};
    const response = await api.get('/api/v1/stats', { params });
    return response.data;
  }

  // Memory endpoints
  async getMemories(params: {
    page?: number;
    size?: number;
    user_id?: string;
    state?: string;
  }): Promise<PaginatedResponse<Memory>> {
    const response = await api.post('/api/v1/memories/filter', params);
    return response.data;
  }

  async createMemory(content: string) {
    const response = await api.post('/api/v1/memories', {
      text: content,
    });

    // Always return the response data, let the hook handle success/failure
    return response.data;
  }

  async deleteMemory(memoryId: string) {
    const response = await api.delete(`/api/v1/memories/${memoryId}`);
    return response.data;
  }

  async updateMemory(memoryId: string, data: { content?: string; metadata?: MemoryMetadata }) {
    const response = await api.put(`/api/v1/memories/${memoryId}`, data);
    return response.data;
  }

  async deleteAllMemories() {
    const response = await api.delete('/api/v1/memories');
    return response.data;
  }

  async searchMemories(query: string, limit: number = 10) {
    const response = await api.post('/api/v1/memories/search', {
      query,
      limit
    });
    return response.data;
  }

  // App endpoints
  async getApps() {
    const response = await api.get('/api/v1/apps/');
    return response.data;
  }

  async createApp(name: string) {
    const response = await api.post('/api/v1/apps/', { name });
    return response.data;
  }

  // Utility function to generate user color from user_id hash
  getUserColor(userId: string): string {
    // Generate consistent color from user_id
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to HSL with good saturation and lightness
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  // Get user initials
  getUserInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}

export const apiService = new ApiService();
export default apiService;
