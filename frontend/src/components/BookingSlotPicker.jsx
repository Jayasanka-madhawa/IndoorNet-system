import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  CLOSE_HOUR,
  MAX_DURATION,
  OPEN_HOUR,
  buildSlotTimesFromHours,
  computeHourSelection,
  formatHourLabel,
  formatSelectionSummary,
  getHourOptions,
  pruneSelection,
  todayDateStr,
} from '../bookingSlots';

export default function BookingSlotPicker({
  bayId,
  date,
  selectedHours,
  onDateChange,
  onSelectionChange,
  summaryExtra,
  singleSelect = false,
  maxHours = MAX_DURATION,
}) {
  const [occupiedHours, setOccupiedHours] = useState([]);
  const [loadingOccupied, setLoadingOccupied] = useState(false);

  const hourOptions = useMemo(() => getHourOptions(), []);
  const selectedSet = useMemo(() => new Set(selectedHours), [selectedHours]);

  useEffect(() => {
    if (!bayId || !date) {
      setOccupiedHours([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingOccupied(true);
    api(`/bookings/occupied?bayId=${bayId}&date=${date}`)
      .then((data) => {
        if (cancelled) return;
        setOccupiedHours(data.occupiedHours || []);
      })
      .catch(() => {
        if (!cancelled) setOccupiedHours([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOccupied(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bayId, date]);

  useEffect(() => {
    const pruned = pruneSelection(selectedHours, occupiedHours);
    if (pruned.length !== selectedHours.length) {
      onSelectionChange(pruned);
    }
  }, [occupiedHours]);

  const slot = buildSlotTimesFromHours(date, selectedHours);
  const summary = slot.valid ? formatSelectionSummary(date, selectedHours) : '';

  function handleHourClick(hour) {
    if (occupiedHours.includes(hour)) return;

    if (singleSelect) {
      onSelectionChange(selectedSet.has(hour) ? [] : [hour]);
      return;
    }

    const next = computeHourSelection(
      selectedHours,
      hour,
      occupiedHours,
      maxHours
    );
    onSelectionChange(next);
  }

  function chipClass(hour) {
    if (occupiedHours.includes(hour)) return 'hour-chip occupied';
    if (selectedSet.has(hour)) return 'hour-chip in-selection';
    return 'hour-chip';
  }

  return (
    <div className="slot-picker">
      <label>
        Date
        <input
          type="date"
          value={date}
          min={todayDateStr()}
          onChange={(e) => {
            onDateChange(e.target.value);
            onSelectionChange([]);
          }}
          required
        />
      </label>

      <div className="slot-field">
        <div className="slot-field-header">
          <span className="slot-field-label">Time slots</span>
          {bayId && (
            <div className="slot-legend">
              <span className="slot-legend-item">
                <span className="slot-legend-swatch available" /> Available
              </span>
              <span className="slot-legend-item">
                <span className="slot-legend-swatch in-selection" /> Selected
              </span>
              <span className="slot-legend-item">
                <span className="slot-legend-swatch occupied" /> Booked
              </span>
            </div>
          )}
        </div>
        {loadingOccupied && bayId && (
          <p className="muted slot-loading">Checking availability…</p>
        )}
        <div className="hour-grid" role="listbox" aria-label="Time slots">
          {hourOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="option"
              aria-selected={selectedSet.has(value)}
              aria-disabled={occupiedHours.includes(value)}
              className={chipClass(value)}
              disabled={occupiedHours.includes(value)}
              onClick={() => handleHourClick(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {slot.valid && (
        <p className="slot-summary">
          <strong>{summary}</strong>
          {summaryExtra}
        </p>
      )}

      <p className="muted slot-hint">
        {singleSelect
          ? `Tap one slot · ${formatHourLabel(OPEN_HOUR)} – ${formatHourLabel(CLOSE_HOUR)} daily`
          : `Tap slots to select · up to ${maxHours} hours · click again to deselect`}
      </p>
    </div>
  );
}

export { buildSlotTimesFromHours as buildSlotTimes };
