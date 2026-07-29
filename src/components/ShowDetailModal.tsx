import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserShow, Actor, ShowStatus, AwardType, Award, Profile } from '../types';
import { X, Star, Heart, Loader2, Edit2, Check, Trash2, Trophy, Eye, EyeOff, MessageSquare, Lock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { insertFeedEvent } from '../lib/feed';
import Comments from './Comments';

interface ShowDetailModalProps {
  userShow: UserShow;
  onClose: () => void;
  onUpdate: () => void;
  onActorClick: (actorName: string) => void;
  isFriendView?: boolean;
}

const AWARD_CONFIG: Record<AwardType, { label: string; icon: string; color: string }> = {
  'Best Lead Chemistry': { label: 'Best Lead Chemistry', icon: '💑', color: 'text-pink-400' },
  'Best Lead Actress': { label: 'Best Lead Actress', icon: '👑', color: 'text-yellow-400' },
  'Best Lead Actor': { label: 'Best Lead Actor', icon: '👑', color: 'text-blue-400' },
  'Best Soundtrack': { label: 'Best Soundtrack', icon: '🎵', color: 'text-purple-400' },
  'Made Me Cry the Most': { label: 'Made Me Cry the Most', icon: '😭', color: 'text-blue-500' },
  'Funniest Show': { label: 'Funniest Show', icon: '😂', color: 'text-yellow-500' },
  'Most Addictive': { label: 'Most Addictive', icon: '🍿', color: 'text-red-500' },
  'Best Slow Burn': { label: 'Best Slow Burn', icon: '🕯️', color: 'text-orange-400' },
  'Best Supporting Roles': { label: 'Best Supporting Roles', icon: '🎭', color: 'text-green-400' },
  'Best Village': { label: 'Best Village', icon: '🏘️', color: 'text-emerald-400' },
  'Best Historical': { label: 'Best Historical', icon: '🏯', color: 'text-amber-600' },
  'Best Cinematic': { label: 'Best Cinematic', icon: '🎥', color: 'text-zinc-400' },
  'Most Creative': { label: 'Most Creative', icon: '💡', color: 'text-cyan-400' },
  'Most Wholesome': { label: 'Most Wholesome', icon: '✨', color: 'text-indigo-400' }
};

export default function ShowDetailModal({ userShow, onClose, onUpdate, onActorClick, isFriendView = false }: ShowDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(userShow.user_rating);
  const [comments, setComments] = useState(userShow.comments);
  const [status, setStatus] = useState<ShowStatus>(userShow.status);
  const [isSpoiler, setIsSpoiler] = useState(userShow.is_spoiler || false);
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actors, setActors] = useState<Actor[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInMyList, setIsInMyList] = useState(false);
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [awards, setAwards] = useState<Award[]>(userShow.awards || []);
  const [isAwarding, setIsAwarding] = useState(false);
  const [isAwardDropdownOpen, setIsAwardDropdownOpen] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [isFriend, setIsFriend] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Fetch owner profile
      const { data: profileData } = await supabase
        .from('Profiles')
        .select('*')
        .eq('id', userShow.user_id)
        .single();
      setOwnerProfile(profileData);

      if (user) {
        // Check if in my list
        const { data: myShow } = await supabase
          .from('User_shows')
          .select('id')
          .eq('user_id', user.id)
          .eq('show_id', userShow.show_id)
          .maybeSingle();
        setIsInMyList(!!myShow);

        // Check if friend
        if (user.id !== userShow.user_id) {
          const { data: friendship } = await supabase
            .from('Friendships')
            .select('*')
            .eq('status', 'accepted')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${userShow.user_id}),and(user_id.eq.${userShow.user_id},friend_id.eq.${user.id})`)
            .maybeSingle();
          setIsFriend(!!friendship);
        } else {
          setIsFriend(true); // Owner is "friend" of self for commenting
        }
      }

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('User_shows')
        .update({
          user_rating: rating,
          comments,
          status,
          is_spoiler: isSpoiler
        })
        .eq('id', userShow.id);

      if (error) throw error;

      // Part 1 — Write feed events (silent background insert)
      if (status !== userShow.status) {
        insertFeedEvent('status_changed', userShow.show_id, userShow.id, { 
          old_status: userShow.status, 
          new_status: status 
        });
      }
      if (rating !== userShow.user_rating) {
        insertFeedEvent('rated', userShow.show_id, userShow.id, { rating });
      }
      if (comments !== userShow.comments && comments.trim()) {
        insertFeedEvent('commented', userShow.show_id, userShow.id, { 
          comment: comments,
          is_spoiler: isSpoiler 
        });
      }

      toast.success('Updated successfully!');
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGiveAward = async (type: AwardType) => {
    if (!currentUserId || userShow.user_id !== currentUserId) return;
    
    setIsAwarding(true);
    try {
      const { data, error } = await supabase
        .from('Awards')
        .upsert({
          user_id: currentUserId,
          show_id: userShow.show_id,
          award: type
        }, {
          onConflict: 'user_id,award'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setAwards([...awards, data]);
      insertFeedEvent('gave_award', userShow.show_id, userShow.id, { award: type });
      toast.success(`Awarded ${AWARD_CONFIG[type].label}!`);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAwarding(false);
    }
  };

  const handleRemoveAward = async (type: AwardType) => {
    if (!currentUserId || userShow.user_id !== currentUserId) return;
    
    try {
      const { error } = await supabase
        .from('Awards')
        .delete()
        .eq('user_id', currentUserId)
        .eq('show_id', userShow.show_id)
        .eq('award', type);
      
      if (error) throw error;
      
      setAwards(awards.filter(a => a.award !== type));
      toast.success('Award removed');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || userShow.user_id === user.id) return;
    const userId = user.id;

    try {
      if (isLiked) {
        await supabase
          .from('Comment_likes')
          .delete()
          .eq('user_show_id', userShow.id)
          .eq('user_id', userId);
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        await supabase
          .from('Comment_likes')
          .insert({
            user_show_id: userShow.id,
            user_id: userId
          });
        
        // Fetch friend's display name for metadata
        const { data: friendProfile } = await supabase
          .from('Profiles')
          .select('display_name')
          .eq('id', userShow.user_id)
          .single();

        insertFeedEvent('liked_comment', userShow.show_id, userShow.id, { 
          liked_user_display_name: friendProfile?.display_name || 'Friend' 
        });

        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddToMyList = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || isAddingToList) return;
    const userId = user.id;
    
    setIsAddingToList(true);
    try {
      const { data: newUserShow, error } = await supabase
        .from('User_shows')
        .insert({
          user_id: userId,
          show_id: userShow.show_id,
          status: 'want_to_watch',
          user_rating: 0,
          comments: ''
        })
        .select()
        .single();

      if (error) throw error;

      // Part 1 — Write feed events (silent background insert)
      if (newUserShow) {
        insertFeedEvent('added_show', userShow.show_id, newUserShow.id, { 
          status: 'want_to_watch' 
        });
      }

      toast.success('Added to your Want to Watch list!');
      setIsInMyList(true);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAddingToList(false);
    }
  };

  const handleDelete = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    
    setIsDeleting(true);
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
    } finally {
      setIsDeleting(false);
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
                  {show.release_year ? (
                    <span className="text-zinc-500 text-xl sm:text-3xl font-sans font-normal ml-3">
                      ({show.release_year})
                    </span>
                  ) : null}
                </h1>
                
                {isFriendView && !isInMyList && (
                  <button
                    onClick={handleAddToMyList}
                    disabled={isAddingToList}
                    className="btn-primary flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-[0.2em] font-bold"
                  >
                    {isAddingToList ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Check size={16} />
                    )}
                    Add to Want to Watch
                  </button>
                )}
                {isFriendView && isInMyList && (
                  <div className="flex items-center gap-2 text-green-500 font-bold text-[10px] uppercase tracking-widest bg-green-500/10 px-3 py-1.5 rounded-full w-fit">
                    <Check size={14} />
                    In your list
                  </div>
                )}
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

              <section className="pt-10 border-t border-zinc-800">
                {ownerProfile?.allow_comments ? (
                  isFriend ? (
                    <Comments 
                      userShowId={userShow.id} 
                      showId={userShow.show_id} 
                      ownerId={userShow.user_id} 
                    />
                  ) : (
                    <div className="bg-zinc-900/50 rounded-xl p-8 text-center border border-zinc-800">
                      <Lock className="mx-auto text-zinc-700 mb-4" size={32} />
                      <h3 className="text-lg font-serif italic text-zinc-500 mb-2">Discussion Restricted</h3>
                      <p className="text-zinc-600 text-sm">Only friends can participate in this discussion.</p>
                    </div>
                  )
                ) : (
                  <div className="bg-zinc-900/50 rounded-xl p-8 text-center border border-zinc-800">
                    <MessageSquare className="mx-auto text-zinc-700 mb-4" size={32} />
                    <h3 className="text-lg font-serif italic text-zinc-500 mb-2">Comments Disabled</h3>
                    <p className="text-zinc-600 text-sm">The owner has disabled comments for their list.</p>
                  </div>
                )}
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">Comments</label>
                      {isEditing && (
                        <button
                          onClick={() => setIsSpoiler(!isSpoiler)}
                          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            isSpoiler ? 'text-netflix-red' : 'text-zinc-500 hover:text-zinc-400'
                          }`}
                        >
                          {isSpoiler ? <EyeOff size={12} /> : <Eye size={12} />}
                          {isSpoiler ? 'Spoiler On' : 'Mark Spoiler'}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full bg-zinc-800 border-none text-white rounded p-3 text-sm focus:ring-1 focus:ring-netflix-red min-h-[100px] resize-none"
                        placeholder="What did you think?"
                      />
                    ) : (
                      <div className="relative group">
                        {isSpoiler && !showSpoiler ? (
                          <div 
                            onClick={() => setShowSpoiler(true)}
                            className="bg-zinc-800/50 backdrop-blur-md rounded-lg p-6 text-center cursor-pointer border border-zinc-700/50 hover:border-netflix-red transition-all"
                          >
                            <EyeOff className="mx-auto text-zinc-500 mb-2" size={24} />
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Spoiler Content</p>
                            <p className="text-[10px] text-zinc-600 mt-1">Click to reveal</p>
                          </div>
                        ) : (
                          <div className="relative">
                            <p className="text-zinc-300 italic text-sm leading-relaxed">
                              "{comments || 'No comments yet...'}"
                            </p>
                            {isSpoiler && (
                              <span className="absolute -top-2 -right-2 bg-netflix-red text-white text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shadow-lg">
                                Spoiler
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Awards Section */}
                  <div className="pt-4 border-t border-zinc-800">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">Awards</label>
                    <div className="flex flex-wrap gap-2">
                      {awards.map((award) => (
                        <div
                          key={award.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 rounded-full border border-zinc-700 text-xs font-medium ${AWARD_CONFIG[award.award].color} group/award`}
                          title={AWARD_CONFIG[award.award].label}
                        >
                          <span>{AWARD_CONFIG[award.award].icon}</span>
                          <span className="text-zinc-300">{AWARD_CONFIG[award.award].label}</span>
                          {!isFriendView && (
                            <button 
                              onClick={() => handleRemoveAward(award.award)}
                              className="ml-1 text-zinc-500 hover:text-netflix-red transition-colors opacity-0 group-hover/award:opacity-100"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      {!isFriendView && (
                        <div className="relative inline-block text-left">
                          <button 
                            type="button"
                            onClick={() => setIsAwardDropdownOpen(!isAwardDropdownOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-all shadow-sm active:scale-95"
                          >
                            <Trophy size={14} className="text-yellow-500 shrink-0" />
                            <span>{isAwarding ? 'Updating...' : 'Add Award'}</span>
                            <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${isAwardDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isAwardDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setIsAwardDropdownOpen(false)} 
                              />
                              <div className="absolute left-0 bottom-full mb-2 z-40 w-60 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1.5 max-h-64 overflow-y-auto">
                                <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                  Select Award
                                </div>
                                {(Object.keys(AWARD_CONFIG) as AwardType[]).map((type) => {
                                  const existingAward = awards.find(a => a.award === type);
                                  return (
                                    <button
                                      key={type}
                                      type="button"
                                      onClick={() => {
                                        if (existingAward) {
                                          handleRemoveAward(type);
                                        } else {
                                          handleGiveAward(type);
                                        }
                                      }}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left ${
                                        existingAward 
                                          ? 'bg-zinc-800/80 text-white font-medium' 
                                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                      }`}
                                    >
                                      <span className="text-base">{AWARD_CONFIG[type].icon}</span>
                                      <span className="flex-1 truncate">{AWARD_CONFIG[type].label}</span>
                                      {existingAward && <Check size={14} className="text-netflix-red shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
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
                    </div>
                  )}

                  {!isFriendView && (
                    <div className="pt-6 border-t border-zinc-800 mt-6 flex justify-end">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-400 font-medium">Remove from list?</span>
                          <button
                            onClick={() => setIsConfirmingDelete(false)}
                            className="text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition-colors flex items-center gap-2"
                          >
                            {isDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsConfirmingDelete(true)}
                          className="text-zinc-700 hover:text-red-500 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                          title="Delete from list"
                        >
                          <Trash2 size={16} />
                          Delete Show
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
