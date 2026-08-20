import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Playlist, PlaylistShow, UserShow, Show } from '../types';
import { 
  ArrowLeft, Edit2, Trash2, Plus, Search, Loader2, 
  Check, Heart, Copy, Share2, Globe, Lock, GripVertical, X, ListMusic
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { toast } from 'react-hot-toast';
import PlaylistModal from './PlaylistModal';
import { insertFeedEvent } from '../lib/feed';
import { sanitizeSearchTerm } from '../lib/security';

interface PlaylistDetailProps {
  playlistId: string;
  onShowClick: (userShow: UserShow) => void;
  onBack?: () => void;
  isPublicView?: boolean;
}

export default function PlaylistDetail({ playlistId, onShowClick, onBack, isPublicView = false }: PlaylistDetailProps) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistShows, setPlaylistShows] = useState<PlaylistShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userShows, setUserShows] = useState<UserShow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    try {
      // Fetch playlist. Unauthenticated visitors may only read public playlists.
      let playlistQuery = supabase
        .from('Playlists')
        .select('*, Profiles!Playlists_user_id_fkey(*)')
        .eq('id', playlistId);

      if (!user) {
        playlistQuery = playlistQuery.eq('is_public', true);
      }

      const { data: playlistData, error: playlistError } = await playlistQuery.single();

      if (playlistError) throw playlistError;
      setPlaylist(playlistData);

      // Fetch shows in playlist
      const { data: showsData, error: showsError } = await supabase
        .from('Playlist_shows')
        .select('*, Show_data(*)')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });
      
      if (showsError) throw showsError;
      setPlaylistShows(showsData || []);

      // Check if following
      if (user && user.id !== playlistData.user_id) {
        const { data: followData } = await supabase
          .from('Playlist_follows')
          .select('*')
          .eq('playlist_id', playlistId)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsFollowing(!!followData);
      }
    } catch (error: any) {
      toast.error(error.message);
      if (onBack) onBack();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [playlistId]);

  const handleSearch = async () => {
    if (!currentUserId || !searchQuery.trim()) {
      setUserShows([]);
      return;
    }
    const term = sanitizeSearchTerm(searchQuery);
    if (!term) {
      setUserShows([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('User_shows')
        .select('*, Show_data(*)')
        .eq('user_id', currentUserId)
        .ilike('Show_data.title', `%${term}%`)
        .limit(10);
      
      setUserShows(data?.map(d => ({ ...d, show: d.Show_data })) as any || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addShowToPlaylist = async (showId: string) => {
    if (!playlist || playlist.user_id !== currentUserId) return;
    try {
      const position = playlistShows.length;
      const { data, error } = await supabase
        .from('Playlist_shows')
        .insert({
          playlist_id: playlistId,
          show_id: showId,
          position
        })
        .select('*, Show_data(*)')
        .single();
      
      if (error) throw error;
      setPlaylistShows([...playlistShows, data]);
      setIsSearchOpen(false);
      setSearchQuery('');
      toast.success('Show added to playlist!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const removeShowFromPlaylist = async (id: string) => {
    if (!playlist || playlist.user_id !== currentUserId) return;
    try {
      const { error } = await supabase
        .from('Playlist_shows')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setPlaylistShows(playlistShows.filter(s => s.id !== id));
      toast.success('Show removed from playlist');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReorder = async (newOrder: PlaylistShow[]) => {
    if (!playlist || playlist.user_id !== currentUserId) return;
    setPlaylistShows(newOrder);
    // Update positions in background
    const updates = newOrder.map((s, index) => ({
      id: s.id,
      position: index
    }));

    for (const update of updates) {
      await supabase
        .from('Playlist_shows')
        .update({ position: update.position })
        .eq('id', update.id);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || !playlist) return;
    try {
      if (isFollowing) {
        await supabase
          .from('Playlist_follows')
          .delete()
          .eq('playlist_id', playlistId)
          .eq('user_id', currentUserId);
        setIsFollowing(false);
        toast.success('Unfollowed playlist');
      } else {
        await supabase
          .from('Playlist_follows')
          .insert({
            playlist_id: playlistId,
            user_id: currentUserId
          });
        
        // Feed event
        insertFeedEvent('followed_playlist', '', '', { 
          playlist_name: playlist.name,
          owner: playlist.Profiles?.display_name || 'Friend'
        });

        setIsFollowing(true);
        toast.success('Following playlist!');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCopy = async () => {
    if (!currentUserId || !playlist) return;
    setIsCopying(true);
    try {
      // 1. Create new playlist
      const { data: newPlaylist, error: pError } = await supabase
        .from('Playlists')
        .insert({
          user_id: currentUserId,
          name: `${playlist.name} (Copy)`,
          description: playlist.description,
          is_public: false
        })
        .select()
        .single();
      
      if (pError) throw pError;

      // 2. Copy shows
      const showsToInsert = playlistShows.map((s, index) => ({
        playlist_id: newPlaylist.id,
        show_id: s.show_id,
        position: index
      }));

      if (showsToInsert.length > 0) {
        const { error: sError } = await supabase
          .from('Playlist_shows')
          .insert(showsToInsert);
        if (sError) throw sError;
      }

      toast.success('Playlist copied to your list!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCopying(false);
    }
  };

  const handleDelete = async () => {
    if (!playlist || playlist.user_id !== currentUserId) return;
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('Playlists')
        .delete()
        .eq('id', playlistId)
        .eq('user_id', currentUserId);
      
      if (error) throw error;
      toast.success('Playlist deleted');
      if (onBack) onBack();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-netflix-red" size={40} />
      </div>
    );
  }

  if (!playlist) return null;

  const isOwner = currentUserId === playlist.user_id;

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row gap-10">
        {/* Playlist Info */}
        <div className="md:w-1/3 space-y-8">
          {!isPublicView && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <ArrowLeft size={16} />
              Back to Playlists
            </button>
          )}

          <div className="relative aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center group">
            {playlistShows.length > 0 ? (
              <img
                src={playlistShows[0].Show_data?.poster_url}
                alt={playlist.name}
                className="w-full h-full object-cover opacity-40 blur-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ListMusic size={64} className="text-zinc-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <ListMusic size={48} className="text-netflix-red mb-4" />
              <h1 className="serif-title text-3xl text-white mb-2 leading-tight">{playlist.name}</h1>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                <span>{playlistShows.length} Shows</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {playlist.is_public ? <Globe size={12} /> : <Lock size={12} />}
                  {playlist.is_public ? 'Public' : 'Private'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
              {playlist.Profiles?.avatar_url ? (
                <img
                  src={playlist.Profiles.avatar_url}
                  alt={playlist.Profiles.display_name}
                  className="w-10 h-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold">
                  {playlist.Profiles?.display_name?.charAt(0) || 'U'}
                </div>
              )}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Curated by</p>
                <p className="text-white font-serif italic">{playlist.Profiles?.display_name}</p>
              </div>
            </div>

            <p className="text-zinc-400 text-sm leading-relaxed italic">
              "{playlist.description || "No description provided."}"
            </p>

            <div className="flex flex-wrap gap-3">
              {isOwner ? (
                <>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-widest font-bold"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-3 bg-zinc-900 hover:bg-red-900/20 text-zinc-500 hover:text-red-500 rounded-lg border border-zinc-800 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              ) : !isPublicView ? (
                <>
                  <button
                    onClick={handleFollow}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-widest font-bold rounded-lg border transition-all ${
                      isFollowing 
                        ? 'bg-netflix-red border-netflix-red text-white' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                  >
                    {isFollowing ? <Check size={14} /> : <Heart size={14} />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={isCopying}
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-all"
                  >
                    {isCopying ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
                    Copy to My List
                  </button>
                </>
              ) : (
                <div className="w-full bg-netflix-red/10 border border-netflix-red/20 p-6 rounded-xl text-center space-y-4">
                  <p className="text-sm text-zinc-300">Sign up to follow this playlist and track your own K-Dramas!</p>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="btn-primary w-full py-3 text-xs uppercase tracking-widest font-bold"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Shows List */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">Shows in Playlist</h2>
            {isOwner && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 text-netflix-red hover:text-netflix-red/80 transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <Plus size={16} />
                Add Show
              </button>
            )}
          </div>

          {isOwner ? (
            <Reorder.Group axis="y" values={playlistShows} onReorder={handleReorder} className="space-y-4">
              {playlistShows.map((ps) => (
                <Reorder.Item
                  key={ps.id}
                  value={ps}
                  className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 group hover:border-zinc-600 transition-all"
                >
                  <div className="cursor-grab active:cursor-grabbing text-zinc-700 group-hover:text-zinc-500 transition-colors">
                    <GripVertical size={20} />
                  </div>
                  <img
                    src={ps.Show_data?.poster_url}
                    alt={ps.Show_data?.title}
                    className="w-12 h-16 object-cover rounded shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{ps.Show_data?.title}</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{ps.Show_data?.seasons} Seasons</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onShowClick({
                        id: '',
                        user_id: playlist.user_id,
                        show_id: ps.show_id,
                        user_rating: 0,
                        comments: '',
                        status: 'watched',
                        added_at: '',
                        is_spoiler: false,
                        show: ps.Show_data
                      })}
                      className="p-2 text-zinc-600 hover:text-white transition-colors"
                    >
                      <Search size={18} />
                    </button>
                    <button
                      onClick={() => removeShowFromPlaylist(ps.id)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="space-y-4">
              {playlistShows.map((ps) => (
                <div
                  key={ps.id}
                  className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-600 transition-all"
                >
                  <img
                    src={ps.Show_data?.poster_url}
                    alt={ps.Show_data?.title}
                    className="w-12 h-16 object-cover rounded shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{ps.Show_data?.title}</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{ps.Show_data?.seasons} Seasons</p>
                  </div>
                  <button
                    onClick={() => onShowClick({
                      id: '',
                      user_id: playlist.user_id,
                      show_id: ps.show_id,
                      user_rating: 0,
                      comments: '',
                      status: 'watched',
                      added_at: '',
                      is_spoiler: false,
                      show: ps.Show_data
                    })}
                    className="p-2 text-zinc-600 hover:text-white transition-colors"
                  >
                    <Search size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {playlistShows.length === 0 && (
            <div className="text-center py-20 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
              <p className="text-zinc-600 text-sm">This playlist is currently empty.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Show Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-card-bg rounded-xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col max-h-[70vh]"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="serif-title text-2xl">Add Show to Playlist</h2>
                <button onClick={() => setIsSearchOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field w-full pl-10"
                    placeholder="Search your list..."
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  {isSearching ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-netflix-red" size={24} />
                    </div>
                  ) : userShows.length > 0 ? (
                    userShows.map((us) => (
                      <button
                        key={us.id}
                        onClick={() => addShowToPlaylist(us.show_id)}
                        disabled={playlistShows.some(ps => ps.show_id === us.show_id)}
                        className="w-full flex items-center gap-4 p-3 bg-zinc-900/50 hover:bg-zinc-800/50 rounded-lg border border-zinc-800 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <img
                          src={us.show?.poster_url}
                          alt={us.show?.title}
                          className="w-10 h-14 object-cover rounded"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate group-hover:text-netflix-red transition-colors">{us.show?.title}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{us.status.replace(/_/g, ' ')}</p>
                        </div>
                        {playlistShows.some(ps => ps.show_id === us.show_id) ? (
                          <Check size={18} className="text-green-500" />
                        ) : (
                          <Plus size={18} className="text-zinc-600 group-hover:text-white" />
                        )}
                      </button>
                    ))
                  ) : searchQuery ? (
                    <p className="text-center py-8 text-zinc-600 text-sm italic">No shows found in your list.</p>
                  ) : (
                    <p className="text-center py-8 text-zinc-600 text-sm italic">Start typing to search your list...</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchData();
        }}
        playlist={playlist}
      />
    </div>
  );
}
