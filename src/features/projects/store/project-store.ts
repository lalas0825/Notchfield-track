import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase/client';
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
  fetchProjects: (organizationId: string, userRole: string) => Promise<void>;
  switchProject: (project: Project) => Promise<void>;
  fetchGeofence: (projectId: string) => Promise<void>;
};

async function loadDependentStores(projectId: string, organizationId: string) {
  const crew = useCrewStore.getState();
  await Promise.all([
    crew.fetchWorkers(organizationId),
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

  fetchProjects: async (organizationId: string, userRole: string) => {
    set({ loading: true });

    const isSupervisor = ['superintendent', 'owner', 'admin'].includes(userRole);
    set({ isSupervisor });

    const { data } = await supabase
      .from('projects')
      .select('id, name, address, organization_id')
      .eq('organization_id', organizationId);

    const projects = (data ?? []) as Project[];

    // Auto-select for foreman (single project). Supervisor chooses.
    const autoSelect = !isSupervisor && projects.length >= 1
      ? projects[0]
      : isSupervisor && projects.length === 1
        ? projects[0]
        : null;

    set({ projects, activeProject: autoSelect, loading: false });

    if (autoSelect) {
      await get().fetchGeofence(autoSelect.id);
      await loadDependentStores(autoSelect.id, organizationId);
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
