import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import type { Incident, IncidentPriority, MaintenanceDepartment } from '@/types/domain';
import { mockIncidents } from '@/data/mockIncidents';

type NewDemoReportInput = {
  category: string;
  description: string;
  location: string;
  priority: IncidentPriority;
  citizenEmail: string;
  citizenName: string;
  evidenceAttached: boolean;
};

type ReportsContextValue = {
  demoReports: Incident[];
  addDemoReport: (input: NewDemoReportInput) => Incident;
};

const ReportsContext = createContext<ReportsContextValue | null>(null);

const departmentByCategory: Record<string, MaintenanceDepartment> = {
  'Agua potable': 'Agua',
  'Alumbrado publico': 'EEMZA',
  'Alumbrado público': 'EEMZA',
  Drenajes: 'Drenajes',
  'Desechos solidos': 'Desechos',
  'Desechos sólidos': 'Desechos',
  Calles: 'Infraestructura',
  'Areas publicas': 'Infraestructura',
  'Áreas públicas': 'Infraestructura'
};

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [demoReports, setDemoReports] = useState<Incident[]>([]);

  const value = useMemo<ReportsContextValue>(
    () => ({
      demoReports,
      addDemoReport: (input) => {
        const now = new Date().toISOString().slice(0, 10);
        const sequence = mockIncidents.length + demoReports.length + 1;
        const report: Incident = {
          id: `demo-${Date.now()}`,
          code: `ZAC-${new Date().getFullYear()}-${String(sequence).padStart(3, '0')}`,
          title: `${input.category} reportado`,
          description: input.description.trim(),
          category: input.category,
          location: input.location.trim(),
          status: 'REGISTRADO',
          createdAt: now,
          updatedAt: now,
          citizenName: input.citizenName,
          citizenEmail: input.citizenEmail,
          department: departmentByCategory[input.category] ?? 'Infraestructura',
          priority: input.priority,
          progress: 10,
          evidenceAttached: input.evidenceAttached
        };
        setDemoReports((current) => [report, ...current]);
        return report;
      }
    }),
    [demoReports]
  );

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports() {
  const context = useContext(ReportsContext);
  if (!context) throw new Error('useReports debe utilizarse dentro de ReportsProvider.');
  return context;
}
