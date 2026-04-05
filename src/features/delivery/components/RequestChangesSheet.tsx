import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
};

export default function RequestChangesSheet({ visible, onClose, onSubmit }: Props) {
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    if (!note.trim()) return;
    onSubmit(note.trim());
    setNote('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/60">
        <Pressable onPress={() => {}} className="rounded-t-3xl border-t border-border bg-card">
          <View className="items-center py-3">
            <View className="h-1 w-10 rounded-full bg-slate-600" />
          </View>
          <View className="px-6 pb-10">
            <Text className="text-xl font-bold text-white">Request Changes</Text>
            <Text className="mt-1 text-sm text-slate-400">Describe the changes needed</Text>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g., Need 200 more SF of CT-04"
              placeholderTextColor="#64748B"
              multiline
              className="mt-4 h-24 rounded-xl border border-border bg-background px-4 pt-3 text-base text-white"
              autoFocus
            />

            <Pressable
              onPress={handleSubmit}
              className="mt-4 h-14 items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
            >
              <Text className="text-lg font-bold text-white">Send Request</Text>
            </Pressable>

            <Pressable onPress={onClose} className="mt-3 h-10 items-center justify-center">
              <Text className="text-sm text-slate-400">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
