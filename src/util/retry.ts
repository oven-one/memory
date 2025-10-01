/**
 * Retry utilities
 * Exponential backoff retry logic for resilient operations
 */

import type { Outcome, MemoryError } from '../types/errors';

/**
 * Retry strategy configuration
 */
export type RetryStrategy = {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
  readonly retryableErrors: readonly string[];
};

/**
 * Default retry strategy
 */
export const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableErrors: ['network_error', 'processing_failed'],
};

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry with exponential backoff
 *
 * @param fn - Function to retry
 * @param strategy - Retry strategy configuration
 * @returns Result from function or final error
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => someApiCall(),
 *   { maxAttempts: 5, initialDelayMs: 500 }
 * );
 * ```
 */
export const withRetry = async <T>(
  fn: () => Promise<Outcome<T>>,
  strategy: RetryStrategy = defaultRetryStrategy
): Promise<Outcome<T>> => {
  const attempt = async (attemptNumber: number): Promise<Outcome<T>> => {
    const result = await fn();

    // Success - return immediately
    if (result.success) {
      return result;
    }

    // Type narrowing - result is now known to be an error
    const errorResult = result as { readonly success: false; readonly error: MemoryError };

    // Max attempts reached - return error
    if (attemptNumber >= strategy.maxAttempts) {
      return errorResult;
    }

    // Check if error is retryable
    if (!isRetryableError(errorResult.error, strategy)) {
      return errorResult;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      strategy.initialDelayMs *
        Math.pow(strategy.backoffFactor, attemptNumber - 1),
      strategy.maxDelayMs
    );

    // Wait before retrying
    await sleep(delay);

    // Retry
    return attempt(attemptNumber + 1);
  };

  return attempt(1);
};

/**
 * Check if error is retryable based on strategy
 */
const isRetryableError = (
  error: MemoryError,
  strategy: RetryStrategy
): boolean => {
  return strategy.retryableErrors.includes(error.error);
};

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker<T> {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}

  async execute(fn: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
    // Check if circuit is open
    if (this.state === 'open') {
      const now = Date.now();
      if (
        this.lastFailureTime &&
        now - this.lastFailureTime >= this.timeout
      ) {
        // Timeout expired, move to half-open
        this.state = 'half-open';
      } else {
        // Circuit is still open
        return {
          success: false,
          error: {
            error: 'network_error',
            statusCode: 503,
            message: 'Circuit breaker is open',
          },
        };
      }
    }

    // Execute function
    const result = await fn();

    if (result.success) {
      // Success - reset failure count
      this.failureCount = 0;
      if (this.state === 'half-open') {
        this.state = 'closed';
      }
      return result;
    }

    // Failure - increment count
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Check if threshold reached
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }

    return result;
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}
