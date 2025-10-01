/**
 * Validation utilities
 * Input validation helpers
 */

import type { Outcome } from '../types/errors';

/**
 * Validate dataset name format
 *
 * Dataset names must:
 * - Be 1-100 characters
 * - Contain only alphanumeric, underscore, and hyphen
 *
 * @param name - Dataset name to validate
 * @returns Validation outcome
 */
export const validateDatasetName = (name: string): Outcome<string> => {
  if (name.length === 0) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'datasetName',
        message: 'Dataset name cannot be empty',
      },
    };
  }

  if (name.length > 100) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'datasetName',
        message: 'Dataset name too long (max 100 chars)',
      },
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'datasetName',
        message:
          'Dataset name can only contain alphanumeric, underscore, and hyphen',
      },
    };
  }

  return { success: true, value: name };
};

/**
 * Validate organization ID format
 *
 * @param organizationId - Organization ID to validate
 * @returns Validation outcome
 */
export const validateOrganizationId = (
  organizationId: string
): Outcome<string> => {
  if (!organizationId || organizationId.trim().length === 0) {
    return {
      success: false,
      error: {
        error: 'organization_required',
        message: 'Organization ID is required',
      },
    };
  }

  return { success: true, value: organizationId };
};

/**
 * Validate user ID format
 *
 * @param userId - User ID to validate
 * @returns Validation outcome
 */
export const validateUserId = (userId: string): Outcome<string> => {
  if (!userId || userId.trim().length === 0) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'userId',
        message: 'User ID is required',
      },
    };
  }

  return { success: true, value: userId };
};

/**
 * Validate query text
 *
 * @param query - Query text to validate
 * @returns Validation outcome
 */
export const validateQuery = (query: string): Outcome<string> => {
  if (!query || query.trim().length === 0) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'query',
        message: 'Query cannot be empty',
      },
    };
  }

  if (query.length > 10000) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'query',
        message: 'Query too long (max 10000 chars)',
      },
    };
  }

  return { success: true, value: query };
};

/**
 * Validate URL format
 *
 * @param url - URL to validate
 * @returns Validation outcome
 */
export const validateUrl = (url: string): Outcome<string> => {
  try {
    new URL(url);
    return { success: true, value: url };
  } catch {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'url',
        message: 'Invalid URL format',
      },
    };
  }
};

/**
 * Validate content is not empty
 *
 * @param content - Content to validate
 * @returns Validation outcome
 */
export const validateContent = (content: unknown): Outcome<unknown> => {
  if (content === null || content === undefined) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'content',
        message: 'Content cannot be null or undefined',
      },
    };
  }

  return { success: true, value: content };
};
