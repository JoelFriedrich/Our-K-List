import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAwardsForUser, attachAwards } from '../lib/queries';
import { formatStatus } from '../lib/utils';
import { Profile, Friendship, UserShow, ShowStatus, InviteLink } from '../types';
import { Search, UserPlus, Check, X, Loader2, Users, ChevronRight, Star, LayoutGrid, List as ListIcon, Copy, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import ShowCard from './ShowCard';
import Avatar from './Avatar';

interface FriendsProps {
  onShowClick: (userShow: UserShow) => void;
  onFriendshipUpdate?: () => void;
  refreshTrigger?: number;
}

export default function Friends({ onShowClick, onFriendshipUpdate, refreshTrigger = 0 }: FriendsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [allFriendShows, setAllFriendShows] = useState<UserShow[]>([]);
  const [isFetchingFriendShows, setIsFetchingFriendShows] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSendingRequest, setIsSendingRequest] = useState<string | null>(null);
  const [friendStatusFilter, setFriendStatusFilter] = useState<ShowStatus>('watched');
  const [friendViewMode, setFriendViewMode] = useState<'grid' | 'list'>('grid');
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        fetchFriendships(user.id);
        fetchOrCreateInviteLink(user.id);
      } else {
        setIsLoading(false);
      }
    };
    init();
  }, [refreshTrigger]);

  const fetchOrCreateInviteLink = async (uid: string) => {
    setIsGeneratingInvite(true);
    try {
      const { data, error } = await supabase
        .from('Invite_links')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      
      if (data) {
        setInviteLink(data);
      } else {
        const code = Math.random().toString(36).substring(2, 10);
        const { data: newLink, error: createError } = await supabase
          .from('Invite_links')
          .insert({ user_id: uid, code })
          .select()
          .single();
        
        if (createError) throw createError;
        setInviteLink(newLink);
      }
    } catch (error: any) {
      console.error('Error with invite link:', error);
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteLink) return;
    const url = `${window.location.origin}/invite/${inviteLink.code}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied to clipboard!');
  };

  const fetchFriendships = async (uid: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('Friendships')
      .select(`
        *,
        friend_profile:Profiles!friendships_friend_id_profiles_fkey(*),
        user_profile:Profiles!friendships_user_id_profiles_fkey(*)
      `)
      .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
      .neq('status', 'declined');

    if (error) {
      console.error('Error fetching friendships:', error);
      toast.error('Failed to load friends');
    } else {
      setFriendships(data || []);
    }
    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentUserId) return;

    setIsSearching(true);
    
    // Get all current friendship IDs to exclude them from search
    const existingFriendIds = friendships.flatMap(f => [f.user_id, f.friend_id]);
    const excludeIds = Array.from(new Set([...existingFriendIds, currentUserId]));

    const { data, error } = await supabase
      .from('Profiles')
      .select('*')
      .ilike('display_name', `%${searchQuery}%`)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(10);

    if (error) {
      toast.error('Search failed');
    } else {
      setSearchResults(data || []);
    }
    setIsSearching(false);
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!currentUserId || isSendingRequest) return;

    setIsSendingRequest(friendId);
    const { error } = await supabase
      .from('Friendships')
      .insert({
        user_id: currentUserId,
        friend_id: friendId,
        status: 'pending'
      });

    if (error) {
      toast.error('Request already sent or failed');
    } else {
      toast.success('Friend request sent!');
      fetchFriendships(currentUserId);
      onFriendshipUpdate?.();
    }
    setIsSendingRequest(null);
  };

  const updateFriendship = async (friendshipId: string, status: 'accepted' | 'declined') => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('Friendships')
      .update({ status })
      .eq('id', friendshipId);

    if (error) {
      toast.error('Failed to update request');
    } else {
      toast.success(`Request ${status}`);
      fetchFriendships(currentUserId);
      onFriendshipUpdate?.();
    }
  };

  const browseFriendList = async (friend: Profile) => {
    setSelectedFriend(friend);
    setIsFetchingFriendShows(true);
    setAllFriendShows([]); // Clear previous shows
    
    const { data: userShows, error: showsError } = await supabase
      .from('User_shows')
      .select(`
        *,
        show:Show_data(*)
      `)
      .eq('user_id', friend.id)
      .order('user_rating', { ascending: false });

    if (showsError) {
      console.error('Error fetching friend list:', showsError);
      toast.error('Failed to fetch friend list');
    } else {
      // Fetch awards separately to avoid invalid join
      const awardsData = await fetchAwardsForUser(friend.id);
      setAllFriendShows(attachAwards(userShows, awardsData));
    }
    setIsFetchingFriendShows(false);
  };

  const filteredFriendShows = allFriendShows.filter(s => s.status === friendStatusFilter);

  const cancelRequest = async (friendshipId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('Friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      toast.error('Failed to cancel request');
    } else {
      toast.success('Request cancelled');
      fetchFriendships(currentUserId);
      onFriendshipUpdate?.();
    }
  };

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
          {/* Invite Section */}
          <section className="space-y-6">
            <h2 className="serif-title text-2xl">Invite a Friend</h2>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Your Personal Invite Link</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    type="text"
                    readOnly
                    value={inviteLink ? `${window.location.origin}/invite/${inviteLink.code}` : 'Generating...'}
                    className="input-field w-full pl-10 text-xs font-mono text-zinc-400 bg-black/50"
                  />
                </div>
                <button
                  onClick={copyInviteLink}
                  disabled={!inviteLink}
                  className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors group"
                  title="Copy Link"
                >
                  <Copy size={18} className="group-active:scale-90 transition-transform" />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest leading-relaxed">
                Friends who join via this link will be automatically added to your friends list.
              </p>
            </div>
          </section>

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
                    <Avatar
                      src={profile.avatar_url}
                      name={profile.display_name}
                      className="w-10 h-10 border border-zinc-700"
                      fallbackClassName="text-xs font-bold uppercase"
                    />
                    <span className="text-sm font-bold">{profile.display_name}</span>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(profile.id)}
                    disabled={isSendingRequest === profile.id}
                    className="p-2 text-zinc-400 hover:text-netflix-red transition-colors disabled:opacity-50"
                    title="Send Friend Request"
                  >
                    {isSendingRequest === profile.id ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Requests Section */}
          {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
            <section className="space-y-8">
              {pendingIncoming.length > 0 && (
                <div className="space-y-4">
                  <h2 className="serif-title text-xl text-netflix-red flex items-center gap-2">
                    Incoming Requests
                    <span className="bg-netflix-red text-white text-[10px] px-2 py-0.5 rounded-full">{pendingIncoming.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {pendingIncoming.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-netflix-red/30">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={f.user_profile?.avatar_url}
                            name={f.user_profile?.display_name}
                            fallback={f.user_profile?.display_name?.charAt(0) || '?'}
                            className="w-8 h-8 border border-zinc-700"
                            fallbackClassName="text-[10px] font-bold uppercase"
                          />
                          <span className="text-sm font-bold">{f.user_profile?.display_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateFriendship(f.id, 'accepted')}
                            className="p-2 text-green-500 hover:bg-green-500/10 rounded-full transition-colors"
                            title="Accept"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => updateFriendship(f.id, 'declined')}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                            title="Decline"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingOutgoing.length > 0 && (
                <div className="space-y-4">
                  <h2 className="serif-title text-xl text-zinc-400">Outgoing Requests</h2>
                  <div className="space-y-3">
                    {pendingOutgoing.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-3 bg-zinc-900/30 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={f.friend_profile?.avatar_url}
                            name={f.friend_profile?.display_name}
                            fallback={f.friend_profile?.display_name?.charAt(0) || '?'}
                            className="w-8 h-8 border border-zinc-700 opacity-50"
                            fallbackClassName="text-[10px] font-bold uppercase"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-400">{f.friend_profile?.display_name}</span>
                            <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Pending</span>
                          </div>
                        </div>
                        <button
                          onClick={() => cancelRequest(f.id)}
                          className="p-2 text-zinc-600 hover:text-white transition-colors"
                          title="Cancel Request"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                        <Avatar
                          src={profile.avatar_url}
                          name={profile.display_name}
                          className="w-12 h-12 border border-zinc-700"
                          fallbackClassName="text-sm font-bold uppercase"
                        />
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-zinc-800">
                  <div className="flex items-center gap-6">
                    <Avatar
                      src={selectedFriend.avatar_url}
                      name={selectedFriend.display_name}
                      className="w-20 h-20 border-2 border-netflix-red shadow-2xl"
                      fallbackClassName="text-3xl font-serif italic uppercase"
                    />
                    <div>
                      <h2 className="serif-title text-4xl mb-1">{selectedFriend.display_name}'s List</h2>
                      <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">
                        {filteredFriendShows.length} {formatStatus(friendStatusFilter)} Shows
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                      {(['watched', 'watching', 'want_to_watch'] as ShowStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => setFriendStatusFilter(status)}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md ${
                            friendStatusFilter === status 
                              ? 'bg-netflix-red text-white shadow-lg' 
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {formatStatus(status)}
                        </button>
                      ))}
                    </div>

                    <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                      <button
                        onClick={() => setFriendViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${friendViewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <LayoutGrid size={14} />
                      </button>
                      <button
                        onClick={() => setFriendViewMode('list')}
                        className={`p-2 rounded-md transition-all ${friendViewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <ListIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {isFetchingFriendShows ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-netflix-red" size={40} />
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Fetching list...</p>
                  </div>
                ) : filteredFriendShows.length === 0 ? (
                  <div className="text-center py-24 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                    <p className="text-zinc-500 font-medium">No shows in this category yet.</p>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    {friendViewMode === 'grid' ? (
                      <motion.div
                        key="grid"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-2 sm:grid-cols-3 gap-8"
                      >
                        {filteredFriendShows.map((userShow) => (
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
                        {filteredFriendShows.map((userShow, index) => (
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg">{userShow.show?.title}</h3>
                                {userShow.show?.release_year ? (
                                  <span className="text-sm font-medium text-zinc-500">
                                    ({userShow.show.release_year})
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-3">
                                {friendStatusFilter !== 'want_to_watch' && (
                                  <div className="flex items-center gap-1 text-netflix-red">
                                    <span className="font-bold">{userShow.user_rating}</span>
                                    <span className="text-xs text-zinc-500">/ 10</span>
                                  </div>
                                )}
                                <span className={`status-badge status-${userShow.status}`}>
                                  {formatStatus(userShow.status)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                ) /* End of friendShows.length check */ }
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
