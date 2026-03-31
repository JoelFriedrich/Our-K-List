import React, { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-card-bg w-full max-w-md rounded-xl border border-zinc-800 shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h2 className="serif-title text-xl">Actor Profile</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-netflix-red" size={40} />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Loading Profile...</p>
            </div>
          ) : actor ? (
            <>
              <div className="w-32 h-32 mb-6 rounded-full overflow-hidden border-2 border-netflix-red shadow-2xl bg-zinc-900">
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
              
              <h3 className="serif-title text-2xl text-white mb-1">{actor.actor_name}</h3>
              <p className="text-[10px] text-zinc-500 mb-8 font-bold uppercase tracking-widest">Lead Actor</p>
              
              <div className="w-full space-y-4">
                <div className="flex items-center gap-2 text-netflix-red mb-4">
                  <Tv size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Other Shows</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {actor.ref_shows.map((showTitle, idx) => (
                    <button
                      key={idx}
                      onClick={() => onShowClick(showTitle)}
                      className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 transition-all text-left group rounded-lg"
                    >
                      <Tv size={16} className="text-zinc-600 group-hover:text-netflix-red" />
                      <span className="text-sm text-zinc-300 font-medium">{showTitle}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={onClose}
                className="mt-10 btn-secondary w-full"
              >
                Close
              </button>
            </>
          ) : (
            <div className="text-zinc-500 py-12 text-sm font-medium">Actor not found.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
