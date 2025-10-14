'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import keycloakService from '@/services/keycloak';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Initialize Keycloak service
      const initialized = keycloakService.initialize();
      if (!initialized) {
        throw new Error('Keycloak not configured');
      }

      // Handle the callback
      const user = await keycloakService.handleCallback();
      
      if (user) {
        // Store user info in session
        const userId = keycloakService.getUserId(user);
        const userName = keycloakService.getUserName(user);
        const userEmail = keycloakService.getUserEmail(user);
        const accessToken = await keycloakService.getAccessToken();
        
        sessionStorage.setItem('user_id', userId);
        sessionStorage.setItem('user_name', userName);
        sessionStorage.setItem('user_email', userEmail);
        sessionStorage.setItem('access_token', accessToken || '');
        sessionStorage.setItem('auth_type', 'keycloak');
        
        // Also store in localStorage as backup
        localStorage.setItem('user_id', userId);
        localStorage.setItem('user_name', userName);
        localStorage.setItem('user_email', userEmail);
        localStorage.setItem('auth_type', 'keycloak');
        
        console.log('Keycloak login successful:', { userId, userName, userEmail });
        
        setStatus('success');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        throw new Error('No user returned from callback');
      }
    } catch (err) {
      console.error('Keycloak callback error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setStatus('error');
      
      // Redirect to login after error
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/10 rounded-2xl mb-4">
            <Brain className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">OpenMemory</h1>
        </div>

        {/* Status Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
          {status === 'loading' && (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 text-blue-400 animate-spin mx-auto" />
              <h2 className="text-xl font-semibold text-white">Completing Sign In</h2>
              <p className="text-gray-400">Please wait while we authenticate you...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto" />
              <h2 className="text-xl font-semibold text-white">Sign In Successful</h2>
              <p className="text-gray-400">Redirecting to your dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
              <h2 className="text-xl font-semibold text-white">Sign In Failed</h2>
              <p className="text-gray-400">{error}</p>
              <p className="text-sm text-gray-500">Redirecting to login page...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
