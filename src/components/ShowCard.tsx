import { Star, Clock, Tv } from 'lucide-react';
import { Show } from '../types';
import { motion } from 'motion/react';

interface ShowCardProps {
  show: Show;
  onClick: () => void;
  key?: string;
}

export default function ShowCard({ show, onClick }: ShowCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick}
      className="relative group cursor-pointer bg-card-bg border-4 border-zinc-900 hover:border-netflix-red transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="aspect-[2/3] relative">
        <img
          src={show.poster_url}
          alt={show.title}
          className="w-full h-full object-cover transition-all"
          referrerPolicy="no-referrer"
        />
        
        {/* Rating Badge - Pixel Style */}
        <div className="absolute top-2 right-2 bg-netflix-red text-white px-2 py-1 font-game text-[8px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          RATING {show.friedrich_rating}
        </div>

        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center p-4 text-center">
          <h3 className="font-game text-[10px] leading-tight mb-4 text-white">{show.title}</h3>
          <div className="space-y-2 font-mono text-sm text-zinc-300">
            <div className="flex items-center justify-center gap-2"><Star size={14} className="text-yellow-500 fill-yellow-500" /> {show.rating}</div>
            <div className="flex items-center justify-center gap-2"><Tv size={14} /> {show.seasons} SEASONS</div>
            <div className="flex items-center justify-center gap-2"><Clock size={14} /> {show.episodes} EPS</div>
          </div>
          <div className="mt-4 font-game text-[8px] text-netflix-red animate-pulse">VIEW DETAILS</div>
        </div>
      </div>
      
      {/* Title below for mobile/static view */}
      <div className="p-2 bg-zinc-950 border-t-4 border-zinc-900">
        <h3 className="font-game text-[8px] truncate text-zinc-400 group-hover:text-white">{show.title}</h3>
      </div>
    </motion.div>
  );
}
