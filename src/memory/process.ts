/**
 * Process (cognify)
 * Process memories into knowledge graph
 */

import { cognify, getDatasetStatus, PipelineRunStatus } from '@lineai/cognee-api';
import type { Session } from '../types/session';
import type {
  ProcessingReference,
  ProcessOptions,
  ProcessingStatus,
} from '../types/memory';
import type { Outcome } from '../types/errors';
import { mapCogneeError } from '../util/errors';
import { generateDatasetName } from '../dataset/strategy';

/**
 * Process memories into knowledge graph
 *
 * @param session - Active session
 * @param options - Optional dataset IDs and background mode
 * @returns Processing reference or error
 *
 * @example
 * ```typescript
 * const ref = await process(session, { background: false });
 * ```
 */
export const process = async (
  session: Session,
  options?: ProcessOptions
): Promise<Outcome<ProcessingReference>> => {
  try {
    // If no dataset IDs provided, use the session's strategy to determine dataset
    const datasetIds = options?.datasetIds || [
      generateDatasetName(session.datasetStrategy, session),
    ];

    // Trigger cognify
    const response = await cognify(session.config, {
      datasets: datasetIds,
      run_in_background: options?.background ?? false,
    });

    // Extract first dataset info (for multiple datasets, they all process together)
    const firstDatasetId = Object.keys(response)[0];
    const firstInfo = response[firstDatasetId];

    // Create processing reference
    const reference: ProcessingReference = {
      id: firstInfo.pipeline_run_id,
      datasetIds: Object.values(response).map((info) => info.dataset_id),
      startedAt: new Date().toISOString(),
    };

    return { success: true, value: reference };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Check processing status
 *
 * @param session - Active session
 * @param reference - Processing reference from process()
 * @returns Processing status or error
 *
 * @example
 * ```typescript
 * const status = await getProcessingStatus(session, reference);
 * if (status.complete) {
 *   console.log('Processing complete!');
 * }
 * ```
 */
export const getProcessingStatus = async (
  session: Session,
  reference: ProcessingReference
): Promise<Outcome<ProcessingStatus>> => {
  try {
    // Get status for all datasets
    const statusResponse = await getDatasetStatus(
      session.config,
      reference.datasetIds
    );

    // Check if all datasets are completed
    const statuses = Object.values(statusResponse);
    const allCompleted = statuses.every(
      (status) => status === PipelineRunStatus.DATASET_PROCESSING_COMPLETED
    );
    const anyErrored = statuses.some(
      (status) => status === PipelineRunStatus.DATASET_PROCESSING_ERRORED
    );

    if (anyErrored) {
      const status: ProcessingStatus = {
        error: true,
        message: 'Processing failed for one or more datasets',
      };
      return { success: true, value: status };
    }

    if (allCompleted) {
      const status: ProcessingStatus = {
        complete: true,
        datasetIds: reference.datasetIds,
      };
      return { success: true, value: status };
    }

    // Calculate progress (simple approach: completed / total)
    const completedCount = statuses.filter(
      (status) => status === PipelineRunStatus.DATASET_PROCESSING_COMPLETED
    ).length;
    const progress = (completedCount / statuses.length) * 100;

    const status: ProcessingStatus = {
      complete: false,
      progress,
      message: `Processing ${completedCount}/${statuses.length} datasets`,
    };

    return { success: true, value: status };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};
