import type { OpenAPI } from 'openapi-types';

// Basic response interface
export interface ApiResponse {
  status_code: number;
  body: any;
  error: string;
  headers?: Record<string, string>;
}

// Request options
export interface RequestOptions {
  path: string;
  method?: string;
  data?: Record<string, any>;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  contentType?: string;
  content?: Buffer;
}

// API Configuration
export interface ApiConfig {
  name: string;
  baseUrl: string;
  openApiSpecUrl?: string;
  openApiSpecPath?: string;
  authentication?: {
    type: 'apiKey' | 'bearer' | 'basic' | 'oauth2' | 'custom';
    config: Record<string, any>;
  };
  defaultHeaders?: Record<string, string>;
  timeout?: number;
}

// API Instance with loaded spec
export interface ApiInstance {
  config: ApiConfig;
  spec: OpenAPI.Document;
}

// Dynamic authentication handler
export interface AuthHandler {
  apply(config: any, headers: Record<string, string>): Promise<void> | void;
}

// Configuration for multiple APIs
export interface MultiApiConfig {
  apis: Record<string, ApiConfig>;
  defaultApi?: string;
}

// Path parameter information
export interface PathParameter {
  name: string;
  required: boolean;
  type: string;
  in?: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
}

// Operation information
export interface OperationInfo {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: PathParameter[];
  requestBody?: any;
  responses?: Record<string, any>;
}
