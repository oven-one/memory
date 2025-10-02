# Critical Fix Plan: Cognee Provisioning Flow

## Status: REQUIRES CTO APPROVAL

## Problem Statement

The current `@lineai/memory` provisioning implementation is **fundamentally incorrect** due to incorrect assumptions about how Cognee's tenant/user system works.

## Root Cause Analysis

### Incorrect Assumption
I assumed:
- Tenants could be created independently
- Users could then be added to existing tenants

### Actual Cognee Behavior (verified from source code)
```python
# cognee/modules/users/tenants/methods/create_tenant.py
async def create_tenant(tenant_name: str, user_id: UUID):
    user = await get_user(user_id)
    if user.tenant_id:
        raise EntityAlreadyExistsError("User already has a tenant")

    tenant = Tenant(name=tenant_name, owner_id=user_id)
    # ...
    user.tenant_id = tenant.id  # User gets assigned to tenant
    # Returns: None (no tenant ID returned!)
```

**Key Facts:**
1. `create_tenant` requires an **existing user_id** as input
2. A user can only have **ONE tenant**
3. `create_tenant` returns **void** (no tenant ID)
4. After creation, the user's `tenant_id` field is populated
5. `register` endpoint accepts optional `tenant_id` but creates user WITHOUT tenant if not provided

## Current Implementation Issues

### Issue 1: provisionCogneeTenant
```typescript
// WRONG: Tries to create tenant independently
export const provisionCogneeTenant = async (params) => {
  await login(config, params.superuserCreds);
  await createTenant(config, params.tenantName);  // ❌ Missing required user_id!
  // ...
};
```

### Issue 2: No Tenant ID Retrieved
```typescript
return {
  tenantId: 'tenant-' + params.tenantName,  // ❌ Placeholder, not real ID!
  // ...
};
```

### Issue 3: provisionCogneeUser Uses Non-existent Tenant
```typescript
await register(config, {
  email: params.userEmail,
  password: password,
  tenant_id: params.tenantId,  // ❌ This tenant doesn't exist yet!
});
```

## Corrected Understanding

### Cognee's Actual Flow

**Option A: User First, Then Tenant**
```
1. Register user WITHOUT tenant (tenant_id is null)
2. Call createTenant(tenantName, userId) - tenant created, user assigned
3. Call getCurrentUser() to get user with populated tenant_id
```

**Option B: Create User Directly in Tenant (if tenant exists)**
```
1. Register user WITH tenant_id (if tenant already exists)
```

## Unknowns Requiring Investigation

### Critical Unknown #1: How to get tenant_id after creation?
- `createTenant` returns void
- No `getTenant` or `listTenants` methods found in codebase
- Possible solutions:
  a. Call `getCurrentUser()` after `createTenant` - user.tenant_id should be populated
  b. Use predictable naming and query database directly (not exposed via API)
  c. **REQUEST COGNEE API ENHANCEMENT** to return tenant object from createTenant

### Critical Unknown #2: What does `register` actually return?
```python
# UserRead schema
class UserRead(schemas.BaseUser[uuid_UUID]):
    tenant_id: Optional[uuid_UUID] = None
```

The `register` endpoint uses fastapi-users and should return `UserRead`, which includes `tenant_id`.

**Need to verify:** Does it return tenant_id if user was created with tenant_id=null?

### Critical Unknown #3: How does superuser create tenants for other users?
From create_tenant.py:
```python
async def create_tenant(tenant_name: str, user_id: UUID):
```

The API endpoint wrapper:
```python
@permissions_router.post("/tenants")
async def create_tenant(tenant_name: str, user: User = Depends(get_authenticated_user)):
    await create_tenant_method(tenant_name=tenant_name, user_id=user.id)
```

**PROBLEM:** The API uses `user.id` from the authenticated session, NOT a parameter!

This means:
- Superuser cannot create tenants for other users via the API
- Each user creates their own tenant
- This contradicts the `user_id` parameter in the backend method!

**Need to verify:** Is there a different endpoint or is the API incomplete?

## Proposed Solutions

### Solution A: User-Creates-Own-Tenant Pattern (If API is as-is)

Each Line AI user creates their own Cognee tenant on first login.

**Pros:**
- Matches what the API seems to support
- No superuser provisioning needed

**Cons:**
- Doesn't match Line AI's org model (one tenant per org, not per user)
- Users would have isolated tenants instead of shared org tenant
- **Does not meet requirements**

### Solution B: One User Per Tenant Pattern

Create one admin user per Line AI organization, that user owns the tenant.

**Flow:**
```typescript
1. Register admin user (no tenant)
2. Login as admin
3. Admin calls createTenant (creates tenant for themselves)
4. Call getCurrentUser() to get tenant_id
5. Register additional users WITH tenant_id from step 4
```

**Pros:**
- Works with current API
- One tenant per org (matches requirements)

**Cons:**
- Requires admin credentials for tenant operations
- First user is special (owns tenant)

### Solution C: Enhance @lineai/cognee-api

Add missing API wrapper to allow superuser to create tenant for a specific user_id.

**Required:**
```typescript
// Need to expose this in @lineai/cognee-api
export const createTenantForUser = async (
  config: CogneeConfig,
  userId: UUID,
  tenantName: string
): Promise<TenantRead> => {
  // Call backend method directly or request new API endpoint
};
```

**Pros:**
- Clean separation of concerns
- Superuser provisions everything

**Cons:**
- Requires Cognee API changes or direct database access

## Recommended Approach

### Immediate Action (No Cognee Changes Required)

Implement **Solution B** with the following corrections:

```typescript
// NEW: Combined function that creates user AND tenant atomically
export const provisionOrganization = async (params: {
  cogneeUrl: string;
  superuserCreds: Credentials;
  organizationName: string;
  adminEmail: string;
}): Promise<Outcome<ProvisionOrganizationResult>> => {

  // Step 1: Register admin user WITHOUT tenant
  await login(config, params.superuserCreds);
  const registerResult = await register(config, {
    email: params.adminEmail,
    password: generatedPassword,
    // NO tenant_id - user starts without tenant
  });
  await logout(config);

  // Step 2: Login AS the new admin user
  await login(config, {
    username: params.adminEmail,
    password: generatedPassword,
  });

  // Step 3: Admin creates their own tenant
  await createTenant(config, params.organizationName);

  // Step 4: Get user info with populated tenant_id
  const userWithTenant = await getCurrentUser(config);

  await logout(config);

  return {
    success: true,
    value: {
      tenantId: userWithTenant.tenant_id,  // ✅ Real tenant ID!
      adminUserId: userWithTenant.id,
      adminEmail: userWithTenant.email,
      adminPassword: generatedPassword,
    }
  };
};

// NEW: Add users to existing tenant
export const provisionUserInTenant = async (params: {
  cogneeUrl: string;
  superuserCreds: Credentials;
  tenantId: string;
  userEmail: string;
}): Promise<Outcome<ProvisionUserResult>> => {

  await login(config, params.superuserCreds);

  // Register user WITH tenant_id
  const user = await register(config, {
    email: params.userEmail,
    password: generatedPassword,
    tenant_id: params.tenantId,  // ✅ Tenant already exists
  });

  await logout(config);

  return {
    success: true,
    value: {
      userId: user.id,
      email: user.email,
      password: generatedPassword,
      tenantId: user.tenant_id,
    }
  };
};
```

### Changes Required

1. **Delete** `src/provisioning/tenant.ts` (wrong approach)
2. **Rename** `provisionCogneeUser` → `provisionUserInTenant` (clarify purpose)
3. **Create** `src/provisioning/organization.ts` with `provisionOrganization`
4. **Update** examples to show correct flow
5. **Document** limitations clearly

## Testing Requirements

Before deployment, verify:

1. ✅ Can register user without tenant
2. ✅ That user can create their own tenant
3. ✅ `getCurrentUser()` returns populated tenant_id after createTenant
4. ✅ Can register additional users WITH tenant_id
5. ✅ Users in same tenant can see each other's datasets (with permissions)
6. ✅ Role creation works with admin user credentials

## Timeline

- **Review & Approval:** CTO review required
- **Implementation:** 2-3 hours after approval
- **Testing:** 1-2 hours with live Cognee instance
- **Documentation:** 1 hour

## Risks

🔴 **HIGH RISK:** If `getCurrentUser()` doesn't return tenant_id after createTenant, we have no way to get the tenant ID via the API.

🟡 **MEDIUM RISK:** The API endpoint for createTenant uses authenticated user's ID, not a parameter. This limits flexibility.

🟡 **MEDIUM RISK:** No way to query/list tenants means we can't validate tenant creation.

## Questions for CTO

1. Is Solution B acceptable (first user owns tenant, others join it)?
2. Should we request Cognee API enhancements for proper superuser tenant provisioning?
3. Do we need to support multiple tenants per Line AI organization?
4. Can we test against a live Cognee instance before finalizing?

---

**Prepared by:** Claude Code
**Date:** 2025-10-01
**Priority:** CRITICAL
**Status:** AWAITING CTO REVIEW
