# Authentication Integration Plan
## Proper Integration with Cognee's Multi-Tenant Permission System

**Date:** 2025-10-01
**Status:** Planning
**Priority:** High

---

## Table of Contents
- [Problem Statement](#problem-statement)
- [Cognee's Authentication Architecture](#cognees-authentication-architecture)
- [Current Implementation Gap](#current-implementation-gap)
- [Recommended Solution](#recommended-solution)
- [Implementation Tasks](#implementation-tasks)
- [Migration Path](#migration-path)
- [References](#references)

---

## Problem Statement

The current `@lineai/memory` implementation uses username/password authentication but **does not fully leverage Cognee's multi-tenant permission system**. Specifically:

1. **Missing Tenant Integration** - Line AI organizations are not mapped to Cognee tenants
2. **No User Provisioning** - No helpers for creating Cognee users when Line AI users sign up
3. **Limited Permission Management** - Not utilizing Cognee's role-based access control
4. **Unclear Mapping** - Documentation doesn't explain Line AI → Cognee entity relationships

This means we're **bypassing** Cognee's designed multi-tenancy features rather than using them correctly.

---

## Cognee's Authentication Architecture

Cognee implements a sophisticated **Role-Based Access Control (RBAC)** system with multi-tenant isolation.

### Core Entities

```
Tenant (Organization)
  ├── Users (Members)
  ├── Roles (Permission Groups)
  └── Datasets (Owned Resources)
```

### Permission Hierarchy

Permissions are inherited in this order:
1. **Direct User Permissions** - Explicitly granted to a user
2. **Role Permissions** - Inherited from roles user belongs to
3. **Tenant Permissions** - Inherited from tenant membership

### Authentication Method

- **Primary:** Email + Password (cookie-based sessions)
- **Optional:** API Key (for system integrations, if configured)
- **Session:** Cookie with `credentials: 'include'`

### Key Design Principles

1. **Tenant = Organization Boundary** - All data isolation starts at tenant level
2. **Users belong to ONE tenant** - Cannot span organizations
3. **Roles are tenant-scoped** - Roles belong to a single tenant
4. **Datasets have Owners** - Ownership is permanent, permissions are granted
5. **Backend Access Control (EBAC)** - Must be enabled for isolation (`ENABLE_BACKEND_ACCESS_CONTROL=true`)

---

## Current Implementation Gap

### What We Have

```typescript
// Current @lineai/memory session creation
const session = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice', password: 'secret' },
  organizationId: 'org-acme-corp',  // Line AI org ID
  datasetStrategy: {
    scope: 'user',
    organizationId: 'org-acme-corp',
    userId: 'alice-123'
  },
});
```

**Issues:**
- ❌ `organizationId` is just a string we use for dataset naming
- ❌ Not creating/using Cognee tenants
- ❌ Manual user credential management
- ❌ No tenant → organization mapping
- ❌ Missing role-based permissions

### What We Need

```typescript
// Desired: Proper tenant-aware authentication
const session = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice@company.com', password: 'stored-password' },
  tenantId: 'cognee-tenant-uuid',  // Cognee tenant ID (mapped from Line AI org)
  datasetStrategy: {
    scope: 'user',
    organizationId: 'org-acme-corp',
    userId: 'alice-123'
  },
});
```

---

## Recommended Solution

### Architecture: 1:1 Entity Mapping

```
Line AI Organization  ──1:1──→  Cognee Tenant
        │
        └── Line AI User  ──1:1──→  Cognee User (with tenant_id)
                │
                └── Datasets (scoped by Line AI conventions + Cognee ACL)
```

### User Lifecycle Flow

#### 1. Organization Provisioning (One-time)

When a Line AI organization is created:

```typescript
// 1. Create Cognee tenant
const tenant = await provisionCogneeTenant({
  cogneeUrl: env.COGNEE_URL,
  superuserCreds: env.COGNEE_SUPERUSER,
  tenantName: lineAIOrg.name,
});

// 2. Store mapping in Line AI database
await db.organizations.update(lineAIOrg.id, {
  cogneeTenantId: tenant.tenantId,
});
```

#### 2. User Provisioning (Per Sign-up)

When a Line AI user signs up:

```typescript
// 1. Get organization's Cognee tenant
const org = await db.organizations.findById(user.organizationId);

// 2. Create Cognee user in that tenant
const cogneeUser = await provisionCogneeUser({
  cogneeUrl: env.COGNEE_URL,
  superuserCreds: env.COGNEE_SUPERUSER,
  tenantId: org.cogneeTenantId,
  userEmail: user.email,
});

// 3. Store credentials securely in Line AI database
await db.users.update(user.id, {
  cogneeUserId: cogneeUser.userId,
  cogneePassword: encrypt(cogneeUser.password), // Encrypted at rest
});
```

#### 3. Session Creation (Per Request)

When a Line AI user needs memory access:

```typescript
// 1. Retrieve stored credentials
const user = await getAuthenticatedLineAIUser();
const cogneeCreds = await getCogneeCredentials(user.id);

// 2. Create session with stored credentials
const session = await createSession({
  cogneeUrl: env.COGNEE_URL,
  credentials: {
    username: user.email,
    password: decrypt(cogneeCreds.cogneePassword),
  },
  organizationId: user.organizationId,
  datasetStrategy: {
    scope: 'user',
    organizationId: user.organizationId,
    userId: user.id,
  },
});
```

### Role-Based Permissions (Optional Enhancement)

For team collaboration:

```typescript
// Create role in tenant for project team
await createProjectRole({
  cogneeUrl: env.COGNEE_URL,
  tenantId: org.cogneeTenantId,
  roleName: 'project-alpha-editors',
  members: [user1.cogneeUserId, user2.cogneeUserId],
});

// Grant role permission on project dataset
await grantRolePermission({
  roleId: role.id,
  datasetId: projectDataset.id,
  permissions: ['read', 'write'],
});
```

---

## Implementation Tasks

### Phase 1: @lineai/cognee-api Verification ✅

**Status:** Already Complete

The `@lineai/cognee-api` library **already supports** all required operations:

```typescript
// Available functions:
- register(config, RegisterRequest): Promise<UserRead>
- createTenant(config, tenantName): Promise<void>
- addUserToTenant(config, userId, tenantId): Promise<void>
- createRole(config, roleName): Promise<void>
- addUserToRole(config, userId, roleId): Promise<void>
- grantDatasetPermissions(config, principalId, permissionName, datasetIds): Promise<void>
```

**No changes needed to @lineai/cognee-api.**

---

### Phase 2: @lineai/memory Enhancements

#### Task 2.1: Add Provisioning Types

**File:** `src/types/provisioning.ts` (new)

```typescript
export type ProvisionTenantParams = {
  readonly cogneeUrl: string;
  readonly superuserCreds: Credentials;
  readonly tenantName: string;
};

export type ProvisionTenantResult = {
  readonly tenantId: string;
  readonly tenantName: string;
};

export type ProvisionUserParams = {
  readonly cogneeUrl: string;
  readonly superuserCreds: Credentials;
  readonly tenantId: string;
  readonly userEmail: string;
};

export type ProvisionUserResult = {
  readonly userId: string;
  readonly email: string;
  readonly password: string; // Generated password to store
  readonly tenantId: string;
};

export type RoleParams = {
  readonly roleName: string;
  readonly tenantId: string;
  readonly members?: readonly string[]; // User IDs
};
```

#### Task 2.2: Implement Provisioning Functions

**File:** `src/provisioning/tenant.ts` (new)

```typescript
import { createTenant, login, register, addUserToTenant } from '@lineai/cognee-api';
import type { ProvisionTenantParams, ProvisionTenantResult } from '../types/provisioning';
import type { Outcome } from '../types/errors';

/**
 * Provision a Cognee tenant for a Line AI organization
 *
 * This should be called once when a Line AI organization is created.
 * The resulting tenantId should be stored in your organization database.
 */
export const provisionCogneeTenant = async (
  params: ProvisionTenantParams
): Promise<Outcome<ProvisionTenantResult>> => {
  // Implementation
};
```

**File:** `src/provisioning/user.ts` (new)

```typescript
/**
 * Provision a Cognee user for a Line AI user
 *
 * This should be called when a Line AI user signs up.
 * Store the returned password encrypted in your user database.
 */
export const provisionCogneeUser = async (
  params: ProvisionUserParams
): Promise<Outcome<ProvisionUserResult>> => {
  // Implementation
};
```

**File:** `src/provisioning/role.ts` (new)

```typescript
/**
 * Create a role within a tenant
 */
export const createTenantRole = async (
  session: Session,
  params: RoleParams
): Promise<Outcome<{ roleId: string }>> => {
  // Implementation
};
```

#### Task 2.3: Update Session Types

**File:** `src/types/session.ts`

Add optional tenant tracking:

```typescript
export type Session = {
  readonly cogneeUrl: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly userName: string;
  readonly datasetStrategy: DatasetStrategy;
  readonly config: CogneeConfig;
  readonly cogneeTenantId?: string; // Optional: Cognee tenant ID for reference
};

export type CreateSessionParams = {
  readonly cogneeUrl: string;
  readonly credentials: Credentials;
  readonly organizationId: string;
  readonly datasetStrategy: DatasetStrategy;
  readonly cogneeTenantId?: string; // Optional: validate user is in this tenant
};
```

#### Task 2.4: Update Main Exports

**File:** `src/index.ts`

```typescript
// Provisioning (new)
export { provisionCogneeTenant } from './provisioning/tenant';
export { provisionCogneeUser } from './provisioning/user';
export { createTenantRole } from './provisioning/role';

export type {
  ProvisionTenantParams,
  ProvisionTenantResult,
  ProvisionUserParams,
  ProvisionUserResult,
  RoleParams,
} from './types/provisioning';
```

#### Task 2.5: Add Validation

**File:** `src/util/validate.ts`

Add tenant/user validation:

```typescript
export const validateTenantId = (tenantId: string): Outcome<string> => {
  // UUID validation
};

export const validateEmail = (email: string): Outcome<string> => {
  // Email format validation
};
```

---

### Phase 3: Documentation Updates

#### Task 3.1: Update README.md

Add new section: **"Authentication & Multi-Tenancy"**

```markdown
## Authentication & Multi-Tenancy

@lineai/memory integrates with Cognee's tenant-based permission system.

### Architecture

Line AI Organization  ──→  Cognee Tenant
        ↓
Line AI User  ──→  Cognee User (in tenant)
        ↓
Datasets (with ACL permissions)

### Setup Flow

#### 1. Provision Organization Tenant (One-time)

\`\`\`typescript
import { provisionCogneeTenant } from '@lineai/memory';

// When creating a Line AI organization
const tenant = await provisionCogneeTenant({
  cogneeUrl: 'http://localhost:8000',
  superuserCreds: {
    username: 'admin@cognee.local',
    password: process.env.COGNEE_ADMIN_PASSWORD,
  },
  tenantName: organization.name,
});

// Store tenant.tenantId in your organization record
await db.organizations.update(org.id, {
  cogneeTenantId: tenant.tenantId,
});
\`\`\`

#### 2. Provision User (Per Sign-up)

\`\`\`typescript
import { provisionCogneeUser } from '@lineai/memory';

// When a user signs up
const cogneeUser = await provisionCogneeUser({
  cogneeUrl: 'http://localhost:8000',
  superuserCreds: { /* ... */ },
  tenantId: organization.cogneeTenantId,
  userEmail: user.email,
});

// Store encrypted password in your user record
await db.users.update(user.id, {
  cogneeUserId: cogneeUser.userId,
  cogneePassword: encrypt(cogneeUser.password),
});
\`\`\`

#### 3. Create Session (Per Request)

\`\`\`typescript
import { createSession } from '@lineai/memory';

// When user needs memory access
const credentials = await getCogneeCredentials(user.id);

const session = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: {
    username: user.email,
    password: decrypt(credentials.cogneePassword),
  },
  organizationId: user.organizationId,
  datasetStrategy: { /* ... */ },
});
\`\`\`
```

#### Task 3.2: Create Authentication Guide

**File:** `docs/AUTHENTICATION.md` (new)

Comprehensive guide covering:
- Cognee's permission system overview
- Entity mapping (Line AI ↔ Cognee)
- Credential storage best practices
- Role-based access control examples
- Security considerations
- Troubleshooting

#### Task 3.3: Add Code Examples

**File:** `examples/user-provisioning.ts` (new)
**File:** `examples/team-collaboration.ts` (new)

---

### Phase 4: Testing & Validation

#### Task 4.1: Unit Tests

- Test provisioning functions with mock API
- Test validation logic
- Test error handling

#### Task 4.2: Integration Tests

- Provision tenant → verify in Cognee
- Provision user → verify tenant membership
- Create session → verify authentication
- Grant permissions → verify access control

#### Task 4.3: E2E Scenario Tests

- Multi-org isolation test
- Role-based collaboration test
- Permission inheritance test

---

## Migration Path

### For Existing Deployments

If you already have Line AI users using `@lineai/memory`:

#### Option 1: Backfill (Recommended)

```typescript
// One-time migration script
async function migrateToTenantSystem() {
  for (const org of await db.organizations.all()) {
    // 1. Create Cognee tenant
    const tenant = await provisionCogneeTenant({
      cogneeUrl: env.COGNEE_URL,
      superuserCreds: env.COGNEE_ADMIN,
      tenantName: org.name,
    });

    // 2. Update organization
    await db.organizations.update(org.id, {
      cogneeTenantId: tenant.tenantId,
    });

    // 3. Migrate each user
    for (const user of await db.users.where({ orgId: org.id })) {
      const cogneeUser = await provisionCogneeUser({
        cogneeUrl: env.COGNEE_URL,
        superuserCreds: env.COGNEE_ADMIN,
        tenantId: tenant.tenantId,
        userEmail: user.email,
      });

      await db.users.update(user.id, {
        cogneeUserId: cogneeUser.userId,
        cogneePassword: encrypt(cogneeUser.password),
      });
    }
  }
}
```

#### Option 2: Gradual Migration

- Keep existing username/password auth working
- New users get provisioned with tenant system
- Gradually migrate old users on login

---

## References

### Cognee Documentation

**Core Concepts:**
- [Permissions System Overview](https://docs.cognee.ai/core-concepts/permissions-system/overview.md)
- [Tenants](https://docs.cognee.ai/core-concepts/permissions-system/tenants.md)
- [Users](https://docs.cognee.ai/core-concepts/permissions-system/users.md)
- [Roles](https://docs.cognee.ai/core-concepts/permissions-system/roles.md)
- [Principals](https://docs.cognee.ai/core-concepts/permissions-system/principals.md)
- [Datasets](https://docs.cognee.ai/core-concepts/permissions-system/datasets.md)
- [Access Control Lists (ACL)](https://docs.cognee.ai/core-concepts/permissions-system/acl.md)

**Implementation Guides:**
- [Permission Code Snippets](https://docs.cognee.ai/guides/permission-snippets.md)

### Internal Documentation

- `@lineai/cognee-api` - `/Users/eman/AgenticSpace/libraries/@lineai/cognee-api`
- `@lineai/memory` - `/Users/eman/AgenticSpace/libraries/@lineai/memory`

---

## Success Criteria

### Phase 2 Complete When:
- ✅ Provisioning functions implemented
- ✅ Types defined and exported
- ✅ Validation logic added
- ✅ Unit tests passing

### Phase 3 Complete When:
- ✅ README updated with auth section
- ✅ Authentication guide created
- ✅ Code examples added
- ✅ Migration path documented

### Phase 4 Complete When:
- ✅ All tests passing
- ✅ E2E scenarios validated
- ✅ Security review completed

---

## Security Considerations

1. **Password Storage**
   - Generate cryptographically secure random passwords
   - Encrypt at rest in Line AI database
   - Never log passwords
   - Use key derivation (e.g., PBKDF2, Argon2)

2. **Superuser Credentials**
   - Store in secure environment variables
   - Rotate regularly
   - Limit access (principle of least privilege)
   - Consider using separate provisioning service

3. **EBAC Configuration**
   - **MUST** enable `ENABLE_BACKEND_ACCESS_CONTROL=true` in production
   - Verify isolation in staging environment
   - Audit permission grants regularly

4. **Session Management**
   - Sessions are cookie-based (HTTP-only recommended)
   - Consider session timeout policies
   - Implement logout on Line AI session end

---

## Timeline Estimate

- **Phase 2:** 2-3 days (implementation)
- **Phase 3:** 1-2 days (documentation)
- **Phase 4:** 2-3 days (testing)

**Total:** ~1 week for complete integration

---

## Questions & Decisions Needed

1. **Password Generation Strategy**
   - Length? (Recommend 32+ characters)
   - Character set? (Alphanumeric + symbols)
   - Rotation policy?

2. **Credential Storage**
   - Which encryption algorithm? (AES-256-GCM recommended)
   - Key management approach?

3. **Superuser Management**
   - Dedicated provisioning service or embed in app?
   - How to secure superuser credentials?

4. **Migration Approach**
   - Backfill all at once or gradual?
   - Downtime acceptable?

---

*Last Updated: 2025-10-01*
*Author: Claude Code*
*Status: Ready for Review*