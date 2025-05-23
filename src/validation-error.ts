/**
 * Validation error severity levels
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Interface for validation error details
 */
export interface ValidationErrorDetail {
  path: string;
  message: string;
  severity: ValidationSeverity;
  code?: string;
  expected?: any;
  actual?: any;
}

/**
 * Custom error class for OpenAPI validation failures
 */
export class ValidationError extends Error {
  public readonly errors: ValidationErrorDetail[];
  public readonly specPath?: string;
  public readonly isValidationError = true;

  constructor(message: string, errors: ValidationErrorDetail[] = [], specPath?: string) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.specPath = specPath;
    
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Creates a ValidationError from a SwaggerParser error
   */
  static fromSwaggerParserError(error: any, specPath?: string): ValidationError {
    const errors: ValidationErrorDetail[] = [];
    
    if (error.details && Array.isArray(error.details)) {
      // SwaggerParser provides detailed error information
      for (const detail of error.details) {
        errors.push({
          path: detail.path || 'unknown',
          message: detail.message || 'Validation failed',
          severity: ValidationSeverity.ERROR,
          code: detail.code,
          expected: detail.expected,
          actual: detail.actual
        });
      }
    } else {
      // Single error case
      errors.push({
        path: error.path || 'root',
        message: error.message || 'OpenAPI validation failed',
        severity: ValidationSeverity.ERROR
      });
    }

    return new ValidationError(
      `OpenAPI specification validation failed: ${error.message || 'Unknown error'}`,
      errors,
      specPath
    );
  }

  /**
   * Creates a ValidationError for parsing failures
   */
  static fromParsingError(error: Error, format: 'JSON' | 'YAML', specPath?: string): ValidationError {
    const errors: ValidationErrorDetail[] = [{
      path: 'root',
      message: `Failed to parse ${format}: ${error.message}`,
      severity: ValidationSeverity.ERROR,
      code: 'PARSING_ERROR'
    }];

    return new ValidationError(
      `Failed to parse OpenAPI specification as ${format}`,
      errors,
      specPath
    );
  }

  /**
   * Formats the error message with detailed information
   */
  getDetailedMessage(): string {
    let message = this.message;
    
    if (this.specPath) {
      message += `\nSpec: ${this.specPath}`;
    }

    if (this.errors.length > 0) {
      message += '\n\nValidation Errors:';
      for (const error of this.errors) {
        message += `\n  [${error.severity.toUpperCase()}] ${error.path}: ${error.message}`;
        if (error.expected !== undefined) {
          message += `\n    Expected: ${JSON.stringify(error.expected)}`;
        }
        if (error.actual !== undefined) {
          message += `\n    Actual: ${JSON.stringify(error.actual)}`;
        }
      }
    }

    return message;
  }

  /**
   * Gets errors filtered by severity
   */
  getErrorsBySeverity(severity: ValidationSeverity): ValidationErrorDetail[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Checks if there are any errors (not just warnings)
   */
  hasErrors(): boolean {
    return this.errors.some(error => error.severity === ValidationSeverity.ERROR);
  }

  /**
   * Gets a summary of error counts by severity
   */
  getErrorSummary(): Record<ValidationSeverity, number> {
    const summary = {
      [ValidationSeverity.ERROR]: 0,
      [ValidationSeverity.WARNING]: 0,
      [ValidationSeverity.INFO]: 0
    };

    for (const error of this.errors) {
      summary[error.severity]++;
    }

    return summary;
  }

  /**
   * Converts the error to a plain object for serialization
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      specPath: this.specPath,
      errors: this.errors,
      summary: this.getErrorSummary()
    };
  }
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: any): error is ValidationError {
  return error && typeof error === 'object' && error.isValidationError === true;
}
