import React from 'react';
import { UserShow, AwardType } from '../types';
import { Star, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

interface ShowCardProps {
  key?: string | number;
  userShow: UserShow;
  onClick: () => void;
}

const AWARD_ICONS: Record<AwardType, string> = {
  'Best Lead Chemistry': '💑',
  'Best Lead Actress': '👑',
  'Best Lead Actor': '👑',
  'Best Soundtrack': '🎵',
  'Made Me Cry the Most': '😭',
  'Funniest Show': '😂',
  'Most Addictive': '🍿',
  'Best Slow Burn': '🕯️',
  'Best Supporting Roles': '🎭',
  'Best Village': '🏘️',
  'Best Historical': '🏯',
  'Best Cinematic': '🎥',
  'Most Creative': '💡',
  'Most Wholesome': '✨'
};

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
        
        {/* Rating Badge */}
        {status !== 'want_to_watch' && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 border border-zinc-800 shadow-xl">
            <Star size={12} className="text-netflix-red fill-netflix-red" />
            <span className="text-xs font-bold text-white">{user_rating}</span>
          </div>
        )}

        {/* Spoiler Badge */}
        {is_spoiler && (
          <div className="absolute top-2 left-2 bg-netflix-red text-white p-1 rounded-md shadow-lg" title="Contains Spoilers">
            <EyeOff size={12} />
          </div>
        )}

        {/* Awards Badge */}
        {awards && awards.length > 0 && (
          <div className="absolute bottom-2 right-2 flex flex-wrap gap-1 justify-end max-w-[80%]">
            {awards.map((award) => (
              <span 
                key={award.id} 
                className="text-sm drop-shadow-lg" 
                title={award.award.replace(/_/g, ' ')}
              >
                {AWARD_ICONS[award.award]}
              </span>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-3">
        <h3 className="font-bold text-sm sm:text-base leading-tight line-clamp-1 group-hover:text-netflix-red transition-colors">
          {show.title}
        </h3>
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
