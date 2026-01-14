import { z } from 'zod';

/**
 * Tool Input Schemas (使用 Zod)
 */

// 1. search_logs
export const SearchLogsInputSchema = z.object({
    query: z.string().optional().describe('搜尋查詢（Lucene syntax 或自然語言）'),
    timeRange: z.object({
        start: z.union([z.number(), z.string()]).describe('開始時間（Unix timestamp 或 ISO string）'),
        end: z.union([z.number(), z.string()]).describe('結束時間'),
    }).optional(),
    index: z.string().optional().describe('Index pattern，預設 logs-*'),
    filters: z.object({
        level: z.union([z.string(), z.array(z.string())]).optional().describe('Log level (ERROR, WARN, INFO, DEBUG)'),
        service: z.string().optional().describe('服務名稱'),
        namespace: z.string().optional().describe('Namespace'),
        pod: z.string().optional().describe('Pod 名稱'),
    }).optional(),
    size: z.number().optional().default(100).describe('返回筆數'),
});

// 2. nl_to_es_query
export const NLToESQueryInputSchema = z.object({
    naturalQuery: z.string().describe('自然語言查詢，例如：過去 1 小時 payment-service 的錯誤日誌'),
    userContext: z.object({
        defaultService: z.string().optional(),
        defaultNamespace: z.string().optional(),
    }).optional(),
});

// 3. analyze_error_patterns
export const AnalyzeErrorPatternsInputSchema = z.object({
    timeRange: z.object({
        start: z.union([z.number(), z.string()]),
        end: z.union([z.number(), z.string()]),
    }).describe('時間範圍'),
    service: z.string().optional().describe('特定服務（可選）'),
    minOccurrences: z.number().optional().default(3).describe('最小出現次數'),
});

// 4. summarize_logs
export const SummarizeLogsInputSchema = z.object({
    query: z.string().optional().describe('日誌查詢條件'),
    timeRange: z.object({
        start: z.union([z.number(), z.string()]),
        end: z.union([z.number(), z.string()]),
    }).describe('時間範圍'),
    maxLogs: z.number().optional().default(500).describe('最多分析的日誌數'),
    service: z.string().optional(),
});

/**
 * Tool Input Types
 */
export type SearchLogsInput = z.infer<typeof SearchLogsInputSchema>;
export type NLToESQueryInput = z.infer<typeof NLToESQueryInputSchema>;
export type AnalyzeErrorPatternsInput = z.infer<typeof AnalyzeErrorPatternsInputSchema>;
export type SummarizeLogsInput = z.infer<typeof SummarizeLogsInputSchema>;
