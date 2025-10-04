/**
 * Provisioning Examples
 *
 * This file demonstrates how to properly provision Cognee tenants, users,
 * and roles for Line AI organizations.
 *
 * These are admin/superuser operations that should be called when:
 * 1. Creating a new Line AI organization (provision tenant)
 * 2. Adding a user to an organization (provision user)
 * 3. Creating user groups/roles (create roles)
 */

import {
  provisionAdminUser,
  provisionOrganization,
  provisionUser,
  createTenantRole,
  createSession,
  remember,
  search,
  createRole,
  addUserToRole,
  type Session,
} from '@lineai/memory';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// =============================================================================
// Example 1: Complete Organization Onboarding
// =============================================================================

/**
 * Complete flow for onboarding a new organization with admin user
 */
export async function onboardOrganization(data: {
  organizationName: string;
  organizationSlug: string;
  adminEmail: string;
  cogneeUrl: string;
  superuserUsername: string;
  superuserPassword: string;
}) {
  console.log(`Onboarding organization: ${data.organizationName}`);

  // Step 1: Create admin user account
  console.log('Step 1: Creating admin user account...');
  const adminResult = await provisionAdminUser({
    cogneeUrl: data.cogneeUrl,
    superuserCreds: {
      username: data.superuserUsername,
      password: data.superuserPassword,
    },
    adminEmail: data.adminEmail,
  });

  if (!adminResult.success) {
    throw new Error(`Failed to create admin user: ${adminResult.error.message}`);
  }

  console.log(`✓ Admin user created: ${adminResult.value.userId}`);

  // Step 2: Store admin user credentials securely BEFORE creating organization
  const encryptedPassword = encryptPassword(adminResult.value.password);
  const admin = {
    id: `user-${Date.now()}`,
    email: adminResult.value.email,
    role: 'admin',
    cogneeUserId: adminResult.value.userId,
    cogneePassword: encryptedPassword,
  };
  // await db.users.create(admin);
  console.log(`✓ Admin credentials stored securely`);

  // Step 3: Create organization (tenant) using admin credentials
  console.log('Step 2: Creating organization tenant...');
  const orgResult = await provisionOrganization({
    cogneeUrl: data.cogneeUrl,
    adminEmail: adminResult.value.email,
    adminPassword: adminResult.value.password,
    organizationName: data.organizationSlug,
  });

  if (!orgResult.success) {
    throw new Error(`Failed to create organization: ${orgResult.error.message}`);
  }

  console.log(`✓ Organization tenant created: ${orgResult.value.tenantId}`);

  // Step 4: Store organization in database
  const org = {
    id: `org-${Date.now()}`,
    name: data.organizationName,
    slug: data.organizationSlug,
    cogneeTenantId: orgResult.value.tenantId,
  };
  // await db.organizations.create(org);
  console.log(`✓ Organization created in database: ${org.id}`);

  // Link admin to organization
  admin.organizationId = org.id;
  // await db.users.update(admin.id, { organizationId: org.id });

  // IMPORTANT: Return password securely (e.g., send via email)
  return {
    organization: org,
    adminUser: admin,
    adminPassword: adminResult.value.password, // Send this securely!
  };
}

// =============================================================================
// Example 2: Invite User to Organization
// =============================================================================

/**
 * Invite a new user to an existing organization
 */
export async function inviteUserToOrganization(data: {
  userEmail: string;
  organizationId: string;
  adminEmail: string;
  adminPassword: string; // Decrypted password of admin user
  cogneeUrl: string;
}) {
  console.log(`Inviting user: ${data.userEmail}`);

  // Provision user in Cognee (admin adds user to their tenant)
  const userResult = await provisionUser({
    cogneeUrl: data.cogneeUrl,
    adminEmail: data.adminEmail,
    adminPassword: data.adminPassword,
    userEmail: data.userEmail,
  });

  if (!userResult.success) {
    throw new Error(`Failed to provision user: ${userResult.error.message}`);
  }

  console.log(`✓ User provisioned: ${userResult.value.userId}`);

  // Store user in database
  const encryptedPassword = encryptPassword(userResult.value.password);
  const user = {
    id: `user-${Date.now()}`,
    email: data.userEmail,
    organizationId: data.organizationId,
    role: 'member',
    cogneeUserId: userResult.value.userId,
    cogneePassword: encryptedPassword,
  };
  // await db.users.create(user);
  console.log(`✓ User created in database: ${user.id}`);

  // Send invitation email with password
  console.log(`✓ Send invitation email to ${data.userEmail} with password: ${userResult.value.password}`);

  return {
    user,
    password: userResult.value.password, // Send via secure channel!
  };
}

// =============================================================================
// Example 3: Create Default Roles During Provisioning
// =============================================================================

/**
 * Create default roles for a tenant during provisioning
 * Uses the admin user's credentials (available during provisioning)
 */
export async function createDefaultRoles(data: {
  organizationId: string;
  cogneeTenantId: string;
  adminEmail: string;
  adminPassword: string; // Available right after provisioning
  cogneeUrl: string;
}) {
  console.log(`Creating default roles for tenant: ${data.cogneeTenantId}`);

  const defaultRoles = ['admin', 'editor', 'viewer'];

  for (const roleName of defaultRoles) {
    const roleResult = await createTenantRole({
      cogneeUrl: data.cogneeUrl,
      ownerEmail: data.adminEmail,      // Use admin's credentials
      ownerPassword: data.adminPassword, // Available during provisioning
      roleName: roleName,
    });

    if (!roleResult.success) {
      console.error(`Failed to create role ${roleName}: ${roleResult.error.message}`);
      continue;
    }

    console.log(`✓ Role created: ${roleName}`);

    // Store in database
    const role = {
      id: `role-${Date.now()}`,
      name: roleName,
      organizationId: data.organizationId,
      cogneeRoleId: roleResult.value.roleId,
      tenantId: data.cogneeTenantId,
    };
    // await db.roles.create(role);
    console.log(`✓ Stored role in database: ${role.id}`);
  }

  return { success: true };
}

// =============================================================================
// Example 4: Full User Session Flow
// =============================================================================

/**
 * Create a session for a provisioned user and perform memory operations
 */
export async function userSessionExample(data: {
  userId: string;
  userEmail: string;
  encryptedCogneePassword: string;
  organizationId: string;
  cogneeUrl: string;
}) {
  console.log(`Creating session for user: ${data.userEmail}`);

  // Step 1: Decrypt Cognee password
  const cogneePassword = decryptPassword(data.encryptedCogneePassword);

  // Step 2: Create session
  const sessionResult = await createSession({
    cogneeUrl: data.cogneeUrl,
    credentials: {
      username: data.userEmail,
      password: cogneePassword,
    },
    organizationId: data.organizationId,
    datasetStrategy: {
      scope: 'user',
      organizationId: data.organizationId,
      userId: data.userId,
    },
  });

  if (!sessionResult.success) {
    throw new Error(`Failed to create session: ${sessionResult.error.message}`);
  }

  const session: Session = sessionResult.value;
  console.log(`✓ Session created for user: ${session.userId}`);

  // Step 3: Perform memory operations
  console.log('Remembering content...');
  const rememberResult = await remember(session, {
    type: 'text',
    text: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
  });

  if (rememberResult.success) {
    console.log(`✓ Content remembered: ${rememberResult.value.id}`);
  }

  // Step 4: Search memories
  console.log('Searching memories...');
  const searchResult = await search(session, {
    text: 'What is TypeScript?',
  });

  if (searchResult.success && searchResult.value.found) {
    console.log(`✓ Found ${searchResult.value.results.length} results`);
    searchResult.value.results.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.content.substring(0, 100)}...`);
    });
  }

  return session;
}

// =============================================================================
// Example 5: Multi-User Collaboration
// =============================================================================

/**
 * Demonstrate project-scoped datasets with multiple users
 */
export async function multiUserCollaborationExample(data: {
  projectId: string;
  organizationId: string;
  users: Array<{
    email: string;
    encryptedPassword: string;
    userId: string;
  }>;
  cogneeUrl: string;
}) {
  console.log(`Setting up collaboration for project: ${data.projectId}`);

  const sessions: Session[] = [];

  // Create sessions for all users with project-scoped strategy
  for (const user of data.users) {
    const password = decryptPassword(user.encryptedPassword);

    const sessionResult = await createSession({
      cogneeUrl: data.cogneeUrl,
      credentials: {
        username: user.email,
        password: password,
      },
      organizationId: data.organizationId,
      datasetStrategy: {
        scope: 'project',
        organizationId: data.organizationId,
        projectId: data.projectId,
      },
    });

    if (sessionResult.success) {
      sessions.push(sessionResult.value);
      console.log(`✓ Session created for ${user.email}`);
    }
  }

  // User 1 adds project documentation
  console.log('\nUser 1 adding project documentation...');
  await remember(sessions[0], {
    type: 'text',
    text: 'Project Requirements: Build a multi-tenant memory system with RBAC',
  });

  // User 2 adds technical notes
  console.log('User 2 adding technical notes...');
  await remember(sessions[1], {
    type: 'text',
    text: 'Technical Note: Use PostgreSQL for metadata, Neo4j for graph',
  });

  // Both users can search the shared project dataset
  console.log('\nUser 1 searching project knowledge...');
  const searchResult1 = await search(sessions[0], {
    text: 'What are the project requirements?',
  });

  console.log('User 2 searching project knowledge...');
  const searchResult2 = await search(sessions[1], {
    text: 'What database should we use?',
  });

  console.log('✓ Multi-user collaboration setup complete');

  return { sessions, searchResult1, searchResult2 };
}

// =============================================================================
// Utility Functions: Encryption/Decryption
// =============================================================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || randomBytes(32).toString('hex');
const algorithm = 'aes-256-gcm';

/**
 * Encrypt Cognee password for storage
 * IMPORTANT: Always encrypt passwords before storing in database!
 */
export function encryptPassword(password: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt Cognee password for authentication
 */
export function decryptPassword(encryptedPassword: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const [ivHex, authTagHex, encrypted] = encryptedPassword.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// =============================================================================
// Example Usage
// =============================================================================

/**
 * Run all examples
 */
async function runExamples() {
  const config = {
    cogneeUrl: process.env.COGNEE_URL || 'http://localhost:8000',
    superuserUsername: process.env.COGNEE_ADMIN_USERNAME || 'admin@cognee.local',
    superuserPassword: process.env.COGNEE_ADMIN_PASSWORD || 'admin',
  };

  console.log('='.repeat(80));
  console.log('Example 1: Onboard Organization');
  console.log('='.repeat(80));

  try {
    const onboarding = await onboardOrganization({
      organizationName: 'Acme Corporation',
      organizationSlug: 'acme-corp',
      adminEmail: 'alice@acme.com',
      ...config,
    });

    console.log('\n✓ Onboarding complete!');
    console.log(`  Organization: ${onboarding.organization.name}`);
    console.log(`  Admin email: ${onboarding.adminUser.email}`);
    console.log(`  Admin password: ${onboarding.adminPassword} (send securely!)`);

    console.log('\n' + '='.repeat(80));
    console.log('Example 2: Invite User');
    console.log('='.repeat(80));

    const invitation = await inviteUserToOrganization({
      userEmail: 'bob@acme.com',
      organizationId: onboarding.organization.id,
      adminEmail: onboarding.adminUser.email,
      adminPassword: onboarding.adminPassword, // Plaintext password available from provisioning
      cogneeUrl: config.cogneeUrl,
    });

    console.log('\n✓ User invited!');
    console.log(`  User email: ${invitation.user.email}`);
    console.log(`  User password: ${invitation.password} (send securely!)`);

    console.log('\n' + '='.repeat(80));
    console.log('Example 3: Create Default Roles');
    console.log('='.repeat(80));

    await createDefaultRoles({
      organizationId: onboarding.organization.id,
      cogneeTenantId: onboarding.organization.cogneeTenantId,
      adminEmail: onboarding.adminUser.email,
      adminPassword: onboarding.adminPassword,  // Available from provisioning
      cogneeUrl: config.cogneeUrl,
    });

    console.log('\n✓ Default roles created!');

    console.log('\n' + '='.repeat(80));
    console.log('Example 4: User Session');
    console.log('='.repeat(80));

    await userSessionExample({
      userId: onboarding.adminUser.id,
      userEmail: onboarding.adminUser.email,
      encryptedCogneePassword: onboarding.adminUser.cogneePassword,
      organizationId: onboarding.organization.id,
      cogneeUrl: config.cogneeUrl,
    });

    console.log('\n' + '='.repeat(80));
    console.log('All examples completed successfully!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Uncomment to run examples
// runExamples().catch(console.error);