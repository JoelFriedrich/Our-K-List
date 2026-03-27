import { Star, Tv, Clock, ChevronRight } from 'lucide-react';
import { Show } from '../types';

interface ShowListProps {
  shows: Show[];
  onShowClick: (show: Show) => void;
}

export default function ShowList({ shows, onShowClick }: ShowListProps) {
  // Sort by Friedrich's rating descending
  const sortedShows = [...shows].sort((a, b) => b.friedrich_rating - a.friedrich_rating);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {sortedShows.map((show, index) => (
        <div
          key={show.id}
          onClick={() => onShowClick(show)}
          className="group flex items-center gap-6 bg-card-bg p-4 border-4 border-zinc-900 hover:border-netflix-red transition-all cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          {/* Rank Number - Pixel Style */}
          <div className="w-16 text-center">
            <span className="font-game text-2xl text-zinc-700 group-hover:text-netflix-red transition-colors">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>

          {/* Thumbnail */}
          <div className="w-16 h-24 flex-shrink-0 border-2 border-zinc-800 overflow-hidden shadow-lg">
            <img
              src={show.poster_url}
              alt={show.title}
              className="w-full h-full object-cover transition-all"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-game text-sm mb-2 truncate group-hover:text-netflix-red transition-colors">{show.title}</h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-mono text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="text-netflix-red font-bold">RATING:</span> {show.friedrich_rating}
              </span>
              <span className="flex items-center gap-1">
                <Star size={14} className="text-yellow-500 fill-yellow-500" /> {show.rating}
              </span>
              <span className="flex items-center gap-1">
                <Tv size={14} /> {show.seasons}S
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} /> {show.episodes}E
              </span>
            </div>
          </div>

          <div className="text-zinc-600 group-hover:text-white transition-colors">
            <ChevronRight size={24} />
          </div>
        </div>
      ))}
    </div>
  );
}
