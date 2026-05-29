export const OPEN_HOUR = 6;
export const CLOSE_HOUR = 22;
export const MIN_DURATION = 1;
export const MAX_DURATION = 4;

export function todayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatHourLabel(hour) {
  if (hour === 12) return '12 PM';
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function getHourOptions() {
  const options = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h += 1) {
    options.push({ value: h, label: formatHourLabel(h) });
  }
  return options;
}

export function slotToIso(dateStr, hour) {
  const h = String(hour).padStart(2, '0');
  return `${dateStr}T${h}:00:00`;
}

/** Toggle / extend selection when clicking an hour chip. */
export function computeHourSelection(selectedHours, hour, occupiedHours = [], maxHours = MAX_DURATION) {
  const occupied = new Set(occupiedHours);
  const selected = [...selectedHours].sort((a, b) => a - b);

  if (occupied.has(hour)) return selected;

  if (selected.includes(hour)) {
    return selected.filter((h) => h !== hour);
  }

  if (selected.length === 0) {
    return [hour];
  }

  const min = Math.min(...selected, hour);
  const max = Math.max(...selected, hour);
  const range = [];

  for (let h = min; h <= max; h += 1) {
    if (occupied.has(h)) {
      const lo = selected[0];
      const hi = selected[selected.length - 1];
      if (hour === lo - 1) return [...selected, hour].sort((a, b) => a - b);
      if (hour === hi + 1) return [...selected, hour].sort((a, b) => a - b);
      return [hour];
    }
    range.push(h);
  }

  if (range.length > maxHours) {
    if (hour === max) return range.slice(-maxHours);
    if (hour === min) return range.slice(0, maxHours);
    return range.slice(0, maxHours);
  }

  return range;
}

export function isContiguous(selectedHours) {
  if (selectedHours.length <= 1) return true;
  const sorted = [...selectedHours].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

export function buildSlotTimesFromHours(date, selectedHours) {
  if (!date || !selectedHours?.length) {
    return { startsAt: '', endsAt: '', valid: false, durationHours: 0 };
  }
  if (!isContiguous(selectedHours)) {
    return { startsAt: '', endsAt: '', valid: false, durationHours: 0 };
  }
  const sorted = [...selectedHours].sort((a, b) => a - b);
  const start = sorted[0];
  const duration = sorted.length;
  if (duration < MIN_DURATION || duration > MAX_DURATION) {
    return { startsAt: '', endsAt: '', valid: false, durationHours: duration };
  }
  return {
    startsAt: slotToIso(date, start),
    endsAt: slotToIso(date, start + duration),
    valid: true,
    durationHours: duration,
  };
}

export function formatSelectionSummary(date, selectedHours) {
  if (!date || !selectedHours?.length) return '';
  const sorted = [...selectedHours].sort((a, b) => a - b);
  const start = sorted[0];
  const end = sorted[sorted.length - 1] + 1;
  const count = sorted.length;
  const hoursLabel = count === 1 ? '1 hour' : `${count} hours`;
  return `${date} · ${formatHourLabel(start)} – ${formatHourLabel(end)} (${hoursLabel})`;
}

export function estimateAmount(hourlyRate, slotCount) {
  if (!hourlyRate || !slotCount) return 0;
  return hourlyRate * Number(slotCount);
}

// Remove occupied from selection when availability reloads
export function pruneSelection(selectedHours, occupiedHours = []) {
  const occupied = new Set(occupiedHours);
  return selectedHours.filter((h) => !occupied.has(h));
}
