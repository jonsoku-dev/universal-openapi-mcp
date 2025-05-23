import fs from 'fs/promises';
import yaml from 'js-yaml';
import { ApiConfig, MultiApiConfig } from './types.js';

/**
 * Configuration loader that supports both environment variables and YAML files
 */
export class ConfigLoader {
  /**
   * Load configuration from environment variables (existing functionality)
   */
  static loadConfigFromEnv(): ApiConfig {
    const openApiSpecUrl = process.env.OPENAPI_SPEC_URL;
    const baseUrl = process.env.API_BASE_URL;
    
    if (!openApiSpecUrl && !baseUrl) {
      throw new Error('Either OPENAPI_SPEC_URL or API_BASE_URL must be provided');
    }

    const config: ApiConfig = {
      name: process.env.API_NAME || 'api',
      baseUrl: baseUrl || '',
      openApiSpecUrl: openApiSpecUrl,
      timeout: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT) : 30000
    };

    // Authentication configuration
    const authType = process.env.AUTH_TYPE;
    if (authType) {
      config.authentication = {
        type: authType as any,
        config: {}
      };

      switch (authType) {
        case 'apiKey':
          config.authentication.config = {
            apiKey: process.env.API_KEY,
            location: process.env.API_KEY_LOCATION || 'header',
            keyName: process.env.API_KEY_NAME || 'X-API-Key'
          };
          break;
        case 'bearer':
          config.authentication.config = {
            token: process.env.AUTH_TOKEN || process.env.BEARER_TOKEN
          };
          break;
        case 'basic':
          config.authentication.config = {
            username: process.env.AUTH_USERNAME,
            password: process.env.AUTH_PASSWORD
          };
          break;
        case 'oauth2':
          config.authentication.config = {
            clientId: process.env.OAUTH2_CLIENT_ID,
            clientSecret: process.env.OAUTH2_CLIENT_SECRET,
            tokenUrl: process.env.OAUTH2_TOKEN_URL,
            scope: process.env.OAUTH2_SCOPE,
            grantType: process.env.OAUTH2_GRANT_TYPE || 'client_credentials'
          };
          break;
      }
    }

    // Default headers
    const defaultHeaders: Record<string, string> = {};
    
    // Look for HEADER_* environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('HEADER_') && value) {
        const headerName = key.slice(7).toLowerCase().replace(/_/g, '-');
        defaultHeaders[headerName] = value;
      }
    }
    
    // Add User-Agent if not provided
    if (!defaultHeaders['user-agent']) {
      defaultHeaders['user-agent'] = 'Universal-OpenAPI-MCP/1.0';
    }
    
    if (Object.keys(defaultHeaders).length > 0) {
      config.defaultHeaders = defaultHeaders;
    }

    return config;
  }

  /**
   * Load configuration from YAML file with environment variable substitution
   */
  static async loadConfigFromYaml(filePath: string): Promise<MultiApiConfig> {
    try {
      const yamlContent = await fs.readFile(filePath, 'utf-8');
      
      // Substitute environment variables in YAML content
      const processedContent = this.substituteEnvVariables(yamlContent);
      
      const config = yaml.load(processedContent) as MultiApiConfig;
      
      // Validate the configuration structure
      this.validateMultiApiConfig(config);
      
      return config;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Invalid YAML configuration file: ${err.message}`);
    }
  }

  /**
   * Get specific API configuration from multi-API config
   */
  static getApiConfig(multiConfig: MultiApiConfig, apiName?: string): ApiConfig {
    const selectedApi = apiName || multiConfig.defaultApi || Object.keys(multiConfig.apis)[0];
    
    if (!selectedApi) {
      throw new Error('No API configuration found');
    }
    
    const config = multiConfig.apis[selectedApi];
    if (!config) {
      throw new Error(`API configuration '${selectedApi}' not found. Available APIs: ${Object.keys(multiConfig.apis).join(', ')}`);
    }
    
    return config;
  }

  /**
   * Load configuration with fallback: YAML file first, then environment variables
   */
  static async loadConfiguration(yamlPath?: string, apiName?: string): Promise<ApiConfig> {
    // Try loading from YAML file first
    if (yamlPath) {
      try {
        const multiConfig = await this.loadConfigFromYaml(yamlPath);
        return this.getApiConfig(multiConfig, apiName);
      } catch (error) {
        // Silently fallback to environment variables
      }
    }
    
    // Fallback to environment variables
    return this.loadConfigFromEnv();
  }

  /**
   * Substitute environment variables in YAML content (${VAR_NAME} format)
   */
  private static substituteEnvVariables(content: string): string {
    return content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        // Keep placeholder if environment variable is not defined
        return match;
      }
      return value;
    });
  }

  /**
   * Validate multi-API configuration structure
   */
  private static validateMultiApiConfig(config: any): asserts config is MultiApiConfig {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }
    
    if (!config.apis || typeof config.apis !== 'object') {
      throw new Error('Configuration must have an "apis" object');
    }
    
    if (Object.keys(config.apis).length === 0) {
      throw new Error('At least one API configuration must be provided');
    }
    
    // Validate each API configuration
    for (const [apiName, apiConfig] of Object.entries(config.apis)) {
      this.validateApiConfig(apiConfig, apiName);
    }
    
    // Validate defaultApi if provided
    if (config.defaultApi && !config.apis[config.defaultApi]) {
      throw new Error(`Default API '${config.defaultApi}' not found in apis configuration`);
    }
  }

  /**
   * Validate single API configuration
   */
  private static validateApiConfig(config: any, apiName: string): asserts config is ApiConfig {
    if (!config || typeof config !== 'object') {
      throw new Error(`API configuration '${apiName}' must be an object`);
    }
    
    if (!config.name || typeof config.name !== 'string') {
      throw new Error(`API configuration '${apiName}' must have a name`);
    }
    
    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      throw new Error(`API configuration '${apiName}' must have a baseUrl`);
    }
    
    // Validate authentication configuration if present
    if (config.authentication) {
      if (!config.authentication.type) {
        throw new Error(`API configuration '${apiName}' authentication must have a type`);
      }
      
      const validAuthTypes = ['apiKey', 'bearer', 'basic', 'oauth2', 'custom'];
      if (!validAuthTypes.includes(config.authentication.type)) {
        throw new Error(`API configuration '${apiName}' has invalid authentication type. Valid types: ${validAuthTypes.join(', ')}`);
      }
    }
  }

  /**
   * Create example YAML configuration file
   */
  static async createExampleConfig(filePath: string): Promise<void> {
    const exampleConfig = `# Universal OpenAPI MCP Server Configuration
# This file shows examples of different API configurations

apis:
  # Example GitHub API configuration
  github:
    name: github
    baseUrl: https://api.github.com
    openApiSpecUrl: https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json
    authentication:
      type: bearer
      config:
        token: \${GITHUB_TOKEN}
    defaultHeaders:
      User-Agent: Universal-OpenAPI-MCP/1.0
      Accept: application/vnd.github.v3+json
    timeout: 30000

  # Example JSONPlaceholder API (for testing, no auth needed)
  jsonplaceholder:
    name: jsonplaceholder
    baseUrl: https://jsonplaceholder.typicode.com
    openApiSpecUrl: https://jsonplaceholder.typicode.com/openapi.json
    timeout: 15000

  # Example API with API Key authentication
  myapi:
    name: myapi
    baseUrl: https://api.example.com
    openApiSpecUrl: https://api.example.com/v1/openapi.json
    authentication:
      type: apiKey
      config:
        apiKey: \${MY_API_KEY}
        location: header
        keyName: X-API-Key
    defaultHeaders:
      User-Agent: Universal-OpenAPI-MCP/1.0
    timeout: 30000

  # Example OAuth2 API configuration
  oauth_api:
    name: oauth_api
    baseUrl: https://oauth-api.example.com
    openApiSpecUrl: https://oauth-api.example.com/openapi.json
    authentication:
      type: oauth2
      config:
        clientId: \${OAUTH2_CLIENT_ID}
        clientSecret: \${OAUTH2_CLIENT_SECRET}
        tokenUrl: https://oauth-api.example.com/oauth/token
        scope: read write
        grantType: client_credentials
    timeout: 30000

# Set default API to use (optional)
defaultApi: jsonplaceholder
`;

    await fs.writeFile(filePath, exampleConfig, 'utf-8');
  }
}
