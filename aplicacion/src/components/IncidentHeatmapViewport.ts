import type { Incident } from '@/types/domain';

// Metro resolves the platform-specific implementations on web and native.
// This neutral fallback also keeps non-platform test environments deterministic.
export function IncidentHeatmapViewport(_props: { incidents: Incident[] }) {
  return null;
}
