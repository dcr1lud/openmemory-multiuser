'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brain, Key, AlertCircle, CheckCircle, LogIn } from 'lucide-react';
import keycloakService from '@/services/keycloak';

export default function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useKeycloak, setUseKeycloak] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if Keycloak is configured
    if (typeof window !== 'undefined') {
      const keycloakConfigured = keycloakService.initialize();
      setUseKeycloak(keycloakConfigured);

      // Check if user is already authenticated
      if (keycloakConfigured) {
        checkKeycloakAuth();
      }
    }
  }, []);

  const checkKeycloakAuth = async () => {
    try {
      const isAuth = await keycloakService.isAuthenticated();
      if (isAuth) {
        const user = await keycloakService.getUser();
        if (user) {
          // Store user info in session
          const userId = keycloakService.getUserId(user);
          const userName = keycloakService.getUserName(user);
          const accessToken = await keycloakService.getAccessToken();

          sessionStorage.setItem('user_id', userId);
          sessionStorage.setItem('user_name', userName);
          sessionStorage.setItem('access_token', accessToken || '');
          sessionStorage.setItem('auth_type', 'keycloak');

          router.push('/');
        }
      }
    } catch (error) {
      console.error('Keycloak auth check failed:', error);
    }
  };

  const handleKeycloakLogin = async () => {
    setLoading(true);
    setError('');

    try {
      await keycloakService.login();
    } catch (err) {
      setError('Failed to initiate Keycloak login');
      console.error('Keycloak login error:', err);
      setLoading(false);
    }
  };

  const handleApiKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      // Use the external API URL directly
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      console.log('Attempting login to:', apiUrl);

      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (response.ok && data.success) {
        // Store API key in session storage
        sessionStorage.setItem('api_key', apiKey);
        sessionStorage.setItem('user_id', data.user_id);
        sessionStorage.setItem('user_name', data.name || data.user_id);
        sessionStorage.setItem('auth_type', 'api_key');

        // Also store in localStorage as backup
        localStorage.setItem('api_key', apiKey);
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('user_name', data.name || data.user_id);

        console.log('Login successful, stored credentials');

        // Show success message
        setSuccess(true);
        setError('');

        // Navigate to dashboard
        setTimeout(() => {
          router.push('/');
        }, 500);

      } else {
        setError(data.detail || 'Invalid API key');
        console.error('Login failed:', data);
      }
    } catch (err) {
      setError('Failed to connect to server. Please check your connection.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/10 rounded-2xl mb-4">
            <Brain className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">OpenMemory</h1>
          <p className="text-gray-400">Collaborative AI Memory System</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-700">
          {useKeycloak ? (
            // Keycloak Login
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-2">Sign In</h2>
                <p className="text-gray-400 text-sm">
                  Use your organization account to access OpenMemory
                </p>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleKeycloakLogin}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                disabled={loading}
              >
                <LogIn className="h-5 w-5" />
                <span>{loading ? 'Redirecting...' : 'Sign in with SSO'}</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-800 text-gray-400">or</span>
                </div>
              </div>

              <button
                onClick={() => setUseKeycloak(false)}
                className="w-full py-2 px-4 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Use API Key instead
              </button>
            </div>
          ) : (
            // API Key Login (fallback)
            <form onSubmit={handleApiKeyLogin} className="space-y-6">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="apiKey"
                    type="password"
                    className="w-full pl-10 pr-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="mem_lab_xxxxxxxxxxxx"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Enter your API key to access the memory dashboard
                </p>
              </div>

              {success && (
                <div className="flex items-center space-x-2 text-green-400 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>Login successful! Redirecting...</span>
                </div>
              )}

              {error && (
                <div className="flex items-center space-x-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || success}
              >
                {loading ? 'Authenticating...' : success ? 'Redirecting...' : 'Access Dashboard'}
              </button>

              {process.env.NEXT_PUBLIC_KEYCLOAK_URL && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-800 text-gray-400">or</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setUseKeycloak(true)}
                    className="w-full py-2 px-4 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Use SSO Login instead
                  </button>
                </>
              )}
            </form>
          )}

          {/* Footer - removed registration link */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-center text-sm text-gray-400">
              {useKeycloak ? 
                'Contact your administrator for account access' : 
                'Use your API key to access the system'
              }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Research Lab Memory System</p>
          <p>Powered by Claude + Human Collaboration</p>
        </div>
      </div>
    </div>
  );
}
