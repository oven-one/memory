/**
 * End session
 * Logout and cleanup session
 */

import { logout } from '@lineai/cognee-api';
import type { Session } from '../types/session';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';

/**
 * End a session (logout)
 *
 * @param session - Active session
 * @returns Success or error
 *
 * @example
 * ```typescript
 * await endSession(session);
 * ```
 */
export const endSession = async (session: Session): Promise<Outcome<void>> => {
  try {
    await logout(session.config);
    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
