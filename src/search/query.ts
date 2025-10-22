/**
 * Search operations
 * Query memories with various search types
 */

import {
  search as cogneeSearch,
  SearchType,
  type SearchResult as CogneeSearchResult,
} from '@lineai/cognee-api';
import type { Session } from '../types/session';
import type { Query, SearchOutcome, SearchResultItem } from '../types/search';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';
import { generateDatasetName } from '../dataset/strategy';
import { isOrganizationDataset } from '../dataset/strategy';

/**
 * Search across memories (GRAPH_COMPLETION by default)
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @example
 * ```typescript
 * const outcome = await search(session, {
 *   text: 'What did I learn about TypeScript?',
 *   topK: 5,
 * });
 *
 * if (outcome.found) {
 *   console.log(outcome.results);
 * }
 * ```
 */
export const search = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.GRAPH_COMPLETION);
};

/**
 * Search graph structure (INSIGHTS)
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 */
export const searchGraph = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.INSIGHTS);
};

/**
 * Search text chunks (CHUNKS)
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 */
export const searchChunks = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.CHUNKS);
};

/**
 * Search pre-computed insights (INSIGHTS)
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 */
export const searchInsights = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.INSIGHTS);
};

/**
 * Search hierarchical summaries (SUMMARIES)
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 */
export const searchSummaries = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.SUMMARIES);
};

/**
 * Search code knowledge graph (CODE)
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 */
export const searchCode = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.CODE);
};

/**
 * Perform search with specified type
 */
const performSearch = async (
  session: Session,
  query: Query,
  searchType: SearchType
): Promise<Outcome<SearchOutcome>> => {
  try {
    // Determine datasets to search
    const datasets = query.datasetIds || [
      generateDatasetName(session.datasetStrategy, session),
    ];

    // Filter datasets to only include those from the current organization
    const organizationDatasets = datasets.filter((name) =>
      isOrganizationDataset(name, session.organizationId)
    );

    if (organizationDatasets.length === 0) {
      const outcome: SearchOutcome = {
        found: false,
        reason: 'No datasets available for this organization',
      };
      return { success: true, value: outcome };
    }

    // Perform search
    const results = await cogneeSearch(session.config, {
      query: query.text,
      searchType: searchType,
      datasets: organizationDatasets,
      nodeName: query.tags, // Scope search to specific cards via node sets
      topK: query.topK,
    });

    // Convert results to our format
    if (!results || results.length === 0) {
      const outcome: SearchOutcome = {
        found: false,
        reason: 'No matching content found',
      };
      return { success: true, value: outcome };
    }

    const searchResults: SearchResultItem[] = results.map(
      (result: CogneeSearchResult) => ({
        content: result.search_result,
        datasetId: result.dataset_id || 'unknown',
        datasetName: result.dataset_name || 'unknown',
        relevanceScore: undefined, // Cognee doesn't return scores in this format
      })
    );

    const outcome: SearchOutcome = {
      found: true,
      results: searchResults,
    };

    return { success: true, value: outcome };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
