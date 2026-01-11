import { EventEmitter } from 'eventemitter3';
import { SQLiteStorage } from './storage/sqlite.js';
import type {
    ServiceInfo,
    SLODefinition,
    MetricMetadata,
    IncidentRecord,
    AIContext,
    QueryFilter,
    SharedMemoryEvent,
    SharedMemoryEventData,
} from './schema/types.js';

/**
 * Shared Memory - 各 MCP Server 的統一資料共享層
 * 
 * 提供：
 * 1. 服務拓撲管理
 * 2. SLO 定義與狀態追蹤
 * 3. 指標元數據管理
 * 4. 事件記錄
 * 5. AI 上下文共享
 * 6. 事件通知機制
 */
export class SharedMemory extends EventEmitter<Record<SharedMemoryEvent, [SharedMemoryEventData]>> {
    private storage: SQLiteStorage;

    constructor(dbPath: string = '~/.sre-agent/shared-memory.db') {
        super();
        this.storage = new SQLiteStorage(dbPath);
    }

    // ==================== 服務管理 ====================

    /**
     * 新增或更新服務
     */
    upsertService(service: ServiceInfo): void {
        const now = new Date().toISOString();
        const serviceWithTimestamp = {
            ...service,
            lastUpdated: now,
        };

        this.storage.execute(
            `INSERT INTO services (id, name, type, dependencies, k8s_config, labels, last_updated, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         type = excluded.type,
         dependencies = excluded.dependencies,
         k8s_config = excluded.k8s_config,
         labels = excluded.labels,
         last_updated = excluded.last_updated,
         metadata = excluded.metadata`,
            [
                service.id,
                service.name,
                service.type,
                JSON.stringify(service.dependencies),
                service.k8sConfig ? JSON.stringify(service.k8sConfig) : null,
                JSON.stringify(service.labels),
                now,
                service.metadata ? JSON.stringify(service.metadata) : null,
                now,
            ]
        );

        // 索引到全文搜尋
        this.indexService(service);

        this.emit('service-added', {
            event: 'service-added',
            resourceId: service.id,
            resourceType: 'service',
            timestamp: now,
            data: serviceWithTimestamp,
        });
    }

    /**
     * 取得服務資訊
     */
    getService(serviceId: string): ServiceInfo | null {
        const row = this.storage.queryOne<{
            id: string;
            name: string;
            type: string;
            dependencies: string;
            k8s_config: string | null;
            labels: string;
            last_updated: string;
            metadata: string | null;
        }>('SELECT * FROM services WHERE id = ?', [serviceId]);

        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            type: row.type as ServiceInfo['type'],
            dependencies: JSON.parse(row.dependencies),
            k8sConfig: row.k8s_config ? JSON.parse(row.k8s_config) : undefined,
            labels: JSON.parse(row.labels),
            lastUpdated: row.last_updated,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
    }

    /**
     * 列出所有服務
     */
    listServices(filter?: QueryFilter): ServiceInfo[] {
        let sql = 'SELECT * FROM services WHERE 1=1';
        const params: unknown[] = [];

        if (filter?.serviceType) {
            sql += ' AND type = ?';
            params.push(filter.serviceType);
        }

        if (filter?.limit) {
            sql += ' LIMIT ?';
            params.push(filter.limit);
        }

        if (filter?.offset) {
            sql += ' OFFSET ?';
            params.push(filter.offset);
        }

        const rows = this.storage.query<{
            id: string;
            name: string;
            type: string;
            dependencies: string;
            k8s_config: string | null;
            labels: string;
            last_updated: string;
            metadata: string | null;
        }>(sql, params);

        return rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type as ServiceInfo['type'],
            dependencies: JSON.parse(row.dependencies),
            k8sConfig: row.k8s_config ? JSON.parse(row.k8s_config) : undefined,
            labels: JSON.parse(row.labels),
            lastUpdated: row.last_updated,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));
    }

    /**
     * 刪除服務
     */
    deleteService(serviceId: string): void {
        this.storage.execute('DELETE FROM services WHERE id = ?', [serviceId]);
        this.storage.execute('DELETE FROM services_fts WHERE service_id = ?', [serviceId]);

        this.emit('service-removed', {
            event: 'service-removed',
            resourceId: serviceId,
            resourceType: 'service',
            timestamp: new Date().toISOString(),
        });
    }

    // ==================== SLO 管理 ====================

    /**
     * 新增或更新 SLO
     */
    upsertSLO(slo: SLODefinition): void {
        const now = new Date().toISOString();

        this.storage.execute(
            `INSERT INTO slos (
        id, service_id, name, description, description_zh, target, threshold,
        window, golden_signal, status, error_budget, last_evaluated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        service_id = excluded.service_id,
        name = excluded.name,
        description = excluded.description,
        description_zh = excluded.description_zh,
        target = excluded.target,
        threshold = excluded.threshold,
        window = excluded.window,
        golden_signal = excluded.golden_signal,
        status = excluded.status,
        error_budget = excluded.error_budget,
        last_evaluated = excluded.last_evaluated,
        updated_at = excluded.updated_at`,
            [
                slo.id,
                slo.serviceId,
                slo.name,
                slo.description,
                slo.description_zh,
                slo.target,
                slo.threshold,
                slo.window,
                slo.goldenSignal,
                slo.status,
                slo.errorBudget,
                slo.lastEvaluated,
                slo.createdAt || now,
                now,
            ]
        );

        // 索引到全文搜尋
        this.indexSLO(slo);

        this.emit('slo-added', {
            event: 'slo-added',
            resourceId: slo.id,
            resourceType: 'slo',
            timestamp: now,
            data: slo,
        });
    }

    /**
     * 取得 SLO
     */
    getSLO(sloId: string): SLODefinition | null {
        const row = this.storage.queryOne<{
            id: string;
            service_id: string;
            name: string;
            description: string;
            description_zh: string;
            target: number;
            threshold: string | null;
            window: string;
            golden_signal: string;
            status: string;
            error_budget: number;
            last_evaluated: string;
            created_at: string;
            updated_at: string;
        }>('SELECT * FROM slos WHERE id = ?', [sloId]);

        if (!row) return null;

        return {
            id: row.id,
            serviceId: row.service_id,
            name: row.name,
            description: row.description,
            description_zh: row.description_zh,
            target: row.target,
            threshold: row.threshold,
            window: row.window,
            goldenSignal: row.golden_signal as SLODefinition['goldenSignal'],
            status: row.status as SLODefinition['status'],
            errorBudget: row.error_budget,
            lastEvaluated: row.last_evaluated,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * 列出 SLOs
     */
    listSLOs(filter?: QueryFilter): SLODefinition[] {
        let sql = 'SELECT * FROM slos WHERE 1=1';
        const params: unknown[] = [];

        if (filter?.serviceId) {
            sql += ' AND service_id = ?';
            params.push(filter.serviceId);
        }

        if (filter?.sloStatus) {
            sql += ' AND status = ?';
            params.push(filter.sloStatus);
        }

        sql += ' ORDER BY created_at DESC';

        if (filter?.limit) {
            sql += ' LIMIT ?';
            params.push(filter.limit);
        }

        const rows = this.storage.query<{
            id: string;
            service_id: string;
            name: string;
            description: string;
            description_zh: string;
            target: number;
            threshold: string | null;
            window: string;
            golden_signal: string;
            status: string;
            error_budget: number;
            last_evaluated: string;
            created_at: string;
            updated_at: string;
        }>(sql, params);

        return rows.map(row => ({
            id: row.id,
            serviceId: row.service_id,
            name: row.name,
            description: row.description,
            description_zh: row.description_zh,
            target: row.target,
            threshold: row.threshold,
            window: row.window,
            goldenSignal: row.golden_signal as SLODefinition['goldenSignal'],
            status: row.status as SLODefinition['status'],
            errorBudget: row.error_budget,
            lastEvaluated: row.last_evaluated,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }

    /**
     * 更新 SLO 狀態
     */
    updateSLOStatus(sloId: string, status: SLODefinition['status'], errorBudget: number): void {
        const now = new Date().toISOString();

        this.storage.execute(
            'UPDATE slos SET status = ?, error_budget = ?, last_evaluated = ?, updated_at = ? WHERE id = ?',
            [status, errorBudget, now, now, sloId]
        );

        this.emit('slo-status-changed', {
            event: 'slo-status-changed',
            resourceId: sloId,
            resourceType: 'slo',
            timestamp: now,
            data: { status, errorBudget },
        });
    }

    // ==================== 指標管理 ====================

    /**
     * 新增或更新指標
     */
    upsertMetric(metric: MetricMetadata): void {
        const now = new Date().toISOString();

        this.storage.execute(
            `INSERT INTO metrics (name, type, labels, description, related_services, unit, high_cardinality, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         type = excluded.type,
         labels = excluded.labels,
         description = excluded.description,
         related_services = excluded.related_services,
         unit = excluded.unit,
         high_cardinality = excluded.high_cardinality,
         last_updated = excluded.last_updated`,
            [
                metric.name,
                metric.type,
                JSON.stringify(metric.labels),
                metric.description,
                JSON.stringify(metric.relatedServices),
                metric.unit || null,
                metric.highCardinality ? 1 : 0,
                now,
            ]
        );

        this.emit('metric-added', {
            event: 'metric-added',
            resourceId: metric.name,
            resourceType: 'metric',
            timestamp: now,
            data: metric,
        });
    }

    /**
     * 取得指標
     */
    getMetric(metricName: string): MetricMetadata | null {
        const row = this.storage.queryOne<{
            name: string;
            type: string;
            labels: string;
            description: string;
            related_services: string;
            unit: string | null;
            high_cardinality: number;
            last_updated: string;
        }>('SELECT * FROM metrics WHERE name = ?', [metricName]);

        if (!row) return null;

        return {
            name: row.name,
            type: row.type as MetricMetadata['type'],
            labels: JSON.parse(row.labels),
            description: row.description,
            relatedServices: JSON.parse(row.related_services),
            unit: row.unit || undefined,
            highCardinality: row.high_cardinality === 1,
            lastUpdated: row.last_updated,
        };
    }

    /**
     * 列出指標
     */
    listMetrics(serviceId?: string): MetricMetadata[] {
        let sql = 'SELECT * FROM metrics';
        const params: unknown[] = [];

        if (serviceId) {
            sql += ` WHERE related_services LIKE ?`;
            params.push(`%"${serviceId}"%`);
        }

        const rows = this.storage.query<{
            name: string;
            type: string;
            labels: string;
            description: string;
            related_services: string;
            unit: string | null;
            high_cardinality: number;
            last_updated: string;
        }>(sql, params);

        return rows.map(row => ({
            name: row.name,
            type: row.type as MetricMetadata['type'],
            labels: JSON.parse(row.labels),
            description: row.description,
            relatedServices: JSON.parse(row.related_services),
            unit: row.unit || undefined,
            highCardinality: row.high_cardinality === 1,
            lastUpdated: row.last_updated,
        }));
    }

    // ==================== 事件管理 ====================

    /**
     * 建立事件
     */
    createIncident(incident: IncidentRecord): void {
        const now = new Date().toISOString();

        this.storage.execute(
            `INSERT INTO incidents (
        id, title, severity, status, affected_services, timeline, resolution,
        root_cause, started_at, resolved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                incident.id,
                incident.title,
                incident.severity,
                incident.status,
                JSON.stringify(incident.affectedServices),
                JSON.stringify(incident.timeline),
                incident.resolution,
                incident.rootCause || null,
                incident.startedAt,
                incident.resolvedAt || null,
                now,
                now,
            ]
        );

        // 索引到全文搜尋
        this.indexIncident(incident);

        this.emit('incident-created', {
            event: 'incident-created',
            resourceId: incident.id,
            resourceType: 'incident',
            timestamp: now,
            data: incident,
        });
    }

    /**
     * 更新事件
     */
    updateIncident(incidentId: string, updates: Partial<IncidentRecord>): void {
        const now = new Date().toISOString();
        const setClauses: string[] = ['updated_at = ?'];
        const params: unknown[] = [now];

        if (updates.status !== undefined) {
            setClauses.push('status = ?');
            params.push(updates.status);
        }

        if (updates.timeline !== undefined) {
            setClauses.push('timeline = ?');
            params.push(JSON.stringify(updates.timeline));
        }

        if (updates.resolution !== undefined) {
            setClauses.push('resolution = ?');
            params.push(updates.resolution);
        }

        if (updates.resolvedAt !== undefined) {
            setClauses.push('resolved_at = ?');
            params.push(updates.resolvedAt);
        }

        if (updates.rootCause !== undefined) {
            setClauses.push('root_cause = ?');
            params.push(updates.rootCause);
        }

        params.push(incidentId);

        this.storage.execute(
            `UPDATE incidents SET ${setClauses.join(', ')} WHERE id = ?`,
            params
        );

        this.emit('incident-updated', {
            event: 'incident-updated',
            resourceId: incidentId,
            resourceType: 'incident',
            timestamp: now,
            data: updates,
        });
    }

    /**
     * 取得事件
     */
    getIncident(incidentId: string): IncidentRecord | null {
        const row = this.storage.queryOne<{
            id: string;
            title: string;
            severity: string;
            status: string;
            affected_services: string;
            timeline: string;
            resolution: string | null;
            root_cause: string | null;
            started_at: string;
            resolved_at: string | null;
            created_at: string;
            updated_at: string;
        }>('SELECT * FROM incidents WHERE id = ?', [incidentId]);

        if (!row) return null;

        return {
            id: row.id,
            title: row.title,
            severity: row.severity as IncidentRecord['severity'],
            status: row.status as IncidentRecord['status'],
            affectedServices: JSON.parse(row.affected_services),
            timeline: JSON.parse(row.timeline),
            resolution: row.resolution,
            rootCause: row.root_cause || undefined,
            startedAt: row.started_at,
            resolvedAt: row.resolved_at || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * 列出事件
     */
    listIncidents(filter?: QueryFilter): IncidentRecord[] {
        let sql = 'SELECT * FROM incidents WHERE 1=1';
        const params: unknown[] = [];

        if (filter?.incidentSeverity) {
            sql += ' AND severity = ?';
            params.push(filter.incidentSeverity);
        }

        if (filter?.incidentStatus) {
            sql += ' AND status = ?';
            params.push(filter.incidentStatus);
        }

        if (filter?.startTime) {
            sql += ' AND started_at >= ?';
            params.push(filter.startTime);
        }

        if (filter?.endTime) {
            sql += ' AND started_at <= ?';
            params.push(filter.endTime);
        }

        sql += ' ORDER BY started_at DESC';

        if (filter?.limit) {
            sql += ' LIMIT ?';
            params.push(filter.limit);
        }

        const rows = this.storage.query<{
            id: string;
            title: string;
            severity: string;
            status: string;
            affected_services: string;
            timeline: string;
            resolution: string | null;
            root_cause: string | null;
            started_at: string;
            resolved_at: string | null;
            created_at: string;
            updated_at: string;
        }>(sql, params);

        return rows.map(row => ({
            id: row.id,
            title: row.title,
            severity: row.severity as IncidentRecord['severity'],
            status: row.status as IncidentRecord['status'],
            affectedServices: JSON.parse(row.affected_services),
            timeline: JSON.parse(row.timeline),
            resolution: row.resolution,
            rootCause: row.root_cause || undefined,
            startedAt: row.started_at,
            resolvedAt: row.resolved_at || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }

    // ==================== AI 上下文 ====================

    /**
     * 取得 AI 上下文
     */
    getAIContext(): AIContext {
        const row = this.storage.queryOne<{
            current_focus: string;
            recent_analysis: string;
            recommendations: string;
            last_updated: string;
        }>('SELECT * FROM ai_context WHERE id = 1');

        if (!row) {
            return {
                currentFocus: '',
                recentAnalysis: [],
                recommendations: [],
                lastUpdated: new Date().toISOString(),
            };
        }

        return {
            currentFocus: row.current_focus,
            recentAnalysis: JSON.parse(row.recent_analysis),
            recommendations: JSON.parse(row.recommendations),
            lastUpdated: row.last_updated,
        };
    }

    /**
     * 更新 AI 上下文
     */
    updateAIContext(context: Partial<AIContext>): void {
        const now = new Date().toISOString();
        const current = this.getAIContext();

        const updated: AIContext = {
            currentFocus: context.currentFocus ?? current.currentFocus,
            recentAnalysis: context.recentAnalysis ?? current.recentAnalysis,
            recommendations: context.recommendations ?? current.recommendations,
            lastUpdated: now,
        };

        this.storage.execute(
            `UPDATE ai_context SET
        current_focus = ?,
        recent_analysis = ?,
        recommendations = ?,
        last_updated = ?
       WHERE id = 1`,
            [
                updated.currentFocus,
                JSON.stringify(updated.recentAnalysis),
                JSON.stringify(updated.recommendations),
                now,
            ]
        );
    }

    // ==================== 輔助方法 ====================

    /**
     * 索引服務到全文搜尋
     */
    private indexService(service: ServiceInfo): void {
        this.storage.execute('DELETE FROM services_fts WHERE service_id = ?', [service.id]);
        this.storage.execute(
            'INSERT INTO services_fts (service_id, name, description) VALUES (?, ?, ?)',
            [service.id, service.name, service.name]
        );
    }

    /**
     * 索引 SLO 到全文搜尋
     */
    private indexSLO(slo: SLODefinition): void {
        this.storage.execute('DELETE FROM slos_fts WHERE slo_id = ?', [slo.id]);
        this.storage.execute(
            'INSERT INTO slos_fts (slo_id, name, description, description_zh) VALUES (?, ?, ?, ?)',
            [slo.id, slo.name, slo.description, slo.description_zh]
        );
    }

    /**
     * 索引事件到全文搜尋
     */
    private indexIncident(incident: IncidentRecord): void {
        this.storage.execute('DELETE FROM incidents_fts WHERE incident_id = ?', [incident.id]);
        this.storage.execute(
            'INSERT INTO incidents_fts (incident_id, title, resolution) VALUES (?, ?, ?)',
            [incident.id, incident.title, incident.resolution || '']
        );
    }

    /**
     * 關閉 Shared Memory
     */
    close(): void {
        this.storage.close();
        this.removeAllListeners();
    }
}
