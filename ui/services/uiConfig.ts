import axios from 'axios';

export interface UIFeatures {
  enable_apps: boolean;
}

export interface UIConfig {
  features: UIFeatures;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const uiConfigService = {
  async getUIConfig(): Promise<UIConfig> {
    // Always use environment variable, no API call needed
    const enableApps = process.env.NEXT_PUBLIC_ENABLE_APPS !== 'false';
    return {
      features: {
        enable_apps: enableApps
      }
    };
  }
};
