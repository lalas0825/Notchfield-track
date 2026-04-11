/**
 * Simple inline calendar date picker — no external dependencies.
 * Pure React Native + NativeWind.
 */

import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Returns "YYYY-MM-DD" for today */
export function todayISO(): string {
  const d = new Date();
  return isoFromDate(d);
}

/** Returns "YYYY-MM-DD" for a Date object */
function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → "Fri, Apr 10, 2026" */
export function fmtDateLabel(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type Props = {
  value: string;        // "YYYY-MM-DD"
  onChange: (iso: string) => void;
};

export function DatePickerField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  // Parse selected date
  const selDate = new Date(value + 'T00:00:00');
  const [viewYear, setViewYear] = useState(selDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selDate.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date();
  const todayISO_ = isoFromDate(today);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          const d = new Date(value + 'T00:00:00');
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
          setOpen(true);
        }}
        className="flex-row items-center rounded-xl border border-border bg-card px-4"
        style={{ minHeight: 52 }}
      >
        <Ionicons name="calendar" size={18} color="#F97316" />
        <Text className="ml-3 flex-1 text-base font-semibold text-white">
          {fmtDateLabel(value)}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#64748B" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/60"
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-4"
          >
            {/* Header: month/year navigation */}
            <View className="mb-3 flex-row items-center justify-between">
              <Pressable onPress={prevMonth} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color="#F97316" />
              </Pressable>
              <Text className="text-base font-bold text-white">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <Pressable onPress={nextMonth} hitSlop={12}>
                <Ionicons name="chevron-forward" size={22} color="#F97316" />
              </Pressable>
            </View>

            {/* Day-of-week labels */}
            <View className="mb-1 flex-row">
              {DAY_LABELS.map((d) => (
                <Text key={d} className="flex-1 text-center text-xs font-bold text-slate-500">
                  {d}
                </Text>
              ))}
            </View>

            {/* Day grid */}
            {chunk(cells, 7).map((row, ri) => (
              <View key={ri} className="flex-row">
                {row.map((day, ci) => {
                  if (!day) return <View key={ci} className="flex-1" style={{ minHeight: 40 }} />;
                  const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = iso === value;
                  const isToday = iso === todayISO_;
                  return (
                    <Pressable
                      key={ci}
                      onPress={() => selectDay(day)}
                      className={`flex-1 items-center justify-center rounded-full ${
                        isSelected ? 'bg-brand-orange' : ''
                      }`}
                      style={{ minHeight: 40 }}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected
                            ? 'text-white'
                            : isToday
                            ? 'text-brand-orange'
                            : 'text-slate-200'
                        }`}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {/* Quick-pick row */}
            <View className="mt-3 flex-row gap-2 border-t border-border pt-3">
              {[0, 1, 2, 3].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() - offset);
                const iso = isoFromDate(d);
                const lbl = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : `${offset}d ago`;
                return (
                  <Pressable
                    key={offset}
                    onPress={() => { onChange(iso); setOpen(false); }}
                    className={`flex-1 items-center rounded-full border py-1.5 ${
                      value === iso ? 'border-brand-orange bg-brand-orange/20' : 'border-border bg-background'
                    }`}
                  >
                    <Text className={`text-[11px] font-semibold ${value === iso ? 'text-brand-orange' : 'text-slate-400'}`}>
                      {lbl}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
