/**
 * Role management (Runtime operations)
 * Create and manage roles using authenticated user sessions
 */

import {
  addUserToRole as addUserToRoleAPI,
  createRole as createRoleAPI,
  grantDatasetPermissions,
} from '@lineai/cognee-api';

import type { Permission } from '../types/dataset';
import type { Outcome } from '../types/errors';
import type { Session } from '../types/session';
import { mapCogneeError } from '../util/errors';

/**
 * Create a role within the authenticated user's tenant
 *
 * This is a runtime operation - the role is created in the tenant of the
 * authenticated user in the session. Use this when tenant admins want to
 * create custom roles through your application.
 *
 * @param session - Active session (user must belong to target tenant)
 * @param roleName - Name for the new role (arbitrary, e.g., 'data-scientists')
 * @returns Success or error
 *
 * @example
 * ```typescript
 * const session = await createSession({
 *   credentials: { username: 'alice@acme.com', password: '...' },
 *   organizationId: 'acme-corp',
 *   datasetStrategy: { scope: 'user', organizationId: 'acme-corp', userId: 'alice' },
 * });
 *
 * if (session.success) {
 *   // Alice creates a custom role in her tenant
 *   await createRole(session.value, 'data-scientists');
 * }
 * ```
 */
export const createRole = async (
  session: Session,
  roleName: string
): Promise<Outcome<void>> => {
  try {
    // Uses session.config which contains the authenticated user's session
    // Role will be created in that user's tenant
    await createRoleAPI(session.config, roleName);

    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Add a user to a role
 *
 * Both the user and role must belong to the same tenant.
 *
 * @param session - Active session (authenticated as tenant admin/owner)
 * @param userId - Cognee user ID to add to role
 * @param roleId - Cognee role ID
 * @returns Success or error
 *
 * @example
 * ```typescript
 * await addUserToRole(session, 'cognee-user-id-123', 'cognee-role-id-456');
 * ```
 */
export const addUserToRole = async (
  session: Session,
  userId: string,
  roleId: string
): Promise<Outcome<void>> => {
  try {
    await addUserToRoleAPI(session.config, userId, roleId);

    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Grant permissions to a role on specific datasets
 *
 * Assigns dataset permissions (read, write, share, delete) to a role.
 * Users in that role will inherit these permissions.
 *
 * @param session - Active session (must have permission to share datasets)
 * @param roleId - Cognee role ID (principal ID)
 * @param permission - Permission to grant ('read', 'write', 'share', 'delete')
 * @param datasetIds - Array of dataset IDs to grant permission on
 * @returns Success or error
 *
 * @example
 * ```typescript
 * // Grant read permission to 'data-scientists' role on specific datasets
 * await grantPermissionToRole(
 *   session,
 *   'cognee-role-id-123',
 *   'read',
 *   ['dataset-1', 'dataset-2']
 * );
 * ```
 */
export const grantPermissionToRole = async (
  session: Session,
  roleId: string,
  permission: Permission,
  datasetIds: readonly string[]
): Promise<Outcome<void>> => {
  try {
    await grantDatasetPermissions(
      session.config,
      roleId,
      permission,
      datasetIds
    );

    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Grant multiple permissions to a role
 *
 * Convenience function to grant multiple permissions at once.
 *
 * @param session - Active session
 * @param roleId - Cognee role ID
 * @param permissions - Array of permissions to grant
 * @param datasetIds - Array of dataset IDs
 * @returns Success or error
 *
 * @example
 * ```typescript
 * // Grant read and write to editors role
 * await grantPermissionsToRole(
 *   session,
 *   'editor-role-id',
 *   ['read', 'write'],
 *   ['dataset-1', 'dataset-2']
 * );
 * ```
 */
export const grantPermissionsToRole = async (
  session: Session,
  roleId: string,
  permissions: readonly Permission[],
  datasetIds: readonly string[]
): Promise<Outcome<void>> => {
  try {
    for (const permission of permissions) {
      await grantDatasetPermissions(
        session.config,
        roleId,
        permission,
        datasetIds
      );
    }

    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
