import axios, { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
import { ApiResponse, RequestOptions, ApiInstance } from './types.js';
import { createAuthHandler } from './auth.js';

export class ApiClient {
  constructor(private apiInstance: ApiInstance) {}

  // Make HTTP request
  async request(options: RequestOptions): Promise<ApiResponse> {
    const { config, spec } = this.apiInstance;
    
    // Build URL
    const baseUrl = config.baseUrl || ((spec as any).servers?.[0]?.url ?? '');
    
    // Handle path correctly - if it starts with /, it's absolute from the API root
    let url: string;
    if (options.path.startsWith('http://') || options.path.startsWith('https://')) {
      // Full URL provided
      url = options.path;
    } else if (options.path.startsWith('/')) {
      // Absolute path - append to baseUrl (including any path component)
      url = baseUrl + options.path;
    } else {
      // Relative path - ensure proper joining
      url = baseUrl.endsWith('/') ? baseUrl + options.path : baseUrl + '/' + options.path;
    }

    // Prepare headers - start with empty object and add only what's needed
    const headers: Record<string, string> = {};
    
    // Add default headers if they exist
    if (config.defaultHeaders) {
      Object.assign(headers, config.defaultHeaders);
    }
    
    // Add custom headers if provided
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    
    // Add Content-Type only if we have data to send and it's not already set
    if ((options.data || options.content) && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = options.contentType || 'application/json';
    }

    // Apply authentication if configured
    const authHandler = createAuthHandler(config.authentication);
    const requestConfig: any = {};
    if (authHandler) {
      try {
        await authHandler.apply(requestConfig, headers);
      } catch (authError) {
        // Continue without authentication - some APIs might work without it
      }
    }

    // Prepare axios config
    const axiosConfig: AxiosRequestConfig = {
      method: (options.method || 'get').toLowerCase() as any,
      url,
      timeout: config.timeout || 60000
    };

    // Add headers only if they exist
    if (Object.keys(headers).length > 0) {
      axiosConfig.headers = headers;
    }

    // Combine query parameters safely
    const allParams = { ...options.params };
    if (requestConfig.apiKeyQuery) {
      Object.assign(allParams, requestConfig.apiKeyQuery);
    }
    if (Object.keys(allParams).length > 0) {
      axiosConfig.params = allParams;
    }

    // Add request body if present
    if (options.content) {
      axiosConfig.data = options.content;
    } else if (options.data) {
      axiosConfig.data = options.data;
    }

    try {
      const response: AxiosResponse = await axios(axiosConfig);

      // Convert AxiosHeaders to plain object for YAML serialization
      const responseHeaders: Record<string, string> = {};
      if (response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          if (typeof value === 'string') {
            responseHeaders[key] = value;
          } else if (typeof value === 'number') {
            responseHeaders[key] = value.toString();
          } else if (Array.isArray(value)) {
            responseHeaders[key] = value.join(', ');
          }
        }
      }

      return {
        status_code: response.status,
        body: response.data,
        error: '',
        headers: responseHeaders
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      
      let statusCode = 0;
      let body = null;
      let responseHeaders: Record<string, string> = {};
      let debugInfo: any = {
        request: {
          url: axiosConfig.url,
          method: axiosConfig.method,
          headers: axiosConfig.headers,
          params: axiosConfig.params,
          data: axiosConfig.data
        }
      };
      
      if (axiosError.response) {
        statusCode = axiosError.response.status;
        body = axiosError.response.data;
        
        // Convert AxiosHeaders to plain object for YAML serialization
        if (axiosError.response.headers) {
          for (const [key, value] of Object.entries(axiosError.response.headers)) {
            if (typeof value === 'string') {
              responseHeaders[key] = value;
            } else if (typeof value === 'number') {
              responseHeaders[key] = value.toString();
            } else if (Array.isArray(value)) {
              responseHeaders[key] = value.join(', ');
            }
          }
        }
      }

      // Create detailed error message with debug info
      const errorMessage = `${axiosError.constructor.name}: ${axiosError.message}
Request Details:
  URL: ${debugInfo.request.url}
  Method: ${debugInfo.request.method?.toUpperCase()}
  Headers: ${JSON.stringify(debugInfo.request.headers || {})}
  Params: ${JSON.stringify(debugInfo.request.params || {})}
  Data: ${JSON.stringify(debugInfo.request.data || null)}`;

      return {
        status_code: statusCode,
        body,
        error: errorMessage,
        headers: responseHeaders
      };
    }
  }

  // Convenience methods for common HTTP methods
  async get(path: string, params?: Record<string, any>, headers?: Record<string, string>): Promise<ApiResponse> {
    return this.request({ path, method: 'get', params, headers });
  }

  async post(path: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse> {
    return this.request({ path, method: 'post', data, headers });
  }

  async put(path: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse> {
    return this.request({ path, method: 'put', data, headers });
  }

  async patch(path: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse> {
    return this.request({ path, method: 'patch', data, headers });
  }

  async delete(path: string, params?: Record<string, any>, headers?: Record<string, string>): Promise<ApiResponse> {
    return this.request({ path, method: 'delete', params, headers });
  }
}
