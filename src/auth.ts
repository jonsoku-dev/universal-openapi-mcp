import { AuthHandler, ApiConfig } from './types.js';
import axios from 'axios';

export class ApiKeyAuthHandler implements AuthHandler {
  constructor(
    private apiKey: string,
    private location: 'header' | 'query' = 'header',
    private keyName: string = 'X-API-Key'
  ) {}

  apply(config: any, headers: Record<string, string>): void {
    if (this.location === 'header') {
      headers[this.keyName] = this.apiKey;
    } else {
      // For query parameters, we'll handle this in the request function
      config.apiKeyQuery = { [this.keyName]: this.apiKey };
    }
  }
}

export class BearerAuthHandler implements AuthHandler {
  constructor(private token: string) {}

  apply(config: any, headers: Record<string, string>): void {
    headers['Authorization'] = `Bearer ${this.token}`;
  }
}

export class BasicAuthHandler implements AuthHandler {
  constructor(private username: string, private password: string) {}

  apply(config: any, headers: Record<string, string>): void {
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }
}

export class OAuth2AuthHandler implements AuthHandler {
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private tokenUrl: string,
    private scope?: string,
    private grantType: 'client_credentials' | 'authorization_code' = 'client_credentials'
  ) {}

  async apply(config: any, headers: Record<string, string>): Promise<void> {
    // Check if we need to refresh the token
    if (!this.accessToken || this.isTokenExpired()) {
      await this.refreshToken();
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
  }

  private async refreshToken(): Promise<void> {
    try {
      const requestBody = new URLSearchParams({
        grant_type: this.grantType,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      if (this.scope) {
        requestBody.append('scope', this.scope);
      }

      const response = await axios.post(this.tokenUrl, requestBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokenData = response.data;
      this.accessToken = tokenData.access_token;
      
      // Set expiry time (default to 1 hour if not provided)
      const expiresIn = tokenData.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
    } catch (error) {
      throw new Error(`OAuth2 token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    // Add 5-minute buffer before actual expiry
    return Date.now() >= (this.tokenExpiry.getTime() - 5 * 60 * 1000);
  }
}

export class CustomAuthHandler implements AuthHandler {
  constructor(private customApply: (config: any, headers: Record<string, string>) => void | Promise<void>) {}

  async apply(config: any, headers: Record<string, string>): Promise<void> {
    await this.customApply(config, headers);
  }
}

// Factory function to create appropriate auth handler
export function createAuthHandler(authConfig: ApiConfig['authentication']): AuthHandler | null {
  if (!authConfig) return null;

  switch (authConfig.type) {
    case 'apiKey':
      return new ApiKeyAuthHandler(
        authConfig.config.apiKey,
        authConfig.config.location || 'header',
        authConfig.config.keyName || 'X-API-Key'
      );
    
    case 'bearer':
      return new BearerAuthHandler(authConfig.config.token);
    
    case 'basic':
      return new BasicAuthHandler(authConfig.config.username, authConfig.config.password);
    
    case 'oauth2':
      return new OAuth2AuthHandler(
        authConfig.config.clientId,
        authConfig.config.clientSecret,
        authConfig.config.tokenUrl,
        authConfig.config.scope,
        authConfig.config.grantType || 'client_credentials'
      );
    
    case 'custom':
      return new CustomAuthHandler(authConfig.config.handler);
    
    default:
      return null;
  }
}
