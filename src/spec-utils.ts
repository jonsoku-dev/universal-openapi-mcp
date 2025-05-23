import { dereference, validate } from '@readme/openapi-parser';
import axios from 'axios';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { ApiConfig, ApiInstance, OperationInfo, PathParameter } from './types.js';
import { ValidationError, ValidationSeverity } from './validation-error.js';

/**
 * Result of OpenAPI specification validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  spec?: any; // Use any for flexibility
}

/**
 * HTTP methods supported by OpenAPI
 */
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
type HttpMethod = typeof HTTP_METHODS[number];

/**
 * Type guard to check if an object is a ReferenceObject
 */
function isReference(obj: any): boolean {
  return obj && typeof obj === 'object' && '$ref' in obj;
}

/**
 * Type guard to check if the document is OpenAPI 3.x
 */
function isOpenAPI3(doc: any): boolean {
  return doc && 'openapi' in doc && typeof doc.openapi === 'string' && doc.openapi.startsWith('3.');
}

/**
 * Type guard to check if the document is Swagger 2.0
 */
function isSwagger2(doc: any): boolean {
  return doc && 'swagger' in doc && doc.swagger === '2.0';
}

/**
 * Get operation object from path item
 */
function getOperation(pathItem: any, method: HttpMethod): any {
  return pathItem && pathItem[method];
}

/**
 * Validates an OpenAPI specification using @readme/openapi-parser
 * @param spec - The OpenAPI specification to validate
 * @param specPath - Optional path to the spec for error reporting
 * @returns Promise that resolves to ValidationResult
 */
export async function validateOpenAPISpec(spec: any, specPath?: string): Promise<ValidationResult> {
  try {
    // Validate using the library - it returns a validation result
    const validationResult = await validate(spec);

    if (validationResult.valid) {
      // If valid, parse and dereference to get the full spec
      const parsedSpec = await dereference(spec);

      return {
        isValid: true,
        errors: [],
        warnings: validationResult.warnings.map((w: any) => new ValidationError(
          w.message,
          [{ path: '', message: w.message, severity: ValidationSeverity.WARNING }],
          specPath
        )),
        spec: parsedSpec
      };
    } else {
      return {
        isValid: false,
        errors: validationResult.errors.map((e: any) => new ValidationError(
          e.message,
          [{ path: '', message: e.message, severity: ValidationSeverity.ERROR }],
          specPath
        )),
        warnings: validationResult.warnings.map((w: any) => new ValidationError(
          w.message,
          [{ path: '', message: w.message, severity: ValidationSeverity.WARNING }],
          specPath
        )),
        spec: undefined
      };
    }
  } catch (error) {
    const validationError = ValidationError.fromSwaggerParserError(error, specPath);

    return {
      isValid: false,
      errors: [validationError],
      warnings: [],
      spec: undefined
    };
  }
}

/**
 * Enhanced validation that checks both structure and content
 * @param spec - The OpenAPI specification to validate
 * @param specPath - Optional path to the spec for error reporting
 * @returns Promise that resolves to ValidationResult with warnings and errors
 */
export async function comprehensiveValidation(spec: any, specPath?: string): Promise<ValidationResult> {
  const result = await validateOpenAPISpec(spec, specPath);

  // If basic validation failed, return early
  if (!result.isValid || !result.spec) {
    return result;
  }

  const validSpec = result.spec;

  // Check for OpenAPI 3.x or Swagger 2.0
  if (!isOpenAPI3(validSpec) && !isSwagger2(validSpec)) {
    return {
      ...result,
      warnings: [...result.warnings, new ValidationError(
        'Only OpenAPI 3.x and Swagger 2.0 specifications are supported',
        [{
          path: 'openapi',
          message: 'This tool supports OpenAPI 3.x and Swagger 2.0 specifications',
          severity: ValidationSeverity.WARNING
        }],
        specPath
      )]
    };
  }

  // Additional custom validations
  const warnings: ValidationError[] = [...result.warnings];

  // Check for missing descriptions
  if (validSpec.info && !validSpec.info.description) {
    warnings.push(new ValidationError(
      'API description is missing',
      [{
        path: 'info.description',
        message: 'API description is recommended for better documentation',
        severity: ValidationSeverity.WARNING
      }],
      specPath
    ));
  }

  // Check for missing operation summaries
  if (validSpec.paths) {
    for (const [path, pathItem] of Object.entries(validSpec.paths)) {
      if (!pathItem || isReference(pathItem)) continue;

      for (const method of HTTP_METHODS) {
        const operation = getOperation(pathItem, method);
        if (operation && !operation.summary) {
          warnings.push(new ValidationError(
            `Missing operation summary for ${method.toUpperCase()} ${path}`,
            [{
              path: `paths.${path}.${method}.summary`,
              message: 'Operation summary is recommended for better documentation',
              severity: ValidationSeverity.WARNING
            }],
            specPath
          ));
        }
      }
    }
  }

  return {
    ...result,
    warnings
  };
}

export class SpecLoader {
  /**
   * Load OpenAPI spec from URL or file path
   */
  static async loadSpec(config: ApiConfig): Promise<any> {
    let specContent: any;
    let specSource: string;

    if (config.openApiSpecUrl) {
      specSource = config.openApiSpecUrl;
      // Load from URL
      const response = await axios.get(config.openApiSpecUrl, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json, application/x-yaml, text/yaml, text/plain'
        }
      });
      specContent = response.data;
    } else if (config.openApiSpecPath) {
      specSource = config.openApiSpecPath;
      // Load from file
      const fileContent = await fs.readFile(config.openApiSpecPath, 'utf-8');
      // Try to parse as YAML first, then JSON
      try {
        specContent = yaml.load(fileContent);
      } catch (yamlError) {
        try {
          specContent = JSON.parse(fileContent);
        } catch (jsonError) {
          throw ValidationError.fromParsingError(
            yamlError instanceof Error ? yamlError : new Error('YAML parsing failed'),
            'YAML',
            specSource
          );
        }
      }
    } else {
      throw new Error(`No OpenAPI spec URL or path provided for API: ${config.name}`);
    }

    // Validate and dereference the spec
    const validationResult = await comprehensiveValidation(specContent, specSource);

    if (!validationResult.isValid || !validationResult.spec) {
      // Throw the first validation error
      throw validationResult.errors[0];
    }

    return validationResult.spec;
  }

  /**
   * Create API instance with loaded spec
   */
  static async createApiInstance(config: ApiConfig): Promise<ApiInstance> {
    const spec = await this.loadSpec(config);
    return { config, spec };
  }
}

export class SpecAnalyzer {
  /**
   * Get all paths from the spec
   */
  static getPaths(spec: any): string[] {
    if (!spec || !spec.paths) return [];
    return Object.keys(spec.paths);
  }

  /**
   * Get operation info for a specific path and method
   */
  static getOperationInfo(spec: any, path: string, method: string): OperationInfo | null {
    if (!spec || !spec.paths || !spec.paths[path]) return null;

    const pathItem = spec.paths[path];
    if (!pathItem || isReference(pathItem)) return null;

    const httpMethod = method.toLowerCase() as HttpMethod;
    const operation = getOperation(pathItem, httpMethod);
    if (!operation) return null;

    const parameters: PathParameter[] = [];

    // Process parameters
    if (operation.parameters && Array.isArray(operation.parameters)) {
      for (const param of operation.parameters) {
        if (isReference(param)) continue;

        parameters.push({
          name: param.name,
          required: param.required || false,
          type: this.getSchemaType(param.schema),
          in: param.in as 'path' | 'query' | 'header' | 'cookie',
          description: param.description
        });
      }
    }

    // Also include path-level parameters
    if (pathItem.parameters && Array.isArray(pathItem.parameters)) {
      for (const param of pathItem.parameters) {
        if (isReference(param)) continue;

        // Check if parameter is not already included
        if (!parameters.some(p => p.name === param.name)) {
          parameters.push({
            name: param.name,
            required: param.required || false,
            type: this.getSchemaType(param.schema),
            in: param.in as 'path' | 'query' | 'header' | 'cookie',
            description: param.description
          });
        }
      }
    }

    return {
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      parameters,
      requestBody: operation.requestBody,
      responses: operation.responses
    };
  }

  /**
   * Get all operations grouped by path
   */
  static getAllOperations(spec: any): Record<string, Record<string, OperationInfo>> {
    const operations: Record<string, Record<string, OperationInfo>> = {};

    if (!spec || !spec.paths) return operations;

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || isReference(pathItem)) continue;

      operations[path] = {};

      for (const method of HTTP_METHODS) {
        const operation = getOperation(pathItem, method);
        if (operation) {
          const info = this.getOperationInfo(spec, path, method);
          if (info) {
            operations[path][method] = info;
          }
        }
      }
    }

    return operations;
  }

  /**
   * Helper to get schema type
   */
  private static getSchemaType(schema?: any): string {
    if (!schema) return 'unknown';
    if (isReference(schema)) return 'reference';

    if (schema.type) {
      if (Array.isArray(schema.type)) {
        return schema.type.join(' | ');
      }
      return schema.type;
    }

    // Infer type from other properties
    if (schema.properties) return 'object';
    if (schema.items) return 'array';
    if (schema.oneOf || schema.anyOf || schema.allOf) return 'composite';

    return 'unknown';
  }

  /**
   * Get servers from spec
   */
  static getServers(spec: any): any[] {
    if (!spec) return [];
    return spec.servers || [];
  }

  /**
   * Get API info
   */
  static getApiInfo(spec: any): any {
    if (!spec) return undefined;
    return spec.info;
  }

  /**
   * Get tags
   */
  static getTags(spec: any): any[] {
    if (!spec) return [];
    return spec.tags || [];
  }

  /**
   * Generate path info for specific paths
   */
  static getPathsInfo(spec: any, pathTemplates: string[]): Record<string, any> {
    const info: Record<string, any> = {};

    if (!spec || !spec.paths) return info;

    for (const pathTemplate of pathTemplates) {
      const pathItem = spec.paths[pathTemplate];
      if (pathItem && !isReference(pathItem)) {
        info[pathTemplate] = pathItem;
      }
    }

    return info;
  }
}
