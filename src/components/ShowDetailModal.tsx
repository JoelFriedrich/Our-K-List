import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserShow, Actor, ShowStatus } from '../types';
import { X, Star, Heart, Loader2, Edit2, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface ShowDetailModalProps {
  userShow: UserShow;
  onClose: () => void;
  onUpdate: () => void;
  onActorClick: (actorName: string) => void;
  isFriendView?: boolean;
}

export default function ShowDetailModal({ userShow, onClose, onUpdate, onActorClick, isFriendView = false }: ShowDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(userShow.user_rating);
  const [comments, setComments] = useState(userShow.comments);
  const [status, setStatus] = useState<ShowStatus>(userShow.status);
  const [isSaving, setIsSaving] = useState(false);
  const [actors, setActors] = useState<Actor[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Fetch actors
      if (userShow.show?.actors) {
        const { data } = await supabase
          .from('Actor_data')
          .select('*')
          .in('actor_name', userShow.show.actors);
        if (data) setActors(data);
      }

      // Fetch likes
      const { count } = await supabase
        .from('Comment_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_show_id', userShow.id);
      setLikesCount(count || 0);

      if (user) {
        const { data: likeData } = await supabase
          .from('Comment_likes')
          .select('*')
          .eq('user_show_id', userShow.id)
          .eq('user_id', user.id)
          .single();
        setIsLiked(!!likeData);
      }
    };

    init();
  }, [userShow.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('User_shows')
        .update({
          user_rating: rating,
          comments,
          status
        })
        .eq('id', userShow.id);

      if (error) throw error;
      toast.success('Updated successfully!');
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLike = async () => {
    if (!currentUserId || userShow.user_id === currentUserId) return;

    try {
      if (isLiked) {
        await supabase
          .from('Comment_likes')
          .delete()
          .eq('user_show_id', userShow.id)
          .eq('user_id', currentUserId);
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        await supabase
          .from('Comment_likes')
          .insert({
            user_show_id: userShow.id,
            user_id: currentUserId
          });
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to remove this show from your list?')) return;
    
    try {
      const { error } = await supabase
        .from('User_shows')
        .delete()
        .eq('id', userShow.id);
      
      if (error) throw error;
      toast.success('Removed from list');
      onClose();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const show = userShow.show;
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl bg-card-bg rounded-xl overflow-hidden shadow-2xl border border-zinc-800 max-h-[90vh] flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors"
        >
          <X size={24} />
        </button>

        <div className="overflow-y-auto flex-1">
          <div className="relative h-64 sm:h-96">
            <img
              src={show.poster_url}
              alt={show.title}
              className="w-full h-full object-cover opacity-40"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card-bg via-card-bg/40 to-transparent" />
            
            <div className="absolute bottom-0 left-0 p-6 sm:p-10 flex flex-col sm:flex-row items-end gap-6 w-full">
              <img
                src={show.poster_url}
                alt={show.title}
                className="w-32 sm:w-48 aspect-[2/3] object-cover rounded-lg shadow-2xl border-2 border-zinc-800 hidden sm:block"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`status-badge status-${status}`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-zinc-400 text-sm font-medium">
                    {show.seasons} Seasons • {show.episodes} Episodes
                  </span>
                </div>
                <h1 className="serif-title text-3xl sm:text-5xl text-white mb-4 leading-tight">
                  {show.title}
                </h1>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <section>
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Summary</h2>
                <p className="text-zinc-300 leading-relaxed text-lg">
                  {show.summary}
                </p>
              </section>

              <section>
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {actors.map((actor) => (
                    <div 
                      key={actor.id} 
                      onClick={() => onActorClick(actor.actor_name)}
                      className="flex items-center gap-3 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors"
                    >
                      <img
                        src={actor.actor_img_url}
                        alt={actor.actor_name}
                        className="w-12 h-12 rounded-full object-cover border border-zinc-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{actor.actor_name}</p>
                        <p className="text-[10px] text-zinc-500 truncate uppercase tracking-tighter">Actor</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="bg-zinc-900/80 p-6 rounded-xl border border-zinc-800 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg">
                    {isFriendView ? 'Friend\'s Review' : 'My Review'}
                  </h3>
                  {!isFriendView && (
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="text-green-500 hover:text-green-400 transition-colors"
                        >
                          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-zinc-500 hover:text-white transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Rating</label>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.1"
                          value={rating}
                          onChange={(e) => setRating(parseFloat(e.target.value))}
                          className="flex-1 accent-netflix-red"
                        />
                        <span className="text-xl font-serif italic w-12 text-center">{rating}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Star className="text-netflix-red fill-netflix-red" size={24} />
                        <span className="text-3xl font-serif italic">{rating}</span>
                        <span className="text-zinc-600">/ 10</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Status</label>
                    {isEditing ? (
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ShowStatus)}
                        className="w-full bg-zinc-800 border-none text-white rounded p-2 text-sm focus:ring-1 focus:ring-netflix-red"
                      >
                        <option value="watched">Watched</option>
                        <option value="watching">Watching</option>
                        <option value="want_to_watch">Want to Watch</option>
                      </select>
                    ) : (
                      <span className={`status-badge status-${status}`}>
                        {status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Comments</label>
                    {isEditing ? (
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full bg-zinc-800 border-none text-white rounded p-3 text-sm focus:ring-1 focus:ring-netflix-red min-h-[100px] resize-none"
                        placeholder="What did you think?"
                      />
                    ) : (
                      <p className="text-zinc-300 italic text-sm leading-relaxed">
                        "{comments || 'No comments yet...'}"
                      </p>
                    )}
                  </div>

                  {(comments || likesCount > 0) && (
                    <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleToggleLike}
                          disabled={!currentUserId || userShow.user_id === currentUserId}
                          className={`transition-all ${
                            isLiked ? 'text-netflix-red' : 'text-zinc-600 hover:text-zinc-400'
                          } disabled:opacity-30`}
                        >
                          <Heart size={20} className={isLiked ? 'fill-netflix-red' : ''} />
                        </button>
                        <span className="text-sm font-bold text-zinc-400">{likesCount}</span>
                      </div>

                      {!isFriendView && (
                        <button
                          onClick={handleDelete}
                          className="text-zinc-700 hover:text-red-500 transition-colors"
                          title="Delete from list"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
