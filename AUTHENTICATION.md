# Authentication & Multi-Tenant Architecture

This guide explains how `@lineai/memory` integrates with Cognee's multi-tenant permission system.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Entity Mapping](#entity-mapping)
- [Provisioning Workflow](#provisioning-workflow)
- [Security Best Practices](#security-best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Overview

Cognee uses a sophisticated **Role-Based Access Control (RBAC)** system with multi-tenant isolation. `@lineai/memory` is designed to leverage this system correctly by mapping Line AI's organizational structure to Cognee's permission model.

### Key Concepts

- **Tenants**: Organizations in Cognee. Each tenant has isolated data.
- **Users**: Individual accounts belonging to a single tenant.
- **Roles**: Groups of users within a tenant for permission management.
- **Principals**: A union type of Users, Tenants, and Roles used for permissions.
- **Datasets**: Collections of data with ACL-based access control.
- **Permissions**: Read, Write, Delete, Share operations on datasets.

## Architecture

### Cognee's Permission Model

```
Tenant (Organization)
├── Users (belong to one tenant)
├── Roles (groups of users)
└── Datasets (owned by users, shared via ACL)
    └── Permissions (Read, Write, Delete, Share)
```

### Data Isolation

When `ENABLE_BACKEND_ACCESS_CONTROL=true` (production setting):
- Users can only see/access data within their tenant
- Tenants are completely isolated
- Permissions inherit: User → Role → Tenant

## Entity Mapping

### Line AI → Cognee

| Line AI Entity | Cognee Entity | Relationship |
|---------------|---------------|--------------|
| Organization | Tenant | 1:1 |
| User | User | 1:1 |
| User Group/Role | Role | 1:1 |
| Dataset | Dataset | N:N (via permissions) |

### Example Mapping

```typescript
// Line AI Organization
{
  id: 'org-acme-corp',
  name: 'Acme Corporation',
  slug: 'acme-corp'
}

// Maps to Cognee Tenant
{
  tenant_id: 'tenant-acme-corp',
  name: 'acme-corp'
}

// Line AI User
{
  id: 'user-alice-123',
  email: 'alice@acme.com',
  organizationId: 'org-acme-corp'
}

// Maps to Cognee User
{
  user_id: 'cognee-user-id',
  email: 'alice@acme.com',
  tenant_id: 'tenant-acme-corp'
}
```

## Provisioning Workflow

### Step 1: Provision Tenant (When Organization is Created)

This is a **one-time operation** when a Line AI organization is first created.

```typescript
import { provisionCogneeTenant } from '@lineai/memory';

// In your organization creation handler
export async function createOrganization(orgData: {
  name: string;
  slug: string;
}) {
  // 1. Create organization in Line AI database
  const org = await db.organizations.create({
    name: orgData.name,
    slug: orgData.slug,
  });

  // 2. Provision Cognee tenant
  const tenantResult = await provisionCogneeTenant({
    cogneeUrl: process.env.COGNEE_URL,
    superuserCreds: {
      username: process.env.COGNEE_ADMIN_USERNAME,
      password: process.env.COGNEE_ADMIN_PASSWORD,
    },
    tenantName: orgData.slug, // Use slug for tenant name
  });

  if (!tenantResult.success) {
    // Rollback: delete org
    await db.organizations.delete(org.id);
    throw new Error(`Failed to provision tenant: ${tenantResult.error.message}`);
  }

  // 3. Store Cognee tenant ID
  await db.organizations.update(org.id, {
    cogneeTenantId: tenantResult.value.tenantId,
  });

  return org;
}
```

### Step 2: Provision User (When User Joins Organization)

This happens when a user is created or added to an organization.

```typescript
import { provisionCogneeUser } from '@lineai/memory';
import { encrypt } from './crypto'; // Your encryption library

// In your user creation handler
export async function createUser(userData: {
  email: string;
  organizationId: string;
}) {
  // 1. Get organization's Cognee tenant ID
  const org = await db.organizations.findById(userData.organizationId);
  if (!org.cogneeTenantId) {
    throw new Error('Organization not provisioned with Cognee');
  }

  // 2. Create user in Line AI database
  const user = await db.users.create({
    email: userData.email,
    organizationId: userData.organizationId,
  });

  // 3. Provision Cognee user
  const userResult = await provisionCogneeUser({
    cogneeUrl: process.env.COGNEE_URL,
    superuserCreds: {
      username: process.env.COGNEE_ADMIN_USERNAME,
      password: process.env.COGNEE_ADMIN_PASSWORD,
    },
    tenantId: org.cogneeTenantId,
    userEmail: userData.email,
    // Let it auto-generate a secure password
  });

  if (!userResult.success) {
    // Rollback: delete user
    await db.users.delete(user.id);
    throw new Error(`Failed to provision user: ${userResult.error.message}`);
  }

  // 4. Store Cognee user ID and ENCRYPTED password
  await db.users.update(user.id, {
    cogneeUserId: userResult.value.userId,
    cogneePassword: await encrypt(userResult.value.password), // IMPORTANT: Encrypt!
  });

  return user;
}
```

### Step 3: Create Roles (Optional)

Roles are useful for grouping users and managing permissions at scale.

```typescript
import { createTenantRole, addUserToTenantRole } from '@lineai/memory';

// Create a role when you create a Line AI user group
export async function createUserGroup(groupData: {
  name: string;
  organizationId: string;
  memberIds: string[];
}) {
  const org = await db.organizations.findById(groupData.organizationId);

  // 1. Create role in Cognee
  const roleResult = await createTenantRole({
    cogneeUrl: process.env.COGNEE_URL,
    superuserCreds: {
      username: process.env.COGNEE_ADMIN_USERNAME,
      password: process.env.COGNEE_ADMIN_PASSWORD,
    },
    tenantId: org.cogneeTenantId,
    role: {
      roleName: groupData.name,
      members: [], // Add members separately for better error handling
    },
  });

  if (!roleResult.success) {
    throw new Error(`Failed to create role: ${roleResult.error.message}`);
  }

  // 2. Create group in Line AI database
  const group = await db.groups.create({
    name: groupData.name,
    organizationId: groupData.organizationId,
    cogneeRoleId: roleResult.value.roleId,
  });

  // 3. Add members to role
  for (const userId of groupData.memberIds) {
    const user = await db.users.findById(userId);
    await addUserToTenantRole(
      process.env.COGNEE_URL,
      {
        username: process.env.COGNEE_ADMIN_USERNAME,
        password: process.env.COGNEE_ADMIN_PASSWORD,
      },
      org.cogneeTenantId,
      groupData.name,
      user.cogneeUserId
    );
  }

  return group;
}
```

### Step 4: Create Sessions (Runtime)

Once users are provisioned, create sessions for memory operations.

```typescript
import { createSession } from '@lineai/memory';
import { decrypt } from './crypto'; // Your decryption library

// In your API request handler
export async function handleMemoryRequest(
  userId: string,
  action: 'remember' | 'search'
) {
  // 1. Get user from database
  const user = await db.users.findById(userId);
  const org = await db.organizations.findById(user.organizationId);

  // 2. Decrypt Cognee password
  const cogneePassword = await decrypt(user.cogneePassword);

  // 3. Create session
  const sessionResult = await createSession({
    cogneeUrl: process.env.COGNEE_URL,
    credentials: {
      username: user.email,
      password: cogneePassword,
    },
    organizationId: user.organizationId,
    datasetStrategy: {
      scope: 'user',
      organizationId: user.organizationId,
      userId: user.id,
    },
  });

  if (!sessionResult.success) {
    throw new Error('Failed to create session');
  }

  return sessionResult.value;
}
```

## Security Best Practices

### 1. Password Encryption

**Always encrypt Cognee passwords before storing in your database.**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(password: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedPassword: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedPassword.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 2. Environment Variables

Store sensitive credentials in environment variables:

```bash
# .env
COGNEE_URL=https://cognee.your-domain.com
COGNEE_ADMIN_USERNAME=admin@cognee.local
COGNEE_ADMIN_PASSWORD=<strong-password>
ENCRYPTION_KEY=<32-byte-hex-key>
```

### 3. Superuser Access Limitation

Only use superuser credentials for provisioning operations:

```typescript
// ✅ GOOD: Use superuser for provisioning
await provisionCogneeUser({
  superuserCreds: {
    username: process.env.COGNEE_ADMIN_USERNAME,
    password: process.env.COGNEE_ADMIN_PASSWORD,
  },
  // ...
});

// ❌ BAD: Don't use superuser for regular operations
const session = await createSession({
  credentials: {
    username: process.env.COGNEE_ADMIN_USERNAME, // NO!
    password: process.env.COGNEE_ADMIN_PASSWORD,
  },
  // ...
});
```

### 4. Password Rotation

Implement periodic password rotation:

```typescript
export async function rotateUserPassword(userId: string) {
  const user = await db.users.findById(userId);
  const org = await db.organizations.findById(user.organizationId);

  // Generate new password
  const newPassword = generateSecurePassword();

  // Update in Cognee (would need an updateUser function in cognee-api)
  // For now, this would require re-provisioning the user

  // Update in database
  await db.users.update(user.id, {
    cogneePassword: await encrypt(newPassword),
  });

  return newPassword; // Return to user securely (email, etc.)
}
```

### 5. HTTPS in Production

Always use HTTPS URLs in production:

```typescript
const cogneeUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://cognee.your-domain.com'
    : 'http://localhost:8000';
```

## Common Patterns

### Pattern 1: Organization Onboarding

Complete flow for onboarding a new organization:

```typescript
export async function onboardOrganization(data: {
  name: string;
  slug: string;
  adminEmail: string;
}) {
  // 1. Provision tenant
  const tenantResult = await provisionCogneeTenant({
    cogneeUrl: process.env.COGNEE_URL,
    superuserCreds: {
      username: process.env.COGNEE_ADMIN_USERNAME,
      password: process.env.COGNEE_ADMIN_PASSWORD,
    },
    tenantName: data.slug,
  });

  if (!tenantResult.success) {
    throw new Error('Failed to provision tenant');
  }

  // 2. Create organization
  const org = await db.organizations.create({
    name: data.name,
    slug: data.slug,
    cogneeTenantId: tenantResult.value.tenantId,
  });

  // 3. Provision admin user
  const userResult = await provisionCogneeUser({
    cogneeUrl: process.env.COGNEE_URL,
    superuserCreds: {
      username: process.env.COGNEE_ADMIN_USERNAME,
      password: process.env.COGNEE_ADMIN_PASSWORD,
    },
    tenantId: tenantResult.value.tenantId,
    userEmail: data.adminEmail,
  });

  if (!userResult.success) {
    throw new Error('Failed to provision admin user');
  }

  // 4. Create admin user in database
  const user = await db.users.create({
    email: data.adminEmail,
    organizationId: org.id,
    role: 'admin',
    cogneeUserId: userResult.value.userId,
    cogneePassword: await encrypt(userResult.value.password),
  });

  return { org, user, password: userResult.value.password };
}
```

### Pattern 2: User Invitation

Invite a user to an existing organization:

```typescript
export async function inviteUser(data: {
  email: string;
  organizationId: string;
  role: 'admin' | 'member';
}) {
  const org = await db.organizations.findById(data.organizationId);

  // Provision user in Cognee
  const userResult = await provisionCogneeUser({
    cogneeUrl: process.env.COGNEE_URL,
    superuserCreds: {
      username: process.env.COGNEE_ADMIN_USERNAME,
      password: process.env.COGNEE_ADMIN_PASSWORD,
    },
    tenantId: org.cogneeTenantId,
    userEmail: data.email,
  });

  if (!userResult.success) {
    throw new Error('Failed to provision user');
  }

  // Create user in database
  const user = await db.users.create({
    email: data.email,
    organizationId: data.organizationId,
    role: data.role,
    cogneeUserId: userResult.value.userId,
    cogneePassword: await encrypt(userResult.value.password),
  });

  // Send invitation email with password
  await sendInvitationEmail({
    to: data.email,
    password: userResult.value.password,
    organizationName: org.name,
  });

  return user;
}
```

### Pattern 3: Session Caching

Cache sessions to avoid re-authenticating on every request:

```typescript
import { createSession, type Session } from '@lineai/memory';

// Simple in-memory cache (use Redis in production)
const sessionCache = new Map<string, { session: Session; expiresAt: number }>();

export async function getOrCreateSession(userId: string): Promise<Session> {
  // Check cache
  const cached = sessionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }

  // Get user credentials
  const user = await db.users.findById(userId);
  const cogneePassword = await decrypt(user.cogneePassword);

  // Create new session
  const sessionResult = await createSession({
    cogneeUrl: process.env.COGNEE_URL,
    credentials: {
      username: user.email,
      password: cogneePassword,
    },
    organizationId: user.organizationId,
    datasetStrategy: {
      scope: 'user',
      organizationId: user.organizationId,
      userId: user.id,
    },
  });

  if (!sessionResult.success) {
    throw new Error('Failed to create session');
  }

  // Cache for 1 hour
  sessionCache.set(userId, {
    session: sessionResult.value,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  return sessionResult.value;
}
```

## Troubleshooting

### Issue: "Authentication failed"

**Cause**: Invalid credentials or user not found.

**Solution**:
1. Verify user was provisioned correctly
2. Check stored password is decrypted correctly
3. Verify tenant exists in Cognee

```typescript
// Debug authentication
const user = await db.users.findById(userId);
console.log('User email:', user.email);
console.log('Cognee user ID:', user.cogneeUserId);

const decryptedPassword = await decrypt(user.cogneePassword);
console.log('Password length:', decryptedPassword.length);

// Try manual login
const result = await createSession({
  cogneeUrl: process.env.COGNEE_URL,
  credentials: {
    username: user.email,
    password: decryptedPassword,
  },
  organizationId: user.organizationId,
  datasetStrategy: { scope: 'user', organizationId: user.organizationId, userId: user.id },
});

console.log('Session result:', result);
```

### Issue: "Permission denied"

**Cause**: User doesn't have access to dataset.

**Solution**:
1. Verify dataset belongs to user's tenant
2. Check dataset permissions
3. Ensure `ENABLE_BACKEND_ACCESS_CONTROL=true` is set correctly

```typescript
// Check dataset ownership
const datasets = await listDatasets(session);
console.log('User datasets:', datasets);

// Share dataset if needed
await shareDataset(session, datasetId, userId, ['read', 'write']);
```

### Issue: "Tenant not found"

**Cause**: Organization not provisioned in Cognee.

**Solution**:
1. Verify `cogneeTenantId` is stored in organization record
2. Re-provision tenant if needed

```typescript
const org = await db.organizations.findById(organizationId);

if (!org.cogneeTenantId) {
  console.error('Organization not provisioned with Cognee');
  // Re-provision
  const result = await provisionCogneeTenant({
    cogneeUrl: process.env.COGNEE_URL,
    superuserCreds: { /* ... */ },
    tenantName: org.slug,
  });

  await db.organizations.update(org.id, {
    cogneeTenantId: result.value.tenantId,
  });
}
```

## Further Reading

- [Cognee Permissions Documentation](https://docs.cognee.ai/cognee/permissions/overview)
- [Cognee Tenants Guide](https://docs.cognee.ai/cognee/permissions/tenants)
- [Cognee Users Guide](https://docs.cognee.ai/cognee/permissions/users)
- [Cognee Roles Guide](https://docs.cognee.ai/cognee/permissions/roles)
- [@lineai/memory README](./README.md)
- [@lineai/memory Implementation Plan](./AUTHENTICATION_INTEGRATION_PLAN.md)

---

*Last updated: 2025-10-01*
