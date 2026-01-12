/**
 * Shared Memory - 各 MCP Server 的統一資料共享層
 * 簡化版：直接使用 Map-based storage，無需 SQL
 */

// 導出主要的 Storage 類別
export { SQLiteStorage } from './storage/sqlite.js';

// 導出類型定義
export type {
    ServiceInfo,
    SLODefinition,
    MetricMetadata,
    IncidentRecord,
    AIContext,
    QueryFilter,
    SharedMemoryEvent,
    SharedMemoryEventData,
} from './schema/types.js';

// 為了向後相容，提供 SharedMemory 別名
import { SQLiteStorage } from './storage/sqlite.js';
export { SQLiteStorage as SharedMemory };
