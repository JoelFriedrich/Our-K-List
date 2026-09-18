import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { UserShow } from './types';
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
  const [addShowPrefillTitle, setAddShowPrefillTitle] = useState<string | null>(null);
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

    // Look the title up in the catalog first, then see whether it is already on
    // this user's list. Filtering User_shows by an embedded Show_data column is
    // not something PostgREST supports on its own, so we resolve the show id
    // ourselves.
    const { data: showData, error: showError } = await supabase
      .from('Show_data')
      .select('*')
      .eq('title', title)
      .limit(1)
      .maybeSingle();

    if (showError && !isNotFoundError(showError)) {
      reportError('Show catalog lookup', showError);
      return;
    }

    if (showData) {
      const { data: userShowData, error: userShowError } = await supabase
        .from('User_shows')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_id', showData.id)
        .limit(1)
        .maybeSingle();

      if (userShowError && !isNotFoundError(userShowError)) {
        reportError('Show lookup in user list', userShowError);
        return;
      }

      if (userShowData) {
        // Already rated on your list — go straight to it.
        setSelectedActorName(null);
        setSelectedUserShow({ ...userShowData, show: showData });
        return;
      }
    }

    // Not on your list yet: open the add flow with this show pre-selected.
    setSelectedActorName(null);
    setAddShowPrefillTitle(title);
    setIsAddModalOpen(true);
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
        onAddClick={() => {
          setAddShowPrefillTitle(null);
          setIsAddModalOpen(true);
        }}
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
        prefillTitle={addShowPrefillTitle}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddShowPrefillTitle(null);
        }}
        onSuccess={() => {
          setIsAddModalOpen(false);
          setAddShowPrefillTitle(null);
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
          // Whose row this is decides the view, not which tab you came from:
          // an actor's other show can be your own even when you reached it from
          // a friend's list.
          isFriendView={!!currentUser && selectedUserShow.user_id !== currentUser.id}
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
