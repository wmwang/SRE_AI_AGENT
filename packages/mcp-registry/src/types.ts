/**
 * MCP Server 元數據介面
 */
export interface MCPServerMetadata {
    /** 唯一識別碼，例如: "slo-management" */
    id: string;

    /** 顯示名稱，例如: "SLO Management Server" */
    name: string;

    /** 版本號，例如: "1.0.0" */
    version: string;

    /** 伺服器功能描述 */
    description: string;

    /** 分類，例如: "monitoring", "logging", "deployment" */
    category: ServerCategory;

    /** 連接端點類型 */
    endpoint: EndpointType;

    /** 當前狀態 */
    status: ServerStatus;

    /** 伺服器能力 */
    capabilities: ServerCapabilities;

    /** 標籤列表，用於搜尋和分類 */
    tags: string[];

    /** 註冊時間 */
    registeredAt: string;

    /** 最後更新時間 */
    lastUpdatedAt: string;
}

/**
 * 伺服器分類
 */
export type ServerCategory =
    | 'monitoring'    // 監控相關
    | 'logging'       // 日誌相關
    | 'deployment'    // 部署相關
    | 'security'      // 安全相關
    | 'cost'          // 成本相關
    | 'general';      // 通用

/**
 * 端點類型
 */
export type EndpointType =
    | 'stdio'         // 標準輸入輸出
    | 'http'          // HTTP 端點
    | 'websocket';    // WebSocket 端點

/**
 * 伺服器狀態
 */
export type ServerStatus =
    | 'active'        // 運行中
    | 'inactive'      // 停用
    | 'error';        // 錯誤

/**
 * 伺服器能力
 */
export interface ServerCapabilities {
    /** 提供的工具列表 */
    tools: ToolMetadata[];

    /** 提供的資源列表 */
    resources: ResourceMetadata[];

    /** 提供的 prompts 列表 */
    prompts: PromptMetadata[];
}

/**
 * 工具元數據
 */
export interface ToolMetadata {
    /** 工具名稱 */
    name: string;

    /** 功能描述（英文） */
    description: string;

    /** 功能描述（繁體中文） */
    description_zh: string;

    /** 工具分類 */
    category: string;

    /** 輸入參數的 JSON Schema */
    inputSchema: Record<string, unknown>;

    /** 使用範例 */
    examples?: ToolExample[];
}

/**
 * 工具使用範例
 */
export interface ToolExample {
    /** 範例描述 */
    description: string;

    /** 輸入參數 */
    input: Record<string, unknown>;

    /** 預期輸出（可選） */
    output?: unknown;
}

/**
 * 資源元數據
 */
export interface ResourceMetadata {
    /** 資源 URI */
    uri: string;

    /** 資源名稱 */
    name: string;

    /** 資源描述 */
    description: string;

    /** MIME 類型 */
    mimeType?: string;
}

/**
 * Prompt 元數據
 */
export interface PromptMetadata {
    /** Prompt 名稱 */
    name: string;

    /** Prompt 描述 */
    description: string;

    /** 參數列表 */
    arguments?: PromptArgument[];
}

/**
 * Prompt 參數
 */
export interface PromptArgument {
    /** 參數名稱 */
    name: string;

    /** 參數描述 */
    description: string;

    /** 是否必要 */
    required: boolean;
}

/**
 * Registry 事件類型
 */
export type RegistryEvent =
    | 'server-added'      // 伺服器新增
    | 'server-removed'    // 伺服器移除
    | 'server-updated'    // 伺服器更新
    | 'server-status-changed'; // 伺服器狀態變更

/**
 * Registry 事件資料
 */
export interface RegistryEventData {
    event: RegistryEvent;
    serverId: string;
    metadata?: MCPServerMetadata;
    timestamp: string;
}

/**
 * 搜尋結果
 */
export interface SearchResult {
    /** 伺服器 ID */
    serverId: string;

    /** 伺服器名稱 */
    serverName: string;

    /** 找到的工具 */
    tool: ToolMetadata;

    /** 相關度分數（0-1） */
    relevance: number;
}
