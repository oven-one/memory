/**
 * Provisioning types for @lineai/memory
 * Types for provisioning Cognee tenants, users, and roles
 */

import type { Credentials } from './session';

/**
 * Parameters for provisioning an admin user
 */
export type ProvisionAdminUserParams = {
  readonly cogneeUrl: string;
  readonly superuserCreds: Credentials;
  readonly adminEmail: string;
  readonly adminPassword?: string; // Optional: auto-generate if not provided
};

/**
 * Result of admin user provisioning
 */
export type ProvisionAdminUserResult = {
  readonly userId: string;
  readonly email: string;
  readonly password: string; // Store encrypted!
};

/**
 * Parameters for provisioning a Cognee user
 */
export type ProvisionUserParams = {
  readonly cogneeUrl: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
  readonly userEmail: string;
  readonly password?: string; // Optional: if not provided, will generate secure password
};

/**
 * Result of user provisioning
 */
export type ProvisionUserResult = {
  readonly userId: string;
  readonly email: string;
  readonly password: string; // Generated or provided password (store encrypted!)
  readonly tenantId: string;
};

/**
 * Parameters for creating a role within a tenant
 */
export type RoleParams = {
  readonly roleName: string;
  readonly members?: readonly string[]; // Optional: user IDs to add to role
};

/**
 * Result of role creation
 */
export type RoleResult = {
  readonly roleId: string;
  readonly roleName: string;
  readonly memberCount: number;
};
