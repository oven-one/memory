/**
 * User provisioning
 * Add users to existing Cognee tenants and create admin users
 */

import {
  type CogneeConfig,
  getCurrentUser,
  login,
  logout,
  register,
} from '@lineai/cognee-api';

import type { Outcome } from '../types/errors';
import type {
  ProvisionAdminUserParams,
  ProvisionAdminUserResult,
  ProvisionUserParams,
  ProvisionUserResult,
} from '../types/provisioning';
import { mapCogneeError } from '../util/errors';
import { generateSecurePassword } from '../util/security';
import { validateEmail } from '../util/validate';

/**
 * Provision a user in an existing Cognee tenant
 *
 * This should be called when adding a Line AI user to an organization.
 * The admin user credentials are used to create the user in the admin's tenant.
 *
 * @param params - User provisioning parameters
 * @returns User ID, email, and password, or error
 *
 * @example
 * ```typescript
 * // After provisioning organization, use admin credentials
 * const result = await provisionUser({
 *   cogneeUrl: 'http://localhost:8000',
 *   adminEmail: 'alice@acme.com',
 *   adminPassword: await decrypt(org.adminPassword),
 *   userEmail: 'bob@acme.com',
 * });
 *
 * if (result.success) {
 *   await db.users.create({
 *     email: result.value.email,
 *     cogneeUserId: result.value.userId,
 *     cogneePassword: await encrypt(result.value.password),
 *   });
 * }
 * ```
 */
export const provisionUser = async (
  params: ProvisionUserParams
): Promise<Outcome<ProvisionUserResult>> => {
  try {
    // Validate email
    const emailValidation = validateEmail(params.userEmail);
    if (!emailValidation.success) {
      return emailValidation as Outcome<ProvisionUserResult>;
    }

    const config: CogneeConfig = {
      baseUrl: params.cogneeUrl,
    };

    // Generate password if not provided
    const password = params.password || generateSecurePassword();

    // Step 1: Login as admin (who owns the tenant)
    await login(config, {
      username: params.adminEmail,
      password: params.adminPassword,
    });

    // Step 2: Get admin's tenant_id
    const admin = await getCurrentUser(config);
    const tenantId = admin.tenant_id!;

    // Step 3: Register new user WITH admin's tenant_id
    const newUser = await register(config, {
      email: params.userEmail,
      password: password,
      tenant_id: tenantId,
    });

    // Step 4: Logout admin
    await logout(config);

    const result: ProvisionUserResult = {
      userId: newUser.id,
      email: newUser.email,
      password: password, // IMPORTANT: Store this encrypted!
      tenantId: newUser.tenant_id!,
    };

    return { success: true, value: result };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Provision an admin user without a tenant
 *
 * This creates the admin user account that will later create and own a tenant.
 * Call this BEFORE provisionOrganization.
 *
 * @param params - Admin user provisioning parameters
 * @returns User ID, email, and generated password
 *
 * @example
 * ```typescript
 * // Step 1: Create admin user
 * const adminResult = await provisionAdminUser({
 *   cogneeUrl: 'http://localhost:8000',
 *   superuserCreds: {
 *     username: 'admin@cognee.local',
 *     password: process.env.COGNEE_ADMIN_PASSWORD,
 *   },
 *   adminEmail: 'alice@acme.com',
 * });
 *
 * if (adminResult.success) {
 *   // Store credentials securely
 *   await db.users.create({
 *     email: adminResult.value.email,
 *     cogneeUserId: adminResult.value.userId,
 *     cogneePassword: await encrypt(adminResult.value.password),
 *   });
 *
 *   // Step 2: Use those credentials to create organization
 *   const orgResult = await provisionOrganization({
 *     cogneeUrl: 'http://localhost:8000',
 *     adminEmail: adminResult.value.email,
 *     adminPassword: adminResult.value.password,
 *     organizationName: 'acme-corp',
 *   });
 * }
 * ```
 */
export const provisionAdminUser = async (
  params: ProvisionAdminUserParams
): Promise<Outcome<ProvisionAdminUserResult>> => {
  try {
    // Validate email
    const emailValidation = validateEmail(params.adminEmail);
    if (!emailValidation.success) {
      return emailValidation as Outcome<ProvisionAdminUserResult>;
    }

    const config: CogneeConfig = {
      baseUrl: params.cogneeUrl,
    };

    // Generate password if not provided
    const password = params.adminPassword || generateSecurePassword();

    // Step 1: Login as superuser
    await login(config, params.superuserCreds);

    // Step 2: Register admin user WITHOUT tenant
    const newUser = await register(config, {
      email: params.adminEmail,
      password: password,
      // NO tenant_id - user starts without tenant
    });

    // Step 3: Logout superuser
    await logout(config);

    const result: ProvisionAdminUserResult = {
      userId: newUser.id,
      email: newUser.email,
      password: password, // IMPORTANT: Store this encrypted!
    };

    return { success: true, value: result };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
