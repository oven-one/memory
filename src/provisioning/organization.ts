/**
 * Organization provisioning
 * Create Line AI organizations with Cognee tenants
 */

import {
  login,
  logout,
  register,
  createTenant,
  getCurrentUser,
  type CogneeConfig,
} from '@lineai/cognee-api';
import type { Credentials } from '../types/session';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';
import { validateEmail } from '../util/validate';
import { generateSecurePassword } from '../util/security';

/**
 * Parameters for provisioning an organization
 */
export type ProvisionOrganizationParams = {
  readonly cogneeUrl: string;
  readonly superuserCreds: Credentials;
  readonly organizationName: string;
  readonly adminEmail: string;
  readonly adminPassword?: string; // Optional: auto-generate if not provided
};

/**
 * Result of organization provisioning
 */
export type ProvisionOrganizationResult = {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly adminUserId: string;
  readonly adminEmail: string;
  readonly adminPassword: string; // Store encrypted!
};

/**
 * Provision a complete organization with admin user and tenant
 *
 * This creates:
 * 1. An admin user (without tenant initially)
 * 2. A tenant owned by that admin user
 * 3. Returns admin credentials and tenant ID for adding more users
 *
 * IMPORTANT: This should be called ONCE when a Line AI organization is created.
 *
 * @param params - Organization provisioning parameters
 * @returns Tenant ID, admin user details, and password
 *
 * @example
 * ```typescript
 * const result = await provisionOrganization({
 *   cogneeUrl: 'http://localhost:8000',
 *   superuserCreds: {
 *     username: 'admin@cognee.local',
 *     password: process.env.COGNEE_ADMIN_PASSWORD,
 *   },
 *   organizationName: 'acme-corp',
 *   adminEmail: 'alice@acme.com',
 * });
 *
 * if (result.success) {
 *   // Store in database
 *   await db.organizations.create({
 *     cogneeTenantId: result.value.tenantId,
 *     adminUserId: result.value.adminUserId,
 *     adminPassword: await encrypt(result.value.adminPassword),
 *   });
 *
 *   // Send password to admin securely
 *   await sendEmail(result.value.adminEmail, result.value.adminPassword);
 * }
 * ```
 */
export const provisionOrganization = async (
  params: ProvisionOrganizationParams
): Promise<Outcome<ProvisionOrganizationResult>> => {
  try {
    // Validate admin email
    const emailValidation = validateEmail(params.adminEmail);
    if (!emailValidation.success) {
      return emailValidation as Outcome<ProvisionOrganizationResult>;
    }

    const config: CogneeConfig = {
      baseUrl: params.cogneeUrl,
    };

    // Generate password if not provided
    const adminPassword = params.adminPassword || generateSecurePassword();

    // Step 1: Login as superuser
    await login(config, params.superuserCreds);

    // Step 2: Register admin user WITHOUT tenant
    await register(config, {
      email: params.adminEmail,
      password: adminPassword,
      // NO tenant_id - user starts without tenant
    });

    // Step 3: Logout superuser
    await logout(config);

    // Step 4: Login as the new admin user
    await login(config, {
      username: params.adminEmail,
      password: adminPassword,
    });

    // Step 5: Admin creates their own tenant
    await createTenant(config, params.organizationName);

    // Step 6: Get admin user details (now has tenant_id populated)
    const adminUser = await getCurrentUser(config);

    // Step 7: Logout admin
    await logout(config);

    const result: ProvisionOrganizationResult = {
      tenantId: adminUser.tenant_id!,
      tenantName: params.organizationName,
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      adminPassword: adminPassword,
    };

    return { success: true, value: result };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
