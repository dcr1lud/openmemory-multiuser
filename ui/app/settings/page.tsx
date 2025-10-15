'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings,
  User,
  Key,
  Database,
  Bell,
  Shield,
  Info,
  Copy,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    if (typeof window === 'undefined') return;

    const apiKey = sessionStorage.getItem('api_key') || localStorage.getItem('api_key');
    const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
    const userName = sessionStorage.getItem('user_name') || localStorage.getItem('user_name');

    if (!apiKey) {
      router.push('/login');
      return;
    }

    setCurrentUser({ userId, userName, apiKey });
  };

  const handleCopyApiKey = () => {
    if (currentUser?.apiKey) {
      navigator.clipboard.writeText(currentUser.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.clear();
    }
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Settings className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-gray-400">Manage your account and preferences</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* User Profile Section */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <User className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">User Profile</h2>
          </div>

          {currentUser && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">User ID</label>
                <div className="mt-1 px-3 py-2 bg-gray-700 rounded-lg text-white font-mono text-sm">
                  {currentUser.userId || 'Loading...'}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">Name</label>
                <div className="mt-1 px-3 py-2 bg-gray-700 rounded-lg text-white text-sm">
                  {currentUser.userName || 'Not set'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account Section - Only show if not Keycloak-only */}
        {typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AUTH_MODE !== 'keycloak-only' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <Key className="h-5 w-5 text-green-400" />
              <h2 className="text-lg font-semibold text-white">API Configuration</h2>
            </div>

            {currentUser && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">API Key</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <div className="flex-1 px-3 py-2 bg-gray-700 rounded-lg text-white font-mono text-sm">
                      {showApiKey ? currentUser.apiKey : '••••••••••••••••••••'}
                    </div>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title={showApiKey ? 'Hide' : 'Show'}
                    >
                      {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={handleCopyApiKey}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="Copy API Key"
                    >
                      {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">User ID</label>
                  <div className="mt-1 px-3 py-2 bg-gray-700 rounded-lg text-white font-mono text-sm">
                    {currentUser.userId || 'Loading...'}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Name</label>
                  <div className="mt-1 px-3 py-2 bg-gray-700 rounded-lg text-white text-sm">
                    {currentUser.userName || 'Not set'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* System Information Section - Only show if not Keycloak-only */}
        {typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AUTH_MODE !== 'keycloak-only' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <Info className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">System Information</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Version</span>
                <span className="text-white">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Environment</span>
                <span className="text-white">Production</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">API Status</span>
                <span className="text-green-400">Connected</span>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-white font-medium mb-2">Logout</h3>
              <p className="text-gray-400 text-sm mb-3">
                This will clear your session and log you out of the application.
              </p>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              {typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AUTH_MODE === 'keycloak-only' 
                ? 'Logging out will clear your session and redirect you to the login page.'
                : 'Logging out will clear your session. You\'ll need your API key to log back in.'
              }
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
