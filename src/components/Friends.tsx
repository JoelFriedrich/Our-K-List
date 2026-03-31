import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, Friendship, UserShow } from '../types';
import { Search, UserPlus, Check, X, Loader2, Users, ChevronRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import ShowCard from './ShowCard';

interface FriendsProps {
  onShowClick: (userShow: UserShow) => void;
}

export default function Friends({ onShowClick }: FriendsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [friendShows, setFriendShows] = useState<UserShow[]>([]);
  const [isFetchingFriendShows, setIsFetchingFriendShows] = useState(false);

  useEffect(() => {
    fetchFriendships();
  }, []);

  const fetchFriendships = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('Friendships')
      .select(`
        *,
        friend_profile:Profiles!Friendships_friend_id_fkey(*),
        user_profile:Profiles!Friendships_user_id_fkey(*)
      `)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (error) {
      console.error('Error fetching friendships:', error);
    } else {
      setFriendships(data || []);
    }
    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('Profiles')
      .select('*')
      .ilike('display_name', `%${searchQuery}%`)
      .neq('id', user?.id)
      .limit(10);

    if (error) {
      toast.error('Search failed');
    } else {
      setSearchResults(data || []);
    }
    setIsSearching(false);
  };

  const sendFriendRequest = async (friendId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('Friendships')
      .insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending'
      });

    if (error) {
      toast.error('Request already sent or failed');
    } else {
      toast.success('Friend request sent!');
      fetchFriendships();
    }
  };

  const updateFriendship = async (friendshipId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('Friendships')
      .update({ status })
      .eq('id', friendshipId);

    if (error) {
      toast.error('Failed to update request');
    } else {
      toast.success(`Request ${status}`);
      fetchFriendships();
    }
  };

  const browseFriendList = async (friend: Profile) => {
    setSelectedFriend(friend);
    setIsFetchingFriendShows(true);
    
    const { data, error } = await supabase
      .from('User_shows')
      .select(`
        *,
        show:Show_data(*)
      `)
      .eq('user_id', friend.id)
      .eq('status', 'watched')
      .order('user_rating', { ascending: false });

    if (error) {
      toast.error('Failed to fetch friend list');
    } else {
      setFriendShows(data || []);
    }
    setIsFetchingFriendShows(false);
  };

  const acceptedFriends = friendships.filter(f => f.status === 'accepted').map(f => {
    const { data: { user } } = supabase.auth.getSession().then(({ data }) => data) as any; // This is a bit hacky for sync access
    // Better way: compare with current user ID
    return f.user_id === selectedFriend?.id ? f.user_profile : f.friend_profile;
  });

  // Re-calculate accepted friends properly
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null));
  }, []);

  const getFriendProfile = (f: Friendship) => {
    return f.user_id === currentUserId ? f.friend_profile : f.user_profile;
  };

  const pendingIncoming = friendships.filter(f => f.status === 'pending' && f.friend_id === currentUserId);
  const pendingOutgoing = friendships.filter(f => f.status === 'pending' && f.user_id === currentUserId);
  const acceptedList = friendships.filter(f => f.status === 'accepted');

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-10">
          {/* Search Section */}
          <section className="space-y-6">
            <h2 className="serif-title text-2xl">Find Friends</h2>
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full pl-10 text-sm"
                placeholder="Search by name..."
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1 px-3 text-[10px] uppercase tracking-widest"
              >
                {isSearching ? <Loader2 className="animate-spin" size={14} /> : 'Search'}
              </button>
            </form>

            <div className="space-y-3">
              {searchResults.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-3">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.display_name} className="w-10 h-10 rounded-full border border-zinc-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold border border-zinc-700 uppercase">
                        {profile.display_name.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-bold">{profile.display_name}</span>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(profile.id)}
                    className="p-2 text-zinc-400 hover:text-netflix-red transition-colors"
                    title="Send Friend Request"
                  >
                    <UserPlus size={20} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Requests Section */}
          {pendingIncoming.length > 0 && (
            <section className="space-y-6">
              <h2 className="serif-title text-xl text-netflix-red">Friend Requests</h2>
              <div className="space-y-3">
                {pendingIncoming.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-netflix-red/30">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{f.user_profile?.display_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateFriendship(f.id, 'accepted')}
                        className="p-2 text-green-500 hover:bg-green-500/10 rounded-full transition-colors"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => updateFriendship(f.id, 'declined')}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Friends List Section */}
          <section className="space-y-6">
            <h2 className="serif-title text-2xl">My Friends</h2>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-zinc-700" size={32} />
              </div>
            ) : acceptedList.length === 0 ? (
              <div className="text-center py-10 bg-zinc-900/30 rounded-lg border border-dashed border-zinc-800">
                <Users className="mx-auto text-zinc-700 mb-2" size={32} />
                <p className="text-zinc-500 text-sm">No friends yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {acceptedList.map((f) => {
                  const profile = getFriendProfile(f);
                  if (!profile) return null;
                  return (
                    <div
                      key={f.id}
                      onClick={() => browseFriendList(profile)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group ${
                        selectedFriend?.id === profile.id 
                          ? 'bg-netflix-red border-netflix-red shadow-lg' 
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.display_name} className="w-12 h-12 rounded-full border border-zinc-700" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold border border-zinc-700 uppercase">
                            {profile.display_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className={`font-bold ${selectedFriend?.id === profile.id ? 'text-white' : 'text-zinc-200'}`}>
                            {profile.display_name}
                          </p>
                          <p className={`text-[10px] uppercase tracking-widest font-bold ${selectedFriend?.id === profile.id ? 'text-red-200' : 'text-zinc-500'}`}>
                            Friend
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={20} className={selectedFriend?.id === profile.id ? 'text-white' : 'text-zinc-700 group-hover:text-zinc-400'} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedFriend ? (
              <motion.div
                key={selectedFriend.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-6 pb-8 border-b border-zinc-800">
                  {selectedFriend.avatar_url ? (
                    <img src={selectedFriend.avatar_url} alt={selectedFriend.display_name} className="w-20 h-20 rounded-full border-2 border-netflix-red shadow-2xl" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-serif italic border-2 border-netflix-red shadow-2xl uppercase">
                      {selectedFriend.display_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2 className="serif-title text-4xl mb-1">{selectedFriend.display_name}'s List</h2>
                    <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">
                      {friendShows.length} Watched Shows
                    </p>
                  </div>
                </div>

                {isFetchingFriendShows ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-netflix-red" size={40} />
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Fetching list...</p>
                  </div>
                ) : friendShows.length === 0 ? (
                  <div className="text-center py-24 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                    <p className="text-zinc-500 font-medium">This user hasn't added any shows yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                    {friendShows.map((userShow) => (
                      <div key={userShow.id} className="relative group cursor-pointer" onClick={() => onShowClick(userShow)}>
                        <div className="aspect-[2/3] relative overflow-hidden rounded-lg shadow-xl">
                          <img
                            src={userShow.show?.poster_url}
                            alt={userShow.show?.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                            <div className="flex items-center gap-1 text-netflix-red mb-1">
                              <Star size={14} className="fill-netflix-red" />
                              <span className="font-bold text-sm">{userShow.user_rating}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 italic line-clamp-2">"{userShow.comments}"</p>
                          </div>
                        </div>
                        <h3 className="mt-3 font-bold text-sm line-clamp-1 group-hover:text-netflix-red transition-colors">
                          {userShow.show?.title}
                        </h3>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-32 text-center space-y-6 opacity-30">
                <Users size={80} className="text-zinc-700" />
                <div className="space-y-2">
                  <h2 className="serif-title text-3xl">Select a friend</h2>
                  <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">To browse their K-Drama collection</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
