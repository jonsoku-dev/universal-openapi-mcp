# Universal OpenAPI MCP Server

A powerful Model Context Protocol (MCP) server that works with any OpenAPI-compliant API. This server allows you to easily connect to and interact with any API by providing its OpenAPI specification, with support for multiple APIs and various authentication methods.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Using .env (Environment Variables)](#using-env-environment-variables)
  - [Using YAML Configuration](#using-yaml-configuration)
- [Available Tools](#available-tools)
- [Real-World Examples](#real-world-examples)
- [Troubleshooting](#troubleshooting)
- [Advanced Features](#advanced-features)
- [Development](#development)
- [Architecture Documentation](#architecture-documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Universal API Support**: Works with any OpenAPI 3.x or Swagger 2.0 compliant API
- **Multiple API Management**: Configure and switch between multiple APIs
- **Automatic Validation**: Validates OpenAPI specs using @readme/openapi-parser
- **Flexible Authentication**: Support for API Key, Bearer Token, Basic Auth, OAuth2, and custom auth
- **Dual Configuration**: Environment variables OR YAML configuration files
- **Structured API Discovery**: Returns organized JSON data for endpoints grouped by tags
- **Enhanced Error Reporting**: Detailed error messages with request information for debugging
- **Environment Variable Substitution**: Use ${VAR_NAME} in YAML files
- **TypeScript Support**: Fully typed with TypeScript for better development experience
- **FastMCP Integration**: Built with FastMCP for optimal Model Context Protocol support

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/universal-openapi-mcp.git
cd universal-openapi-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Quick Start

1. **Copy the example environment file:**
```bash
cp .env.example .env
```

2. **Edit `.env` with your API details:**
```bash
# Minimal configuration
API_NAME=petstore
API_BASE_URL=https://petstore.swagger.io/v2
OPENAPI_SPEC_URL=https://petstore.swagger.io/v2/swagger.json
```

3. **Run the server:**
```bash
npm run dev
```

4. **Test with FastMCP:**
```bash
npx fastmcp dev src/index.ts
```

## Configuration

### Using .env (Environment Variables)

The simplest way to configure is using a `.env` file. The server supports comprehensive environment variable configuration for all aspects of API connectivity.

#### Basic Configuration (Required)

```bash
# API Name - Unique identifier for your API
API_NAME=my-api

# API Base URL - The base URL of your API
API_BASE_URL=https://api.example.com

# OpenAPI Specification URL - Where to fetch the spec
# Can be a URL or local file path
OPENAPI_SPEC_URL=https://api.example.com/openapi.json
# or for local files:
# OPENAPI_SPEC_URL=./specs/my-api.yaml

# Request timeout in milliseconds (optional, default: 30000)
API_TIMEOUT=30000
```

#### Authentication Methods

The server supports multiple authentication methods. Choose ONE that matches your API:

**1. API Key Authentication:**
```bash
AUTH_TYPE=apiKey
API_KEY=your-api-key-here
API_KEY_LOCATION=header        # or 'query'
API_KEY_NAME=X-API-Key         # The name of the header/query parameter

# Common API key header names:
# - X-API-Key: Generic APIs
# - Authorization: Some services use "Authorization: API-Key YOUR_KEY"
# - X-RapidAPI-Key: RapidAPI services
# - api-key: Azure services
# - X-Auth-Token: Some REST APIs
# - access_token: When passed as query parameter
```

**2. Bearer Token Authentication:**
```bash
AUTH_TYPE=bearer
# You can use either AUTH_TOKEN or BEARER_TOKEN
BEARER_TOKEN=your-bearer-token-here
# The token will be sent as "Authorization: Bearer TOKEN"
```

**3. Basic Authentication:**
```bash
AUTH_TYPE=basic
AUTH_USERNAME=your-username
AUTH_PASSWORD=your-password
```

**4. OAuth2 Authentication:**
```bash
AUTH_TYPE=oauth2
OAUTH2_CLIENT_ID=your-client-id
OAUTH2_CLIENT_SECRET=your-client-secret
OAUTH2_TOKEN_URL=https://api.example.com/oauth/token
OAUTH2_SCOPE=read write        # Space-separated scopes
OAUTH2_GRANT_TYPE=client_credentials  # Usually 'client_credentials' for server-to-server
```

#### Custom Headers

Add any custom headers by prefixing with `HEADER_`. The prefix will be removed and underscores converted to hyphens:

```bash
# Examples of header transformation:
# HEADER_USER_AGENT → User-Agent
# HEADER_X_CUSTOM_ID → X-Custom-Id
# HEADER_CONTENT_TYPE → Content-Type

HEADER_USER_AGENT=MyApp/1.0
HEADER_ACCEPT=application/json
HEADER_X_REQUEST_ID=req_123456
HEADER_X_CLIENT_VERSION=2.0
HEADER_X_TENANT_ID=tenant_abc
```

### Using YAML Configuration

For more complex setups or multiple APIs, use YAML configuration. This is especially useful when:
- You need to configure multiple APIs
- You want to version control your configuration
- You have complex authentication setups
- You need to use environment variable substitution

#### Create config.yaml:

```yaml
apis:
  # GitHub API Example
  github:
    name: github
    baseUrl: https://api.github.com
    openApiSpecUrl: https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json
    authentication:
      type: bearer
      config:
        token: ${GITHUB_TOKEN}  # Uses environment variable
    defaultHeaders:
      User-Agent: Universal-OpenAPI-MCP/1.0
      Accept: application/vnd.github.v3+json
    timeout: 30000

  # PetStore Example (for testing)
  petstore:
    name: petstore
    baseUrl: https://petstore.swagger.io/v2
    openApiSpecUrl: https://petstore.swagger.io/v2/swagger.json
    timeout: 15000

  # Custom API with API Key
  myapi:
    name: myapi
    baseUrl: ${MY_API_URL}      # Can use env vars anywhere
    openApiSpecUrl: ${MY_API_URL}/openapi.json
    authentication:
      type: apiKey
      config:
        apiKey: ${MY_API_KEY}
        location: header
        keyName: X-API-Key
    defaultHeaders:
      Content-Type: application/json
    timeout: 60000

  # OAuth2 API Example
  oauth_api:
    name: oauth_api
    baseUrl: https://oauth-api.example.com
    openApiSpecUrl: https://oauth-api.example.com/openapi.json
    authentication:
      type: oauth2
      config:
        clientId: ${OAUTH2_CLIENT_ID}
        clientSecret: ${OAUTH2_CLIENT_SECRET}
        tokenUrl: https://oauth-api.example.com/oauth/token
        scope: read write
        grantType: client_credentials
    timeout: 30000

# Set default API (optional)
defaultApi: github
```

#### Using YAML Configuration:

```bash
# Option 1: Using CONFIG_FILE environment variable
CONFIG_FILE=./config.yaml npm run dev

# Option 2: Using MCP_CONFIG_FILE environment variable
MCP_CONFIG_FILE=./my-config.yaml npm run dev

# Option 3: Set in .env file
echo "CONFIG_FILE=./config.yaml" >> .env
npm run dev
```

### Configuration Priority

1. If `CONFIG_FILE` or `MCP_CONFIG_FILE` is set, it tries to load YAML first
2. If YAML loading fails, it falls back to environment variables
3. If no API is specified with `API_NAME`, it uses the `defaultApi` from YAML
4. YAML configuration takes precedence over environment variables when both exist

## Available Tools

The server provides four main tools for interacting with APIs:

### 1. `api_request`
Make HTTP requests to the configured API with detailed error reporting.

**Parameters:**
- `path`: API endpoint path (e.g., '/users' or '/pet/123')
- `method`: HTTP method (default: 'get')
- `data`: Request body for POST/PUT/PATCH requests
- `params`: Query parameters
- `headers`: Additional headers

**Example:**
```json
{
  "path": "/pet/123",
  "method": "get"
}
```

**Error Response includes:**
- Full request URL
- HTTP method used
- Headers sent (with sensitive data redacted)
- Query parameters
- Request body
- Status code and error message

### 2. `api_paths_list`
Returns a structured JSON object with all API endpoints organized by tags.

**Response format:**
```json
{
  "summary": {
    "totalEndpoints": 20,
    "tags": ["pet", "store", "user"]
  },
  "endpoints": {
    "pet": [
      {
        "path": "/pet",
        "method": "POST",
        "operationId": "addPet",
        "summary": "Add a new pet to the store",
        "parameters": [],
        "requestBody": {
          "required": true,
          "contentTypes": ["application/json", "application/xml"]
        }
      }
    ]
  }
}
```

### 3. `api_paths_info`
Get detailed OpenAPI specification for specific paths.

**Parameters:**
- `path_templates`: Array of path templates (e.g., ["/pet", "/pet/{petId}"])

### 4. `api_spec_info`
Get general information about the API's OpenAPI specification.

**Parameters:**
- `include`: Array of information types to include
  - `info`: API title, version, description
  - `servers`: Available server URLs
  - `tags`: Tag descriptions
  - `paths_summary`: Summary of all paths with operations

## Real-World Examples

### Example 1: GitHub API Setup

**.env file:**
```bash
API_NAME=github
API_BASE_URL=https://api.github.com
OPENAPI_SPEC_URL=https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json
AUTH_TYPE=bearer
BEARER_TOKEN=ghp_your_github_personal_access_token_here
HEADER_ACCEPT=application/vnd.github.v3+json
HEADER_X_GITHUB_API_VERSION=2022-11-28
```

### Example 2: Stripe API Setup

**.env file:**
```bash
API_NAME=stripe
API_BASE_URL=https://api.stripe.com
OPENAPI_SPEC_URL=https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
AUTH_TYPE=bearer
BEARER_TOKEN=sk_test_your_stripe_secret_key_here
HEADER_STRIPE_VERSION=2023-10-16
```

### Example 3: OpenAI API Setup

**.env file:**
```bash
API_NAME=openai
API_BASE_URL=https://api.openai.com
OPENAPI_SPEC_URL=https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml
AUTH_TYPE=bearer
BEARER_TOKEN=sk-your-openai-api-key-here
HEADER_OPENAI_BETA=assistants=v2
```

### Example 4: Custom Internal API

**config.yaml:**
```yaml
apis:
  internal:
    name: internal-api
    baseUrl: https://api.internal.company.com
    openApiSpecPath: ./specs/internal-api.yaml  # Local file
    authentication:
      type: apiKey
      config:
        apiKey: ${INTERNAL_API_KEY}
        location: header
        keyName: X-Company-API-Key
    defaultHeaders:
      X-Request-ID: ${REQUEST_ID}
      X-Client-Version: "2.0"
      X-Tenant-ID: tenant_123
    timeout: 45000

defaultApi: internal
```

## Troubleshooting

### Common Issues and Solutions

1. **"No OpenAPI spec URL or path provided"**
   - Ensure `OPENAPI_SPEC_URL` is set in .env or config.yaml
   - Check that the URL is accessible and returns valid OpenAPI/Swagger spec
   - Try opening the URL in your browser to verify

2. **404 Errors when making requests**
   - Verify `API_BASE_URL` includes the full base path (e.g., `/v2` for PetStore)
   - Check if the path you're requesting exists using `api_paths_list`
   - Ensure paths don't have double slashes (e.g., avoid `//pet`)

3. **Authentication errors**
   - Double-check your API key/token is correct and not expired
   - Verify you're using the correct `AUTH_TYPE` for your API
   - Check authentication type matches API requirements
   - Some APIs require specific header names (check API documentation)
   - For OAuth2, ensure all required fields are set

4. **"Failed to load configuration"**
   - Check YAML syntax is valid (use a YAML validator)
   - Ensure all environment variables referenced with ${} exist
   - Verify file path is correct if using CONFIG_FILE

5. **Timeout errors**
   - Increase `API_TIMEOUT` value (default is 30000ms)
   - Check network connectivity
   - Some APIs have slow endpoints that need longer timeouts

### Debug Mode

To see detailed logs and debug information:
```bash
# The MCP server logs detailed information about requests and errors
npm run dev
```

Check the error messages - they include:
- Exact URL being requested
- Headers being sent (with sensitive data redacted)
- Query parameters
- Request body (for POST/PUT/PATCH)
- Full error stack traces

## Advanced Features

### Using Local OpenAPI Specs

Instead of a URL, you can use a local file:

```yaml
apis:
  local:
    name: local-api
    baseUrl: http://localhost:3000
    openApiSpecPath: ./specs/my-api.yaml  # Local file path
```

### Dynamic Headers

Use environment variables for dynamic headers:

```bash
# In .env
REQUEST_ID=req_${RANDOM_ID}
SESSION_TOKEN=${DYNAMIC_TOKEN}

# These become headers
HEADER_X_REQUEST_ID=${REQUEST_ID}
HEADER_AUTHORIZATION=Session ${SESSION_TOKEN}
```

### Multiple Authentication Methods

Some APIs support multiple auth methods. Configure the one you prefer:

```yaml
# OAuth2 for write operations
authentication:
  type: oauth2
  config:
    clientId: ${CLIENT_ID}
    clientSecret: ${CLIENT_SECRET}
    tokenUrl: https://api.example.com/oauth/token
    scope: read write

# Or use API Key for read-only
# authentication:
#   type: apiKey
#   config:
#     apiKey: ${READ_ONLY_KEY}
#     location: header
#     keyName: X-API-Key
```

### Environment Variable Substitution in YAML

The YAML loader supports environment variable substitution using the `${VAR_NAME}` syntax:

```yaml
apis:
  myapi:
    baseUrl: ${API_BASE_URL}
    authentication:
      type: bearer
      config:
        token: ${API_TOKEN}
    defaultHeaders:
      X-Environment: ${ENVIRONMENT:-development}  # With default value
```

## Development

### Project Structure
```
src/
├── index.ts          # Main MCP server
├── types.ts          # TypeScript type definitions
├── auth.ts           # Authentication handlers
├── client.ts         # HTTP client with error handling
├── spec-utils.ts     # OpenAPI specification utilities
├── validation-error.ts  # Custom error classes
└── config-loader.ts  # Configuration loading logic
```

### Available Scripts

```bash
# Development mode with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run built version
npm start

# Test with FastMCP
npm test

# Inspect MCP capabilities
npm run inspect

# Clean build directory
npm run clean
```

### Building from Source

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Changelog

### Version 1.0.0
- Complete rewrite with @readme/openapi-parser for better validation
- Support for both Swagger 2.0 and OpenAPI 3.x specifications
- Enhanced error messages with detailed request information
- Structured JSON responses for api_paths_list tool
- Improved URL handling for different API structures
- Better TypeScript types throughout
- Comprehensive environment variable support
- YAML configuration with environment variable substitution
- Multiple authentication methods (API Key, Bearer, Basic, OAuth2)
- Custom header support
- FastMCP integration for optimal MCP support
