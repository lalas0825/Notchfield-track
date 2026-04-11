/**
 * Plan Viewer — Sprint 47B
 * ==========================
 * Full-screen PDF with hyperlink hotspots, pin annotations, sheet navigation
 * history, and offline caching. Overlays visible at fit-to-page (scale≈1);
 * they fade out when pinch-zoomed because react-native-pdf doesn't expose
 * a usable pan/zoom transform.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useTrackPermissions } from '@/shared/lib/permissions/TrackPermissionsContext';
import { getPdfUri } from '@/features/plans/services/drawing-service';
import { PdfViewerNative } from '@/features/plans/components/PdfViewerNative';
import { HyperlinkOverlay } from '@/features/plans/components/HyperlinkOverlay';
import { PinOverlay } from '@/features/plans/components/PinOverlay';
import { PinDetailSheet } from '@/features/plans/components/PinDetailSheet';
import { AddPinSheet } from '@/features/plans/components/AddPinSheet';
import { SheetNavBar } from '@/features/plans/components/SheetNavBar';
import { useHyperlinks, type DrawingHyperlink } from '@/features/plans/hooks/useHyperlinks';
import { usePins } from '@/features/plans/hooks/usePins';
import { useSheetSiblings, type SheetSibling } from '@/features/plans/hooks/useSheetSiblings';
import type { DrawingPin } from '@/features/plans/services/pin-service';
import { haptic } from '@/shared/lib/haptics';

type ViewerTarget = {
  id: string;
  filePath: string;
  pageNumber: number;
  label: string;
};

export default function PlanViewerScreen() {
  const router = useRouter();
  const initial = useLocalSearchParams<{
    id: string;
    filePath: string;
    pageNumber: string;
    label: string;
  }>();

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);
  const { role } = useTrackPermissions();
  const canAddPins = role === 'foreman' || role === 'supervisor';

  // Current sheet + navigation history stack
  const [current, setCurrent] = useState<ViewerTarget>({
    id: String(initial.id ?? ''),
    filePath: String(initial.filePath ?? ''),
    pageNumber: parseInt(String(initial.pageNumber ?? '1'), 10),
    label: String(initial.label ?? 'Plan Viewer'),
  });
  const [sheetStack, setSheetStack] = useState<ViewerTarget[]>([]);

  // PDF state
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Viewer geometry
  const [pageBounds, setPageBounds] = useState({ pageWidth: 0, pageHeight: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);

  // Hyperlinks + pins + siblings
  const { links } = useHyperlinks(current.id);
  const { pins, reload: reloadPins } = usePins(current.id);
  const { siblings } = useSheetSiblings(current.id);

  // UI state
  const [selectedPin, setSelectedPin] = useState<DrawingPin | null>(null);
  const [showAddPin, setShowAddPin] = useState(false);

  // Drop-pin mode: long-press the FAB to arm → tap the PDF to place
  const [dropPinMode, setDropPinMode] = useState(false);
  const [pendingPinCoords, setPendingPinCoords] = useState<{ x: number; y: number } | null>(null);

  // Load PDF whenever current sheet changes
  useEffect(() => {
    if (!current.filePath) return;
    let cancelled = false;
    setPdfUri(null);
    setError(null);
    setDownloading(true);
    setProgress(0);
    setPageBounds({ pageWidth: 0, pageHeight: 0 });
    setScale(1);

    getPdfUri(current.filePath, 'drawings', (p) => {
      if (!cancelled) setProgress(p);
    })
      .then((uri) => {
        if (cancelled) return;
        if (uri) setPdfUri(uri);
        else setError('Unable to load PDF. Check your connection and try again.');
      })
      .finally(() => {
        if (!cancelled) setDownloading(false);
      });

    return () => { cancelled = true; };
  }, [current.filePath]);

  const retry = () => {
    setError(null);
    setDownloading(true);
    getPdfUri(current.filePath, 'drawings', setProgress).then((uri) => {
      if (uri) setPdfUri(uri);
      else setError('Download failed');
      setDownloading(false);
    });
  };

  // Navigate to a target sheet (hyperlink click)
  const navigateToSheet = useCallback(
    async (link: DrawingHyperlink) => {
      if (!activeProject) return;
      let targetId = link.target_drawing_id;

      // Resolve by sheet number if id isn't pre-linked
      if (!targetId) {
        const { data, error: queryErr } = await supabase
          .from('drawings')
          .select('id, drawing_set_id')
          .eq('project_id', activeProject.id)
          .eq('label', link.target_sheet_number)
          .limit(1)
          .maybeSingle();
        if (queryErr || !data) {
          Alert.alert('Sheet not found', `${link.target_sheet_number} is not in this project.`);
          return;
        }
        targetId = data.id;
      }

      // Fetch full target drawing + its set to get file_path + page_number
      const { data: targetDraw } = await supabase
        .from('drawings')
        .select('id, drawing_set_id, page_number, label')
        .eq('id', targetId!)
        .maybeSingle();
      if (!targetDraw) {
        Alert.alert('Sheet not found', 'Target drawing could not be loaded.');
        return;
      }
      const { data: targetSet } = await supabase
        .from('drawing_sets')
        .select('file_path, name')
        .eq('id', targetDraw.drawing_set_id)
        .maybeSingle();
      if (!targetSet) {
        Alert.alert('Sheet not found', 'Target drawing set could not be loaded.');
        return;
      }

      haptic.light();
      setSheetStack((prev) => [...prev, current]);
      setCurrent({
        id: targetDraw.id,
        filePath: targetSet.file_path,
        pageNumber: targetDraw.page_number,
        label: targetDraw.label ?? targetSet.name,
      });
    },
    [activeProject, current],
  );

  const goBack = useCallback(() => {
    if (sheetStack.length > 0) {
      const prev = sheetStack[sheetStack.length - 1];
      setSheetStack((s) => s.slice(0, -1));
      setCurrent(prev);
      haptic.light();
    } else {
      router.back();
    }
  }, [sheetStack, router]);

  // Navigate to a sibling (prev/next from the nav bar) — does NOT push onto
  // the back stack, since this is lateral in-set movement, not a drill-down.
  const navigateToSibling = useCallback(
    (target: SheetSibling) => {
      haptic.light();
      setCurrent({
        id: target.id,
        filePath: target.file_path,
        pageNumber: target.page_number,
        label: target.label ?? `Page ${target.page_number}`,
      });
    },
    [],
  );

  // Overlays visible only at fit-to-page (scale close to 1)
  const overlaysVisible = Math.abs(scale - 1) < 0.05;

  // Can the user create a pin right now?
  const canOpenAddPin = () => {
    if (!canAddPins) return false;
    if (!profile || !activeProject || !user) {
      Alert.alert('Not ready', 'Missing user or project context.');
      return false;
    }
    if (pageBounds.pageWidth <= 0 || pageBounds.pageHeight <= 0) {
      Alert.alert('PDF not loaded', 'Wait for the plan to finish loading.');
      return false;
    }
    return true;
  };

  // Short-tap FAB: drop pin at page center
  const addPinAtCenter = useCallback(() => {
    if (!canOpenAddPin()) return;
    setPendingPinCoords({
      x: pageBounds.pageWidth / 2,
      y: pageBounds.pageHeight / 2,
    });
    setShowAddPin(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAddPins, profile, activeProject, user, pageBounds]);

  // Long-press FAB: arm drop-pin mode (next tap on PDF places the pin)
  const armDropPinMode = useCallback(() => {
    if (!canOpenAddPin()) return;
    setDropPinMode(true);
    haptic.light();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAddPins, profile, activeProject, user, pageBounds]);

  // When the drop-pin overlay catches a tap, convert screen → PDF coords
  const handleDropTap = useCallback(
    (screenX: number, screenY: number) => {
      if (pageBounds.pageWidth <= 0 || pageBounds.pageHeight <= 0) return;
      // Same fit-inside-viewport math as the overlays
      const scaleFit = Math.min(
        viewport.width / pageBounds.pageWidth,
        viewport.height / pageBounds.pageHeight,
      );
      const renderedW = pageBounds.pageWidth * scaleFit;
      const renderedH = pageBounds.pageHeight * scaleFit;
      const offsetX = (viewport.width - renderedW) / 2;
      const offsetY = (viewport.height - renderedH) / 2;

      // Guard: tap outside the rendered page
      if (
        screenX < offsetX ||
        screenX > offsetX + renderedW ||
        screenY < offsetY ||
        screenY > offsetY + renderedH
      ) {
        return;
      }

      const pdfX = (screenX - offsetX) / scaleFit;
      const pdfY = (screenY - offsetY) / scaleFit;

      setPendingPinCoords({ x: pdfX, y: pdfY });
      setDropPinMode(false);
      setShowAddPin(true);
      haptic.success();
    },
    [pageBounds, viewport],
  );

  const overlay = useMemo(() => {
    if (!pdfUri || viewport.width === 0) return null;
    return (
      <>
        <HyperlinkOverlay
          links={links}
          pageWidth={pageBounds.pageWidth}
          pageHeight={pageBounds.pageHeight}
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
          visible={overlaysVisible && !dropPinMode}
          onLinkPress={navigateToSheet}
        />
        <PinOverlay
          pins={pins}
          pageWidth={pageBounds.pageWidth}
          pageHeight={pageBounds.pageHeight}
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
          visible={overlaysVisible && !dropPinMode}
          onPinPress={setSelectedPin}
        />

        {/* Drop-pin tap catcher: full-viewport transparent Pressable that
            captures the next tap and places a pin there. */}
        {dropPinMode && (
          <Pressable
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              handleDropTap(locationX, locationY);
            }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.35)',
            }}
          >
            <View className="flex-1 items-center justify-center">
              <View className="flex-row items-center rounded-full bg-brand-orange px-4 py-2.5">
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">
                  Tap anywhere to place pin
                </Text>
              </View>
              <Pressable
                onPress={() => setDropPinMode(false)}
                className="mt-3 rounded-full border border-border bg-slate-800/90 px-4 py-1.5"
              >
                <Text className="text-xs font-semibold text-slate-300">Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      </>
    );
  }, [
    pdfUri, links, pins, pageBounds, viewport, overlaysVisible,
    navigateToSheet, dropPinMode, handleDropTap,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: current.label ?? 'Plan Viewer',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
          headerLeft: () => (
            <Pressable onPress={goBack} hitSlop={12} className="pr-3">
              <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 bg-background">
        {downloading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
            <Text className="mt-4 text-base font-medium text-white">
              Downloading plan...
            </Text>
            {progress > 0 && (
              <View className="mt-3 w-48">
                <View className="h-2 overflow-hidden rounded-full bg-slate-700">
                  <View
                    className="h-full rounded-full bg-brand-orange"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </View>
                <Text className="mt-1 text-center text-sm text-slate-400">
                  {Math.round(progress * 100)}%
                </Text>
              </View>
            )}
          </View>
        )}

        {error && !downloading && (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
            <Text className="mt-4 text-center text-base text-white">{error}</Text>
            <Pressable
              onPress={retry}
              className="mt-6 h-12 flex-row items-center rounded-xl bg-brand-orange px-6 active:opacity-80"
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-base font-bold text-white">Retry</Text>
            </Pressable>
          </View>
        )}

        {pdfUri && !downloading && !error && (
          <PdfViewerNative
            uri={pdfUri}
            page={current.pageNumber}
            onPageBounds={setPageBounds}
            onScaleChanged={setScale}
            onViewportSize={setViewport}
            overlay={overlay}
          />
        )}

        {/* Stack indicator — shows "← A-101" when back will return to source */}
        {sheetStack.length > 0 && !downloading && (
          <View
            className="absolute left-4 rounded-full bg-brand-orange/90 px-3 py-1.5"
            style={{ top: 12 }}
          >
            <Text className="text-xs font-bold text-white">
              ← Back to {sheetStack[sheetStack.length - 1].label}
            </Text>
          </View>
        )}

        {/* Zoom hint when overlays hidden */}
        {pdfUri && !overlaysVisible && (links.length > 0 || pins.length > 0) && (
          <View
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-slate-800/90 px-4 py-2"
            style={{ bottom: 80 }}
          >
            <Text className="text-xs font-semibold text-slate-300">
              Zoom to fit to see links & pins
            </Text>
          </View>
        )}

        {/* Pin counts */}
        {pdfUri && !downloading && (
          <View className="absolute right-4 top-3 flex-row items-center rounded-full bg-card/95 px-3 py-1.5">
            {links.length > 0 && (
              <View className="flex-row items-center">
                <Ionicons name="link" size={12} color="#0EA5E9" />
                <Text className="ml-1 text-xs font-bold text-sky-400">{links.length}</Text>
              </View>
            )}
            {pins.length > 0 && (
              <View className="ml-3 flex-row items-center">
                <Ionicons name="location" size={12} color="#F59E0B" />
                <Text className="ml-1 text-xs font-bold text-amber-400">{pins.length}</Text>
              </View>
            )}
          </View>
        )}

        {/* Sheet navigation bar — prev / current / next within the same set */}
        {pdfUri && !downloading && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <SheetNavBar
              siblings={siblings}
              currentId={current.id}
              onNavigate={navigateToSibling}
            />
          </View>
        )}

        {/* FAB — tap: pin at center · long-press: drop-pin mode */}
        {canAddPins && pdfUri && !downloading && (
          <Pressable
            onPress={addPinAtCenter}
            onLongPress={armDropPinMode}
            delayLongPress={400}
            className="absolute right-4 h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg active:opacity-80"
            style={{ bottom: siblings.length > 0 ? 74 : 24 }}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Pressable>
        )}

        {/* Pin detail */}
        <PinDetailSheet
          pin={selectedPin}
          canMutate={canAddPins}
          onClose={() => setSelectedPin(null)}
          onChanged={reloadPins}
        />

        {/* Add pin */}
        {profile && activeProject && user && pendingPinCoords && (
          <AddPinSheet
            visible={showAddPin}
            onClose={() => { setShowAddPin(false); setPendingPinCoords(null); }}
            onCreated={reloadPins}
            organizationId={profile.organization_id}
            projectId={activeProject.id}
            drawingId={current.id}
            createdBy={profile.id ?? user.id}
            positionX={pendingPinCoords.x}
            positionY={pendingPinCoords.y}
          />
        )}
      </View>
    </>
  );
}
