/**
 * Session types for @lineai/memory
 * Session management and authentication types
 */

import type { CogneeConfig } from '@lineai/cognee-api';
import type { DatasetStrategy } from './dataset';

/**
 * Session represents an authenticated connection to Cognee
 * with dataset strategy configuration
 */
export type Session = {
  readonly cogneeUrl: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly userName: string;
  readonly datasetStrategy: DatasetStrategy;
  readonly config: CogneeConfig;
};

/**
 * Credentials for authentication
 */
export type Credentials = {
  readonly username: string;
  readonly password: string;
};

/**
 * Parameters for creating a new session
 */
export type CreateSessionParams = {
  readonly cogneeUrl: string;
  readonly credentials: Credentials;
  readonly organizationId: string;
  readonly datasetStrategy: DatasetStrategy;
};
