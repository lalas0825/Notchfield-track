/**
 * Reusable collapsible section wrapper for AreaDetail modules.
 *
 * 2026-04-29 — Pilot reported AreaDetail screen growing long after each
 * sprint added a new section (Deficiencies, Sign-Offs, Crew). Modules
 * with badge counts stay visible (header always rendered), but their
 * body collapses by default unless there's something action-worthy.
 *
 * Usage:
 *   <CollapsibleSection
 *     header={<MyHeader counts={...} />}
 *     defaultExpanded={openCount > 0}
 *   >
 *     <MyListBody />
 *   </CollapsibleSection>
 *
 * The caller decides `defaultExpanded` based on its own data — sections
 * with active items auto-open, calm sections stay closed. The user's
 * explicit toggle wins after that within the screen lifetime (no
 * persistence — re-opens reset on next AreaDetail mount, which matches
 * the rest of the screen's local-state flavor).
 */

import { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Enable LayoutAnimation on Android — iOS has it on by default.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  /** Always-visible header. Tap toggles expand/collapse. */
  header: React.ReactNode;
  /** Body shown when expanded. */
  children: React.ReactNode;
  /** Initial state on mount. Sections with active items pass true. */
  defaultExpanded?: boolean;
  /** Container style override (border, background, padding). */
  containerStyle?: React.ComponentProps<typeof View>['style'];
  /** Hide the chevron (e.g. when caller already includes one in header). */
  hideChevron?: boolean;
};

export function CollapsibleSection({
  header,
  children,
  defaultExpanded = false,
  containerStyle,
  hideChevron = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View
      style={[
        {
          marginBottom: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#1E293B',
          backgroundColor: '#0F172A',
          overflow: 'hidden',
        },
        containerStyle,
      ]}
    >
      <Pressable
        onPress={toggle}
        android_ripple={{ color: '#1E293B' }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
        }}
      >
        <View style={{ flex: 1 }}>{header}</View>
        {!hideChevron ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#475569"
            style={{ marginLeft: 8 }}
          />
        ) : null}
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}
