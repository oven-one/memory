/**
 * @lineai/memory
 * A comprehensive memory orchestration SDK for Line AI applications
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Session types
  Session,
  Credentials,
  CreateSessionParams,
} from './types/session';

export type {
  // Memory types
  Content,
  Memory,
  RememberOptions,
  ProcessingReference,
  ProcessOptions,
  ProcessingStatus,
  DeleteMode,
} from './types/memory';

export type {
  // Search types
  Query,
  SearchResultItem,
  SearchOutcome,
  SearchHistoryItem,
  SearchHistoryFilters,
} from './types/search';

export type {
  // Dataset types
  DatasetStrategy,
  DatasetContext,
  Permission,
  Dataset,
  DatasetGraph,
} from './types/dataset';

export type {
  // Error types
  MemoryError,
  Outcome,
} from './types/errors';

export type {
  // Provisioning types
  ProvisionUserParams,
  ProvisionUserResult,
  RoleParams,
  RoleResult,
} from './types/provisioning';
export type {
  ProvisionOrganizationParams,
  ProvisionOrganizationResult,
} from './provisioning/organization';

// ============================================================================
// Session Management
// ============================================================================

export { createSession } from './session/create';
export { endSession } from './session/end';

// ============================================================================
// Memory Operations
// ============================================================================

export { remember, rememberMany } from './memory/remember';
export { forget } from './memory/forget';
export { process, getProcessingStatus } from './memory/process';

// ============================================================================
// Search Operations
// ============================================================================

export {
  search,
  searchGraph,
  searchChunks,
  searchInsights,
  searchSummaries,
  searchCode,
} from './search/query';
export { getSearchHistory } from './search/history';

// ============================================================================
// Dataset Management
// ============================================================================

export {
  listDatasets,
  createDataset,
  getDatasetGraph,
  deleteDataset,
} from './dataset/manage';
export { shareDataset, revokeAccess } from './dataset/permissions';
export {
  generateDatasetName,
  isValidDatasetName,
  extractOrganizationId,
  isOrganizationDataset,
} from './dataset/strategy';

// ============================================================================
// Provisioning (Admin/Superuser Operations)
// ============================================================================

export { provisionOrganization } from './provisioning/organization';
export { provisionUser } from './provisioning/user';
export {
  createTenantRole,
  type CreateTenantRoleParams,
} from './provisioning/role';

// ============================================================================
// Role Management (Runtime Operations)
// ============================================================================

export {
  createRole,
  addUserToRole,
  grantPermissionToRole,
  grantPermissionsToRole,
} from './roles/manage';

// ============================================================================
// Utilities
// ============================================================================

export { mapCogneeError } from './util/errors';
export {
  withRetry,
  CircuitBreaker,
  defaultRetryStrategy,
  type RetryStrategy,
} from './util/retry';
export {
  validateDatasetName,
  validateOrganizationId,
  validateUserId,
  validateQuery,
  validateUrl,
  validateContent,
  validateEmail,
  validateTenantName,
} from './util/validate';
export { generateSecurePassword } from './util/security';

// Re-export hash utilities from lib
export { sha256, sha256Native } from './lib/hash';
