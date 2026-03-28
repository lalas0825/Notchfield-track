import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '../store/project-store';

/**
 * Project switcher for supervisors.
 * Hidden for foremen (single project, auto-selected).
 * Shows as a tappable header that opens a modal picker.
 */
export function ProjectSwitcher() {
  const { projects, activeProject, isSupervisor, switchProject } = useProjectStore();
  const [open, setOpen] = useState(false);

  // Foreman: no switcher needed
  if (!isSupervisor || projects.length <= 1) return null;

  return (
    <>
      {/* Tap to open */}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center rounded-lg bg-card px-3 py-1.5 active:opacity-80"
      >
        <Ionicons name="business" size={14} color="#F97316" />
        <Text className="ml-1.5 text-sm font-medium text-brand-orange" numberOfLines={1}>
          {activeProject?.name ?? 'Select Project'}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#F97316" style={{ marginLeft: 4 }} />
      </Pressable>

      {/* Modal picker */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center justify-center bg-black/60"
        >
          <Pressable
            onPress={() => {}}
            className="mx-8 w-full max-w-sm rounded-2xl border border-border bg-card"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
              <Text className="text-lg font-bold text-white">Switch Project</Text>
              <Pressable onPress={() => setOpen(false)} className="h-8 w-8 items-center justify-center">
                <Ionicons name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Project list */}
            <ScrollView className="max-h-80">
              {projects.map((project) => {
                const isActive = activeProject?.id === project.id;
                return (
                  <Pressable
                    key={project.id}
                    onPress={async () => {
                      await switchProject(project);
                      setOpen(false);
                    }}
                    className={`flex-row items-center border-b border-border px-5 py-4 active:opacity-80 ${
                      isActive ? 'bg-brand-orange/10' : ''
                    }`}
                  >
                    <View className="flex-1">
                      <Text className={`text-base font-medium ${isActive ? 'text-brand-orange' : 'text-white'}`}>
                        {project.name}
                      </Text>
                      {project.address && (
                        <Text className="mt-0.5 text-sm text-slate-400">{project.address}</Text>
                      )}
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={20} color="#F97316" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
