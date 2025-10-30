/**
 * Search types for @lineai/memory
 * Query, results, and search history types
 */

import type { GraphDTO } from '@lineai/cognee-api';

/**
 * Search query
 */
export type Query = {
  /** Query text (natural language question recommended) */
  readonly text: string;

  /** Dataset IDs to search within (uses session dataset strategy if not provided) */
  readonly datasetIds?: readonly string[];

  /** Tags to filter results (e.g., card-specific tags) */
  readonly tags?: readonly string[];

  /** Number of results to return (default: 10) */
  readonly topK?: number;

  /**
   * System prompt to provide context for LLM-based search types.
   * Example: "User is Mike from Supreme Auto Store looking for vendor information"
   * Only applies to search types that generate answers (e.g., GRAPH_COMPLETION, RAG_COMPLETION)
   */
  readonly systemPrompt?: string;

  /**
   * Return only raw context/data instead of AI-generated answer.
   * When true, returns the data that would be fed to the LLM rather than the LLM's narrated response.
   * Useful when you need actual datapoints for further processing.
   */
  readonly onlyContext?: boolean;

  /**
   * Use combined context from multiple sources.
   * Enables broader context aggregation across graph and vector results.
   */
  readonly useCombinedContext?: boolean;
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
