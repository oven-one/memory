/**
 * Error utilities
 * Map Cognee errors to domain-specific memory errors
 */

import { CogneeError } from '@lineai/cognee-api';
import type { MemoryError } from '../types/errors';

/**
 * Map Cognee API errors to domain-specific memory errors
 *
 * @param error - Error from Cognee API or unknown error
 * @returns Mapped memory error
 */
export const mapCogneeError = (error: unknown): MemoryError => {
  if (error instanceof CogneeError) {
    const cogneeError = error as CogneeError;
    const statusCode = cogneeError.statusCode || 500;
    const message = cogneeError.message;

    // Authentication errors
    if (statusCode === 401) {
      return {
        error: 'authentication_failed',
        message: message || 'Authentication failed',
      };
    }

    // Permission errors
    if (statusCode === 403) {
      return {
        error: 'permission_denied',
        datasetId: extractDatasetId(message),
        requiredPermission: 'read',
      };
    }

    // Not found errors
    if (statusCode === 404) {
      return {
        error: 'dataset_not_found',
        datasetId: extractDatasetId(message),
      };
    }

    // Network errors
    if (statusCode >= 500) {
      return {
        error: 'network_error',
        statusCode,
        message: message || 'Network error occurred',
      };
    }

    // Bad request / validation errors
    if (statusCode === 400 || statusCode === 422) {
      return {
        error: 'invalid_input',
        field: 'unknown',
        message: message || 'Invalid input',
      };
    }

    // Generic network error
    return {
      error: 'network_error',
      statusCode,
      message: message || 'Unknown error occurred',
    };
  }

  // Unknown error type
  if (error instanceof Error) {
    return {
      error: 'unknown_error',
      message: error.message,
    };
  }

  return {
    error: 'unknown_error',
    message: 'An unknown error occurred',
  };
};

/**
 * Extract dataset ID from error message (best effort)
 */
const extractDatasetId = (message: string): string => {
  // Try to extract UUID from message
  const uuidMatch = message.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return uuidMatch ? uuidMatch[0] : 'unknown';
};
