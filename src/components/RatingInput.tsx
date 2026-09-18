import React, { useState } from 'react';
import { Star, X } from 'lucide-react';

interface RatingInputProps {
  /** null means "not rated yet" — distinct from a deliberate 0. */
  value: number | null;
  onChange: (value: number | null) => void;
}

const MIN = 0;
const MAX = 10;
const STEP = 0.1;

/** Round to the slider's precision so 0.30000000000000004 never reaches the database. */
const normalize = (value: number) =>
  Math.round(Math.min(MAX, Math.max(MIN, value)) * 10) / 10;

export default function RatingInput({ value, onChange }: RatingInputProps) {
  // While the number box is focused it holds raw text, so partial input like
  // "8." survives long enough to become "8.5".
  const [draft, setDraft] = useState<string | null>(null);

  const isRated = value !== null;
  const boxValue = draft ?? (isRated ? String(value) : '');

  const handleBoxChange = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onChange(normalize(parsed));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={isRated ? value : MIN}
          onChange={(e) => onChange(normalize(parseFloat(e.target.value)))}
          // An unrated slider rests at 0, so tapping the far-left end fires no
          // change event. Commit on release, which makes 0 reachable by touch.
          onPointerUp={(e) => {
            if (!isRated) onChange(normalize(parseFloat(e.currentTarget.value)));
          }}
          aria-label="Rating out of 10"
          aria-valuetext={isRated ? `${value} out of 10` : 'Not rated'}
          className={`flex-1 h-6 cursor-pointer ${isRated ? 'accent-netflix-red' : 'accent-zinc-600'}`}
        />
        <div
          className={`flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded border transition-colors ${
            isRated ? 'border-zinc-700' : 'border-zinc-800'
          }`}
        >
          <Star
            size={14}
            className={isRated ? 'text-netflix-red fill-netflix-red' : 'text-zinc-600'}
          />
          <input
            type="number"
            inputMode="decimal"
            min={MIN}
            max={MAX}
            step={STEP}
            value={boxValue}
            placeholder="—"
            onChange={(e) => handleBoxChange(e.target.value)}
            onBlur={() => setDraft(null)}
            aria-label="Rating out of 10"
            className="bg-transparent border-none text-white w-14 text-sm font-serif italic focus:ring-0 p-0 placeholder:text-zinc-600 placeholder:not-italic"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 min-h-[18px]">
        {isRated ? (
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              onChange(null);
            }}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-netflix-red transition-colors"
          >
            <X size={11} />
            Clear rating
          </button>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-zinc-600">
            Not rated yet — drag or type to rate
          </span>
        )}
        {isRated && value === 0 && (
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 italic">
            Rated zero
          </span>
        )}
      </div>
    </div>
  );
}
