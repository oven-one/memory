/**
 * Search types for @lineai/memory
 * Query, results, and search history types
 */

import type { GraphDTO } from '@lineai/cognee-api';

/**
 * Search query
 */
export type Query = {
  readonly text: string;
  readonly datasetIds?: readonly string[];
  readonly tags?: readonly string[];
  readonly topK?: number;
};

/**
 * Search result item
 */
export type SearchResultItem = {
  readonly content: unknown;
  readonly datasetId: string;
  readonly datasetName: string;
  readonly relevanceScore?: number;
};

/**
 * Search outcome (discriminated union)
 */
export type SearchOutcome =
  | {
      readonly found: true;
      readonly results: readonly SearchResultItem[];
      readonly graphs?: readonly GraphDTO[];
    }
  | {
      readonly found: false;
      readonly reason: string;
    };

/**
 * Search history item
 */
export type SearchHistoryItem = {
  readonly id: string;
  readonly query: string;
  readonly timestamp: string;
};

/**
 * Filters for search history
 */
export type SearchHistoryFilters = {
  readonly since?: string;
  readonly datasetIds?: readonly string[];
};
