import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { UserShow, Show } from './types';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import MyList from './components/MyList';
import Friends from './components/Friends';
import Feed from './components/Feed';
import Playlists from './components/Playlists';
import PlaylistDetail from './components/PlaylistDetail';
import InviteLanding from './components/InviteLanding';
import AddShowModal from './components/AddShowModal';
import ShowDetailModal from './components/ShowDetailModal';
import ActorModal from './components/ActorModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import { Toaster, toast } from 'react-hot-toast';
import { Session } from '@supabase/supabase-js';
import { isNotFoundError, logError, reportError } from './lib/errors';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Session['user'] | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentView, setCurrentView] = useState<'my-list' | 'friends' | 'feed' | 'playlists' | 'playlist' | 'invite'>('my-list');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUserShow, setSelectedUserShow] = useState<UserShow | null>(null);
  const [selectedActorName, setSelectedActorName] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    // Basic routing
    const path = window.location.pathname;
    if (path.startsWith('/invite/')) {
      const code = path.split('/invite/')[1];
      setInviteCode(code);
      setCurrentView('invite');
    } else if (path.startsWith('/playlist/')) {
      const id = path.split('/playlist/')[1];
      setPlaylistId(id);
      setCurrentView('playlist');
    }

    // Get initial session - critical for OAuth redirect users
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCurrentUser(session?.user ?? null);
      setAuthReady(true);
      if (session?.user) {
        fetchPendingCount(session.user.id);
        if (inviteCode) handleInvite(inviteCode, session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setCurrentUser(session?.user ?? null);
      setAuthReady(true);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          fetchPendingCount(session.user.id);
          if (inviteCode) handleInvite(inviteCode, session.user.id);
        }
      }
      if (event === 'SIGNED_OUT') {
        setPendingRequestsCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [inviteCode]);

  const handleInvite = async (code: string, userId: string) => {
    try {
      const { data: inviteLink, error: inviteError } = await supabase
        .from('Invite_links')
        .select('user_id, uses')
        .eq('code', code)
        .single();

      if (inviteError) {
        if (isNotFoundError(inviteError)) {
          toast.error('This invite link was not found or has expired.');
        } else {
          reportError('Invite link lookup', inviteError);
        }
        return;
      }

      if (inviteLink && inviteLink.user_id !== userId) {
        // 1. Create accepted friend request
        const { data: existingFriendship, error: friendshipLookupError } = await supabase
          .from('Friendships')
          .select('*')
          .or(`and(user_id.eq.${inviteLink.user_id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${inviteLink.user_id})`)
          .maybeSingle();

        if (friendshipLookupError) throw friendshipLookupError;

        if (!existingFriendship) {
          const { error: friendshipError } = await supabase.from('Friendships').insert({
            user_id: inviteLink.user_id,
            friend_id: userId,
            status: 'accepted'
          });
          if (friendshipError) throw friendshipError;
          toast.success('Friend added via invite link!');
        }

        // 2. Increment uses
        const { error: usesError } = await supabase
          .from('Invite_links')
          .update({ uses: inviteLink.uses + 1 })
          .eq('code', code);
        if (usesError) {
          reportError('Invite link usage update', usesError, 'Friend added, but the invite usage count could not be updated.');
        }
      }
    } catch (err) {
      reportError('Invite handling', err);
    } finally {
      // Always leave the invite route, even if processing failed.
      setInviteCode(null);
      setCurrentView('feed');
      window.history.pushState({}, '', '/');
    }
  };

  const fetchPendingCount = async (userId: string) => {
    const { count, error } = await supabase
      .from('Friendships')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) {
      logError('Pending friend request count', error);
      return;
    }
    setPendingRequestsCount(count || 0);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    if (session?.user) fetchPendingCount(session.user.id);
  };

  const handleShowClick = (userShow: UserShow) => {
    setSelectedUserShow(userShow);
  };

  const handleActorClick = (actorName: string) => {
    setSelectedActorName(actorName);
  };

  const handleShowByTitle = async (title: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Try to find in user's list
    const { data: userShowData, error: userShowError } = await supabase
      .from('User_shows')
      .select('*, show:Show_data(*)')
      .eq('user_id', user.id)
      .eq('show:Show_data.title', title)
      .single();

    if (userShowError && !isNotFoundError(userShowError)) {
      reportError('Show lookup in user list', userShowError);
      return;
    }

    if (userShowData) {
      setSelectedUserShow(userShowData);
      setSelectedActorName(null);
    } else {
      // If not in user's list, maybe just search in global catalog
      const { data: showData, error: showError } = await supabase
        .from('Show_data')
        .select('*')
        .eq('title', title)
        .single();

      if (showError) {
        if (isNotFoundError(showError)) {
          toast.error(`"${title}" isn't available in the catalog.`);
        } else {
          reportError('Show catalog lookup', showError);
        }
        return;
      }

      if (showData) {
        // Create a mock UserShow for read-only view
        setSelectedUserShow({
          id: '',
          user_id: '',
          show_id: showData.id,
          user_rating: 0,
          comments: 'Not in your list',
          status: 'want_to_watch',
          added_at: '',
          is_spoiler: false,
          show: showData
        });
        setSelectedActorName(null);
      }
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-netflix-red"></div>
      </div>
    );
  }

  // Public playlist view
  if (!session && currentView === 'playlist' && playlistId) {
    return (
      <div className="min-h-screen bg-dark-bg text-white">
        <PlaylistDetail playlistId={playlistId} onShowClick={handleShowClick} isPublicView />
        <Toaster position="bottom-center" />
      </div>
    );
  }

  if (!session) {
    if (currentView === 'invite' && inviteCode) {
      return (
        <>
          <Toaster position="bottom-center" />
          <InviteLanding code={inviteCode} onAuthSuccess={handleRefresh} />
        </>
      );
    }
    return (
      <>
        <Toaster position="bottom-center" />
        <Auth />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white pb-20">
      <Toaster position="bottom-center" toastOptions={{
        style: {
          background: '#141414',
          color: '#fff',
          border: '1px solid #333',
        }
      }} />

      <Navbar 
        onAddClick={() => setIsAddModalOpen(true)} 
        onViewChange={setCurrentView}
        onProfileClick={() => setIsProfileModalOpen(true)}
        currentView={currentView}
        refreshTrigger={refreshTrigger}
        pendingRequestsCount={pendingRequestsCount}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {currentView === 'my-list' ? (
          <MyList 
            key={`my-list-${refreshTrigger}`}
            onShowClick={handleShowClick}
            refreshTrigger={refreshTrigger}
          />
        ) : currentView === 'friends' ? (
          <Friends 
            onShowClick={handleShowClick}
            onFriendshipUpdate={handleRefresh}
            refreshTrigger={refreshTrigger}
          />
        ) : currentView === 'playlists' ? (
          <Playlists 
            onPlaylistClick={(id) => {
              setPlaylistId(id);
              setCurrentView('playlist');
            }}
            refreshTrigger={refreshTrigger}
          />
        ) : currentView === 'playlist' && playlistId ? (
          <PlaylistDetail 
            playlistId={playlistId} 
            onShowClick={handleShowClick}
            onBack={() => setCurrentView('playlists')}
          />
        ) : (
          <Feed 
            onShowClick={handleShowClick}
            refreshTrigger={refreshTrigger}
          />
        )}
      </main>

      {/* Modals */}
      <AddShowModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          handleRefresh();
        }}
      />

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdate={handleRefresh}
      />

      {selectedUserShow && (
        <ShowDetailModal
          userShow={selectedUserShow}
          onClose={() => setSelectedUserShow(null)}
          onUpdate={handleRefresh}
          onActorClick={handleActorClick}
          isFriendView={currentView === 'friends' || (currentView === 'playlist' && selectedUserShow.user_id !== currentUser?.id)}
        />
      )}

      {selectedActorName && (
        <ActorModal
          actorName={selectedActorName}
          onClose={() => setSelectedActorName(null)}
          onShowClick={handleShowByTitle}
        />
      )}
      
      {/* Footer */}
      <footer className="mt-20 border-t border-zinc-900 py-12 text-center">
        <h2 className="serif-title text-2xl text-zinc-800 mb-4 opacity-50">OUR K-LIST</h2>
        <p className="text-zinc-600 text-sm">© 2026 FRIEDRICH</p>
      </footer>
    </div>
  );
}
