import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { TMDBShow, TMDBActor, ShowStatus } from '../types';
import { X, Search, Plus, Loader2, Star, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

interface AddShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddShowModal({ isOpen, onClose, onSuccess }: AddShowModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBShow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedShow, setSelectedShow] = useState<TMDBShow | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form fields
  const [rating, setRating] = useState(8);
  const [comments, setComments] = useState('');
  const [status, setStatus] = useState<ShowStatus>('watched');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      toast.error('Failed to search TMDB');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddShow = async () => {
    if (!selectedShow) return;
    setIsAdding(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Fetch full show details from TMDB
      const showDetailsRes = await fetch(
        `https://api.themoviedb.org/3/tv/${selectedShow.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`
      );
      const showDetails = await showDetailsRes.json();

      const actors = showDetails.credits?.cast?.slice(0, 10).map((a: any) => a.name) || [];
      const characters = showDetails.credits?.cast?.slice(0, 10).map((a: any) => a.character) || [];

      // 2. Upsert Show_data
      const { data: showData, error: showDataError } = await supabase
        .from('Show_data')
        .upsert({
          tmdb_id: showDetails.id,
          title: showDetails.name,
          poster_url: `https://image.tmdb.org/t/p/w500${showDetails.poster_path}`,
          summary: showDetails.overview,
          seasons: showDetails.number_of_seasons,
          episodes: showDetails.number_of_episodes,
          actors,
          characters
        }, { onConflict: 'tmdb_id' })
        .select()
        .single();

      if (showDataError) throw showDataError;

      // 3. Upsert Actor_data
      const actorUpserts = showDetails.credits?.cast?.slice(0, 10).map((a: any) => ({
        actor_name: a.name,
        actor_img_url: a.profile_path ? `https://image.tmdb.org/t/p/w200${a.profile_path}` : 'https://via.placeholder.com/200x300',
        ref_shows: [showDetails.name]
      })) || [];

      for (const actor of actorUpserts) {
        const { data: existingActor } = await supabase
          .from('Actor_data')
          .select('*')
          .eq('actor_name', actor.actor_name)
          .maybeSingle();
        
        if (existingActor) {
          if (!existingActor.ref_shows.includes(showDetails.name)) {
            const newRefShows = [...existingActor.ref_shows, showDetails.name];
            await supabase
              .from('Actor_data')
              .update({ ref_shows: newRefShows })
              .eq('id', existingActor.id);
          }
        } else {
          await supabase
            .from('Actor_data')
            .insert(actor);
        }
      }

      // 4. Create User_shows entry
      const { error: userShowError } = await supabase
        .from('User_shows')
        .insert({
          user_id: user.id,
          show_id: showData.id,
          user_rating: rating,
          comments,
          status
        });

      if (userShowError) throw userShowError;

      toast.success('Added to your list!');
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedShow(null);
    setRating(8);
    setComments('');
    setStatus('watched');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl bg-card-bg rounded-xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="serif-title text-2xl">Add New Show</h2>
          <button onClick={handleClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {!selectedShow ? (
            <div className="space-y-6">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field w-full pl-10"
                  placeholder="Search K-Drama title..."
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1 px-3 text-xs"
                >
                  {isSearching ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
                </button>
              </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {searchResults.map((show) => (
                  <div
                    key={show.id}
                    onClick={() => setSelectedShow(show)}
                    className="flex gap-4 p-3 bg-zinc-900/50 hover:bg-zinc-800/50 rounded-lg border border-zinc-800 transition-colors cursor-pointer group"
                  >
                    <img
                      src={show.poster_path ? `https://image.tmdb.org/t/p/w200${show.poster_path}` : 'https://via.placeholder.com/200x300'}
                      alt={show.name}
                      className="w-16 h-24 object-cover rounded shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm mb-1 truncate group-hover:text-netflix-red transition-colors">{show.name}</h3>
                      <p className="text-[10px] text-zinc-500 mb-1">{show.first_air_date ? new Date(show.first_air_date).getFullYear() : 'N/A'}</p>
                      <p className="text-xs text-zinc-500 line-clamp-2">{show.overview}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex gap-6 items-start">
                <img
                  src={`https://image.tmdb.org/t/p/w200${selectedShow.poster_path}`}
                  alt={selectedShow.name}
                  className="w-24 sm:w-32 aspect-[2/3] object-cover rounded-lg shadow-xl border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <button
                    onClick={() => setSelectedShow(null)}
                    className="text-xs font-bold text-zinc-500 hover:text-white mb-2 flex items-center gap-1"
                  >
                    <X size={12} /> Change Show
                  </button>
                  <h3 className="serif-title text-2xl mb-2">{selectedShow.name}</h3>
                  <p className="text-sm text-zinc-400 line-clamp-4">{selectedShow.overview}</p>
                </div>
              </div>

              <div className="space-y-6 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {(['watched', 'watching', 'want_to_watch'] as ShowStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(s)}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-all ${
                            status === s 
                              ? 'bg-netflix-red border-netflix-red text-white' 
                              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                          }`}
                        >
                          {s.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {status !== 'want_to_watch' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Rating</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.1"
                          value={rating}
                          onChange={(e) => setRating(parseFloat(e.target.value))}
                          className="flex-1 accent-netflix-red"
                        />
                        <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded border border-zinc-700">
                          <Star size={14} className="text-netflix-red fill-netflix-red" />
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={rating}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setRating(Math.min(10, Math.max(0, val)));
                            }}
                            className="bg-transparent border-none text-white w-12 text-sm font-serif italic focus:ring-0 p-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Comments</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full bg-zinc-800 border-none text-white rounded p-3 text-sm focus:ring-1 focus:ring-netflix-red min-h-[100px] resize-none"
                    placeholder="Your thoughts on this show..."
                  />
                </div>

                <button
                  onClick={handleAddShow}
                  disabled={isAdding}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {isAdding ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Add to My List</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
