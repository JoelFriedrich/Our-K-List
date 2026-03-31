import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserShow, ShowStatus, Profile } from '../types';
import ShowCard from './ShowCard';
import { LayoutGrid, List as ListIcon, Loader2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MyListProps {
  key?: string | number;
  onShowClick: (userShow: UserShow) => void;
  refreshTrigger: number;
}

export default function MyList({ onShowClick, refreshTrigger }: MyListProps) {
  const [userShows, setUserShows] = useState<UserShow[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ShowStatus>('watched');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const fetchMyList = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile for personalized header
      const { data: profileData } = await supabase
        .from('Profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileData) setProfile(profileData);

      const { data, error } = await supabase
        .from('User_shows')
        .select(`
          *,
          show:Show_data(*)
        `)
        .eq('user_id', user.id)
        .order('user_rating', { ascending: false });

      if (error) {
        console.error('Error fetching list:', error);
      } else {
        setUserShows(data || []);
      }
      setIsLoading(false);
    };

    fetchMyList();
  }, [refreshTrigger]);

  const filteredShows = userShows.filter(us => us.status === statusFilter);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-8">
        <div className="flex items-center gap-6">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={profile.display_name} 
              className="w-20 h-20 rounded-full border-2 border-netflix-red shadow-2xl object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center text-3xl font-serif italic border-2 border-netflix-red shadow-2xl uppercase text-zinc-500">
              {profile?.display_name?.charAt(0) || <Heart size={32} className="text-zinc-800" />}
            </div>
          )}
          <div>
            <h2 className="serif-title text-4xl sm:text-5xl mb-1">
              {profile?.display_name || 'My'} List
            </h2>
            <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">
              {userShows.length} Total Shows tracked
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-full sm:w-auto">
          {(['watched', 'watching', 'want_to_watch'] as ShowStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded-md ${
                statusFilter === status 
                  ? 'bg-netflix-red text-white shadow-lg' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-netflix-red" size={40} />
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Loading your list...</p>
        </div>
      ) : filteredShows.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
          <p className="text-zinc-500 font-medium mb-2">No shows in this category yet.</p>
          <p className="text-zinc-600 text-sm">Add a show to start tracking your progress!</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8"
            >
              {filteredShows.map((userShow) => (
                <ShowCard
                  key={userShow.id}
                  userShow={userShow}
                  onClick={() => onShowClick(userShow)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {filteredShows.map((userShow, index) => (
                <div
                  key={userShow.id}
                  onClick={() => onShowClick(userShow)}
                  className="flex items-center gap-6 p-4 bg-zinc-900/50 hover:bg-zinc-800/50 rounded-lg border border-zinc-800 transition-colors cursor-pointer group"
                >
                  <div className="text-2xl font-serif italic text-zinc-700 group-hover:text-netflix-red transition-colors w-8">
                    {index + 1}
                  </div>
                  <img
                    src={userShow.show?.poster_url}
                    alt={userShow.show?.title}
                    className="w-16 h-24 object-cover rounded shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{userShow.show?.title}</h3>
                    <div className="flex items-center gap-3">
                      {statusFilter !== 'want_to_watch' && (
                        <div className="flex items-center gap-1 text-netflix-red">
                          <span className="font-bold">{userShow.user_rating}</span>
                          <span className="text-xs text-zinc-500">/ 10</span>
                        </div>
                      )}
                      <span className={`status-badge status-${userShow.status}`}>
                        {userShow.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-zinc-500 text-sm italic hidden md:block max-w-md truncate">
                    "{userShow.comments}"
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
