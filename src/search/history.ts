/**
 * Search history
 * Retrieve past search queries
 */

import { getSearchHistory as cogneeGetSearchHistory } from '@lineai/cognee-api';
import type { Session } from '../types/session';
import type { SearchHistoryItem, SearchHistoryFilters } from '../types/search';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';

/**
 * Get search history
 *
 * @param session - Active session
 * @param filters - Optional filters (date range, datasets)
 * @returns Array of search history items or error
 *
 * @example
 * ```typescript
 * const history = await getSearchHistory(session, {
 *   since: '2024-01-01',
 * });
 * ```
 */
export const getSearchHistory = async (
  session: Session,
  filters?: SearchHistoryFilters
): Promise<Outcome<readonly SearchHistoryItem[]>> => {
  try {
    const history = await cogneeGetSearchHistory(session.config);

    // Convert to our format
    let items: SearchHistoryItem[] = history.map((item) => ({
      id: item.id,
      query: item.text,
      timestamp: item.createdAt,
    }));

    // Apply filters
    if (filters?.since) {
      const sinceDate = new Date(filters.since);
      items = items.filter((item) => new Date(item.timestamp) >= sinceDate);
    }

    // Note: Dataset filtering would require additional metadata from Cognee
    // that's not currently available in the search history response

    return { success: true, value: items };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
