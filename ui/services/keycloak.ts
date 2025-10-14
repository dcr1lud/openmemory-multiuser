import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';

interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  redirectUri: string;
}

class KeycloakService {
  private userManager: UserManager | null = null;
  private config: KeycloakConfig | null = null;

  initialize() {
    // Get configuration from environment variables
    const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
    const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM;
    const keycloakClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;

    if (!keycloakUrl || !keycloakRealm || !keycloakClientId) {
      console.warn('Keycloak configuration missing. Falling back to API key authentication.');
      return false;
    }

    this.config = {
      url: keycloakUrl,
      realm: keycloakRealm,
      clientId: keycloakClientId,
      redirectUri: `${window.location.origin}/auth/callback`
    };

    const authority = `${keycloakUrl}/realms/${keycloakRealm}`;

    this.userManager = new UserManager({
      authority,
      client_id: keycloakClientId,
      redirect_uri: this.config.redirectUri,
      post_logout_redirect_uri: window.location.origin,
      response_type: 'code',
      scope: 'openid profile email',
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      automaticSilentRenew: true,
      silent_redirect_uri: `${window.location.origin}/auth/silent-callback`,
    });

    return true;
  }

  isConfigured(): boolean {
    return this.userManager !== null;
  }

  async login(): Promise<void> {
    if (!this.userManager) {
      throw new Error('Keycloak not initialized');
    }
    await this.userManager.signinRedirect();
  }

  async logout(): Promise<void> {
    if (!this.userManager) {
      throw new Error('Keycloak not initialized');
    }
    await this.userManager.signoutRedirect();
  }

  async handleCallback(): Promise<User | null> {
    if (!this.userManager) {
      throw new Error('Keycloak not initialized');
    }
    return await this.userManager.signinRedirectCallback();
  }

  async getUser(): Promise<User | null> {
    if (!this.userManager) {
      return null;
    }
    return await this.userManager.getUser();
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getUser();
    return user !== null && !user.expired;
  }

  async getAccessToken(): Promise<string | null> {
    const user = await this.getUser();
    return user?.access_token || null;
  }

  getUserId(user: User): string {
    // Use Keycloak 'sub' claim as user ID
    return user.profile.sub;
  }

  getUserName(user: User): string {
    return user.profile.preferred_username || user.profile.name || user.profile.sub;
  }

  getUserEmail(user: User): string {
    return user.profile.email || '';
  }
}

export const keycloakService = new KeycloakService();
export default keycloakService;
