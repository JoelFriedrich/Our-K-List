import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { TMDBShow, TMDBActor } from '../types';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

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
  const [friedrichRating, setFriedrichRating] = useState(5);
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === import.meta.env.VITE_RATING_PASSWORD) {
      setIsUnlocked(true);
    } else {
      toast.error('INVALID KEY');
    }
  };

  const searchTMDB = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      toast.error('TMDB OFFLINE');
    } finally {
      setIsSearching(false);
    }
  };

  const selectShow = async (show: TMDBShow) => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/tv/${show.id}?api_key=${TMDB_API_KEY}`
      );
      const fullDetails = await response.json();
      setSelectedShow(fullDetails);
    } catch (error) {
      toast.error('DATA ERROR');
      setSelectedShow(show);
    }
  };

  const handleSave = async () => {
    if (!selectedShow) return;
    setIsSaving(true);

    try {
      const creditsResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${selectedShow.id}/credits?api_key=${TMDB_API_KEY}`
      );
      const creditsData = await creditsResponse.json();
      const topCast: TMDBActor[] = creditsData.cast.slice(0, 10);

      const actorNames = topCast.map(c => c.name);
      const characters = topCast.map(c => c.character);

      const { data: newShow, error: showError } = await supabase
        .from('Show_data')
        .insert({
          tmdb_id: selectedShow.id,
          title: selectedShow.name,
          poster_url: `https://image.tmdb.org/t/p/w500${selectedShow.poster_path}`,
          summary: selectedShow.overview,
          friedrich_rating: friedrichRating,
          rating: rating,
          comments: comments,
          seasons: selectedShow.number_of_seasons || 1,
          episodes: selectedShow.number_of_episodes || 1,
          actors: actorNames,
          characters: characters
        })
        .select()
        .single();

      if (showError) throw showError;

      for (const castMember of topCast) {
        const { data: existingActor } = await supabase
          .from('Actor_data')
          .select('*')
          .eq('actor_name', castMember.name)
          .single();

        if (existingActor) {
          const updatedRefs = Array.from(new Set([...existingActor.ref_shows, selectedShow.name]));
          await supabase
            .from('Actor_data')
            .update({ ref_shows: updatedRefs })
            .eq('id', existingActor.id);
        } else {
          await supabase
            .from('Actor_data')
            .insert({
              actor_name: castMember.name,
              actor_img_url: castMember.profile_path ? `https://image.tmdb.org/t/p/w200${castMember.profile_path}` : null,
              ref_shows: [selectedShow.name]
            });
        }
      }

      toast.success('SHOW ADDED');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Supabase Insert Error:', error);
      toast.error(`SAVE FAILED: ${error.message || 'UNKNOWN ERROR'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
      <div className="bg-card-bg w-full max-w-2xl border-4 border-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b-4 border-zinc-900 flex justify-between items-center bg-zinc-950">
          <h2 className="font-game text-sm text-netflix-red">ADD NEW SHOW</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="p-12 flex flex-col items-center gap-8">
            <p className="font-game text-[8px] text-zinc-500 text-center leading-loose uppercase">Who is your bias?</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="bg-zinc-900 border-4 border-zinc-800 p-4 w-full max-w-xs text-center font-mono focus:outline-none focus:border-netflix-red transition-colors"
              autoFocus
            />
            <button type="submit" className="pixel-button">
              UNLOCK
            </button>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {!selectedShow ? (
              <div className="space-y-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchTMDB()}
                    placeholder="SEARCH DATABASE..."
                    className="flex-1 bg-zinc-900 border-2 border-zinc-800 p-3 font-mono text-sm focus:outline-none focus:border-netflix-red"
                  />
                  <button
                    onClick={searchTMDB}
                    disabled={isSearching}
                    className="bg-netflix-red p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {searchResults.map((show) => (
                    <div
                      key={show.id}
                      onClick={() => selectShow(show)}
                      className="cursor-pointer group relative border-4 border-zinc-900 hover:border-netflix-red transition-all"
                    >
                      {show.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w200${show.poster_path}`}
                          alt={show.name}
                          className="w-full aspect-[2/3] object-cover transition-all"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] bg-zinc-900 flex items-center justify-center text-zinc-700 font-game text-[8px] p-2 text-center">
                          {show.name}
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                        <Plus size={32} className="text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex gap-6 bg-zinc-950 p-4 border-2 border-zinc-900">
                  <img
                    src={`https://image.tmdb.org/t/p/w200${selectedShow.poster_path}`}
                    alt={selectedShow.name}
                    className="w-24 border-2 border-zinc-800"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1">
                    <h3 className="font-game text-[10px] mb-2">{selectedShow.name}</h3>
                    <p className="font-mono text-[10px] text-zinc-500 line-clamp-3 mb-4">{selectedShow.overview}</p>
                    <div className="flex gap-4 font-game text-[8px] text-netflix-red">
                      <span>{selectedShow.number_of_seasons || 1}S</span>
                      <span>{selectedShow.number_of_episodes || 1}E</span>
                    </div>
                    <button
                      onClick={() => setSelectedShow(null)}
                      className="font-game text-[8px] text-zinc-600 hover:text-white mt-4 underline"
                    >
                      BACK TO SEARCH
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block font-game text-[8px] text-zinc-500 uppercase">JOEL'S RATING</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={friedrichRating}
                        onChange={(e) => setFriedrichRating(parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-zinc-900 border-2 border-zinc-800 p-2 font-mono text-white focus:outline-none focus:border-netflix-red"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block font-game text-[8px] text-zinc-500 uppercase">LINDSAY'S RATING</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={rating}
                        onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-zinc-900 border-2 border-zinc-800 p-2 font-mono text-white focus:outline-none focus:border-netflix-red"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block font-game text-[8px] text-zinc-500 uppercase">COMMENTS</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="ADD YOUR THOUGHTS..."
                    className="w-full bg-zinc-900 border-2 border-zinc-800 p-4 font-mono text-zinc-300 min-h-[100px] focus:outline-none focus:border-netflix-red transition-colors"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full pixel-button !py-4 !text-sm"
                >
                  {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'SAVE SHOW'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
