/**
 * Role management (Provisioning operations)
 * Create roles during tenant provisioning
 */

import {
  type CogneeConfig,
  createRole,
  getRoleByName,
  login,
} from '@lineai/cognee-api';

import type { Outcome } from '../types/errors';
import type { RoleResult } from '../types/provisioning';
import { mapCogneeError } from '../util/errors';

/**
 * Parameters for creating a tenant role during provisioning
 *
 * IMPORTANT: The owner must be a user who belongs to the target tenant.
 * Typically this is the admin user created during tenant provisioning.
 */
export type CreateTenantRoleParams = {
  readonly cogneeUrl: string;
  readonly ownerEmail: string;      // User email (must belong to tenant)
  readonly ownerPassword: string;   // User password
  readonly roleName: string;        // Arbitrary name for the role
};

/**
 * Create a role within a Cognee tenant during provisioning
 *
 * This should be called during tenant setup to create default roles.
 * Role names are arbitrary - you can use any name that makes sense for
 * your application (e.g., 'admin', 'editor', 'viewer', 'data-scientist').
 *
 * The actual permissions are separate and must be assigned after role creation
 * using grantPermissionToRole or grantPermissionsToRole.
 *
 * @param params - Role creation parameters
 * @returns Role details, or error
 *
 * @example
 * ```typescript
 * // During tenant provisioning, after creating admin user
 * const adminUser = await provisionCogneeUser({
 *   tenantId: 'tenant-acme-corp',
 *   userEmail: 'alice@acme.com',
 * });
 *
 * // Use admin's credentials to create default roles
 * const result = await createTenantRole({
 *   cogneeUrl: 'http://localhost:8000',
 *   ownerEmail: adminUser.value.email,
 *   ownerPassword: adminUser.value.password,  // Available during provisioning
 *   roleName: 'editor',
 * });
 *
 * if (result.success) {
 *   // Store roleId in your database
 *   await db.roles.create({
 *     name: 'editor',
 *     cogneeRoleId: result.value.roleId,
 *     tenantId: 'acme-corp',
 *   });
 * }
 * ```
 */
export const createTenantRole = async (
  params: CreateTenantRoleParams
): Promise<Outcome<RoleResult>> => {
  try {
    const config: CogneeConfig = {
      baseUrl: params.cogneeUrl,
    };

    // Authenticate as tenant owner (NOT superuser!)
    // This ensures the role is created in the owner's tenant
    const loginResponse = await login(config, {
      username: params.ownerEmail,
      password: params.ownerPassword,
    });

    // Create config with auth token
    const configWithAuth: CogneeConfig = {
      ...config,
      authToken: loginResponse.access_token,
    };

    // Create role - will be created in authenticated user's tenant
    await createRole(configWithAuth, params.roleName);

    // Retrieve the created role to get its ID
    const role = await getRoleByName(configWithAuth, params.roleName);

    // NO logout - keep token alive for future operations

    const result: RoleResult = {
      roleId: role.id,
      roleName: role.name,
      memberCount: 0,
    };

    return { success: true, value: result };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

