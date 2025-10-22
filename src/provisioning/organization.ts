/**
 * Organization provisioning
 * Create Line AI organizations with Cognee tenants
 */

import {
  login,
  createTenant,
  getCurrentUser,
  type CogneeConfig,
} from '@lineai/cognee-api';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';

/**
 * Parameters for provisioning an organization
 */
export type ProvisionOrganizationParams = {
  readonly cogneeUrl: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
  readonly organizationName: string;
};

/**
 * Result of organization provisioning
 */
export type ProvisionOrganizationResult = {
  readonly tenantId: string;
  readonly tenantName: string;
};

/**
 * Provision an organization (tenant) for an existing admin user
 *
 * This creates a tenant owned by the admin user.
 * Call this AFTER provisionAdminUser.
 *
 * @param params - Organization provisioning parameters
 * @returns Tenant ID and name
 *
 * @example
 * ```typescript
 * // Step 1: Create admin user first
 * const adminResult = await provisionAdminUser({
 *   cogneeUrl: 'http://localhost:8000',
 *   superuserCreds: {
 *     username: 'admin@cognee.local',
 *     password: process.env.COGNEE_ADMIN_PASSWORD,
 *   },
 *   adminEmail: 'alice@acme.com',
 * });
 *
 * // Step 2: Create organization with admin credentials
 * const orgResult = await provisionOrganization({
 *   cogneeUrl: 'http://localhost:8000',
 *   adminEmail: adminResult.value.email,
 *   adminPassword: adminResult.value.password,
 *   organizationName: 'acme-corp',
 * });
 *
 * if (orgResult.success) {
 *   await db.organizations.create({
 *     cogneeTenantId: orgResult.value.tenantId,
 *     adminUserId: adminResult.value.userId,
 *   });
 * }
 * ```
 */
export const provisionOrganization = async (
  params: ProvisionOrganizationParams
): Promise<Outcome<ProvisionOrganizationResult>> => {
  try {
    const config: CogneeConfig = {
      baseUrl: params.cogneeUrl,
    };

    // Step 1: Login as the admin user and get access token
    const loginResponse = await login(config, {
      username: params.adminEmail,
      password: params.adminPassword,
    });

    // Create config with auth token for subsequent requests
    const configWithAuth: CogneeConfig = {
      ...config,
      authToken: loginResponse.access_token,
    };

    // Step 2: Admin creates their tenant
    await createTenant(configWithAuth, params.organizationName);

    // Step 3: Get tenant details
    const adminUser = await getCurrentUser(configWithAuth);

    // NO logout - keep token alive for future operations

    const result: ProvisionOrganizationResult = {
      tenantId: adminUser.tenant_id!,
      tenantName: params.organizationName,
    };

    return { success: true, value: result };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
