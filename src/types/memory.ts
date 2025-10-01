/**
 * Memory types for @lineai/memory
 * Content ingestion, processing, and memory reference types
 */

/**
 * Content to remember
 */
export type Content =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'file'; readonly file: File }
  | { readonly type: 'url'; readonly url: string };

/**
 * Memory reference after ingestion
 */
export type Memory = {
  readonly id: string;
  readonly datasetId: string;
  readonly datasetName: string;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly tags?: readonly string[];
};

/**
 * Options for remembering content
 */
export type RememberOptions = {
  readonly tags?: readonly string[];
  readonly datasetName?: string;
};

/**
 * Processing reference returned after starting cognify
 */
export type ProcessingReference = {
  readonly id: string;
  readonly datasetIds: readonly string[];
  readonly startedAt: string;
};

/**
 * Options for processing memories
 */
export type ProcessOptions = {
  readonly datasetIds?: readonly string[];
  readonly background?: boolean;
};

/**
 * Processing status (discriminated union)
 */
export type ProcessingStatus =
  | {
      readonly complete: true;
      readonly datasetIds: readonly string[];
    }
  | {
      readonly complete: false;
      readonly progress: number;
      readonly message: string;
    }
  | {
      readonly error: true;
      readonly message: string;
    };

/**
 * Deletion mode for forget operation
 */
export type DeleteMode = 'soft' | 'hard';
