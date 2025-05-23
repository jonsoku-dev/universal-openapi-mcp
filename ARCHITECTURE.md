# Universal OpenAPI MCP Server - Architecture Documentation

## Table of Contents
1. [Overall Architecture](#overall-architecture)
2. [Initialization Flow](#initialization-flow)
3. [API Request Processing Flow](#api-request-processing-flow)
4. [Class Structure](#class-structure)
5. [Component Interactions](#component-interactions)
6. [Environment Variable Configuration Flow](#environment-variable-configuration-flow)
7. [Authentication Processing Flow](#authentication-processing-flow)
8. [File Structure and Roles](#file-structure-and-roles)

---

## Overall Architecture

```mermaid
graph TB
    %% External Components
    User[User/Claude]
    API[External API]
    EnvVars[Environment Variables]
    
    %% Main Application Components
    subgraph "Universal OpenAPI MCP Server"
        subgraph "Entry Point"
            Main[index.ts<br/>Main Entry Point]
        end
        
        subgraph "Core Components"
            Config[Configuration Loader<br/>Parse Environment Variables]
            SpecLoader[SpecLoader<br/>Load OpenAPI Spec]
            SpecAnalyzer[SpecAnalyzer<br/>Parse and Analyze Spec]
            ApiClient[ApiClient<br/>Handle HTTP Requests]
            AuthHandler[AuthHandler<br/>Handle Authentication]
        end
        
        subgraph "MCP Tools"
            Tool1[api_request<br/>Make API Calls]
            Tool2[api_paths_list<br/>List API Paths]
            Tool3[api_paths_info<br/>Path Details]
            Tool4[api_spec_info<br/>Spec Information]
        end
        
        subgraph "FastMCP Framework"
            MCPServer[FastMCP Server<br/>Handle MCP Protocol]
        end
    end
    
    %% Data Flow
    User --> MCPServer
    MCPServer --> Tool1
    MCPServer --> Tool2
    MCPServer --> Tool3
    MCPServer --> Tool4
    
    EnvVars --> Config
    Config --> Main
    Main --> SpecLoader
    SpecLoader --> API
    SpecLoader --> SpecAnalyzer
    SpecAnalyzer --> ApiClient
    AuthHandler --> ApiClient
    ApiClient --> API
    
    Tool1 --> ApiClient
    Tool2 --> SpecAnalyzer
    Tool3 --> SpecAnalyzer
    Tool4 --> SpecAnalyzer
```

---

## Initialization Flow

Shows the initialization process when the application starts.

```mermaid
flowchart TD
    Start([Application Start]) --> LoadEnv[dotenv.config<br/>Load Environment Variables]
    LoadEnv --> CreateServer[Call createServer]
    
    CreateServer --> LoadConfig[Call loadConfiguration]
    LoadConfig --> ParseEnv[loadConfigFromEnv<br/>Parse Environment Variables]
    
    ParseEnv --> CheckRequired{Check Required Variables<br/>OPENAPI_SPEC_URL or<br/>API_BASE_URL}
    CheckRequired -->|Missing| ThrowError[Throw Error<br/>Missing Required Variables]
    CheckRequired -->|Present| BuildConfig[Build ApiConfig Object]
    
    BuildConfig --> ParseAuth[Parse Authentication Settings<br/>Check AUTH_TYPE]
    ParseAuth --> ParseHeaders[Parse Custom Headers<br/>HEADER_* Variables]
    ParseHeaders --> ConfigReady[Configuration Ready]
    
    ConfigReady --> HasSpec{Has OpenAPI<br/>Spec URL?}
    HasSpec -->|Yes| LoadSpec[SpecLoader.createApiInstance<br/>Load and Parse Spec]
    HasSpec -->|No| CreateMinimal[Create Minimal Spec<br/>Basic OpenAPI Structure]
    
    LoadSpec --> SpecSuccess[Spec Load Success]
    CreateMinimal --> SpecSuccess
    SpecSuccess --> CreateClient[Create ApiClient Instance]
    
    CreateClient --> SetupMCP[Setup FastMCP Server]
    SetupMCP --> RegisterTools[Register 4 Tools<br/>api_request, api_paths_list<br/>api_paths_info, api_spec_info]
    
    RegisterTools --> StartServer[Start Server<br/>stdio mode]
    StartServer --> Ready[Server Ready<br/>Waiting for Requests]
    
    ThrowError --> Exit[Process Exit]
```

---

## API Request Processing Flow

Shows the processing flow when a user calls the `api_request` tool.

```mermaid
sequenceDiagram
    participant User as User/Claude
    participant MCP as FastMCP Server
    participant Tool as api_request Tool
    participant Client as ApiClient
    participant Auth as AuthHandler
    participant API as External API
    
    User->>MCP: Call api_request<br/>{path: "/users", method: "get"}
    MCP->>Tool: Execute Tool
    
    Tool->>Tool: Validate Parameters<br/>path, method, data, params, headers
    Tool->>Client: Call request() method
    
    Client->>Client: Build URL<br/>baseUrl + path
    Client->>Client: Set Default Headers<br/>Content-Type, Custom Headers
    
    Client->>Auth: Process Authentication<br/>createAuthHandler()
    Auth->>Auth: Handle by Auth Type<br/>(apiKey/bearer/basic)
    Auth-->>Client: Add Auth to Headers
    
    Client->>Client: Configure Axios<br/>method, url, headers, params
    Client->>API: Send HTTP Request
    
    alt Request Success
        API-->>Client: Response Data
        Client->>Client: Format Response<br/>{status_code, body, headers}
        Client-->>Tool: Return ApiResponse
        Tool->>Tool: Convert to YAML
        Tool-->>MCP: Return YAML String
        MCP-->>User: Final Response
    else Request Failed
        API-->>Client: Error Response
        Client->>Client: Handle Error<br/>Parse AxiosError
        Client-->>Tool: ApiResponse with Error
        Tool->>Tool: Convert Error to YAML
        Tool-->>MCP: Return Error YAML
        MCP-->>User: Error Response
    end
    
    Note over User,API: Entire process is handled as a single transaction
```

---

## Class Structure

Shows the main classes and their relationships in the application.

```mermaid
classDiagram
    class ApiConfig {
        +string name
        +string baseUrl
        +string openApiSpecUrl
        +string openApiSpecPath
        +AuthConfig authentication
        +Record defaultHeaders
        +number timeout
    }
    
    class ApiInstance {
        +ApiConfig config
        +OpenAPIDocument spec
    }
    
    class ApiClient {
        -ApiInstance apiInstance
        +request(options) Promise ApiResponse
        +get(path, params) Promise ApiResponse
        +post(path, data) Promise ApiResponse
        +put(path, data) Promise ApiResponse
        +delete(path, params) Promise ApiResponse
    }
    
    class SpecLoader {
        +loadSpec(config) Promise OpenAPIDocument
        +createApiInstance(config) Promise ApiInstance
    }
    
    class SpecAnalyzer {
        +getPaths(spec) string[]
        +getOperationInfo(spec, path, method) OperationInfo
        +getAllOperations(spec) Record
        +getServers(spec) any[]
        +getApiInfo(spec) any
        +getTags(spec) any[]
        +getPathsInfo(spec, pathTemplates) Record
    }
    
    class AuthHandler {
        <<interface>>
        +apply(config, headers) void
    }
    
    class ApiKeyAuthHandler {
        +apply(config, headers) void
    }
    
    class BearerAuthHandler {
        +apply(config, headers) void
    }
    
    class BasicAuthHandler {
        +apply(config, headers) void
    }
    
    class RequestOptions {
        +string path
        +string method
        +Record data
        +Record params
        +Record headers
        +string contentType
        +Buffer content
    }
    
    class ApiResponse {
        +number status_code
        +any body
        +string error
        +Record headers
    }
    
    %% Relationships
    ApiInstance --> ApiConfig
    ApiInstance --> OpenAPIDocument
    ApiClient --> ApiInstance
    ApiClient --> RequestOptions
    ApiClient --> ApiResponse
    ApiClient --> AuthHandler
    SpecLoader --> ApiConfig
    SpecLoader --> ApiInstance
    SpecAnalyzer --> OpenAPIDocument
    AuthHandler <|-- ApiKeyAuthHandler
    AuthHandler <|-- BearerAuthHandler
    AuthHandler <|-- BasicAuthHandler
```

---

## Component Interactions

Shows how the main components interact with each other.

```mermaid
graph TB
    subgraph "User Interface"
        User[User/Claude]
    end
    
    subgraph "MCP Protocol Layer"
        FastMCP[FastMCP Server<br/>- Register Tools<br/>- Route Requests<br/>- Format Responses]
    end
    
    subgraph "Business Logic Layer"
        subgraph "Tool Handlers"
            T1[api_request<br/>Execute HTTP Requests]
            T2[api_paths_list<br/>List Available Paths]
            T3[api_paths_info<br/>Get Path Details]
            T4[api_spec_info<br/>Get Spec Info]
        end
        
        subgraph "Core Services"
            ApiClient[ApiClient<br/>- Handle HTTP Requests<br/>- Format Responses<br/>- Error Handling]
            SpecAnalyzer[SpecAnalyzer<br/>- Parse Spec<br/>- Analyze Paths<br/>- Extract Metadata]
        end
    end
    
    subgraph "Data Layer"
        subgraph "Configuration Management"
            EnvConfig[Environment Config<br/>- Parse Env Variables<br/>- Validate Config]
            ApiInstance[API Instance<br/>- Config + Spec<br/>- Instance State]
        end
        
        subgraph "External Resources"
            SpecLoader[SpecLoader<br/>- Load Spec<br/>- Handle URL/File]
            AuthHandler[AuthHandler<br/>- Process Auth<br/>- Modify Headers]
        end
    end
    
    subgraph "External Systems"
        ExtAPI[External API<br/>Actual API Endpoints]
        SpecSource[OpenAPI Spec<br/>URL or File]
    end
    
    %% User Interactions
    User --> FastMCP
    
    %% MCP to Tools
    FastMCP --> T1
    FastMCP --> T2
    FastMCP --> T3
    FastMCP --> T4
    
    %% Tool Dependencies
    T1 --> ApiClient
    T2 --> SpecAnalyzer
    T3 --> SpecAnalyzer
    T4 --> SpecAnalyzer
    
    %% Service Dependencies
    ApiClient --> AuthHandler
    ApiClient --> ApiInstance
    SpecAnalyzer --> ApiInstance
    
    %% Data Dependencies
    ApiInstance --> EnvConfig
    ApiInstance --> SpecLoader
    
    %% External Dependencies
    SpecLoader --> SpecSource
    ApiClient --> ExtAPI
    
    %% Data Flow Arrows
    EnvConfig -.->|Config Data| ApiInstance
    SpecLoader -.->|Spec Data| ApiInstance
    ApiInstance -.->|Instance| ApiClient
    ApiInstance -.->|Spec| SpecAnalyzer
    AuthHandler -.->|Auth Info| ApiClient
```

---

## Environment Variable Configuration Flow

Shows how environment variables are parsed and used.

```mermaid
flowchart TD
    EnvFile[.env File] --> DotEnv[dotenv.config]
    DotEnv --> ProcessEnv[process.env]
    
    ProcessEnv --> LoadConfig[loadConfigFromEnv Function]
    
    LoadConfig --> Required{Check Required Variables}
    Required --> CheckSpec[OPENAPI_SPEC_URL]
    Required --> CheckBase[API_BASE_URL]
    
    CheckSpec --> SpecExists{Exists?}
    CheckBase --> BaseExists{Exists?}
    
    SpecExists -->|Yes| UseSpec[Use Spec URL]
    BaseExists -->|Yes| UseBase[Use Base URL]
    SpecExists -->|No| CheckBase
    BaseExists -->|No| ErrorCheck{Both Missing?}
    
    ErrorCheck -->|Yes| ThrowError[Error: Missing Required Variables]
    ErrorCheck -->|No| BuildConfig[Build ApiConfig]
    
    UseSpec --> BuildConfig
    UseBase --> BuildConfig
    
    BuildConfig --> BasicConfig[Basic Configuration<br/>name = API_NAME or api<br/>baseUrl = API_BASE_URL<br/>timeout = API_TIMEOUT or 30000]
    
    BasicConfig --> AuthConfig[Parse Authentication Settings]
    AuthConfig --> CheckAuthType{Check AUTH_TYPE}
    
    CheckAuthType -->|apiKey| ApiKeyConfig[API Key Settings<br/>apiKey = API_KEY<br/>location = API_KEY_LOCATION<br/>keyName = API_KEY_NAME]
    
    CheckAuthType -->|bearer| BearerConfig[Bearer Token Settings<br/>token = AUTH_TOKEN or BEARER_TOKEN]
    
    CheckAuthType -->|basic| BasicAuthConfig[Basic Auth Settings<br/>username = AUTH_USERNAME<br/>password = AUTH_PASSWORD]
    
    CheckAuthType -->|none| NoAuth[No Authentication]
    
    ApiKeyConfig --> HeaderConfig[Parse Header Settings]
    BearerConfig --> HeaderConfig
    BasicAuthConfig --> HeaderConfig
    NoAuth --> HeaderConfig
    
    HeaderConfig --> ScanHeaders[Scan HEADER_* Variables]
    ScanHeaders --> ParseHeaders[Transform Header Names<br/>HEADER_USER_AGENT to user-agent]
    ParseHeaders --> DefaultHeaders[Add Default Headers<br/>user-agent: Universal-OpenAPI-MCP/1.0]
    
    DefaultHeaders --> FinalConfig[Final ApiConfig Complete]
```

---

## Authentication Processing Flow

Shows how different authentication methods are processed.

```mermaid
flowchart TD
    Start[HTTP Request Start] --> CreateAuth[Call createAuthHandler]
    CreateAuth --> CheckType{Check Auth Type}
    
    CheckType -->|apiKey| ApiKeyHandler[ApiKeyAuthHandler]
    CheckType -->|bearer| BearerHandler[BearerAuthHandler]
    CheckType -->|basic| BasicHandler[BasicAuthHandler]
    CheckType -->|none| NoAuth[No Authentication]
    
    subgraph "API Key Authentication"
        ApiKeyHandler --> CheckLocation{Check Location}
        CheckLocation -->|header| AddApiKeyHeader[Add to Headers<br/>headers[keyName] = apiKey]
        CheckLocation -->|query| AddApiKeyQuery[Add to Query<br/>params[keyName] = apiKey]
        
        AddApiKeyHeader --> ApiKeyDone[API Key Complete]
        AddApiKeyQuery --> ApiKeyDone
    end
    
    subgraph "Bearer Token Authentication"
        BearerHandler --> AddBearer[Add Authorization Header<br/>Authorization: Bearer token]
        AddBearer --> BearerDone[Bearer Complete]
    end
    
    subgraph "Basic Authentication"
        BasicHandler --> EncodeBasic[Base64 Encode<br/>btoa(username:password)]
        EncodeBasic --> AddBasic[Add Authorization Header<br/>Authorization: Basic encoded]
        AddBasic --> BasicDone[Basic Complete]
    end
    
    ApiKeyDone --> ApplyAuth[Apply Authentication]
    BearerDone --> ApplyAuth
    BasicDone --> ApplyAuth
    NoAuth --> ApplyAuth
    
    ApplyAuth --> RequestReady[Request Ready]
    RequestReady --> SendRequest[Send HTTP Request]
    
    SendRequest --> Success{Response Success?}
    Success -->|Yes| FormatSuccess[Format Success Response<br/>{status_code, body, headers}]
    Success -->|No| FormatError[Format Error Response<br/>{status_code, error, headers}]
    
    FormatSuccess --> End[Complete]
    FormatError --> End
```

---

## File Structure and Roles

```mermaid
graph TB
    subgraph "Project Root"
        Root[universal-openapi-mcp/]
    end
    
    subgraph "Source Code"
        Src[src/]
        
        subgraph "Core Files"
            Index[index.ts<br/>Main Entry Point<br/>Server Initialization<br/>Tool Registration<br/>FastMCP Setup]
            
            Types[types.ts<br/>TypeScript Type Definitions<br/>ApiConfig, ApiInstance<br/>RequestOptions, ApiResponse<br/>Interfaces]
            
            Client[client.ts<br/>ApiClient Class<br/>HTTP Request Handling<br/>Apply Authentication<br/>Response Formatting]
            
            SpecUtils[spec-utils.ts<br/>SpecLoader Class<br/>SpecAnalyzer Class<br/>OpenAPI Spec Processing<br/>Metadata Extraction]
            
            Auth[auth.ts<br/>AuthHandler Interface<br/>Authentication Handlers<br/>Auth Factory Function]
        end
    end
    
    subgraph "Configuration Files"
        Config[Configuration Files]
        
        EnvExample[.env.example<br/>Environment Variable Examples<br/>Configuration Guide<br/>Various API Examples]
        
        PackageJson[package.json<br/>Project Metadata<br/>Dependency Management<br/>Script Commands]
        
        TsConfig[tsconfig.json<br/>TypeScript Configuration<br/>Compiler Options<br/>Module Resolution]
    end
    
    subgraph "Build Output"
        Dist[dist/<br/>Compiled JavaScript<br/>Production Files<br/>npm run build Output]
    end
    
    subgraph "Documentation"
        Docs[Documentation]
        Readme[README.md<br/>Usage Guide<br/>Installation<br/>Examples]
        
        Architecture[ARCHITECTURE.md<br/>Architecture Documentation<br/>Mermaid Diagrams<br/>Detailed Explanations]
    end
    
    %% Relationships
    Root --> Src
    Root --> Config
    Root --> Dist
    Root --> Docs
    
    Src --> Index
    Src --> Types
    Src --> Client
    Src --> SpecUtils
    Src --> Auth
    
    Config --> EnvExample
    Config --> PackageJson
    Config --> TsConfig
    
    Docs --> Readme
    Docs --> Architecture
    
    %% Dependencies
    Index -.->|imports| Types
    Index -.->|imports| Client
    Index -.->|imports| SpecUtils
    Client -.->|imports| Types
    Client -.->|imports| Auth
    SpecUtils -.->|imports| Types
    
    %% Build Process
    Src -.->|tsc build| Dist
    TsConfig -.->|config| Dist
```

---

## Key Concepts

### 1. **MCP (Model Context Protocol)**
- Protocol that allows AI models like Claude to interact with external tools
- FastMCP is a framework that makes it easy to implement this protocol

### 2. **OpenAPI Specification**
- Standardized format for describing REST API structure
- Defines API endpoints, parameters, response formats, etc.

### 3. **Environment Variable Configuration**
- Design that allows connecting to different APIs without code changes
- Separates security information (API keys, etc.) from code

### 4. **Authentication Methods**
- **API Key**: Passed via header or query parameter
- **Bearer Token**: Included in Authorization header
- **Basic Auth**: Username:password encoded in Base64

### 5. **Type Safety**
- Using TypeScript to detect errors at compile time
- Contract definitions through interfaces and types

This architecture follows the **Single Responsibility Principle** and **Dependency Injection** pattern, where each component has a clear role and can be easily tested and extended.
