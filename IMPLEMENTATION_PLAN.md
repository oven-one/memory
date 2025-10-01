# @lineai/memory Implementation Plan

A comprehensive memory orchestration SDK for Line AI applications, built on top of @lineai/cognee-api.

---

## Table of Contents
- [Overview](#overview)
- [Design Principles](#design-principles)
- [Architecture](#architecture)
- [Module Structure](#module-structure)
- [Implementation Phases](#implementation-phases)
- [API Design](#api-design)
- [Type System](#type-system)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)
- [Security Considerations](#security-considerations)

---

## Overview

### Purpose
The `@lineai/memory` library provides a **higher-level abstraction** over the Cognee API that:
- Enforces security best practices automatically
- Standardizes dataset naming and organization patterns
- Simplifies authentication and authorization flows
- Provides deterministic, functional interfaces
- Handles common error scenarios gracefully
- Manages session lifecycle and state

### Key Differentiators from @lineai/cognee-api
| @lineai/cognee-api | @lineai/memory |
|-------------------|----------------|
| Direct API mapping | Opinionated workflows |
| Low-level operations | High-level abstractions |
| Requires manual session management | Automatic session handling |
| User provides all parameters | Smart defaults + conventions |
| No built-in patterns | Enforces best practices |

---

## Design Principles

### 1. Functional Purity
```typescript
// ✅ Pure functions with explicit dependencies
const remember = (memory: Memory, content: Content): Promise<Memory> => { ... }

// ❌ Avoid stateful classes or implicit state
class MemoryManager { ... }  // NO
```

### 2. Deterministic Patterns
```typescript
// ✅ Explicit, predictable outcomes
type SearchOutcome =
  | { readonly found: true; readonly results: SearchResult[] }
  | { readonly found: false; readonly reason: string }

// ❌ Avoid non-functional status fields
type SearchResult = {
  status: 'success' | 'error';  // NO - use discriminated unions
  data?: unknown;
}
```

### 3. Minimal Abstraction
```typescript
// ✅ Direct mapping to domain concepts
const rememberConversation = (session: Session, messages: Message[]): Promise<Memory>

// ❌ Over-abstraction
const processInput = (input: GenericInput, options: ProcessOptions): Promise<Output>
```

### 4. Explicit Configuration
```typescript
// ✅ All configuration visible at call site
const session = createSession({
  cogneeUrl: 'http://localhost:8000',
  user: { id: 'user-123', name: 'Alice' },
  datasetStrategy: 'user-scoped',
})

// ❌ Hidden global state
initMemory({ ... })  // NO - global side effects
memory.search(...)   // NO - where does this connect to?
```

### 5. Composition Over Configuration
```typescript
// ✅ Compose behaviors
const searchWithFallback = (primary: SearchFn, fallback: SearchFn) =>
  async (query: Query) => {
    const result = await primary(query)
    return result.found ? result : fallback(query)
  }

// ❌ Configuration flags
search({ query, useFallback: true })  // NO
```

---

## Architecture

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                    @lineai/memory                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Session    │  │   Memory     │  │   Search     │     │
│  │  Management  │  │  Operations  │  │   Queries    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                           │                                │
│                  ┌────────▼────────┐                       │
│                  │  Dataset        │                       │
│                  │  Strategy       │                       │
│                  └────────┬────────┘                       │
│                           │                                │
└───────────────────────────┼────────────────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │ @lineai/cognee-api │
                  │  (HTTP Client)     │
                  └────────────────────┘
```

### Data Flow

```
Application Code
      │
      ▼
┌──────────────────┐
│  createSession   │ → Authenticate, setup dataset strategy
└─────┬────────────┘
      │
      ▼
┌──────────────────┐
│  remember        │ → Add content with auto-naming, permissions
└─────┬────────────┘
      │
      ▼
┌──────────────────┐
│  process         │ → Cognify with progress tracking
└─────┬────────────┘
      │
      ▼
┌──────────────────┐
│  search          │ → Query with automatic dataset scoping
└──────────────────┘
```

---

## Module Structure

```
src/
├── index.ts                    # Public API exports
├── types/
│   ├── session.ts             # Session, User, Config types
│   ├── memory.ts              # Memory, Content types
│   ├── search.ts              # Query, Result types
│   ├── dataset.ts             # Dataset strategy types
│   └── errors.ts              # Error types
├── session/
│   ├── create.ts              # createSession()
│   ├── authenticate.ts        # authenticate()
│   ├── refresh.ts             # refreshSession()
│   └── end.ts                 # endSession()
├── memory/
│   ├── remember.ts            # remember()
│   ├── forget.ts              # forget()
│   ├── process.ts             # process()
│   └── status.ts              # getProcessingStatus()
├── search/
│   ├── query.ts               # search()
│   ├── graph.ts               # searchGraph()
│   ├── chunks.ts              # searchChunks()
│   ├── insights.ts            # searchInsights()
│   ├── summaries.ts           # searchSummaries()
│   ├── code.ts                # searchCode()
│   └── history.ts             # getSearchHistory()
├── dataset/
│   ├── strategy.ts            # Dataset naming strategies
│   ├── create.ts              # createDataset()
│   ├── list.ts                # listDatasets()
│   ├── graph.ts               # getDatasetGraph()
│   └── permissions.ts         # shareDataset(), revokeAccess()
├── util/
│   ├── hash.ts                # Content hashing utilities
│   ├── validate.ts            # Input validation
│   └── retry.ts               # Retry logic with exponential backoff
└── lib/
    └── cognee.ts              # Re-exported from @lineai/cognee-api
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Core types and session management

#### Tasks:
1. **Type System** (`src/types/`)
   - Define all core types with `readonly` properties
   - Create discriminated unions for outcomes
   - No `status` or `type` fields - use type narrowing

2. **Session Management** (`src/session/`)
   - `createSession`: Authenticate and initialize
   - `authenticate`: Handle login/registration
   - `refreshSession`: Token refresh (if needed)
   - `endSession`: Logout and cleanup

3. **Dataset Strategy** (`src/dataset/strategy.ts`)
   - User-scoped: `organization_{organizationId}_user_{userId}_memories`
   - Project-scoped: `organization_{organizationId}_project_{projectId}_knowledge`
   - Organization-scoped: `organization_{organizationId}_shared`
   - Custom: User-provided naming function

#### Deliverables:
- `src/types/*.ts` - Complete type definitions
- `src/session/*.ts` - Session lifecycle functions
- `src/dataset/strategy.ts` - Dataset naming strategies
- Unit tests for all functions

---

### Phase 2: Memory Operations (Week 2)
**Goal:** Content ingestion with automatic dataset management

#### Tasks:
1. **Content Ingestion** (`src/memory/remember.ts`)
   - Accept text, files, or URLs
   - Auto-create dataset based on strategy
   - Hash content for deduplication
   - Grant permissions automatically
   - Return `Memory` reference

2. **Content Removal** (`src/memory/forget.ts`)
   - Soft delete by default
   - Hard delete option
   - Permission checks

3. **Processing** (`src/memory/process.ts`)
   - Trigger cognify with dataset auto-selection
   - Optional background processing
   - Return processing reference

4. **Status Tracking** (`src/memory/status.ts`)
   - Poll processing status
   - Return progress information

#### Deliverables:
- `src/memory/*.ts` - Memory operations
- Integration tests with mock Cognee API
- Example usage documentation

---

### Phase 3: Search Operations (Week 3)
**Goal:** All search types with automatic dataset scoping

#### Tasks:
1. **Unified Search** (`src/search/query.ts`)
   - Auto-scope to user's datasets
   - Support all SearchType values
   - Return discriminated union results

2. **Specialized Search Functions** (`src/search/*.ts`)
   - `searchGraph()` - GRAPH_COMPLETION
   - `searchChunks()` - CHUNKS
   - `searchInsights()` - INSIGHTS
   - `searchSummaries()` - SUMMARIES
   - `searchCode()` - CODE

3. **Search History** (`src/search/history.ts`)
   - Retrieve past queries
   - Filter by date/dataset

#### Deliverables:
- `src/search/*.ts` - All search functions
- Type-safe result handling
- Performance benchmarks

---

### Phase 4: Dataset Management (Week 4)
**Goal:** Advanced dataset operations and permissions

#### Tasks:
1. **Dataset Operations** (`src/dataset/*.ts`)
   - List user's datasets
   - Create explicit datasets
   - Get dataset graph
   - Delete datasets

2. **Permission Management** (`src/dataset/permissions.ts`)
   - Share dataset with users
   - Revoke access
   - List shared datasets

3. **Visualization** (`src/dataset/graph.ts`)
   - Get graph for visualization
   - Export graph data

#### Deliverables:
- `src/dataset/*.ts` - Dataset management
- Permission enforcement tests
- Multi-user scenario tests

---

### Phase 5: Error Handling & Resilience (Week 5)
**Goal:** Production-ready error handling and retry logic

#### Tasks:
1. **Error Types** (`src/types/errors.ts`)
   - Discriminated error unions
   - Map Cognee errors to domain errors
   - User-friendly messages

2. **Retry Logic** (`src/util/retry.ts`)
   - Exponential backoff
   - Configurable retry strategies
   - Circuit breaker pattern

3. **Validation** (`src/util/validate.ts`)
   - Input validation
   - Dataset name validation
   - Permission checks

#### Deliverables:
- Comprehensive error handling
- Retry logic with tests
- Error documentation

---

### Phase 6: Documentation & Examples (Week 6)
**Goal:** Complete documentation and real-world examples

#### Tasks:
1. **API Documentation**
   - TSDoc comments for all functions
   - Usage examples
   - Migration guide from direct API usage

2. **Examples**
   - Simple chatbot with memory
   - Multi-user application
   - RAG pipeline
   - Code assistant

3. **Testing**
   - Integration test suite
   - E2E tests with real Cognee instance
   - Performance tests

#### Deliverables:
- Complete README
- API reference documentation
- 4+ working examples
- Test coverage > 90%

---

## API Design

### Session Management

```typescript
/**
 * Session represents an authenticated connection to Cognee
 */
export type Session = {
  readonly cogneeUrl: string
  readonly organizationId: string
  readonly userId: string
  readonly userName: string
  readonly datasetStrategy: DatasetStrategy
  readonly config: CogneeConfig
}

/**
 * Dataset naming strategy
 *
 * All datasets are organization-scoped for multi-tenant isolation.
 * Users from Organization A can NEVER see data from Organization B.
 */
export type DatasetStrategy =
  | { readonly scope: 'user'; readonly organizationId: string; readonly userId: string }
  | { readonly scope: 'project'; readonly organizationId: string; readonly projectId: string }
  | { readonly scope: 'organization'; readonly organizationId: string }
  | { readonly scope: 'custom'; readonly namingFn: (context: Context) => string }

/**
 * Create a new authenticated session
 *
 * @param organizationId - Required for multi-tenant isolation
 */
export const createSession = async (params: {
  readonly cogneeUrl: string
  readonly credentials: { readonly username: string; readonly password: string }
  readonly organizationId: string
  readonly datasetStrategy: DatasetStrategy
}): Promise<Session>

/**
 * End a session (logout)
 */
export const endSession = async (session: Session): Promise<void>
```

---

### Memory Operations

```typescript
/**
 * Content to remember
 */
export type Content =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'file'; readonly file: File }
  | { readonly type: 'url'; readonly url: string }

/**
 * Memory reference after ingestion
 */
export type Memory = {
  readonly id: string
  readonly datasetId: string
  readonly datasetName: string
  readonly contentHash: string
  readonly createdAt: string
  readonly tags?: readonly string[]
}

/**
 * Add content to memory (single item)
 */
export const remember = async (
  session: Session,
  content: Content,
  options?: {
    readonly tags?: readonly string[]
    readonly datasetName?: string
  }
): Promise<Memory>

/**
 * Add multiple items to memory (batch operation)
 */
export const rememberMany = async (
  session: Session,
  contents: readonly Content[],
  options?: {
    readonly tags?: readonly string[]
    readonly datasetName?: string
  }
): Promise<readonly Memory[]>

/**
 * Remove content from memory
 */
export const forget = async (
  session: Session,
  memory: Memory,
  mode?: 'soft' | 'hard'
): Promise<void>

/**
 * Process memories into knowledge graph
 */
export type ProcessingReference = {
  readonly id: string
  readonly datasetIds: readonly string[]
  readonly startedAt: string
}

export const process = async (
  session: Session,
  options?: {
    readonly datasetIds?: readonly string[]
    readonly background?: boolean
  }
): Promise<ProcessingReference>

/**
 * Check processing status
 */
export type ProcessingStatus =
  | { readonly complete: true; readonly datasetIds: readonly string[] }
  | { readonly complete: false; readonly progress: number; readonly message: string }
  | { readonly error: true; readonly message: string }

export const getProcessingStatus = async (
  session: Session,
  reference: ProcessingReference
): Promise<ProcessingStatus>
```

---

### Search Operations

```typescript
/**
 * Search query
 */
export type Query = {
  readonly text: string
  readonly datasetIds?: readonly string[]
  readonly tags?: readonly string[]
  readonly topK?: number
}

/**
 * Search result (discriminated union)
 */
export type SearchOutcome =
  | {
      readonly found: true
      readonly results: readonly {
        readonly content: unknown
        readonly datasetId: string
        readonly datasetName: string
        readonly relevanceScore?: number
      }[]
      readonly graphs?: readonly GraphDTO[]
    }
  | {
      readonly found: false
      readonly reason: string
    }

/**
 * Search across memories (GRAPH_COMPLETION)
 */
export const search = async (
  session: Session,
  query: Query
): Promise<SearchOutcome>

/**
 * Search graph structure (INSIGHTS)
 */
export const searchGraph = async (
  session: Session,
  query: Query
): Promise<SearchOutcome>

/**
 * Search text chunks (CHUNKS)
 */
export const searchChunks = async (
  session: Session,
  query: Query
): Promise<SearchOutcome>

/**
 * Search pre-computed insights (INSIGHTS)
 */
export const searchInsights = async (
  session: Session,
  query: Query
): Promise<SearchOutcome>

/**
 * Search hierarchical summaries (SUMMARIES)
 */
export const searchSummaries = async (
  session: Session,
  query: Query
): Promise<SearchOutcome>

/**
 * Search code knowledge graph (CODE)
 */
export const searchCode = async (
  session: Session,
  query: Query
): Promise<SearchOutcome>

/**
 * Get search history
 */
export const getSearchHistory = async (
  session: Session,
  filters?: {
    readonly since?: string
    readonly datasetIds?: readonly string[]
  }
): Promise<readonly {
  readonly id: string
  readonly query: string
  readonly timestamp: string
}[]>
```

---

### Dataset Management

```typescript
/**
 * Dataset information
 */
export type Dataset = {
  readonly id: string
  readonly name: string
  readonly ownerId: string
  readonly createdAt: string
  readonly updatedAt: string | null
  readonly permissions: readonly {
    readonly userId: string
    readonly permission: 'read' | 'write' | 'delete' | 'share'
  }[]
}

/**
 * List datasets accessible to user
 */
export const listDatasets = async (
  session: Session
): Promise<readonly Dataset[]>

/**
 * Create a new dataset explicitly
 */
export const createDataset = async (
  session: Session,
  name: string
): Promise<Dataset>

/**
 * Get dataset graph for visualization
 */
export const getDatasetGraph = async (
  session: Session,
  datasetId: string
): Promise<GraphDTO>

/**
 * Delete a dataset
 */
export const deleteDataset = async (
  session: Session,
  datasetId: string
): Promise<void>

/**
 * Share dataset with another user
 */
export const shareDataset = async (
  session: Session,
  datasetId: string,
  userId: string,
  permissions: readonly ('read' | 'write' | 'delete' | 'share')[]
): Promise<void>

/**
 * Revoke dataset access
 */
export const revokeAccess = async (
  session: Session,
  datasetId: string,
  userId: string
): Promise<void>
```

---

## Type System

### Core Principles

1. **Immutability**: All types use `readonly`
2. **Discriminated Unions**: No `status` or `type` fields for outcomes
3. **Explicit Nullability**: Use `| null` not `?`
4. **Nominal Types**: Use branded types for IDs

```typescript
// ✅ Discriminated union
type Result<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: Error }

// ✅ Branded ID types
type UserId = string & { readonly __brand: 'UserId' }
type DatasetId = string & { readonly __brand: 'DatasetId' }

const createUserId = (id: string): UserId => id as UserId
const createDatasetId = (id: string): DatasetId => id as DatasetId

// ✅ Explicit configuration
type MemoryConfig = {
  readonly maxRetries: number
  readonly retryDelayMs: number
  readonly timeout: number
}

const defaultConfig: MemoryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeout: 30000,
}
```

---

## Error Handling

### Error Types

```typescript
/**
 * Domain errors (discriminated union)
 */
export type MemoryError =
  | {
      readonly error: 'authentication_failed'
      readonly message: string
    }
  | {
      readonly error: 'permission_denied'
      readonly datasetId: string
      readonly requiredPermission: string
    }
  | {
      readonly error: 'dataset_not_found'
      readonly datasetId: string
    }
  | {
      readonly error: 'processing_failed'
      readonly datasetId: string
      readonly reason: string
    }
  | {
      readonly error: 'network_error'
      readonly statusCode: number
      readonly message: string
    }
  | {
      readonly error: 'invalid_input'
      readonly field: string
      readonly message: string
    }

/**
 * Result type with error handling
 */
export type Outcome<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: MemoryError }

/**
 * Map Cognee errors to domain errors
 */
const mapCogneeError = (error: CogneeError): MemoryError => {
  if (error.statusCode === 403) {
    return {
      error: 'permission_denied',
      datasetId: extractDatasetId(error),
      requiredPermission: 'read',
    }
  }
  // ... other mappings
}

/**
 * Safe execution wrapper
 */
const tryCognee = async <T>(
  fn: () => Promise<T>
): Promise<Outcome<T>> => {
  try {
    const value = await fn()
    return { success: true, value }
  } catch (err) {
    if (err instanceof CogneeError) {
      return { success: false, error: mapCogneeError(err) }
    }
    return {
      success: false,
      error: {
        error: 'network_error',
        statusCode: 500,
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    }
  }
}
```

### Retry Logic

```typescript
/**
 * Retry strategy
 */
export type RetryStrategy = {
  readonly maxAttempts: number
  readonly initialDelayMs: number
  readonly maxDelayMs: number
  readonly backoffFactor: number
  readonly retryableErrors: readonly string[]
}

const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableErrors: ['network_error', 'processing_failed'],
}

/**
 * Retry with exponential backoff
 */
export const withRetry = <T>(
  fn: () => Promise<Outcome<T>>,
  strategy: RetryStrategy = defaultRetryStrategy
): Promise<Outcome<T>> => {
  const attempt = async (attemptNumber: number): Promise<Outcome<T>> => {
    const result = await fn()

    if (result.success) {
      return result
    }

    if (attemptNumber >= strategy.maxAttempts) {
      return result
    }

    if (!strategy.retryableErrors.includes(result.error.error)) {
      return result
    }

    const delay = Math.min(
      strategy.initialDelayMs * Math.pow(strategy.backoffFactor, attemptNumber - 1),
      strategy.maxDelayMs
    )

    await sleep(delay)
    return attempt(attemptNumber + 1)
  }

  return attempt(1)
}
```

---

## Testing Strategy

### Unit Tests
- Test each pure function in isolation
- Mock @lineai/cognee-api calls
- Test error mapping
- Test retry logic

### Integration Tests
- Test against mock Cognee server
- Test session lifecycle
- Test multi-dataset scenarios
- Test permission enforcement

### E2E Tests
- Test against real Cognee instance (Docker)
- Test complete workflows
- Test multi-user scenarios
- Test error recovery

### Example Test Structure

```typescript
import test from 'ava'
import { createSession, remember, search } from '../src'
import { mockCogneeApi } from './mocks/cognee'

test('remember creates dataset with user scope', async (t) => {
  const mockApi = mockCogneeApi()
  const session = await createSession({
    cogneeUrl: mockApi.url,
    credentials: { username: 'alice', password: 'secret' },
    datasetStrategy: { scope: 'user', userId: 'alice-123' },
  })

  const memory = await remember(session, {
    type: 'text',
    text: 'Important information',
  })

  t.is(memory.datasetName, 'organization_org-acme-corp_user_alice-123_memories')
  t.truthy(memory.id)
  t.truthy(memory.contentHash)
})

test('search returns no results when dataset is empty', async (t) => {
  const mockApi = mockCogneeApi()
  const session = await createSession({ ... })

  const outcome = await search(session, { text: 'query' })

  t.false(outcome.found)
  t.is(outcome.reason, 'No matching content found')
})

test('search handles permission errors gracefully', async (t) => {
  const mockApi = mockCogneeApi({
    searchError: { statusCode: 403, message: 'Permission denied' },
  })
  const session = await createSession({ ... })

  const outcome = await search(session, { text: 'query' })

  t.false(outcome.found)
  t.is(outcome.reason, 'Permission denied for dataset')
})
```

---

## Security Considerations

### Authentication
- Never store passwords
- Use cookie-based auth from @lineai/cognee-api
- Support token refresh
- Auto-logout on auth errors

### Authorization
- Always scope operations to user's datasets
- Check permissions before operations
- Fail safely on permission errors
- Audit permission grants

### Data Protection
- Hash content for deduplication
- Never log sensitive content
- Sanitize error messages
- Support hard delete for GDPR compliance

### Input Validation
```typescript
const validateDatasetName = (name: string): Outcome<string> => {
  if (name.length === 0) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'datasetName',
        message: 'Dataset name cannot be empty',
      },
    }
  }

  if (name.length > 100) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'datasetName',
        message: 'Dataset name too long (max 100 chars)',
      },
    }
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return {
      success: false,
      error: {
        error: 'invalid_input',
        field: 'datasetName',
        message: 'Dataset name can only contain alphanumeric, underscore, and hyphen',
      },
    }
  }

  return { success: true, value: name }
}
```

---

## Usage Examples

### Example 1: Simple Chatbot

```typescript
import { createSession, remember, process, search } from '@lineai/memory'

const main = async () => {
  // Create session for user
  const session = await createSession({
    cogneeUrl: 'http://localhost:8000',
    credentials: { username: 'alice', password: 'secret' },
    organizationId: 'org-acme-corp',
    datasetStrategy: { scope: 'user', organizationId: 'org-acme-corp', userId: 'alice-123' },
  })

  // Remember conversation
  await remember(session, {
    type: 'text',
    text: 'User: What is the capital of France?\nBot: Paris',
  })

  // Process into knowledge graph
  await process(session)

  // Search later
  const outcome = await search(session, {
    text: 'What did I ask about France?',
  })

  if (outcome.found) {
    console.log(outcome.results[0].content)
  }

  await endSession(session)
}
```

### Example 2: Multi-user Document System

```typescript
import { createSession, remember, shareDataset, search } from '@lineai/memory'

const setupProject = async () => {
  // Alice creates project dataset
  const aliceSession = await createSession({
    cogneeUrl: 'http://localhost:8000',
    credentials: { username: 'alice', password: 'secret' },
    organizationId: 'org-acme-corp',
    datasetStrategy: { scope: 'project', organizationId: 'org-acme-corp', projectId: 'proj-456' },
  })

  // Add project documents
  const memory = await remember(aliceSession, {
    type: 'file',
    file: projectDoc,
  })

  // Share with Bob
  await shareDataset(aliceSession, memory.datasetId, 'bob-789', ['read'])

  // Bob searches (same organization)
  const bobSession = await createSession({
    cogneeUrl: 'http://localhost:8000',
    credentials: { username: 'bob', password: 'secret' },
    organizationId: 'org-acme-corp',
    datasetStrategy: { scope: 'project', organizationId: 'org-acme-corp', projectId: 'proj-456' },
  })

  const outcome = await search(bobSession, {
    text: 'project requirements',
  })

  if (outcome.found) {
    console.log('Found requirements:', outcome.results)
  }
}
```

### Example 3: RAG Pipeline

```typescript
import { createSession, remember, process, searchChunks } from '@lineai/memory'

const ragPipeline = async (documents: File[], userQuery: string) => {
  const session = await createSession({ ... })

  // Ingest documents
  for (const doc of documents) {
    await remember(session, { type: 'file', file: doc })
  }

  // Process
  const ref = await process(session, { background: false })

  // Search for relevant chunks
  const outcome = await searchChunks(session, {
    text: userQuery,
    topK: 5,
  })

  if (!outcome.found) {
    return 'No relevant information found'
  }

  // Use chunks as context for LLM
  const context = outcome.results
    .map((r) => r.content)
    .join('\n\n')

  return generateResponse(context, userQuery)
}
```

---

## Migration Path

### From Direct API Usage

**Before:**
```typescript
import { login, addData, cognify, search, CogneeConfig } from '@lineai/cognee-api'

const config: CogneeConfig = { baseUrl: 'http://localhost:8000' }

await login(config, { username: 'alice', password: 'secret' })
const file = new File(['content'], 'doc.txt')
await addData(config, [file], { datasetName: 'my-dataset' })
await cognify(config, { datasets: ['my-dataset'] })
const results = await search(config, { query: 'test', dataset_name: 'my-dataset' })
```

**After:**
```typescript
import { createSession, remember, process, search } from '@lineai/memory'

const session = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice', password: 'secret' },
  organizationId: 'org-acme-corp',
  datasetStrategy: { scope: 'user', organizationId: 'org-acme-corp', userId: 'alice' },
})

await remember(session, { type: 'file', file: new File(['content'], 'doc.txt') })
await process(session)
const outcome = await search(session, { text: 'test' })
```

**Benefits:**
- Automatic dataset naming
- Type-safe results
- Built-in error handling
- Session management
- Permission enforcement

---

## Success Criteria

### Phase 1 (Foundation)
- [ ] All core types defined
- [ ] Session lifecycle working
- [ ] Dataset strategies implemented
- [ ] Unit tests pass

### Phase 2 (Memory)
- [ ] Content ingestion works
- [ ] Auto-dataset creation
- [ ] Permission grants automatic
- [ ] Processing status tracking

### Phase 3 (Search)
- [ ] All search types supported
- [ ] Automatic dataset scoping
- [ ] Type-safe results
- [ ] Search history retrieval

### Phase 4 (Datasets)
- [ ] Dataset CRUD operations
- [ ] Permission management
- [ ] Graph visualization
- [ ] Multi-user tests pass

### Phase 5 (Resilience)
- [ ] Error handling complete
- [ ] Retry logic tested
- [ ] Input validation
- [ ] Circuit breaker pattern

### Phase 6 (Documentation)
- [ ] API documentation complete
- [ ] 4+ working examples
- [ ] Migration guide
- [ ] Test coverage > 90%

---

## Design Decisions

1. **Session Persistence**: ✅ Sessions will be serializable for server-side use
2. **Background Processing**: ⏸️ WebSocket support deferred to future phase; poll-based status checks for now
3. **Batch Operations**: ✅ Support batch `remember()` for adding multiple items at once
4. **Caching**: ⏸️ Deferred to future phase
5. **Streaming**: ✅ Support streaming search results where API supports it
6. **Multi-tenancy**: ✅ Full organization-based multi-tenancy with strict isolation. Dataset naming: `organization_{orgId}_user_{userId}`, `organization_{orgId}_project_{projectId}`, `organization_{orgId}_shared`. Cross-organization sharing NOT supported in this phase.
7. **Analytics**: ⏸️ Deferred to future phase
8. **Offline Mode**: ❌ Not supported in this phase

---

## Dependencies

### Required
- `@lineai/cognee-api` - HTTP client for Cognee API
- `@bitauth/libauth` - Crypto utilities (already in package.json)

### Development
- `ava` - Testing framework
- `nyc` - Code coverage
- `typescript` - Type checking
- `eslint` - Linting
- `prettier` - Formatting

---

## Timeline

- **Week 1**: Phase 1 - Foundation
- **Week 2**: Phase 2 - Memory Operations
- **Week 3**: Phase 3 - Search Operations
- **Week 4**: Phase 4 - Dataset Management
- **Week 5**: Phase 5 - Error Handling & Resilience
- **Week 6**: Phase 6 - Documentation & Examples

**Total**: 6 weeks to production-ready v1.0.0

---

*Last updated: 2025-09-30*
*This plan follows functional programming principles and enforces best practices for Cognee API usage.*