/**
 * Dataset types for @lineai/memory
 * Dataset strategies, permissions, and dataset management types
 */

import type { GraphDTO } from '@lineai/cognee-api';

/**
 * Dataset naming strategy
 *
 * All datasets are organization-scoped for multi-tenant isolation.
 * Users from Organization A can NEVER see data from Organization B.
 */
export type DatasetStrategy =
  | {
      readonly scope: 'user';
      readonly organizationId: string;
      readonly userId: string;
    }
  | {
      readonly scope: 'project';
      readonly organizationId: string;
      readonly projectId: string;
    }
  | {
      readonly scope: 'organization';
      readonly organizationId: string;
    }
  | {
      readonly scope: 'custom';
      readonly namingFn: (context: DatasetContext) => string;
    };

/**
 * Context passed to custom naming functions
 */
export type DatasetContext = {
  readonly organizationId: string;
  readonly userId: string;
  readonly [key: string]: unknown;
};

/**
 * Dataset permission types
 */
export type Permission = 'read' | 'write' | 'delete' | 'share';

/**
 * Dataset information
 */
export type Dataset = {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string | null;
  readonly permissions: readonly {
    readonly userId: string;
    readonly permission: Permission;
  }[];
};

/**
 * Dataset graph for visualization
 */
export type DatasetGraph = GraphDTO;
