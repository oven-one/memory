/**
 * Search operations
 * Query memories with various search types
 */

import {
  search as cogneeSearch,
  SearchType,
  type SearchResult as CogneeSearchResult,
  GraphDTO,
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
 * RAG-based completion search (RAG_COMPLETION)
 * Retrieve-then-generate over text chunks using fast vector search
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Pulls top-k chunks via vector search, stitches a context window,
 * then asks an LLM to answer. Faster than graph-based methods for simple text-only RAG.
 */
export const searchRAG = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.RAG_COMPLETION);
};

/**
 * Graph-aware summary completion (GRAPH_SUMMARY_COMPLETION)
 * Builds graph context, condenses it, then generates concise answer
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Like GRAPH_COMPLETION but condenses context before answering for tighter,
 * summary-first responses.
 */
export const searchGraphSummary = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.GRAPH_SUMMARY_COMPLETION);
};

/**
 * Direct Cypher query execution (CYPHER)
 * Run raw Cypher queries against the knowledge graph
 *
 * @param session - Active session
 * @param query - Search query (query.text should be valid Cypher)
 * @returns Search outcome or error
 *
 * @description
 * Executes Cypher query directly against graph database.
 * Requires knowledge of graph schema. Technical use only.
 */
export const searchCypher = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.CYPHER);
};

/**
 * Natural language to Cypher (NATURAL_LANGUAGE)
 * Converts natural language question to Cypher, executes it
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Infers a Cypher query from natural language using graph schema,
 * runs it, and returns structured graph results.
 */
export const searchNaturalLanguage = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.NATURAL_LANGUAGE);
};

/**
 * Chain-of-thought graph reasoning (GRAPH_COMPLETION_COT)
 * Iterative rounds of graph retrieval and LLM reasoning
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Uses multiple reasoning steps to refine the answer.
 * Best for complex questions requiring stepwise logic.
 */
export const searchChainOfThought = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.GRAPH_COMPLETION_COT);
};

/**
 * Iterative context expansion (GRAPH_COMPLETION_CONTEXT_EXTENSION)
 * Starts with initial context, expands through follow-up queries
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Begins with initial graph context, lets LLM suggest follow-ups,
 * fetches more context, repeats. Good for open-ended exploration.
 */
export const searchContextExtension = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.GRAPH_COMPLETION_CONTEXT_EXTENSION);
};

/**
 * Automatic mode selection (FEELING_LUCKY)
 * LLM picks the most suitable search mode for your query
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Uses an LLM to analyze your query and automatically select
 * the best search mode, then executes it.
 */
export const searchFeelingLucky = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.FEELING_LUCKY);
};

/**
 * Store user feedback (FEEDBACK)
 * Records feedback on recent answers, links to graph elements
 *
 * @param session - Active session
 * @param query - Feedback data
 * @returns Search outcome or error
 *
 * @description
 * For storing user feedback on search results/answers.
 * Links feedback to graph elements for future tuning.
 */
export const searchFeedback = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.FEEDBACK);
};

/**
 * Temporal search (TEMPORAL)
 * Time-aware search across memories
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Searches with temporal context awareness.
 * Note: Full documentation pending - may fall back to GRAPH_COMPLETION.
 */
export const searchTemporal = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.TEMPORAL);
};

/**
 * Coding rules search (CODING_RULES)
 * Search for coding standards and best practices
 *
 * @param session - Active session
 * @param query - Search query
 * @returns Search outcome or error
 *
 * @description
 * Searches coding standards, patterns, and best practices.
 * Note: Full documentation pending - may fall back to GRAPH_COMPLETION.
 */
export const searchCodingRules = async (
  session: Session,
  query: Query
): Promise<Outcome<SearchOutcome>> => {
  return performSearch(session, query, SearchType.CODING_RULES);
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
      systemPrompt: query.systemPrompt,
      onlyContext: query.onlyContext,
      useCombinedContext: query.useCombinedContext,
    });

    // Convert results to our format
    if (!results || results.length === 0) {
      const outcome: SearchOutcome = {
        found: false,
        reason: 'No matching content found',
      };
      return { success: true, value: outcome };
    }

    console.log('Raw search results:', results);

    const searchResults: SearchResultItem[] = results.map(
      (result: CogneeSearchResult) => ({
        content: result.search_result,
        datasetId: result.dataset_id || 'unknown',
        datasetName: result.dataset_name || 'unknown',
        relevanceScore: undefined, // Cognee doesn't return scores in this format
      })
    );

    const graphResults: readonly GraphDTO[] = results.map((result: CogneeSearchResult) =>
      Object.entries(result.graphs || {}).map(([_, graphDto]) =>
        graphDto)).flat();

    const outcome: SearchOutcome = {
      found: true,
      results: searchResults,
      graphs: graphResults,
    };

    console.log('Processed search outcome:', outcome);

    return { success: true, value: outcome };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
