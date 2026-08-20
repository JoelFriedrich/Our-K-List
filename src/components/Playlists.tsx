import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, fetchProfile, fetchAcceptedFriendIds } from '../lib/queries';
import { Playlist, Profile } from '../types';
import { Plus, ListMusic, Users, Globe, Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import PlaylistModal from './PlaylistModal';
import Avatar from './Avatar';

interface PlaylistsProps {
  onPlaylistClick: (id: string) => void;
  refreshTrigger: number;
}

export default function Playlists({ onPlaylistClick, refreshTrigger }: PlaylistsProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'following' | 'friends'>('my');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    const user = await getCurrentUser();
    if (!user) return;

    // Fetch user profile for "My Playlists" fallback
    if (!userProfile) {
      const profile = await fetchProfile(user.id);
      if (profile) setUserProfile(profile);
    }

    try {
      if (activeTab === 'my') {
        const { data } = await supabase
          .from('Playlists')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        setPlaylists(data || []);
      } else if (activeTab === 'following') {
        const { data } = await supabase
          .from('Playlist_follows')
          .select('Playlists(*, Profiles!Playlists_user_id_fkey(*))')
          .eq('user_id', user.id);
        
        setPlaylists(data?.map(d => d.Playlists) as any || []);
      } else {
        // Friends' Playlists
        const friendIds = await fetchAcceptedFriendIds(user.id);

        if (friendIds.length > 0) {
          const { data } = await supabase
            .from('Playlists')
            .select('*, Profiles!Playlists_user_id_fkey(*)')
            .in('user_id', friendIds)
            .order('created_at', { ascending: false });
          setPlaylists(data || []);
        } else {
          setPlaylists([]);
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, [activeTab, refreshTrigger]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="serif-title text-4xl text-white tracking-tighter">Playlists</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-[0.2em] font-bold w-fit"
        >
          <Plus size={18} />
          New Playlist
        </button>
      </div>

      <div className="flex items-center gap-8 border-b border-zinc-900">
        <button
          onClick={() => setActiveTab('my')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'my' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          My Playlists
          {activeTab === 'my' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-netflix-red" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('following')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'following' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Following
          {activeTab === 'following' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-netflix-red" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'friends' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Friends' Playlists
          {activeTab === 'friends' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-netflix-red" />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-netflix-red" size={40} />
        </div>
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onPlaylistClick(playlist.id)}
              className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 hover:border-zinc-600 transition-all cursor-pointer group flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-netflix-red/10 rounded-lg text-netflix-red group-hover:scale-110 transition-transform">
                  <ListMusic size={24} />
                </div>
                {playlist.is_public ? (
                  <Globe size={16} className="text-zinc-600" title="Public" />
                ) : (
                  <Users size={16} className="text-zinc-600" title="Private" />
                )}
              </div>

              <h3 className="serif-title text-xl text-white mb-2 group-hover:text-netflix-red transition-colors">
                {playlist.name}
              </h3>
              <p className="text-zinc-500 text-sm line-clamp-2 mb-6 flex-1">
                {playlist.description || "No description provided."}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50 mt-auto">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={playlist.Profiles?.avatar_url || (activeTab === 'my' ? userProfile?.avatar_url : undefined)}
                    name={playlist.Profiles?.display_name || userProfile?.display_name}
                    className="w-6 h-6"
                    fallbackClassName="text-[10px] font-bold"
                  />
                  <span className="text-xs text-zinc-400 font-medium">{playlist.Profiles?.display_name || userProfile?.display_name}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                  <span>{playlist.shows_count || 0} Shows</span>
                  <span>{playlist.follows_count || 0} Followers</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
          <ListMusic size={48} className="mx-auto text-zinc-700 mb-4" />
          <h3 className="text-xl font-serif italic text-zinc-500 mb-2">No playlists found</h3>
          <p className="text-zinc-600 text-sm">
            {activeTab === 'my' 
              ? "Create your first playlist to organize your favorite K-Dramas."
              : activeTab === 'following'
              ? "You haven't followed any playlists yet."
              : "Your friends haven't created any playlists yet."}
          </p>
        </div>
      )}

      <PlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchPlaylists();
        }}
      />
    </div>
  );
}
