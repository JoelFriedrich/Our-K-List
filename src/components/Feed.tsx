import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FeedEvent, UserShow } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, RefreshCw, MessageSquare, Star, Heart, Plus, Activity, Trophy, ListMusic } from 'lucide-react';
import { motion } from 'motion/react';
import { logError, reportError } from '../lib/errors';

interface FeedProps {
  onShowClick: (userShow: UserShow) => void;
  refreshTrigger: number;
}

export default function Feed({ onShowClick, refreshTrigger }: FeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  const fetchFeed = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Step 1 — get all accepted friend IDs (current user can be either side)
      const { data: friendships, error: friendshipsError } = await supabase
        .from('Friendships')
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);
      if (friendshipsError) throw friendshipsError;

      // Step 2 — extract friend IDs, excluding current user
      const friendIds = friendships?.map(f => 
        f.user_id === currentUser.id ? f.friend_id : f.user_id
      ) ?? [];

      // Step 3 — include current user in the list to see own events too
      const allUserIds = [currentUser.id, ...friendIds];

      // Step 4 — fetch feed events for all those users
      const { data, error } = await supabase
        .from('Feed_events')
        .select(`
          *,
          Profiles!feed_events_user_id_profiles_fkey (
            display_name,
            avatar_url
          ),
          Show_data (
            title,
            poster_url
          )
        `)
        .in('user_id', allUserIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      setLoadError(error);
      reportError('Feed fetch', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [refreshTrigger]);

  const handleEventClick = async (event: FeedEvent) => {
    if (!event.user_show_id) return;

    try {
      const { data: userShow, error: showError } = await supabase
        .from('User_shows')
        .select('*, show:Show_data(*)')
        .eq('id', event.user_show_id)
        .single();

      if (showError) throw showError;
      
      if (userShow) {
        // Fetch awards separately
        const { data: awardsData, error: awardsError } = await supabase
          .from('Awards')
          .select('*')
          .eq('user_id', userShow.user_id)
          .eq('show_id', userShow.show_id);
        if (awardsError) logError('Feed event awards fetch', awardsError);
        onShowClick({
          ...userShow,
          awards: awardsData || []
        });
      }
    } catch (error) {
      reportError('Feed event details', error);
    }
  };

  const getEventDescription = (event: FeedEvent) => {
    const name = event.Profiles?.display_name || 'Someone';
    const showTitle = event.Show_data?.title || 'a show';

    switch (event.event_type) {
      case 'added_show':
        return (
          <span>
            <span className="font-bold text-white">{name}</span> added{' '}
            <span className="font-bold text-white italic">{showTitle}</span> to their{' '}
            {event.metadata?.status?.replace(/_/g, ' ') || 'list'}
          </span>
        );
      case 'status_changed':
        const isFinished = event.metadata?.new_status === 'watched';
        const isStarted = event.metadata?.new_status === 'watching';
        return (
          <span>
            <span className="font-bold text-white">{name}</span>{' '}
            {isFinished ? 'finished' : isStarted ? 'started watching' : 'wants to watch'}{' '}
            <span className="font-bold text-white italic">{showTitle}</span>
          </span>
        );
      case 'commented':
        return (
          <span>
            <span className="font-bold text-white">{name}</span> commented on{' '}
            <span className="font-bold text-white italic">{showTitle}</span>
          </span>
        );
      case 'rated':
        return (
          <span>
            <span className="font-bold text-white">{name}</span> rated{' '}
            <span className="font-bold text-white italic">{showTitle}</span> a{' '}
            <span className="text-netflix-red font-bold">{event.metadata?.rating}</span>
          </span>
        );
      case 'gave_award':
        return (
          <span>
            <span className="font-bold text-white">{name}</span> gave a{' '}
            <span className="text-yellow-500 font-bold uppercase tracking-tighter">{event.metadata?.award?.replace(/_/g, ' ')}</span> award to{' '}
            <span className="font-bold text-white italic">{showTitle}</span>
          </span>
        );
      case 'created_playlist':
        return (
          <span>
            <span className="font-bold text-white">{name}</span> created a new playlist:{' '}
            <span className="font-bold text-white italic">{event.metadata?.playlist_name}</span>
          </span>
        );
      case 'followed_playlist':
        return (
          <span>
            <span className="font-bold text-white">{name}</span> followed{' '}
            <span className="font-bold text-white italic">{event.metadata?.playlist_name}</span>
          </span>
        );
      case 'liked_comment':
        return (
          <span>
            <span className="font-bold text-white">{name}</span> liked{' '}
            {event.metadata?.liked_user_display_name === name ? 'their own' : `${event.metadata?.liked_user_display_name}'s`}{' '}
            comment on <span className="font-bold text-white italic">{showTitle}</span>
          </span>
        );
      default:
        return <span>{name} interacted with {showTitle}</span>;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'added_show': return <Plus size={14} className="text-blue-500" />;
      case 'status_changed': return <Activity size={14} className="text-green-500" />;
      case 'commented': return <MessageSquare size={14} className="text-purple-500" />;
      case 'rated': return <Star size={14} className="text-yellow-500" />;
      case 'gave_award': return <Trophy size={14} className="text-yellow-500" />;
      case 'created_playlist': return <ListMusic size={14} className="text-blue-400" />;
      case 'followed_playlist': return <Heart size={14} className="text-netflix-red" />;
      case 'liked_comment': return <Heart size={14} className="text-netflix-red" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-netflix-red mb-4" size={32} />
        <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Loading Feed...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="serif-title text-3xl">Activity Feed</h2>
        <button
          onClick={fetchFeed}
          disabled={isRefreshing}
          className="p-2 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loadError ? (
        <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
          <Activity className="mx-auto text-zinc-700 mb-4" size={48} />
          <p className="text-zinc-400 font-medium mb-4">We couldn't load the activity feed.</p>
          <button onClick={fetchFeed} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
          <Activity className="mx-auto text-zinc-700 mb-4" size={48} />
          <p className="text-zinc-400 font-serif italic text-lg mb-2">Nothing here yet</p>
          <p className="text-zinc-600 text-sm">Add some friends to see their activity!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleEventClick(event)}
              className="group bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800 p-4 rounded-xl transition-all cursor-pointer flex gap-4 items-start"
            >
              <div className="relative flex-shrink-0">
                {event.Profiles?.avatar_url ? (
                  <img
                    src={event.Profiles.avatar_url}
                    alt={event.Profiles.display_name}
                    className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold border border-zinc-700 uppercase">
                    {event.Profiles?.display_name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-zinc-800">
                  {getEventIcon(event.event_type)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-400 leading-snug mb-1">
                  {getEventDescription(event)}
                </div>
                
                {event.event_type === 'commented' && event.metadata?.comment && (
                  <div className="bg-black/30 border-l-2 border-zinc-700 px-3 py-1.5 my-2 rounded-r italic text-xs text-zinc-500 line-clamp-2">
                    "{event.metadata.comment}"
                  </div>
                )}

                <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                </div>
              </div>

              {event.Show_data?.poster_url && (
                <div className="flex-shrink-0">
                  <img
                    src={event.Show_data.poster_url}
                    alt={event.Show_data.title}
                    className="w-10 h-14 object-cover rounded border border-zinc-800 shadow-lg group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
