/**
 * In-Memory Storage - Shared Memory 的儲存層
 * 純 JavaScript 實作，無需編譯，Windows 完全相容
 * 
 * 替代 better-sqlite3，移除 native 依賴
 */

interface ServiceData {
  id: string;
  name: string;
  type: string;
  dependencies: string[];
  k8sConfig?: any;
  labels: Record<string, string>;
  lastUpdated: string;
  metadata?: any;
  createdAt: string;
}

interface SLOData {
  id: string;
  serviceId: string;
  name: string;
  description: string;
  descriptionZh: string;
  target: number;
  threshold?: any;
  window: string;
  promqlQuery?: string;
  goldenSignal?: string;
  status?: string;
  errorBudget?: number;
  lastEvaluated?: string;
  createdAt: string;
  updatedAt: string;
}

export class SQLiteStorage {
  private services: Map<string, ServiceData> = new Map();
  private slos: Map<string, SLOData> = new Map();
  private metrics: Map<string, any> = new Map();
  private context: Map<string, any> = new Map();

  constructor(_dbPath: string = ':memory:') {
    console.log('[Storage] Using pure in-memory storage (no SQLite, Windows compatible)');
  }

  // ==================== Services ====================

  createService(data: Omit<ServiceData, 'id' | 'createdAt'>): string {
    const id = `svc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const service: ServiceData = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.services.set(id, service);
    return id;
  }

  /**
   * Upsert service (for compatibility)
   */
  upsertService(service: ServiceData): void {
    const existing = this.services.get(service.id);
    if (existing) {
      this.updateService(service.id, service);
    } else {
      this.services.set(service.id, {
        ...service,
        createdAt: service.createdAt || new Date().toISOString(),
      });
    }
  }

  getService(id: string): ServiceData | null {
    return this.services.get(id) || null;
  }

  getAllServices(): ServiceData[] {
    return Array.from(this.services.values());
  }

  getServicesByType(type: string): ServiceData[] {
    return this.getAllServices().filter(s => s.type === type);
  }

  searchServices(query: string): ServiceData[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllServices().filter(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.type.toLowerCase().includes(lowerQuery)
    );
  }

  updateService(id: string, updates: Partial<ServiceData>): boolean {
    const service = this.services.get(id);
    if (!service) return false;

    this.services.set(id, { ...service, ...updates, lastUpdated: new Date().toISOString() });
    return true;
  }

  deleteService(id: string): boolean {
    return this.services.delete(id);
  }

  // ==================== SLOs ====================

  createSLO(data: Omit<SLOData, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `slo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const slo: SLOData = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.slos.set(id, slo);
    return id;
  }

  /**
   * Upsert SLO (for compatibility)
   */
  upsertSLO(slo: SLOData): void {
    const existing = this.slos.get(slo.id);
    if (existing) {
      this.updateSLO(slo.id, slo);
    } else {
      this.slos.set(slo.id, {
        ...slo,
        createdAt: slo.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  getSLO(id: string): SLOData | null {
    return this.slos.get(id) || null;
  }

  getAllSLOs(): SLOData[] {
    return Array.from(this.slos.values());
  }

  getSLOsByService(serviceId: string): SLOData[] {
    return this.getAllSLOs().filter(s => s.serviceId === serviceId);
  }

  /**
   * List SLOs with optional filtering
   */
  listSLOs(filter?: { serviceId?: string; status?: string }): SLOData[] {
    let results = this.getAllSLOs();

    if (filter?.serviceId) {
      results = results.filter(s => s.serviceId === filter.serviceId);
    }

    if (filter?.status) {
      results = results.filter(s => s.status === filter.status);
    }

    return results;
  }

  updateSLO(id: string, updates: Partial<SLOData>): boolean {
    const slo = this.slos.get(id);
    if (!slo) return false;

    this.slos.set(id, { ...slo, ...updates, updatedAt: new Date().toISOString() });
    return true;
  }

  /**
   * Update SLO status and error budget
   */
  updateSLOStatus(id: string, status: string, errorBudget: number): boolean {
    const slo = this.slos.get(id);
    if (!slo) return false;

    this.slos.set(id, {
      ...slo,
      status,
      errorBudget,
      lastEvaluated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  deleteSLO(id: string): boolean {
    return this.slos.delete(id);
  }

  // ==================== Metrics ====================

  storeMetric(key: string, data: any): void {
    this.metrics.set(key, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Upsert metric with metric object (compatibility)
   */
  upsertMetric(metric: any): void {
    const key = metric.name || `metric-${Date.now()}`;
    this.storeMetric(key, metric);
  }

  getMetric(key: string): any {
    return this.metrics.get(key) || null;
  }

  getAllMetrics(): any[] {
    return Array.from(this.metrics.values());
  }

  deleteMetric(key: string): boolean {
    return this.metrics.delete(key);
  }

  // ==================== Context ====================

  setContext(key: string, value: any): void {
    this.context.set(key, {
      value,
      timestamp: new Date().toISOString(),
    });
  }

  getContext(key: string): any {
    const ctx = this.context.get(key);
    return ctx ? ctx.value : null;
  }

  getAllContext(): Record<string, any> {
    const result: Record<string, any> = {};
    this.context.forEach((data, key) => {
      result[key] = data.value;
    });
    return result;
  }

  deleteContext(key: string): boolean {
    return this.context.delete(key);
  }

  clearAllContext(): void {
    this.context.clear();
  }

  // ==================== Utility ====================

  close(): void {
    // No-op for in-memory storage
    console.log('[Storage] Closing (memory cleared)');
    this.services.clear();
    this.slos.clear();
    this.metrics.clear();
    this.context.clear();
  }

  /**
   * 統計資訊
   */
  getStats(): {
    services: number;
    slos: number;
    metrics: number;
    context: number;
  } {
    return {
      services: this.services.size,
      slos: this.slos.size,
      metrics: this.metrics.size,
      context: this.context.size,
    };
  }
}
