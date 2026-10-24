import { weekDays } from "./bestTimes";
import type { Autolist, AutolistSlot } from "./types";

export type UpcomingAutolistOccurrence = {
  key: string;
  autolistId: string;
  autolistName: string;
  platform: string;
  dayKey: string;
  dayIndex: number;
  dayLabel: string;
  dateLabel: string;
  time: string;
  hour: number;
  text: string;
  queueIndex: number;
  queueLength: number;
  cycle: number;
};

export function sortWeeklySlots(slots: AutolistSlot[]): AutolistSlot[] {
  return [...slots].sort(
    (a, b) => a.day - b.day || a.time.localeCompare(b.time),
  );
}

export function formatDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Generates upcoming slot occurrences for an autolist starting from `anchorDate`.
 * - In circular mode (default or `is_circular !== false`): fills each slot in chronological
 *   order from `autolist.items` and cycles back to item 0 when the queue ends.
 * - In non-circular mode (`is_circular === false`): fills each slot once until the
 *   queue items are exhausted, without repeating.
 */
export function buildAutolistOccurrences(
  autolist: Autolist,
  anchorDate: Date,
  maxOccurrences = 12,
  maxDays = 56,
): UpcomingAutolistOccurrence[] {
  const cleanItems = autolist.items.map((item) => item.trim()).filter(Boolean);
  const sortedSlots = sortWeeklySlots(autolist.slots);
  if (!sortedSlots.length || !cleanItems.length) return [];

  const isCircular = autolist.is_circular !== false;
  const targetCount = isCircular
    ? Math.max(maxOccurrences, cleanItems.length * 2)
    : cleanItems.length;

  const start = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate(),
  );
  const occurrences: UpcomingAutolistOccurrence[] = [];
  let seq = 0;

  for (
    let dayOffset = 0;
    dayOffset < maxDays && occurrences.length < targetCount;
    dayOffset++
  ) {
    const current = new Date(start);
    current.setDate(start.getDate() + dayOffset);
    const dayIndex = (current.getDay() + 6) % 7;
    const daySlots = sortedSlots.filter((s) => s.day === dayIndex);
    if (!daySlots.length) continue;

    const dKey = formatDayKey(current);
    const dateLabel = current.toLocaleDateString("en", {
      month: "short",
      day: "numeric",
    });

    for (const slot of daySlots) {
      if (occurrences.length >= targetCount) break;
      if (!isCircular && seq >= cleanItems.length) break;

      const queueIndex = seq % cleanItems.length;
      const cycle = Math.floor(seq / cleanItems.length) + 1;
      const hour = Number(slot.time.slice(0, 2)) || 0;
      occurrences.push({
        key: `${autolist.id}-${dKey}-${slot.time}-${seq}`,
        autolistId: autolist.id,
        autolistName: autolist.name,
        platform: autolist.platform,
        dayKey: dKey,
        dayIndex,
        dayLabel: weekDays[dayIndex] || "Mon",
        dateLabel,
        time: slot.time,
        hour,
        text: cleanItems[queueIndex],
        queueIndex,
        queueLength: cleanItems.length,
        cycle,
      });
      seq++;
    }
  }

  return occurrences;
}

/**
 * Advances the queue of an autolist by taking the first item:
 * - If circular: moves it to the end of the queue (recycled).
 * - If non-circular: removes it from the queue (consumed).
 */
export function advanceAutolistQueue(
  items: string[],
  isCircular = true,
): { items: string[]; published: string | null } {
  const clean = items.map((i) => i.trim()).filter(Boolean);
  if (!clean.length) return { items: [], published: null };
  const [first, ...rest] = clean;
  return {
    items: isCircular ? [...rest, first] : rest,
    published: first,
  };
}
