import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { TMDBShow, TMDBActor, ShowStatus } from '../types';
import { X, Search, Plus, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

import RatingInput from './RatingInput';
import { insertFeedEvent } from '../lib/feed';
import { logError, reportError } from '../lib/errors';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

interface TMDBShowDetails extends TMDBShow {
  credits?: {
    cast?: TMDBActor[];
  };
  number_of_seasons?: number;
  number_of_episodes?: number;
}

interface TMDBErrorResponse {
  status_message?: string;
}

const fetchTmdb = async <T,>(path: string): Promise<T> => {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is missing. Please configure VITE_TMDB_API_KEY.');
  }

  const response = await fetch(`https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`);
  const data = await response.json() as T | TMDBErrorResponse;
  if (!response.ok) {
    const statusMessage = typeof data === 'object' && data !== null && 'status_message' in data
      ? data.status_message
      : undefined;
    throw new Error(`TMDB request failed (${response.status})${statusMessage ? `: ${statusMessage}` : ''}`);
  }
  return data as T;
};

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
  // A new show is something you are starting, and it is unrated until you say
  // otherwise — no pre-filled opinion.
  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [status, setStatus] = useState<ShowStatus>('watching');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const data = await fetchTmdb<{ results?: TMDBShow[] }>(`/search/tv?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.results || []);
    } catch (error) {
      reportError('TMDB show search', error);
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
      const showDetails = await fetchTmdb<TMDBShowDetails>(`/tv/${selectedShow.id}?append_to_response=credits`);

      const cast = showDetails.credits?.cast?.slice(0, 10) || [];
      const actors = cast.map(a => a.name);
      const characters = cast.map(a => a.character);

      const firstAirDate = showDetails.first_air_date || selectedShow.first_air_date;
      const releaseYearRaw = firstAirDate ? new Date(firstAirDate).getFullYear() : null;
      const releaseYear = (releaseYearRaw && !isNaN(releaseYearRaw)) ? releaseYearRaw : null;

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
          characters,
          release_year: releaseYear
        }, { onConflict: 'tmdb_id' })
        .select()
        .single();

      if (showDataError) throw showDataError;

      // 3. Upsert Actor_data
      const actorUpserts = cast.map(a => ({
        actor_name: a.name,
        actor_img_url: a.profile_path ? `https://image.tmdb.org/t/p/w200${a.profile_path}` : 'https://via.placeholder.com/200x300',
        ref_shows: [showDetails.name]
      }));

      const actorFailures: unknown[] = [];
      for (const actor of actorUpserts) {
        const { data: existingActor, error: actorLookupError } = await supabase
          .from('Actor_data')
          .select('*')
          .eq('actor_name', actor.actor_name)
          .maybeSingle();
        if (actorLookupError) {
          actorFailures.push(actorLookupError);
          logError('Actor data lookup', actorLookupError);
          continue;
        }
        
        if (existingActor) {
          if (!existingActor.ref_shows.includes(showDetails.name)) {
            const newRefShows = [...existingActor.ref_shows, showDetails.name];
            const { error: actorUpdateError } = await supabase
              .from('Actor_data')
              .update({ ref_shows: newRefShows })
              .eq('id', existingActor.id);
            if (actorUpdateError) {
              actorFailures.push(actorUpdateError);
              logError('Actor data update', actorUpdateError);
            }
          }
        } else {
          const { error: actorInsertError } = await supabase
            .from('Actor_data')
            .insert(actor);
          if (actorInsertError) {
            actorFailures.push(actorInsertError);
            logError('Actor data insert', actorInsertError);
          }
        }
      }
      if (actorFailures.length > 0) {
        toast.error('Show added, but some actor details could not be saved.');
      }

      // 4. Create User_shows entry
      const { data: userShowData, error: userShowError } = await supabase
        .from('User_shows')
        .insert({
          user_id: user.id,
          show_id: showData.id,
          user_rating: status === 'watched' ? rating : null,
          comments: '',
          status
        })
        .select()
        .single();

      if (userShowError) throw userShowError;

      // 5. The review is the opening comment of the show's discussion.
      //    User_shows.comments is kept in sync from there by the database.
      if (userShowData && comments.trim()) {
        const { error: reviewError } = await supabase
          .from('Comments')
          .insert({
            user_id: user.id,
            user_show_id: userShowData.id,
            show_id: showData.id,
            body: comments.trim(),
            is_spoiler: isSpoiler
          });
        if (reviewError) {
          logError('Review comment insert', reviewError);
          toast.error('Show added, but your review could not be saved.');
        } else {
          const feedResult = await insertFeedEvent('commented', showData.id, userShowData.id, {
            comment: comments.trim(),
            is_spoiler: isSpoiler
          });
          if (!feedResult.ok) toast.error('Review saved, but the activity was not posted to the feed.');
        }
      }

      // Part 1 — Write feed events (silent background insert)
      if (userShowData) {
        const feedResult = await insertFeedEvent('added_show', showData.id, userShowData.id, { status });
        if (!feedResult.ok) toast.error('Show added, but the activity was not posted to the feed.');
      }

      toast.success('Added to your list!');
      onSuccess();
      handleClose();
    } catch (error) {
      reportError('Add show', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedShow(null);
    setRating(null);
    setComments('');
    setIsSpoiler(false);
    setStatus('watching');
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
                  className="input-field w-full pl-11 pr-24"
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

                  {status === 'watched' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Rating</label>
                      <RatingInput value={rating} onChange={setRating} />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Review</label>
                    <button
                      type="button"
                      onClick={() => setIsSpoiler(!isSpoiler)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        isSpoiler ? 'text-netflix-red' : 'text-zinc-500 hover:text-zinc-400'
                      }`}
                    >
                      {isSpoiler ? <EyeOff size={12} /> : <Eye size={12} />}
                      {isSpoiler ? 'Spoiler On' : 'Mark Spoiler'}
                    </button>
                  </div>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full bg-zinc-800 border-none text-white rounded p-3 text-sm focus:ring-1 focus:ring-netflix-red min-h-[100px] resize-none"
                    placeholder="Your thoughts on this show..."
                  />
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
                    Starts the discussion — friends can reply to it.
                  </p>
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
