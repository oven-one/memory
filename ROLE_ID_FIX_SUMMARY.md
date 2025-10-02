# Role ID Fix - Complete Integration

## Problem Solved

Previously, `createTenantRole()` returned a placeholder role ID (`pending-${roleName}`) because Cognee's `POST /permissions/roles` endpoint returns void. This made it impossible to:
- Add users to roles (requires real role ID)
- Grant permissions to roles (requires real role ID)

## Solution Overview

Added a new `GET /api/v1/permissions/roles/{role_name}` endpoint to retrieve role details after creation.

---

## Changes Made

### 1. Cognee Backend (Fork)

**File:** `cognee/api/v1/permissions/routers/get_permissions_router.py`

**Change:** Added GET endpoint at end of file (lines 219-263)

**Commit:** `fd724ff7` - `[LINEAI] feat: add GET endpoint to retrieve role by name`

**Endpoint:**
```
GET /api/v1/permissions/roles/{role_name}
```

**Returns:**
```json
{
  "id": "uuid-here",
  "name": "editor",
  "tenant_id": "tenant-uuid"
}
```

**Documentation:** See `LINEAI_CUSTOMIZATIONS.md` for merge strategy

---

### 2. @lineai/cognee-api

**Version:** Updated to `1.0.2`

**Files Changed:**
- `src/types/cognee.ts` - Added `RoleRead` type
- `src/lib/cognee.ts` - Added `getRoleByName()` function

**New Export:**
```typescript
export const getRoleByName = async (
  config: CogneeConfig,
  roleName: string
): Promise<RoleRead> => {
  return fetchWithConfig(
    config, 
    `/permissions/roles/${encodeURIComponent(roleName)}`, 
    { method: 'GET' }
  );
};
```

---

### 3. @lineai/memory

**File:** `src/provisioning/role.ts`

**Change:** 
```typescript
// BEFORE (placeholder):
const result: RoleResult = {
  roleId: `pending-${params.roleName}`, // ❌ Fake!
  roleName: params.roleName,
  memberCount: 0,
};

// AFTER (real ID):
await createRole(config, params.roleName);
const role = await getRoleByName(config, params.roleName); // ✅ Retrieve real ID
const result: RoleResult = {
  roleId: role.id, // ✅ Real UUID!
  roleName: role.name,
  memberCount: 0,
};
```

---

## Testing

### Manual Test

```typescript
import { createTenantRole } from '@lineai/memory';

const result = await createTenantRole({
  cogneeUrl: 'http://localhost:8000',
  ownerEmail: 'admin@example.com',
  ownerPassword: 'password',
  roleName: 'data-scientists',
});

console.log(result.value.roleId); 
// ✅ Now prints real UUID instead of "pending-data-scientists"
```

### Verify in Swagger UI

1. Visit http://localhost:8000/docs
2. Find `permissions` section
3. Locate `GET /api/v1/permissions/roles/{role_name}`
4. Test with a role name

---

## Next Steps

### Now Works ✅

- `addUserToRole(session, userId, roleId)` - Can use real role ID
- `grantPermissionToRole(session, roleId, permission, datasetIds)` - Can use real role ID
- Complete role-based access control in memory library

### Future Cleanup (When Upstream Adds Feature)

If Cognee adds official role retrieval:

1. Check commit: `git log --grep="LINEAI"`
2. Revert: `git revert fd724ff7`
3. Update cognee-api to use upstream endpoint
4. Test and deploy

---

## Files Modified

```
cognee/
└── cognee/api/v1/permissions/routers/get_permissions_router.py

@lineai/cognee-api/
├── src/types/cognee.ts
└── src/lib/cognee.ts

@lineai/memory/
└── src/provisioning/role.ts
```

---

*Completed: 2025-10-02*
*Integration tested and verified working*
