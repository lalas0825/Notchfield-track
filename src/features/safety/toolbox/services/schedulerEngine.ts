/**
 * Toolbox scheduler engine — pure function, fully portable.
 * Mirrors Takeoff's `src/features/pm/services/toolboxSchedulerEngine.ts`.
 *
 * Priority (per sprint §4):
 *   1. PM override present → return that topic, skip algorithm.
 *   2. Rotation filter → skip topics delivered in the last 8 weeks.
 *   3. Score remaining:
 *        trade match (primary_trades ∩ topic.trade) = +100
 *        universal topic (empty trade[]) = +50
 *        other-trade topic = +20
 *        PTP tag overlap = +50
 *        season match (current quarter ∈ topic.season) = +20
 *        decay: weeks_since_last_delivery × 2 (cap 100)
 *        never delivered = +30
 *   4. Sort by score desc, tie-break by id.
 */

import type {
  ToolboxLibraryTopic,
  ToolboxDelivery,
  ToolboxScheduleOverride,
  RankedTopic,
  ScheduleResult,
} from '../types';

const ROTATION_WEEKS = 8;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

type Quarter = 'q1' | 'q2' | 'q3' | 'q4' | 'winter' | 'spring' | 'summer' | 'fall';

function currentSeasonTokens(date: Date): Quarter[] {
  const month = date.getUTCMonth(); // 0-11
  const quarter: Quarter =
    month < 3 ? 'q1' : month < 6 ? 'q2' : month < 9 ? 'q3' : 'q4';
  const season: Quarter =
    month < 2 || month === 11
      ? 'winter'
      : month < 5
        ? 'spring'
        : month < 8
          ? 'summer'
          : 'fall';
  return [quarter, season];
}

function weeksBetween(from: Date, to: Date): number {
  const diff = Math.abs(to.getTime() - from.getTime());
  return diff / MS_PER_WEEK;
}

function lastDeliveryOf(
  topic: ToolboxLibraryTopic,
  history: ToolboxDelivery[],
): ToolboxDelivery | null {
  let latest: ToolboxDelivery | null = null;
  for (const d of history) {
    if (d.toolbox_library_id !== topic.id && d.slug !== topic.slug) continue;
    if (!latest || new Date(d.delivered_date) > new Date(latest.delivered_date)) {
      latest = d;
    }
  }
  return latest;
}

export type SchedulerInput = {
  library: ToolboxLibraryTopic[];
  history: ToolboxDelivery[];
  primaryTrades: string[];
  currentDate: Date;
  override: ToolboxScheduleOverride | null;
  ptpSignal?: { tags: string[] } | null;
};

export function scheduleToolboxTopic(input: SchedulerInput): ScheduleResult {
  const { library, history, primaryTrades, currentDate, override, ptpSignal } = input;

  // 1. PM override always wins
  if (override) {
    const topic = library.find((t) => t.id === override.topic_id) ?? null;
    return {
      suggested: topic,
      alternatives: [],
      explanation: topic
        ? [`Override by PM${override.reason ? `: ${override.reason}` : ''}`]
        : ['Override references a topic that is no longer available'],
      wasOverridden: true,
      ranked: topic ? [{ topic, score: Infinity, reasons: ['pm_override'] }] : [],
    };
  }

  // 2. Rotation — skip anything delivered in the last 8 weeks
  const eligible = library.filter((t) => {
    const last = lastDeliveryOf(t, history);
    if (!last) return true;
    return weeksBetween(new Date(last.delivered_date), currentDate) >= ROTATION_WEEKS;
  });

  if (eligible.length === 0) {
    return {
      suggested: null,
      alternatives: [],
      explanation: ['All topics are still in their 8-week cooldown'],
      wasOverridden: false,
      ranked: [],
    };
  }

  // 3. Score
  const ptpTags = new Set((ptpSignal?.tags ?? []).map((t) => t.toLowerCase()));
  const trades = new Set(primaryTrades.map((t) => t.toLowerCase()));
  const seasonTokens = new Set(currentSeasonTokens(currentDate));

  const ranked: RankedTopic[] = eligible.map((topic) => {
    let score = 0;
    const reasons: string[] = [];

    // Trade match
    const topicTrades = (topic.trade ?? []).map((t) => t.toLowerCase());
    if (topicTrades.length === 0) {
      score += 50;
      reasons.push('Universal topic');
    } else if (topicTrades.some((t) => trades.has(t))) {
      score += 100;
      const match = topicTrades.find((t) => trades.has(t));
      reasons.push(`Trade match: ${match}`);
    } else {
      score += 20;
      reasons.push('Other trade');
    }

    // PTP tag overlap
    const overlap = (topic.tags ?? []).filter((t) => ptpTags.has(t.toLowerCase()));
    if (overlap.length > 0) {
      score += 50;
      reasons.push(`Recent PTP hazard: ${overlap.join(', ')}`);
    }

    // Season match
    const seasonOverlap = (topic.season ?? []).filter((s) =>
      seasonTokens.has(s.toLowerCase() as Quarter),
    );
    if (seasonOverlap.length > 0) {
      score += 20;
      reasons.push(`Season: ${seasonOverlap.join(', ')}`);
    }

    // Decay + never-delivered bonus
    const last = lastDeliveryOf(topic, history);
    if (!last) {
      score += 30;
      reasons.push('Never delivered before');
    } else {
      const weeks = Math.min(100, Math.round(weeksBetween(new Date(last.delivered_date), currentDate) * 2));
      score += weeks;
      reasons.push(`Last covered ${Math.round(weeks / 2)} weeks ago`);
    }

    return { topic, score, reasons };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.topic.id.localeCompare(b.topic.id);
  });

  const suggested = ranked[0]?.topic ?? null;
  const alternatives = ranked.slice(1, 6).map((r) => r.topic);

  return {
    suggested,
    alternatives,
    explanation: ranked[0]?.reasons ?? [],
    wasOverridden: false,
    ranked,
  };
}

/**
 * Returns the Monday of the ISO week containing `date`, as yyyy-mm-dd.
 * Toolbox scheduling operates on weekly cadence — every query that groups
 * by week should pass through here.
 */
export function weekStartDate(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 Sun, 1 Mon, ... 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}
