/**
 * Forget (content removal)
 * Remove content from memory
 */

import { deleteData } from '@lineai/cognee-api';
import type { Session } from '../types/session';
import type { Memory, DeleteMode } from '../types/memory';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';

/**
 * Remove content from memory
 *
 * @param session - Active session
 * @param memory - Memory reference to remove
 * @param mode - Deletion mode ('soft' or 'hard'), defaults to 'soft'
 * @returns Success or error
 *
 * @example
 * ```typescript
 * await forget(session, memory, 'soft');
 * ```
 */
export const forget = async (
  session: Session,
  memory: Memory,
  mode: DeleteMode = 'soft'
): Promise<Outcome<void>> => {
  try {
    // Delete data from Cognee
    // Note: We use the pipeline_run_id as data_id since that's what we stored
    await deleteData(session.config, memory.datasetId, memory.id, mode);

    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
