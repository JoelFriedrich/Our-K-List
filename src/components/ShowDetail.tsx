import React, { useState, useEffect } from 'react';
import { X, Star, Tv, Clock, Lock, Unlock, Loader2, Save } from 'lucide-react';
import { Show, Actor } from '../types';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface ShowDetailProps {
  show: Show;
  onClose: () => void;
  onUpdate: () => void;
  onActorClick: (actorName: string) => void;
}

export default function ShowDetail({ show, onClose, onUpdate, onActorClick }: ShowDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [friedrichRating, setFriedrichRating] = useState(show.friedrich_rating);
  const [rating, setRating] = useState(show.rating);
  const [isSaving, setIsSaving] = useState(false);
  const [actors, setActors] = useState<Actor[]>([]);
  const [isLoadingActors, setIsLoadingActors] = useState(true);

  useEffect(() => {
    const fetchActors = async () => {
      setIsLoadingActors(true);
      try {
        const { data, error } = await supabase
          .from('Actor_data')
          .select('*')
          .in('actor_name', show.actors);
        
        if (error) throw error;
        setActors(data || []);
      } catch (error) {
        console.error('Error fetching actors:', error);
      } finally {
        setIsLoadingActors(false);
      }
    };

    fetchActors();
  }, [show.actors]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === import.meta.env.VITE_RATING_PASSWORD) {
      setIsEditing(true);
      setShowPasswordPrompt(false);
      setPassword('');
    } else {
      toast.error('ACCESS DENIED');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('Show_data')
        .update({
          friedrich_rating: friedrichRating,
          rating: rating
        })
        .eq('id', show.id);

      if (error) throw error;

      toast.success('STATS UPDATED');
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      toast.error('SAVE FAILED');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card-bg w-full max-w-4xl border-4 border-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-netflix-red text-white p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 transition-all"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Poster Section */}
          <div className="w-full md:w-1/3 border-b-4 md:border-b-0 md:border-r-4 border-zinc-900">
            <img
              src={show.poster_url}
              alt={show.title}
              className="w-full h-full object-cover transition-all"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Content Section */}
          <div className="flex-1 p-8 space-y-8">
            <div>
              <h2 className="font-game text-2xl text-white mb-4 leading-tight">{show.title}</h2>
              <div className="flex items-center gap-6 font-mono text-zinc-400">
                <span className="flex items-center gap-2"><Tv size={18} className="text-netflix-red" /> {show.seasons} SEASONS</span>
                <span className="flex items-center gap-2"><Clock size={18} className="text-netflix-red" /> {show.episodes} EPS</span>
              </div>
            </div>

            <div className="bg-zinc-950 p-4 border-2 border-zinc-900 font-mono text-zinc-300 leading-relaxed">
              <span className="text-netflix-red mr-2">{'>'}</span>{show.summary}
            </div>

            {/* Ratings Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
              <div className="bg-zinc-900 p-6 border-4 border-zinc-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
                <div className="font-game text-[8px] text-zinc-500 mb-4">FRIEDRICH RATING</div>
                {isEditing ? (
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={friedrichRating}
                    onChange={(e) => setFriedrichRating(parseFloat(e.target.value))}
                    className="bg-black border-2 border-netflix-red text-white font-game text-sm w-24 text-center p-2"
                  />
                ) : (
                  <div className="font-game text-3xl text-netflix-red">{show.friedrich_rating}</div>
                )}
              </div>

              <div className="bg-zinc-900 p-6 border-4 border-zinc-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
                <div className="font-game text-[8px] text-zinc-500 mb-4">YOUR RATING</div>
                {isEditing ? (
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={rating}
                    onChange={(e) => setRating(parseFloat(e.target.value))}
                    className="bg-black border-2 border-netflix-red text-white font-game text-sm w-24 text-center p-2"
                  />
                ) : (
                  <div className="font-game text-3xl text-yellow-500">{show.rating}</div>
                )}
              </div>

              <div className="absolute -top-3 -right-3">
                {isEditing ? (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-green-600 text-white p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowPasswordPrompt(!showPasswordPrompt)}
                    className="bg-zinc-800 text-zinc-400 p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:text-netflix-red"
                  >
                    <Lock size={14} />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showPasswordPrompt && (
                  <motion.form
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onSubmit={handleUnlock}
                    className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-4 p-4 z-20"
                  >
                    <div className="font-game text-[8px] text-netflix-red">ENTER PASSWORD</div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-zinc-900 border-2 border-zinc-700 text-white font-mono p-2 text-center focus:border-netflix-red outline-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="pixel-button">UNLOCK</button>
                      <button type="button" onClick={() => setShowPasswordPrompt(false)} className="pixel-button !bg-zinc-700 !shadow-[inset_-4px_-4px_0px_0px_#444]">ESC</button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* Actors Section */}
            <div className="space-y-4">
              <h3 className="font-game text-[10px] text-zinc-500 border-b-2 border-zinc-900 pb-2">CAST</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {isLoadingActors ? (
                  <div className="col-span-full flex justify-center py-4">
                    <Loader2 className="animate-spin text-netflix-red" />
                  </div>
                ) : (
                  show.actors.map((actorName, idx) => {
                    const actorData = actors.find(a => a.actor_name === actorName);
                    return (
                      <div
                        key={idx}
                        onClick={() => onActorClick(actorName)}
                        className="group cursor-pointer flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 border-2 border-zinc-800 group-hover:border-netflix-red transition-all overflow-hidden mb-2">
                          {actorData?.actor_img_url ? (
                            <img
                              src={actorData.actor_img_url}
                              alt={actorName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700 font-game text-[8px]">
                              N/A
                            </div>
                          )}
                        </div>
                        <div className="font-mono text-[10px] font-bold text-white group-hover:text-netflix-red transition-colors truncate w-full">{actorName}</div>
                        <div className="font-mono text-[8px] text-zinc-500">{show.characters[idx]}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
