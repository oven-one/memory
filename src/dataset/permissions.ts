/**
 * Dataset permissions
 * Share datasets and manage access control
 */

import { grantDatasetPermissions } from '@lineai/cognee-api';
import type { Session } from '../types/session';
import type { Permission } from '../types/dataset';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';

/**
 * Share dataset with another user
 *
 * @param session - Active session
 * @param datasetId - Dataset ID to share
 * @param userId - User ID to share with
 * @param permissions - Array of permissions to grant
 * @returns Success or error
 *
 * @example
 * ```typescript
 * await shareDataset(session, 'dataset-id-123', 'user-456', ['read', 'write']);
 * ```
 */
export const shareDataset = async (
  session: Session,
  datasetId: string,
  userId: string,
  permissions: readonly Permission[]
): Promise<Outcome<void>> => {
  try {
    // Grant each permission
    for (const permission of permissions) {
      await grantDatasetPermissions(
        session.config,
        userId,
        permission,
        [datasetId]
      );
    }

    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Revoke dataset access
 *
 * Note: Cognee API doesn't have a direct revoke endpoint,
 * so this is a placeholder that would need backend support
 *
 * @param session - Active session
 * @param datasetId - Dataset ID
 * @param userId - User ID to revoke access from
 * @returns Success or error
 */
export const revokeAccess = async (
  session: Session,
  datasetId: string,
  userId: string
): Promise<Outcome<void>> => {
  // TODO: Implement when Cognee API supports revoke
  // For now, return an error indicating this is not supported
  console.log(`Revoke access not implemented for dataset ${datasetId} and user ${userId}`, session);
  return {
    success: false,
    error: {
      error: 'invalid_input',
      field: 'operation',
      message: 'Revoke access is not yet supported by the Cognee API',
    },
  };
};
