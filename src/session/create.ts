/**
 * Create session
 * Authenticate and initialize a memory session
 */

import { login, getCurrentUser, type CogneeConfig } from '@lineai/cognee-api';
import type { Session, CreateSessionParams } from '../types/session';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';

/**
 * Create a new authenticated session
 *
 * @param params - Session creation parameters
 * @returns Session object or error
 *
 * @example
 * ```typescript
 * const session = await createSession({
 *   cogneeUrl: 'http://localhost:8000',
 *   credentials: { username: 'alice', password: 'secret' },
 *   organizationId: 'org-acme-corp',
 *   datasetStrategy: { scope: 'user', organizationId: 'org-acme-corp', userId: 'alice-123' },
 * });
 * ```
 */
export const createSession = async (
  params: CreateSessionParams
): Promise<Outcome<Session>> => {
  try {
    const config: CogneeConfig = {
      baseUrl: params.cogneeUrl,
    };

    // Authenticate
    await login(config, params.credentials);

    // Get current user info
    const user = await getCurrentUser(config);

    // Create session
    const session: Session = {
      cogneeUrl: params.cogneeUrl,
      organizationId: params.organizationId,
      userId: user.id,
      userName: user.email,
      datasetStrategy: params.datasetStrategy,
      config,
    };

    return { success: true, value: session };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
