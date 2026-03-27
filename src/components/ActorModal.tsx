import { useState, useEffect } from 'react';
import { X, Loader2, Tv, User } from 'lucide-react';
import { Actor } from '../types';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';

interface ActorModalProps {
  actorName: string;
  onClose: () => void;
  onShowClick: (showTitle: string) => void;
}

export default function ActorModal({ actorName, onClose, onShowClick }: ActorModalProps) {
  const [actor, setActor] = useState<Actor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActor = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('Actor_data')
          .select('*')
          .eq('actor_name', actorName)
          .single();
        
        if (error) throw error;
        setActor(data);
      } catch (error) {
        console.error('Error fetching actor:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActor();
  }, [actorName]);

  if (!actorName) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card-bg w-full max-w-md border-4 border-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
      >
        <div className="p-6 border-b-4 border-zinc-900 flex justify-between items-center bg-zinc-950">
          <h2 className="font-game text-sm text-netflix-red">ACTOR INFO</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-netflix-red" size={40} />
              <p className="font-game text-[8px] text-zinc-500">LOADING...</p>
            </div>
          ) : actor ? (
            <>
              <div className="w-32 h-32 mb-6 border-4 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-zinc-900">
                {actor.actor_img_url ? (
                  <img
                    src={actor.actor_img_url}
                    alt={actor.actor_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700">
                    <User size={64} />
                  </div>
                )}
              </div>
              
              <h3 className="font-game text-lg text-white mb-2">{actor.actor_name}</h3>
              <p className="font-game text-[8px] text-zinc-500 mb-8 tracking-widest uppercase">LEAD ACTOR</p>
              
              <div className="w-full space-y-4">
                <div className="flex items-center gap-2 font-game text-[8px] text-netflix-red mb-4">
                  <Tv size={14} />
                  <span>OTHER SHOWS</span>
                </div>
                <div className="space-y-2">
                  {actor.ref_shows.map((showTitle, idx) => (
                    <button
                      key={idx}
                      onClick={() => onShowClick(showTitle)}
                      className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 border-2 border-zinc-900 hover:border-netflix-red hover:bg-zinc-900 transition-all text-left group"
                    >
                      <Tv size={16} className="text-zinc-600 group-hover:text-netflix-red" />
                      <span className="font-mono text-sm text-zinc-200">{showTitle}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={onClose}
                className="mt-10 pixel-button w-full"
              >
                CLOSE
              </button>
            </>
          ) : (
            <div className="text-zinc-500 py-12 font-game text-[8px]">DATA CORRUPTED. ACTOR NOT FOUND.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
