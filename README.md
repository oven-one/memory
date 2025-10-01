# @lineai/memory

A comprehensive memory orchestration SDK for Line AI applications, built on top of [@lineai/cognee-api](https://github.com/oven-one/cognee-api).

## Overview

`@lineai/memory` provides a **higher-level abstraction** over the Cognee API with:

- ✅ **Automatic session management** - Handle authentication and configuration seamlessly
- ✅ **Organization-based multi-tenancy** - Strict data isolation between organizations
- ✅ **Smart dataset naming strategies** - User, project, and organization-scoped datasets
- ✅ **Type-safe error handling** - Discriminated unions for predictable error handling
- ✅ **Functional programming principles** - Pure functions, immutability, composition
- ✅ **Built-in retry logic** - Exponential backoff and circuit breaker patterns

## Installation

```bash
npm install @lineai/memory
# or
yarn add @lineai/memory
```

## Quick Start

```typescript
import { createSession, remember, process, search } from '@lineai/memory';

// Create authenticated session
const sessionResult = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice', password: 'secret' },
  organizationId: 'org-acme-corp',
  datasetStrategy: {
    scope: 'user',
    organizationId: 'org-acme-corp',
    userId: 'alice-123',
  },
});

if (!sessionResult.success) {
  console.error('Failed to create session:', sessionResult.error);
  return;
}

const session = sessionResult.value;

// Remember something
const memoryResult = await remember(session, {
  type: 'text',
  text: 'TypeScript is a typed superset of JavaScript',
});

if (memoryResult.success) {
  console.log('Remembered:', memoryResult.value);
}

// Process into knowledge graph
const processResult = await process(session);

// Search later
const searchResult = await search(session, {
  text: 'What is TypeScript?',
});

if (searchResult.success && searchResult.value.found) {
  console.log('Found:', searchResult.value.results);
}
```

## Core Concepts

### Sessions

Sessions represent an authenticated connection to Cognee with dataset strategy configuration:

```typescript
type Session = {
  readonly cogneeUrl: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly userName: string;
  readonly datasetStrategy: DatasetStrategy;
  readonly config: CogneeConfig;
};
```

### Dataset Strategies

All datasets are organization-scoped for multi-tenant isolation:

```typescript
// User-scoped: personal memories
const userStrategy: DatasetStrategy = {
  scope: 'user',
  organizationId: 'org-123',
  userId: 'user-456',
};
// Dataset name: "organization_org-123_user_user-456_memories"

// Project-scoped: shared team knowledge
const projectStrategy: DatasetStrategy = {
  scope: 'project',
  organizationId: 'org-123',
  projectId: 'proj-789',
};
// Dataset name: "organization_org-123_project_proj-789_knowledge"

// Organization-scoped: company-wide data
const orgStrategy: DatasetStrategy = {
  scope: 'organization',
  organizationId: 'org-123',
};
// Dataset name: "organization_org-123_shared"

// Custom: define your own naming
const customStrategy: DatasetStrategy = {
  scope: 'custom',
  namingFn: (context) =>
    `organization_${context.organizationId}_custom_${context.customField}`,
};
```

### Error Handling

All functions return `Outcome<T>` for type-safe error handling:

```typescript
const result = await remember(session, content);

if (result.success) {
  const memory = result.value;
  console.log('Success:', memory.id);
} else {
  const error = result.error;
  switch (error.error) {
    case 'authentication_failed':
      console.error('Auth failed:', error.message);
      break;
    case 'permission_denied':
      console.error('No access to dataset:', error.datasetId);
      break;
    case 'network_error':
      console.error('Network error:', error.statusCode);
      break;
  }
}
```

## API Reference

### Session Management

#### `createSession(params: CreateSessionParams): Promise<Outcome<Session>>`

Create a new authenticated session.

```typescript
const result = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice', password: 'secret' },
  organizationId: 'org-acme-corp',
  datasetStrategy: {
    scope: 'user',
    organizationId: 'org-acme-corp',
    userId: 'alice-123',
  },
});
```

#### `endSession(session: Session): Promise<Outcome<void>>`

End a session (logout).

```typescript
await endSession(session);
```

### Memory Operations

#### `remember(session, content, options?): Promise<Outcome<Memory>>`

Add content to memory (single item).

```typescript
// Text content
await remember(session, {
  type: 'text',
  text: 'Important information',
});

// File content
await remember(session, {
  type: 'file',
  file: myFile,
});

// URL content
await remember(session, {
  type: 'url',
  url: 'https://example.com/document.pdf',
});

// With tags and custom dataset
await remember(
  session,
  { type: 'text', text: 'Data' },
  {
    tags: ['important', 'finance'],
    datasetName: 'organization_org-123_custom_dataset',
  }
);
```

#### `rememberMany(session, contents, options?): Promise<Outcome<readonly Memory[]>>`

Add multiple items to memory (batch operation).

```typescript
await rememberMany(session, [
  { type: 'text', text: 'First item' },
  { type: 'text', text: 'Second item' },
  { type: 'text', text: 'Third item' },
]);
```

#### `forget(session, memory, mode?): Promise<Outcome<void>>`

Remove content from memory.

```typescript
// Soft delete (default)
await forget(session, memory, 'soft');

// Hard delete
await forget(session, memory, 'hard');
```

#### `process(session, options?): Promise<Outcome<ProcessingReference>>`

Process memories into knowledge graph.

```typescript
// Process with default dataset
const ref = await process(session);

// Process specific datasets in background
const ref = await process(session, {
  datasetIds: ['dataset-1', 'dataset-2'],
  background: true,
});
```

#### `getProcessingStatus(session, reference): Promise<Outcome<ProcessingStatus>>`

Check processing status.

```typescript
const status = await getProcessingStatus(session, ref);

if (status.success) {
  if (status.value.complete) {
    console.log('Processing complete!');
  } else if (status.value.error) {
    console.log('Processing failed:', status.value.message);
  } else {
    console.log('Progress:', status.value.progress, '%');
  }
}
```

### Search Operations

#### `search(session, query): Promise<Outcome<SearchOutcome>>`

Search across memories (GRAPH_COMPLETION).

```typescript
const result = await search(session, {
  text: 'What did I learn about TypeScript?',
  topK: 5,
  datasetIds: ['dataset-1'], // Optional
  tags: ['programming'], // Optional
});

if (result.success && result.value.found) {
  result.value.results.forEach((item) => {
    console.log('Dataset:', item.datasetName);
    console.log('Content:', item.content);
  });
}
```

#### Specialized Search Functions

- `searchGraph(session, query)` - INSIGHTS search
- `searchChunks(session, query)` - CHUNKS search
- `searchInsights(session, query)` - INSIGHTS search
- `searchSummaries(session, query)` - SUMMARIES search
- `searchCode(session, query)` - CODE search

#### `getSearchHistory(session, filters?): Promise<Outcome<readonly SearchHistoryItem[]>>`

Get search history.

```typescript
const history = await getSearchHistory(session, {
  since: '2024-01-01',
});
```

### Dataset Management

#### `listDatasets(session): Promise<Outcome<readonly Dataset[]>>`

List datasets accessible to user (automatically filtered by organization).

```typescript
const datasets = await listDatasets(session);
```

#### `createDataset(session, name): Promise<Outcome<Dataset>>`

Create a new dataset explicitly.

```typescript
await createDataset(session, 'organization_org-123_custom_dataset');
```

#### `getDatasetGraph(session, datasetId): Promise<Outcome<DatasetGraph>>`

Get dataset graph for visualization.

```typescript
const graph = await getDatasetGraph(session, 'dataset-id-123');
```

#### `deleteDataset(session, datasetId): Promise<Outcome<void>>`

Delete a dataset.

```typescript
await deleteDataset(session, 'dataset-id-123');
```

#### `shareDataset(session, datasetId, userId, permissions): Promise<Outcome<void>>`

Share dataset with another user.

```typescript
await shareDataset(session, 'dataset-id-123', 'user-456', [
  'read',
  'write',
]);
```

### Utilities

#### Retry Logic

```typescript
import { withRetry, defaultRetryStrategy } from '@lineai/memory';

const result = await withRetry(
  () => remember(session, content),
  {
    ...defaultRetryStrategy,
    maxAttempts: 5,
    initialDelayMs: 500,
  }
);
```

#### Circuit Breaker

```typescript
import { CircuitBreaker } from '@lineai/memory';

const breaker = new CircuitBreaker(5, 60000); // threshold, timeout

const result = await breaker.execute(() => remember(session, content));
```

#### Validation

```typescript
import {
  validateDatasetName,
  validateOrganizationId,
  validateQuery,
  validateUrl,
} from '@lineai/memory';

const nameResult = validateDatasetName('my-dataset');
if (!nameResult.success) {
  console.error(nameResult.error.message);
}
```

## Examples

### Simple Chatbot

```typescript
import {
  createSession,
  remember,
  process,
  search,
  endSession,
} from '@lineai/memory';

const session = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice', password: 'secret' },
  organizationId: 'org-acme-corp',
  datasetStrategy: {
    scope: 'user',
    organizationId: 'org-acme-corp',
    userId: 'alice-123',
  },
});

if (!session.success) {
  throw new Error('Failed to create session');
}

const s = session.value;

// Remember conversation
await remember(s, {
  type: 'text',
  text: 'User: What is the capital of France?\nBot: Paris',
});

// Process into knowledge graph
await process(s);

// Search later
const outcome = await search(s, {
  text: 'What did I ask about France?',
});

if (outcome.success && outcome.value.found) {
  console.log(outcome.value.results[0].content);
}

await endSession(s);
```

### Multi-user Document System

```typescript
// Alice creates project dataset
const aliceSession = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice', password: 'secret' },
  organizationId: 'org-acme-corp',
  datasetStrategy: {
    scope: 'project',
    organizationId: 'org-acme-corp',
    projectId: 'proj-456',
  },
});

// Add project documents
const memory = await remember(aliceSession.value, {
  type: 'file',
  file: projectDoc,
});

// Share with Bob
if (memory.success) {
  await shareDataset(aliceSession.value, memory.value.datasetId, 'bob-789', [
    'read',
  ]);
}

// Bob searches
const bobSession = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'bob', password: 'secret' },
  organizationId: 'org-acme-corp',
  datasetStrategy: {
    scope: 'project',
    organizationId: 'org-acme-corp',
    projectId: 'proj-456',
  },
});

const outcome = await search(bobSession.value, {
  text: 'project requirements',
});
```

### RAG Pipeline

```typescript
import { createSession, remember, process, searchChunks } from '@lineai/memory';

const ragPipeline = async (documents: File[], userQuery: string) => {
  const session = await createSession({
    /* ... */
  });

  if (!session.success) {
    throw new Error('Failed to create session');
  }

  const s = session.value;

  // Ingest documents
  for (const doc of documents) {
    await remember(s, { type: 'file', file: doc });
  }

  // Process
  await process(s, { background: false });

  // Search for relevant chunks
  const outcome = await searchChunks(s, {
    text: userQuery,
    topK: 5,
  });

  if (!outcome.success || !outcome.value.found) {
    return 'No relevant information found';
  }

  // Use chunks as context for LLM
  const context = outcome.value.results.map((r) => r.content).join('\n\n');

  return generateResponse(context, userQuery);
};
```

## Design Principles

1. **Functional Purity** - All functions are pure with explicit dependencies
2. **Deterministic Patterns** - Discriminated unions instead of status fields
3. **Minimal Abstraction** - Direct mapping to domain concepts
4. **Explicit Configuration** - All configuration visible at call site
5. **Composition Over Configuration** - Compose behaviors instead of flags

## Migration from @lineai/cognee-api

### Before

```typescript
import { login, addData, cognify, search, CogneeConfig } from '@lineai/cognee-api';

const config: CogneeConfig = { baseUrl: 'http://localhost:8000' };

await login(config, { username: 'alice', password: 'secret' });
const file = new File(['content'], 'doc.txt');
await addData(config, [file], { datasetName: 'my-dataset' });
await cognify(config, { datasets: ['my-dataset'] });
const results = await search(config, { query: 'test', dataset_name: 'my-dataset' });
```

### After

```typescript
import { createSession, remember, process, search } from '@lineai/memory';

const session = await createSession({
  cogneeUrl: 'http://localhost:8000',
  credentials: { username: 'alice', password: 'secret' },
  organizationId: 'org-acme-corp',
  datasetStrategy: { scope: 'user', organizationId: 'org-acme-corp', userId: 'alice' },
});

await remember(session.value, { type: 'file', file: new File(['content'], 'doc.txt') });
await process(session.value);
const outcome = await search(session.value, { text: 'test' });
```

### Benefits

- ✅ Automatic dataset naming with organization isolation
- ✅ Type-safe error handling with discriminated unions
- ✅ Built-in session management
- ✅ Permission enforcement
- ✅ Retry logic and circuit breaker patterns

## License

MIT

## Contributing

Issues and pull requests welcome!