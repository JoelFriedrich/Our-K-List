import React from 'react';
import { Star } from 'lucide-react';

interface RatingInputProps {
  value: number;
  onChange: (value: number) => void;
}

export default function RatingInput({ value, onChange }: RatingInputProps) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min="0"
        max="10"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-netflix-red"
      />
      <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded border border-zinc-700">
        <Star size={14} className="text-netflix-red fill-netflix-red" />
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={value}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) onChange(Math.min(10, Math.max(0, val)));
          }}
          className="bg-transparent border-none text-white w-12 text-sm font-serif italic focus:ring-0 p-0"
        />
      </div>
    </div>
  );
}
