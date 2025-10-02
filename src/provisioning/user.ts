/**
 * User provisioning
 * Add users to existing Cognee tenants
 */

import {
  login,
  logout,
  register,
  getCurrentUser,
  type CogneeConfig,
} from '@lineai/cognee-api';
import type {
  ProvisionUserParams,
  ProvisionUserResult,
} from '../types/provisioning';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';
import { validateEmail } from '../util/validate';
import { generateSecurePassword } from '../util/security';

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
