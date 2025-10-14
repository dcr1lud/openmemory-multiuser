'use client';

import { useEffect } from 'react';
import keycloakService from '@/services/keycloak';

export default function SilentCallbackPage() {
  useEffect(() => {
    // Initialize and handle silent callback
    keycloakService.initialize();
    // The OIDC client will handle the silent callback automatically
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400">Processing...</div>
    </div>
  );
}
