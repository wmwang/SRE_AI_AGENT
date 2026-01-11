import { z } from 'zod';

/**
 * save_user_context 和 get_user_context 的 schema
 */

// User Context 資料結構
export const UserContextSchema = z.object({
    userId: z.string().default('default').describe('使用者 ID'),
    defaultNamespace: z.string().optional().describe('預設 namespace'),
    defaultService: z.string().optional().describe('預設 service'),
    labelPreferences: z.record(z.string()).default({}).describe('Label 偏好設定'),
    favoriteQueries: z.array(z.object({
        name: z.string(),
        promql: z.string(),
        description: z.string().optional(),
    })).default([]).describe('最愛的查詢'),
    lastUpdated: z.string().optional().describe('最後更新時間'),
});

export type UserContext = z.infer<typeof UserContextSchema>;

// save_user_context 的輸入
export const SaveUserContextSchema = z.object({
    context: UserContextSchema,
});

export type SaveUserContextInput = z.infer<typeof SaveUserContextSchema>;

// get_user_context 的輸入
export const GetUserContextSchema = z.object({
    userId: z.string().default('default').describe('使用者 ID'),
});

export type GetUserContextInput = z.infer<typeof GetUserContextSchema>;

// translate_nl_to_promql 的輸入
export const TranslateNLToPromQLSchema = z.object({
    naturalQuery: z.string().describe('自然語言查詢'),
    availableMetrics: z.array(z.string()).optional().describe('可用指標列表'),
    userContext: UserContextSchema.partial().optional().describe('使用者上下文'),
});

export type TranslateNLToPromQLInput = z.infer<typeof TranslateNLToPromQLSchema>;

// suggest_query_hints 的輸入
export const SuggestQueryHintsSchema = z.object({
    currentQuery: z.string().optional().describe('目前的查詢'),
    availableMetrics: z.array(z.string()).optional().describe('可用指標'),
    context: z.string().optional().describe('上下文類型'),
    userContext: UserContextSchema.partial().optional().describe('使用者上下文'),
});

export type SuggestQueryHintsInput = z.infer<typeof SuggestQueryHintsSchema>;

// analyze_metrics_health 的輸入
export const AnalyzeMetricsHealthSchema = z.object({
    promql: z.string().describe('要分析的 PromQL'),
    timeRange: z.object({
        start: z.number().describe('開始時間 (Unix timestamp)'),
        end: z.number().describe('結束時間 (Unix timestamp)'),
    }),
    currentValue: z.number().optional().describe('目前值'),
});

export type AnalyzeMetricsHealthInput = z.infer<typeof AnalyzeMetricsHealthSchema>;
