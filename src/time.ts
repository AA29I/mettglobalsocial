export function formatWallTime(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function resolveWallTime(wall: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall))
    throw new Error("Choose a valid date and time.");
  const target = Date.parse(wall + ":00Z");
  if (!Number.isFinite(target) || formatWallTime(new Date(target), "UTC") !== wall)
    throw new Error("Choose a valid date and time.");
  // Probe both sides of a possible clock change, including half-hour changes.
  // Accept only a wall time that maps to exactly one UTC instant.
  const candidates = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const probe = target + hours * 3600000;
    const offset = Date.parse(formatWallTime(new Date(probe), timezone) + ":00Z") - probe;
    const candidate = target - offset;
    if (formatWallTime(new Date(candidate), timezone) === wall) candidates.add(candidate);
  }
  if (!candidates.size)
    throw new Error("This local time is invalid because of a timezone clock change. Choose another time.");
  if (candidates.size > 1)
    throw new Error("This local time occurs twice because of a timezone clock change. Choose a time outside the repeated hour.");
  return new Date([...candidates][0]).toISOString();
}
