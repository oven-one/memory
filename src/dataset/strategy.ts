/**
 * Dataset naming strategies
 * Generate dataset names based on organization-scoped patterns
 */

import type { DatasetStrategy, DatasetContext } from '../types/dataset';
import type { Session } from '../types/session';

/**
 * Generate dataset name from strategy
 *
 * @param strategy - Dataset strategy
 * @param session - Current session
 * @param customContext - Additional context for custom strategies
 * @returns Dataset name
 *
 * @example
 * ```typescript
 * const name = generateDatasetName(
 *   { scope: 'user', organizationId: 'org-123', userId: 'user-456' },
 *   session
 * );
 * // Returns: "organization_org-123_user_user-456_memories"
 * ```
 */
export const generateDatasetName = (
  strategy: DatasetStrategy,
  session: Session,
  customContext?: Record<string, unknown>
): string => {
  switch (strategy.scope) {
    case 'user':
      return `organization_${strategy.organizationId}_user_${strategy.userId}_memories`;

    case 'project':
      return `organization_${strategy.organizationId}_project_${strategy.projectId}_knowledge`;

    case 'organization':
      return `organization_${strategy.organizationId}_shared`;

    case 'custom': {
      const context: DatasetContext = {
        organizationId: session.organizationId,
        userId: session.userId,
        ...customContext,
      };
      return strategy.namingFn(context);
    }
  }
};

/**
 * Validate dataset name format
 *
 * @param name - Dataset name to validate
 * @returns True if valid, false otherwise
 */
export const isValidDatasetName = (name: string): boolean => {
  // Dataset names must be 1-100 characters
  if (name.length === 0 || name.length > 100) {
    return false;
  }

  // Dataset names can only contain alphanumeric, underscore, and hyphen
  return /^[a-zA-Z0-9_-]+$/.test(name);
};

/**
 * Extract organization ID from dataset name
 *
 * @param datasetName - Dataset name
 * @returns Organization ID or null if not found
 */
export const extractOrganizationId = (
  datasetName: string
): string | null => {
  const match = datasetName.match(/^organization_([^_]+)/);
  return match ? match[1] : null;
};

/**
 * Check if dataset belongs to organization
 *
 * @param datasetName - Dataset name
 * @param organizationId - Organization ID to check
 * @returns True if dataset belongs to organization
 */
export const isOrganizationDataset = (
  datasetName: string,
  organizationId: string
): boolean => {
  const extracted = extractOrganizationId(datasetName);
  return extracted === organizationId;
};
