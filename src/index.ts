#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

// --- 디버깅 로그 추가 ---
console.error(`[DEBUG index.ts] INIT`);
console.error(`[DEBUG index.ts] CWD: ${process.cwd()}`);
console.error(`[DEBUG index.ts] API_NAME from env: ${process.env.API_NAME}`);
console.error(`[DEBUG index.ts] OPENAPI_SPEC_URL from env: ${process.env.OPENAPI_SPEC_URL}`);
console.error(`[DEBUG index.ts] API_BASE_URL from env: ${process.env.API_BASE_URL}`);
console.error(`[DEBUG index.ts] CONFIG_FILE env: ${process.env.CONFIG_FILE}`);
console.error(`[DEBUG index.ts] MCP_CONFIG_FILE env: ${process.env.MCP_CONFIG_FILE}`);
// --- 디버깅 로그 끝 ---

import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import yaml from 'js-yaml';
import { 
  ApiInstance, 
  ApiResponse,
  ApiConfig,
  OperationInfo
} from './types.js';
import { SpecLoader, SpecAnalyzer } from './spec-utils.js';
import { ApiClient } from './client.js';
import { ConfigLoader } from './config-loader.js';

// Constants
const VERSION = '1.0.0';

// Global state
let apiInstance: ApiInstance;
let apiClient: ApiClient;

// Load configuration and initialize API
async function loadConfiguration() {
  try {
    // Check for command line arguments or environment variables to specify config source
    const configFile = process.env.CONFIG_FILE || process.env.MCP_CONFIG_FILE;
    const apiName = process.env.API_NAME;
    
    // Use ConfigLoader with fallback mechanism
    console.error(`[DEBUG index.ts loadConfiguration] About to call ConfigLoader.loadConfiguration. apiName: '${apiName}', configFilePath: '${configFile}'`);
    const config = await ConfigLoader.loadConfiguration(configFile, apiName);
    console.error(`[DEBUG index.ts loadConfiguration] ConfigLoader.loadConfiguration returned. Config: ${JSON.stringify(config, null, 2)}`);
    
    if (config.openApiSpecUrl) {
      apiInstance = await SpecLoader.createApiInstance(config);
    } else {
      // Create minimal instance without spec
      apiInstance = { 
        config, 
        spec: { 
          openapi: '3.0.0', 
          info: { title: config.name, version: '1.0.0' },
          paths: {}
        } 
      };
    }
    
    apiClient = new ApiClient(apiInstance);

  } catch (error) {
    const err = error as Error;
    throw new UserError(`Failed to load configuration: ${err.message}`);
  }
}

// Create and configure the server
async function createServer(): Promise<FastMCP<any>> {
  console.error(`[DEBUG index.ts createServer] Entered createServer function.`);
  // Load configuration first
  await loadConfiguration();

  // Build instructions
  const instructions = `This is a Universal OpenAPI MCP Server for ${apiInstance.config.name}.

Base URL: ${apiInstance.config.baseUrl}
OpenAPI Spec: ${apiInstance.config.openApiSpecUrl || 'Not provided'}

Available tools:
- api_request: Make API requests
- api_paths_list: List available API endpoints
- api_paths_info: Get detailed API path information
- api_spec_info: Get OpenAPI spec information`;

  // Initialize FastMCP server
  const server = new FastMCP({
    name: `${apiInstance.config.name} OpenAPI MCP Server`,
    version: VERSION,
    instructions
  });

  // Tool 1: Make API request
  server.addTool({
    name: 'api_request',
    description: `Make a request to the configured API

Args:
    path: API endpoint path (e.g. '/users' or '/api/v1/users')
    method: HTTP method to use (default: 'get')
    data: Dictionary for request body (for POST/PUT)
    params: Dictionary for query parameters
    headers: Dictionary for additional headers

Returns:
    str: YAML string containing response status code, body, headers and error message`,
    parameters: z.object({
      path: z.string().describe("API endpoint path (e.g. '/users')"),
      method: z.string().default('get').describe('HTTP method to use'),
      data: z.record(z.any()).optional().describe('Dictionary for request body (for POST/PUT)'),
      params: z.record(z.any()).optional().describe('Dictionary for query parameters'),
      headers: z.record(z.string()).optional().describe('Dictionary for additional headers')
    }),
    annotations: {
      title: 'API Request',
      openWorldHint: true,
      readOnlyHint: false
    },
    execute: async (args, { log }) => {
      try {
        log.info(`Making ${args.method.toUpperCase()} request to ${args.path}`);
        
        const result = await apiClient.request({
          path: args.path,
          method: args.method,
          data: args.data,
          params: args.params,
          headers: args.headers
        });
        
        if (result.status_code >= 400) {
          log.error(`Request failed with status ${result.status_code}`, { error: result.error });
        } else {
          log.info(`Request successful with status ${result.status_code}`);
        }
        
        return yaml.dump(result);
      } catch (error) {
        const err = error as Error;
        log.error('Request failed', { error: err.message });
        
        if (error instanceof UserError) {
          throw error;
        }
        
        const errorResult: ApiResponse = {
          status_code: 0,
          body: null,
          error: `${err.constructor.name}: ${err.message}`
        };
        return yaml.dump(errorResult);
      }
    }
  });

  // Tool 2: List API paths
  server.addTool({
    name: 'api_paths_list',
    description: `List all available API endpoints with essential information

Returns:
    JSON object containing endpoints grouped by tags, with method details and parameters`,
    annotations: {
      title: 'List API Paths',
      readOnlyHint: true,
      openWorldHint: false
    },
    execute: async (_, { log }) => {
      try {
        log.info('Retrieving API paths with details');
        
        const spec = apiInstance.spec;
        const allOperations = SpecAnalyzer.getAllOperations(spec);
        const tags = SpecAnalyzer.getTags(spec);
        
        // Create a map of tag names to descriptions
        const tagMap: Record<string, string> = {};
        tags.forEach((tag: any) => {
          if (tag.name) {
            tagMap[tag.name] = tag.description || tag.name;
          }
        });
        
        // Organize endpoints by tags
        const endpointsByTag: Record<string, any[]> = {
          'untagged': []
        };
        
        // Initialize tag groups
        Object.keys(tagMap).forEach(tagName => {
          endpointsByTag[tagName] = [];
        });
        
        // Process all operations
        for (const [path, methods] of Object.entries(allOperations)) {
          for (const [method, operation] of Object.entries(methods)) {
            const op = operation as OperationInfo;
            
            // Extract tags from the operation
            const operationTags = (spec as any).paths?.[path]?.[method]?.tags || [];
            const targetTags = operationTags.length > 0 ? operationTags : ['untagged'];
            
            // Create endpoint info
            const endpointInfo = {
              path,
              method: method.toUpperCase(),
              operationId: op.operationId,
              summary: op.summary || 'No description',
              parameters: op.parameters?.map(p => ({
                name: p.name,
                required: p.required,
                type: p.type,
                in: (spec as any).paths?.[path]?.[method]?.parameters?.find((param: any) => 
                  param.name === p.name
                )?.in || 'query'
              })) || [],
              requestBody: op.requestBody ? {
                required: op.requestBody.required || false,
                contentTypes: Object.keys(op.requestBody.content || {})
              } : null
            };
            
            // Add to appropriate tags
            targetTags.forEach((tag: string) => {
              if (!endpointsByTag[tag]) {
                endpointsByTag[tag] = [];
              }
              endpointsByTag[tag].push(endpointInfo);
            });
          }
        }
        
        // Clean up empty tags
        Object.keys(endpointsByTag).forEach(tag => {
          if (endpointsByTag[tag].length === 0) {
            delete endpointsByTag[tag];
          }
        });
        
        // Create final structure
        const result = {
          summary: {
            totalEndpoints: Object.values(endpointsByTag).reduce((sum, endpoints) => sum + endpoints.length, 0),
            tags: Object.keys(endpointsByTag)
          },
          endpoints: endpointsByTag
        };
        
        log.info(`Found ${result.summary.totalEndpoints} endpoints across ${result.summary.tags.length} tags`);
        
        // Return as formatted JSON string instead of YAML
        return JSON.stringify(result, null, 2);
      } catch (error) {
        const err = error as Error;
        log.error('Failed to retrieve paths', { error: err.message });
        throw error instanceof UserError ? error : new UserError(err.message);
      }
    }
  });

  // Tool 3: Get path information
  server.addTool({
    name: 'api_paths_info',
    description: `Get detailed information for specific API paths

Args:
    path_templates: List of path templates (e.g. ['/users', '/users/{id}'])
    
Returns:
    str: YAML string containing detailed API specifications for the requested paths`,
    parameters: z.object({
      path_templates: z.array(z.string()).describe('List of path templates')
    }),
    annotations: {
      title: 'Get API Path Details',
      readOnlyHint: true,
      openWorldHint: false
    },
    execute: async (args, { log }) => {
      try {
        log.info(`Getting path information for ${args.path_templates.length} paths`);
        
        const info = SpecAnalyzer.getPathsInfo(apiInstance.spec, args.path_templates);
        
        log.info(`Retrieved information for ${Object.keys(info).length} paths`);
        return yaml.dump(info);
      } catch (error) {
        const err = error as Error;
        log.error('Failed to retrieve path information', { error: err.message });
        throw error instanceof UserError ? error : new UserError(err.message);
      }
    }
  });

  // Tool 4: Get API spec information
  server.addTool({
    name: 'api_spec_info',
    description: `Get general information about the API's OpenAPI specification

Args:
    include: List of information to include (info, servers, tags, paths_summary)
    
Returns:
    str: YAML string containing the requested API specification information`,
    parameters: z.object({
      include: z.array(z.enum(['info', 'servers', 'tags', 'paths_summary'])).default(['info', 'servers', 'tags']).describe('Information to include')
    }),
    annotations: {
      title: 'Get API Spec Info',
      readOnlyHint: true,
      openWorldHint: false
    },
    execute: async (args, { log }) => {
      try {
        const spec = apiInstance.spec;
        
        log.info('Getting API spec information');
        
        const result: Record<string, any> = {};
        
        if (args.include.includes('info')) {
          result.info = SpecAnalyzer.getApiInfo(spec);
        }
        
        if (args.include.includes('servers')) {
          result.servers = SpecAnalyzer.getServers(spec);
        }
        
        if (args.include.includes('tags')) {
          result.tags = SpecAnalyzer.getTags(spec);
        }
        
        if (args.include.includes('paths_summary')) {
          const allOperations = SpecAnalyzer.getAllOperations(spec);
          result.paths_summary = Object.entries(allOperations).map(([path, operations]) => ({
            path,
            methods: Object.keys(operations),
            operations: Object.values(operations).map(op => ({
              operationId: op.operationId,
              summary: op.summary
            }))
          }));
        }
        
        log.info('Retrieved API spec information');
        return yaml.dump(result);
      } catch (error) {
        const err = error as Error;
        log.error('Failed to retrieve spec information', { error: err.message });
        throw error instanceof UserError ? error : new UserError(err.message);
      }
    }
  });

  return server;
}

// Main execution
async function main() {
  console.error('[DEBUG index.ts main] Main function started.');
  try {
    const server = await createServer();
    
    // Log the config being used by the server instance
    if (apiInstance && apiInstance.config) {
      console.error(`[DEBUG index.ts main] Config used for server: ${JSON.stringify(apiInstance.config, null, 2)}`);
    } else {
      console.error('[DEBUG index.ts main] apiInstance or apiInstance.config is not available for logging.');
    }
    console.error(`[DEBUG index.ts main] Server instance created. Attempting to start...`);
    // Start the server
    await server.start({
      transportType: 'stdio'
    });
  } catch (error: any) {
    console.error(`[FATAL ERROR index.ts main] MCP server failed to start.`);
    if (error instanceof Error) {
      console.error(`Error Message: ${error.message}`);
      console.error(`Stack Trace: ${error.stack}`);
    } else {
      console.error(`Caught non-Error object: ${JSON.stringify(error)}`);
    }
    // Ensure process exits after logging, might help flush stderr
    process.stderr.write("Forcing exit due to error in main.\n", () => process.exit(1));
  }
}

// Add global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL ERROR index.ts] Unhandled Rejection at:', promise, 'reason:', reason);
  process.stderr.write("Forcing exit due to unhandledRejection.\n", () => process.exit(1));
});

process.on('uncaughtException', (err, origin) => {
  console.error(`[FATAL ERROR index.ts] Uncaught Exception: ${err.message}`);
  console.error(`Origin: ${origin}`);
  console.error(`Stack: ${err.stack}`);
  process.stderr.write("Forcing exit due to uncaughtException.\n", () => process.exit(1));
});

// Export the server creation function for testing
export { createServer };

// If running directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
