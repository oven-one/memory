/**
 * Provisioning types for @lineai/memory
 * Types for provisioning Cognee tenants, users, and roles
 */

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
