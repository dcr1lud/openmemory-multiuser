import { useState, useEffect } from 'react';
import { uiConfigService, UIConfig } from '@/services/uiConfig';

export function useUIConfig() {
  const [config, setConfig] = useState<UIConfig>({
    features: {
      enable_apps: process.env.NEXT_PUBLIC_AUTH_MODE !== 'keycloak-only'
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('Fetching UI config...');
        const uiConfig = await uiConfigService.getUIConfig();
        console.log('UI config loaded:', uiConfig);
        setConfig(uiConfig);
      } catch (error) {
        console.warn('Failed to load UI config, using environment fallback:', error);
        // Use environment variable as fallback
        setConfig({
          features: {
            enable_apps: process.env.NEXT_PUBLIC_AUTH_MODE !== 'keycloak-only'
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, loading };
}
