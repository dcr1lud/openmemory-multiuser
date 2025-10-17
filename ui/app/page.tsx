'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Database,
  Activity,
  Clock,
  TrendingUp,
  Calendar,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import apiService from '@/services/api';

interface Stats {
  totalMemories: number;
  activeMemories: number;
  totalUsers: number;
  recentMemories: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalMemories: 0,
    activeMemories: 0,
    totalUsers: 0,
    recentMemories: []
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const initializePage = async () => {
      const isAuthenticated = checkAuth();
      if (isAuthenticated) {
        await fetchDashboardData();
      }
    };
    initializePage();
  }, []);

  const checkAuth = () => {
    if (typeof window === 'undefined') return false;

    const authType = sessionStorage.getItem('auth_type') || localStorage.getItem('auth_type') || 'api_key';

    if (authType === 'keycloak') {
      // Check Keycloak authentication
      const accessToken = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
      const userName = sessionStorage.getItem('user_name') || localStorage.getItem('user_name');

      if (!accessToken || !userId) {
        router.push('/login');
        return false;
      }

      setCurrentUser({ userId, userName, authType: 'keycloak' });
      return true;
    } else {
      // Check API key authentication
      const apiKey = sessionStorage.getItem('api_key') || localStorage.getItem('api_key');
      const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
      const userName = sessionStorage.getItem('user_name') || localStorage.getItem('user_name');

      if (!apiKey) {
        router.push('/login');
        return false;
      }

      setCurrentUser({ userId, userName, authType: 'api_key' });
      return true;
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch memories to calculate stats
      const memoriesResponse = await apiService.getMemories({
        page: 1,
        size: 100,
        state: 'active'
      });

      // Fetch users
      const users = await apiService.getAllUsers();

      // Calculate stats
      const recentMemories = memoriesResponse.items.slice(0, 5);

      setStats({
        totalMemories: memoriesResponse.total || 0,
        activeMemories: memoriesResponse.items.filter(m => m.state === 'active').length,
        totalUsers: users.length || 1,
        recentMemories: recentMemories
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      }
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Brain className="h-8 w-8 text-blue-400" />
              <h1 className="text-2xl font-bold text-white">OpenMemory Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              {currentUser && (
                <div className="text-gray-300">
                  Welcome back, <span className="font-medium">{currentUser.userName}</span>
                </div>
              )}
              <button
                onClick={fetchDashboardData}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <Database className="h-8 w-8 text-blue-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.totalMemories}</div>
                <div className="text-sm text-gray-400 mt-1">Total Memories</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <Activity className="h-8 w-8 text-green-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Active</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.activeMemories}</div>
                <div className="text-sm text-gray-400 mt-1">Active Memories</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <TrendingUp className="h-8 w-8 text-yellow-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Recent</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {stats.recentMemories.length}
                </div>
                <div className="text-sm text-gray-400 mt-1">Recent Memories</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/memories')}
                    className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Database className="h-5 w-5 text-blue-400" />
                      <span className="text-white">View All Memories</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>

                  <button
                    onClick={() => router.push('/memories?create=true')}
                    className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Brain className="h-5 w-5 text-green-400" />
                      <span className="text-white">Create New Memory</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                {stats.recentMemories.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    No recent memories
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.recentMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className="flex items-start space-x-3 p-3 bg-gray-700 rounded-lg"
                      >
                        <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {memory.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(memory.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* System Info */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">System Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">API Status</div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm text-gray-300">Operational</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Version</div>
                  <div className="text-sm text-gray-300">OpenMemory v2.0</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Last Sync</div>
                  <div className="text-sm text-gray-300">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}