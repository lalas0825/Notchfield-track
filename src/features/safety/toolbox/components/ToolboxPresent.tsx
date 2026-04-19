/**
 * Screen 2 — Present the content to the crew.
 *
 * EN/ES toggle surfaces the *_es fields when populated. The component
 * tracks whether the foreman actually toggled languages during delivery —
 * if yes, `delivered_language='both'` is saved at the end of the wizard.
 * Photo attach is optional; photos upload to Supabase Storage
 * `toolbox-photos/{orgId}/{docId}/{index}_{ts}.jpg` and the returned URL
 * is pushed into `content.photo_urls`.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/shared/lib/supabase/client';
import type { ToolboxTopicSnapshot } from '../types';

type Lang = 'en' | 'es';

type Props = {
  docId: string;
  organizationId: string;
  topic: ToolboxTopicSnapshot;
  initialPhotoUrls: string[];
  initialLanguageUsed: 'en' | 'es' | 'both';
  onContinue: (result: {
    photo_urls: string[];
    delivered_language: 'en' | 'es' | 'both';
  }) => void;
  onBack: () => void;
};

async function uploadToolboxPhoto(
  uri: string,
  orgId: string,
  docId: string,
  index: number,
): Promise<string | null> {
  try {
    const ts = Date.now();
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${orgId}/${docId}/${index}_${ts}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('toolbox-photos')
      .upload(path, blob, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[toolbox photo upload]', error);
      return null;
    }

    const { data } = supabase.storage.from('toolbox-photos').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[toolbox photo upload] threw', e);
    return null;
  }
}

export function ToolboxPresent({
  docId,
  organizationId,
  topic,
  initialPhotoUrls,
  initialLanguageUsed,
  onContinue,
  onBack,
}: Props) {
  const hasEs = !!topic.title_es && topic.key_points_es && topic.key_points_es.length > 0;
  const [lang, setLang] = useState<Lang>('en');
  const [photos, setPhotos] = useState<string[]>(initialPhotoUrls);
  const [uploading, setUploading] = useState(false);

  // Tracks whether the foreman switched languages at any point during
  // delivery — if so we'll save delivered_language='both'.
  const usedBothRef = useRef(initialLanguageUsed === 'both');
  const lastLangRef = useRef<Lang>('en');

  useEffect(() => {
    if (hasEs && lastLangRef.current !== lang) {
      usedBothRef.current = true;
    }
    lastLangRef.current = lang;
  }, [lang, hasEs]);

  const title = lang === 'es' && topic.title_es ? topic.title_es : topic.title;
  const why =
    lang === 'es' && topic.why_it_matters_es ? topic.why_it_matters_es : topic.why_it_matters;
  const keyPoints =
    lang === 'es' && topic.key_points_es && topic.key_points_es.length
      ? topic.key_points_es
      : topic.key_points;
  const questions =
    lang === 'es' && topic.discussion_questions_es && topic.discussion_questions_es.length
      ? topic.discussion_questions_es
      : topic.discussion_questions;

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    await pushPhoto(result.assets[0].uri);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    await pushPhoto(result.assets[0].uri);
  };

  const pushPhoto = async (localUri: string) => {
    setUploading(true);
    const url = await uploadToolboxPhoto(localUri, organizationId, docId, photos.length);
    setUploading(false);
    if (!url) {
      Alert.alert('Upload failed', 'Could not save the photo. Check your connection and try again.');
      return;
    }
    setPhotos((prev) => [...prev, url]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const finish = () => {
    const delivered_language: 'en' | 'es' | 'both' = usedBothRef.current
      ? 'both'
      : lang;
    onContinue({ photo_urls: photos, delivered_language });
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-3" keyboardShouldPersistTaps="handled">
        {/* Language toggle */}
        {hasEs ? (
          <View className="mb-3 flex-row items-center rounded-xl border border-border bg-card p-1">
            {(['en', 'es'] as const).map((code) => (
              <Pressable
                key={code}
                onPress={() => setLang(code)}
                className={`h-9 flex-1 items-center justify-center rounded-lg ${
                  lang === code ? 'bg-brand-orange/20' : ''
                }`}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: lang === code ? '#F97316' : '#94A3B8' }}
                >
                  {code === 'en' ? 'English' : 'Español'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text className="mb-2 text-xl font-bold text-white">{title}</Text>
        {topic.osha_ref ? (
          <Text className="mb-2 text-xs text-slate-500">{topic.osha_ref}</Text>
        ) : null}

        {/* Why it matters */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="mb-1 text-xs font-bold uppercase text-slate-400">Why it matters</Text>
          <Text className="text-base leading-6 text-white">{why}</Text>
        </View>

        {/* Key points */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="mb-2 text-xs font-bold uppercase text-slate-400">
            Key points ({keyPoints.length})
          </Text>
          {keyPoints.map((p, i) => (
            <View key={i} className="mb-1.5 flex-row items-start">
              <Ionicons name="checkmark" size={16} color="#22C55E" style={{ marginTop: 2 }} />
              <Text className="ml-2 flex-1 text-sm leading-5 text-white">{p}</Text>
            </View>
          ))}
        </View>

        {/* Discussion questions */}
        {questions.length > 0 ? (
          <View className="mb-4 rounded-2xl border border-border bg-card p-4">
            <Text className="mb-2 text-xs font-bold uppercase text-slate-400">
              Discussion
            </Text>
            {questions.map((q, i) => (
              <View key={i} className="mb-1.5 flex-row items-start">
                <Ionicons name="help-circle" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                <Text className="ml-2 flex-1 text-sm leading-5 text-white">{q}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Photos */}
        <Text className="mb-2 text-xs font-bold uppercase text-slate-500">
          Photos of the huddle (optional)
        </Text>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            {photos.map((url, i) => (
              <View key={`${url}-${i}`} className="mr-2 h-24 w-24">
                <Image
                  source={{ uri: url }}
                  className="h-full w-full rounded-lg"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => removePhoto(i)}
                  hitSlop={6}
                  className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/70"
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View className="mb-4 flex-row">
          <Pressable
            onPress={takePhoto}
            disabled={uploading}
            className="mr-2 h-12 flex-1 flex-row items-center justify-center rounded-xl border border-border"
          >
            <Ionicons name="camera-outline" size={18} color="#94A3B8" />
            <Text className="ml-2 text-sm text-slate-400">
              {uploading ? 'Uploading…' : 'Camera'}
            </Text>
          </Pressable>
          <Pressable
            onPress={pickPhoto}
            disabled={uploading || Platform.OS === 'web'}
            className="ml-2 h-12 flex-1 flex-row items-center justify-center rounded-xl border border-border"
          >
            <Ionicons name="images-outline" size={18} color="#94A3B8" />
            <Text className="ml-2 text-sm text-slate-400">Gallery</Text>
          </Pressable>
        </View>

        <View className="h-24" />
      </ScrollView>

      <View className="flex-row items-center border-t border-border bg-card px-4 py-3">
        <Pressable
          onPress={onBack}
          className="mr-2 h-12 w-24 items-center justify-center rounded-xl border border-border"
        >
          <Text className="text-base text-slate-400">Back</Text>
        </Pressable>
        <Pressable
          onPress={finish}
          className="ml-2 h-12 flex-1 items-center justify-center rounded-xl bg-brand-orange"
        >
          <Text className="text-base font-bold text-white">Continue to Signatures</Text>
        </Pressable>
      </View>
    </View>
  );
}
