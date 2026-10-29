import type { Incident } from '@/types/domain';

export function exportAnalyticsDetail(incidents: Incident[], title: string): Promise<void> | void;
export function printAnalyticsSummary(): Promise<void> | void;
export function printAnalyticsMap(): Promise<void> | void;

