import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useCrewStore } from '@/features/crew/store/crew-store';

type Project = {
  id: string;
  name: string;
  address: string | null;
  organization_id: string;
};

type Geofence = {
  id: string;
  project_id: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  name: string | null;
  is_active: boolean;
};

type ProjectState = {
  projects: Project[];
  activeProject: Project | null;
  geofence: Geofence | null;
  loading: boolean;
  isSupervisor: boolean;
};

type ProjectActions = {
  fetchProjects: (
    organizationId: string,
    userRole: string,
    assignedProjectIds?: string[],
  ) => Promise<void>;
  switchProject: (project: Project) => Promise<void>;
  fetchGeofence: (projectId: string) => Promise<void>;
};

async function loadDependentStores(projectId: string, organizationId: string) {
  const crew = useCrewStore.getState();
  await Promise.all([
    crew.fetchWorkers(organizationId, projectId),
    crew.fetchAreas(projectId),
    crew.fetchAssignments(projectId, organizationId),
    crew.fetchTodayTimeEntries(projectId, organizationId),
  ]);
}

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  projects: [],
  activeProject: null,
  geofence: null,
  loading: false,
  isSupervisor: false,

  fetchProjects: async (
    organizationId: string,
    userRole: string,
    assignedProjectIds?: string[],
  ) => {
    set({ loading: true });

    const isSupervisor = ['supervisor', 'superintendent', 'owner'].includes(userRole);
    set({ isSupervisor });

    // Sprint 40C: filter by project_assignments when provided
    if (assignedProjectIds !== undefined && assignedProjectIds.length === 0) {
      set({ projects: [], activeProject: null, loading: false });
      return;
    }

    try {
      // PowerSync local-first read
      let projects: Project[] = [];
      const localRows = await localQuery<Project>(
        `SELECT id, name, address, organization_id FROM projects WHERE organization_id = ?`,
        [organizationId],
      );

      if (localRows !== null && localRows.length > 0) {
        projects = localRows;
        if (assignedProjectIds !== undefined) {
          const allowed = new Set(assignedProjectIds);
          projects = projects.filter((p) => allowed.has(p.id));
        }
      } else {
        // Fall back to Supabase REST
        let query = supabase
          .from('projects')
          .select('id, name, address, organization_id')
          .eq('organization_id', organizationId);
        if (assignedProjectIds !== undefined) {
          query = query.in('id', assignedProjectIds);
        }
        const { data } = await query;
        projects = (data ?? []) as Project[];
      }

      // Supervisor with multiple projects → must pick. Foreman/worker → auto-select first.
      const autoSelect =
        !isSupervisor && projects.length >= 1
          ? projects[0]
          : isSupervisor && projects.length === 1
            ? projects[0]
            : null;

      set({ projects, activeProject: autoSelect, loading: false });

      if (autoSelect) {
        // Fire-and-forget — these load home/crew data but should NOT
        // block the project store from reporting "loaded". On flaky
        // networks, awaiting these can hang the entire app startup.
        get().fetchGeofence(autoSelect.id).catch((err) => {
          console.warn('[ProjectStore] fetchGeofence error:', err);
        });
        loadDependentStores(autoSelect.id, organizationId).catch((err) => {
          console.warn('[ProjectStore] loadDependentStores error:', err);
        });
      }
    } catch (err) {
      console.warn('[ProjectStore] fetchProjects error:', err);
      set({ loading: false });
    }
  },

  switchProject: async (project: Project) => {
    const prev = get().activeProject;
    if (prev?.id === project.id) return;

    // Reset dependent stores immediately (no stale data visible)
    useCrewStore.setState({
      workers: [],
      areas: [],
      assignments: [],
      timeEntries: [],
    });

    set({ activeProject: project, geofence: null });

    await get().fetchGeofence(project.id);
    await loadDependentStores(project.id, project.organization_id);
  },

  fetchGeofence: async (projectId: string) => {
    const { data } = await supabase
      .from('gps_geofences')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .limit(1)
      .single();

    set({ geofence: data as Geofence | null });
  },
}));
