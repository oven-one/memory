/**
 * Error types for @lineai/memory
 * Discriminated union error types for type-safe error handling
 */

/**
 * Domain-specific memory errors
 */
export type MemoryError =
  | {
      readonly error: 'authentication_failed';
      readonly message: string;
    }
  | {
      readonly error: 'permission_denied';
      readonly datasetId: string;
      readonly requiredPermission: string;
    }
  | {
      readonly error: 'dataset_not_found';
      readonly datasetId: string;
    }
  | {
      readonly error: 'processing_failed';
      readonly datasetId: string;
      readonly reason: string;
    }
  | {
      readonly error: 'network_error';
      readonly statusCode: number;
      readonly message: string;
    }
  | {
      readonly error: 'invalid_input';
      readonly field: string;
      readonly message: string;
    }
  | {
      readonly error: 'organization_required';
      readonly message: string;
    }
  | {
      readonly error: 'unknown_error';
      readonly message: string;
    };

/**
 * Result type with error handling
 */
export type Outcome<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: MemoryError };
