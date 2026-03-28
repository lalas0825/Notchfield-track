import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase/client';

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
};

type ProjectActions = {
  fetchProjects: (organizationId: string) => Promise<void>;
  setActiveProject: (project: Project) => Promise<void>;
  fetchGeofence: (projectId: string) => Promise<void>;
};

export const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
  projects: [],
  activeProject: null,
  geofence: null,
  loading: false,

  fetchProjects: async (organizationId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('projects')
      .select('id, name, address, organization_id')
      .eq('organization_id', organizationId);

    const projects = (data ?? []) as Project[];
    set({
      projects,
      // Auto-select first project if none active (foreman has 1)
      activeProject: projects.length === 1 ? projects[0] : null,
      loading: false,
    });

    // Auto-fetch geofence for single-project foreman
    if (projects.length === 1) {
      const store = useProjectStore.getState();
      await store.fetchGeofence(projects[0].id);
    }
  },

  setActiveProject: async (project) => {
    set({ activeProject: project, geofence: null });
    await useProjectStore.getState().fetchGeofence(project.id);
  },

  fetchGeofence: async (projectId) => {
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
