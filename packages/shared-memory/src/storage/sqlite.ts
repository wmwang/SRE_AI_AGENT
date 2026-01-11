import Database from 'better-sqlite3';

/**
 * SQLite Storage - Shared Memory 的儲存層
 * 
 * 負責：
 * 1. 資料庫初始化與 schema 建立
 * 2. CRUD 操作
 * 3. 查詢與過濾
 * 4. 事務管理
 */
export class SQLiteStorage {
    private db: Database.Database;

    constructor(dbPath: string = ':memory:') {
        this.db = new Database(dbPath);
        this.initializeDatabase();
    }

    /**
     * 初始化資料庫結構
     */
    private initializeDatabase(): void {
        this.db.exec(`
      -- 服務資訊表
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        dependencies TEXT NOT NULL,
        k8s_config TEXT,
        labels TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_services_type ON services(type);
      CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
      
      -- SLO 定義表
      CREATE TABLE IF NOT EXISTS slos (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        description_zh TEXT NOT NULL,
        target REAL NOT NULL,
        threshold TEXT,
        window TEXT NOT NULL,
        golden_signal TEXT NOT NULL,
        status TEXT NOT NULL,
        error_budget REAL NOT NULL,
        last_evaluated TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_slos_service ON slos(service_id);
      CREATE INDEX IF NOT EXISTS idx_slos_status ON slos(status);
      CREATE INDEX IF NOT EXISTS idx_slos_golden_signal ON slos(golden_signal);
      
      -- 指標元數據表
      CREATE TABLE IF NOT EXISTS metrics (
        name TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        labels TEXT NOT NULL,
        description TEXT NOT NULL,
        related_services TEXT NOT NULL,
        unit TEXT,
        high_cardinality INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(type);
      
      -- 事件記錄表
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        affected_services TEXT NOT NULL,
        timeline TEXT NOT NULL,
        resolution TEXT,
        root_cause TEXT,
        started_at TEXT NOT NULL,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_incidents_started ON incidents(started_at);
      
      -- AI 上下文表
      CREATE TABLE IF NOT EXISTS ai_context (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_focus TEXT NOT NULL,
        recent_analysis TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        last_updated TEXT NOT NULL
      );
      
      -- 插入預設的 AI 上下文
      INSERT OR IGNORE INTO ai_context (id, current_focus, recent_analysis, recommendations, last_updated)
      VALUES (1, '', '[]', '[]', datetime('now'));
      
      -- 全文搜尋索引
      CREATE VIRTUAL TABLE IF NOT EXISTS services_fts USING fts5(
        service_id,
        name,
        description,
        content=''
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS slos_fts USING fts5(
        slo_id,
        name,
        description,
        description_zh,
        content=''
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS incidents_fts USING fts5(
        incident_id,
        title,
        resolution,
        content=''
      );
    `);
    }

    /**
     * 取得資料庫實例
     */
    getDatabase(): Database.Database {
        return this.db;
    }

    /**
     * 執行查詢
     */
    query<T = unknown>(sql: string, params?: unknown[]): T[] {
        const stmt = this.db.prepare(sql);
        return (params ? stmt.all(...params) : stmt.all()) as T[];
    }

    /**
     * 執行單筆查詢
     */
    queryOne<T = unknown>(sql: string, params?: unknown[]): T | null {
        const stmt = this.db.prepare(sql);
        return (params ? stmt.get(...params) : stmt.get()) as T | null;
    }

    /**
     * 執行寫入操作
     */
    execute(sql: string, params?: unknown[]): Database.RunResult {
        const stmt = this.db.prepare(sql);
        return params ? stmt.run(...params) : stmt.run();
    }

    /**
     * 執行事務
     */
    transaction<T>(fn: () => T): T {
        return this.db.transaction(fn)();
    }

    /**
     * 關閉資料庫連接
     */
    close(): void {
        this.db.close();
    }
}
