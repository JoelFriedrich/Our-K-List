import React from 'react';
import { UserShow } from '../types';
import { Star, EyeOff, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

interface ShowCardProps {
  key?: string | number;
  userShow: UserShow;
  onClick: () => void;
}

export default function ShowCard({ userShow, onClick }: ShowCardProps) {
  const { show, user_rating, status, is_spoiler, awards } = userShow;

  if (!show) return null;

  return (
    <motion.div
      whileHover={{ y: -10 }}
      onClick={onClick}
      className="netflix-card group relative"
    >
      <div className="aspect-[2/3] relative">
        <img
          src={show.poster_url}
          alt={show.title}
          className="w-full h-full object-cover rounded-md shadow-lg"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <p className="text-xs text-zinc-300 line-clamp-3 mb-2">{show.summary}</p>
          <div className="flex items-center justify-between">
            <span className={`status-badge status-${status} bg-black/60`}>
              {status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        
        {/* Top Left Badges (Spoiler + Awards) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start max-w-[calc(100%-4rem)] z-10 pointer-events-none">
          {is_spoiler && (
            <div className="bg-netflix-red text-white p-1 rounded-md shadow-lg pointer-events-auto" title="Contains Spoilers">
              <EyeOff size={12} />
            </div>
          )}

          {awards && awards.length > 0 && awards.map((award) => (
            <div
              key={award.id}
              className="bg-black/70 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 border border-zinc-800 shadow-xl pointer-events-auto max-w-full"
              title={award.award}
            >
              <Trophy size={12} className="text-yellow-400 shrink-0" />
              <span className="text-[10px] font-bold text-white truncate">{award.award}</span>
            </div>
          ))}
        </div>

        {/* Rating Badge */}
        {status !== 'want_to_watch' && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 border border-zinc-800 shadow-xl z-10">
            <Star size={12} className="text-netflix-red fill-netflix-red" />
            <span className="text-xs font-bold text-white">{user_rating}</span>
          </div>
        )}
      </div>
      
      <div className="mt-3">
        <h3 className="font-bold text-sm sm:text-base leading-tight line-clamp-1 group-hover:text-netflix-red transition-colors">
          {show.title}
        </h3>
        {show.release_year ? (
          <p className="text-xs text-zinc-500 font-normal mt-0.5">
            {show.release_year}
          </p>
        ) : null}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
            {show.seasons} Seasons
          </span>
          <span className="text-zinc-700">•</span>
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
            {show.episodes} Episodes
          </span>
        </div>
      </div>
    </motion.div>
  );
}
