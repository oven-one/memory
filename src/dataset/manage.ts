/**
 * Dataset management
 * CRUD operations for datasets
 */

import {
  createDataset as cogneeCreateDataset,
  deleteDataset as cogneeDeleteDataset,
  getDatasetData as cogneeGetDatasetData,
  getDatasetGraph as cogneeGetDatasetGraph,
  getDatasets as cogneeGetDatasets,
  type DataDTO,
  type DatasetDTO,
} from '@lineai/cognee-api';

import type { Dataset, DatasetDataItem, DatasetGraph } from '../types/dataset';
import type { Outcome } from '../types/errors';
import type { Session } from '../types/session';
import { mapCogneeError } from '../util/errors';

import { isOrganizationDataset } from './strategy';

/**
 * List datasets accessible to user
 *
 * Automatically filters to only show datasets from the user's organization
 *
 * @param session - Active session
 * @returns Array of datasets or error
 *
 * @example
 * ```typescript
 * const datasets = await listDatasets(session);
 * ```
 */
export const listDatasets = async (
  session: Session
): Promise<Outcome<readonly Dataset[]>> => {
  try {
    const datasets = await cogneeGetDatasets(session.config);

    // Filter to only include organization datasets
    const organizationDatasets = datasets
      .filter((d) => isOrganizationDataset(d.name, session.organizationId))
      .map(convertDataset);

    return { success: true, value: organizationDatasets };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Create a new dataset explicitly
 *
 * @param session - Active session
 * @param name - Dataset name (must follow naming conventions)
 * @returns Created dataset or error
 *
 * @example
 * ```typescript
 * const dataset = await createDataset(session, 'organization_org-123_custom_dataset');
 * ```
 */
export const createDataset = async (
  session: Session,
  name: string
): Promise<Outcome<Dataset>> => {
  try {
    // Validate that dataset name belongs to the organization
    if (!isOrganizationDataset(name, session.organizationId)) {
      return {
        success: false,
        error: {
          error: 'invalid_input',
          field: 'name',
          message: `Dataset name must belong to organization ${session.organizationId}`,
        },
      };
    }

    const dataset = await cogneeCreateDataset(session.config, { name });

    return { success: true, value: convertDataset(dataset) };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Get dataset graph for visualization
 *
 * @param session - Active session
 * @param datasetId - Dataset ID
 * @returns Dataset graph or error
 *
 * @example
 * ```typescript
 * const graph = await getDatasetGraph(session, 'dataset-id-123');
 * ```
 */
export const getDatasetGraph = async (
  session: Session,
  datasetId: string
): Promise<Outcome<DatasetGraph>> => {
  try {
    const graph = await cogneeGetDatasetGraph(session.config, datasetId);

    return { success: true, value: graph };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Get dataset data items
 *
 * Returns all data items (files, documents, etc.) in a dataset
 *
 * @param session - Active session
 * @param datasetId - Dataset ID
 * @returns Array of data items or error
 *
 * @example
 * ```typescript
 * const items = await getDatasetData(session, 'dataset-id-123');
 * if (items.success) {
 *   items.value.forEach(item => {
 *     console.log(item.name, item.mimeType, item.extension);
 *   });
 * }
 * ```
 */
export const getDatasetData = async (
  session: Session,
  datasetId: string
): Promise<Outcome<readonly DatasetDataItem[]>> => {
  try {
    const data = await cogneeGetDatasetData(session.config, datasetId);

    const items = data.map(convertDataItem);
    console.log(`[Dataset]`, data, items);

    return { success: true, value: items };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Delete a dataset
 *
 * @param session - Active session
 * @param datasetId - Dataset ID to delete
 * @returns Success or error
 *
 * @example
 * ```typescript
 * await deleteDataset(session, 'dataset-id-123');
 * ```
 */
export const deleteDataset = async (
  session: Session,
  datasetId: string
): Promise<Outcome<void>> => {
  try {
    await cogneeDeleteDataset(session.config, datasetId);

    return { success: true, value: undefined };
  } catch (err) {
    return { success: false, error: mapCogneeError(err) };
  }
};

/**
 * Convert Cognee DatasetDTO to our Dataset type
 */
const convertDataset = (dto: DatasetDTO): Dataset => ({
  id: dto.id,
  name: dto.name,
  ownerId: dto.owner_id,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  permissions: [], // Cognee doesn't return permissions in dataset list
});

/**
 * Convert Cognee DataDTO to our DatasetDataItem type
 */
const convertDataItem = (dto: DataDTO): DatasetDataItem => ({
  id: dto.id,
  name: dto.name,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  extension: dto.extension,
  mimeType: dto.mimeType,
  rawDataLocation: dto.rawDataLocation,
  datasetId: dto.datasetId,
  nodeSet: dto.nodeSet,
});
