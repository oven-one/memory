/**
 * Remember (content ingestion)
 * Add content to memory with automatic dataset management
 */

import { addData, createDataset, getDatasets } from '@lineai/cognee-api';
import type { Session } from '../types/session';
import type {
  Content,
  Memory,
  RememberOptions,
} from '../types/memory';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';
import { generateDatasetName } from '../dataset/strategy';
import { sha256Native } from '../lib/hash';

/**
 * Add content to memory (single item)
 *
 * @param session - Active session
 * @param content - Content to remember
 * @param options - Optional tags and dataset name
 * @returns Memory reference or error
 *
 * @example
 * ```typescript
 * const memory = await remember(session, {
 *   type: 'text',
 *   text: 'Important information to remember',
 * });
 * ```
 */
export const remember = async (
  session: Session,
  content: Content,
  options?: RememberOptions
): Promise<Outcome<Memory>> => {
  try {
    // Determine dataset name
    const datasetName =
      options?.datasetName || generateDatasetName(session.datasetStrategy, session);

    // Ensure dataset exists
    const datasetId = await ensureDataset(session, datasetName);

    // Convert content to file
    const file = contentToFile(content);

    // Compute content hash
    const contentHash = await computeContentHash(content);

    // Add data to Cognee with tags as node sets for scoping
    const pipelineInfo = await addData(
      session.config,
      [file],
      {
        datasetName,
        datasetId,
        node_set: options?.tags || [] // Pass tags as node sets for search scoping
      }
    );

    // Create memory reference
    const memory: Memory = {
      id: pipelineInfo.pipeline_run_id,
      datasetId: pipelineInfo.dataset_id,
      datasetName: pipelineInfo.dataset_name,
      contentHash,
      createdAt: new Date().toISOString(),
      tags: options?.tags,
    };

    return { success: true, value: memory };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Add multiple items to memory (batch operation)
 *
 * @param session - Active session
 * @param contents - Array of content to remember
 * @param options - Optional tags and dataset name
 * @returns Array of memory references or error
 *
 * @example
 * ```typescript
 * const memories = await rememberMany(session, [
 *   { type: 'text', text: 'First item' },
 *   { type: 'text', text: 'Second item' },
 * ]);
 * ```
 */
export const rememberMany = async (
  session: Session,
  contents: readonly Content[],
  options?: RememberOptions
): Promise<Outcome<readonly Memory[]>> => {
  try {
    // Determine dataset name
    const datasetName =
      options?.datasetName || generateDatasetName(session.datasetStrategy, session);

    // Ensure dataset exists
    const datasetId = await ensureDataset(session, datasetName);

    // Convert all content to files
    const files = contents.map(contentToFile);

    // Add data to Cognee with tags as node sets for scoping
    const pipelineInfo = await addData(
      session.config,
      files,
      {
        datasetName,
        datasetId,
        node_set: options?.tags || [] // Pass tags as node sets for search scoping
      }
    );

    // Create memory references for all items
    const memories: Memory[] = await Promise.all(
      contents.map(async (content, index) => ({
        id: `${pipelineInfo.pipeline_run_id}_${index}`,
        datasetId: pipelineInfo.dataset_id,
        datasetName: pipelineInfo.dataset_name,
        contentHash: await computeContentHash(content),
        createdAt: new Date().toISOString(),
        tags: options?.tags,
      }))
    );

    return { success: true, value: memories };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Ensure dataset exists, create if not
 */
const ensureDataset = async (
  session: Session,
  datasetName: string
): Promise<string> => {
  // Check if dataset exists
  const datasets = await getDatasets(session.config);
  const existing = datasets.find((d) => d.name === datasetName);

  if (existing) {
    return existing.id;
  }

  // Create dataset
  const dataset = await createDataset(session.config, { name: datasetName });
  return dataset.id;
};

/**
 * Convert content to File object
 */
const contentToFile = (content: Content): File => {
  switch (content.type) {
    case 'text':
      return new File([content.text], 'content.txt', { type: 'text/plain' });

    case 'file':
      return content.file;

    case 'url':
      // For URLs, create a text file with the URL
      // Cognee will fetch the content
      return new File([content.url], 'url.txt', { type: 'text/plain' });
  }
};

/**
 * Compute content hash for deduplication
 */
const computeContentHash = async (content: Content): Promise<string> => {
  switch (content.type) {
    case 'text':
      return sha256Native(content.text);

    case 'file':
      // For files, hash the file name and size as a simple identifier
      // In production, you might want to read and hash the file content
      return sha256Native(`${content.file.name}:${content.file.size}`);

    case 'url':
      return sha256Native(content.url);
  }
};
