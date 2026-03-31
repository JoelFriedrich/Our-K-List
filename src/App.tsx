import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { UserShow, Show } from './types';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import MyList from './components/MyList';
import Friends from './components/Friends';
import AddShowModal from './components/AddShowModal';
import ShowDetailModal from './components/ShowDetailModal';
import ActorModal from './components/ActorModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import { Toaster } from 'react-hot-toast';
import { Session } from '@supabase/supabase-js';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'my-list' | 'friends'>('my-list');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUserShow, setSelectedUserShow] = useState<UserShow | null>(null);
  const [selectedActorName, setSelectedActorName] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
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
    const { data: userShowData } = await supabase
      .from('User_shows')
      .select('*, show:Show_data(*)')
      .eq('user_id', user.id)
      .eq('show:Show_data.title', title)
      .single();

    if (userShowData) {
      setSelectedUserShow(userShowData);
      setSelectedActorName(null);
    } else {
      // If not in user's list, maybe just search in global catalog
      const { data: showData } = await supabase
        .from('Show_data')
        .select('*')
        .eq('title', title)
        .single();
      
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
          show: showData
        });
        setSelectedActorName(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-netflix-red"></div>
      </div>
    );
  }

  if (!session) {
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
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {currentView === 'my-list' ? (
          <MyList 
            key={`my-list-${refreshTrigger}`}
            onShowClick={handleShowClick}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <Friends 
            onShowClick={handleShowClick}
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
          isFriendView={currentView === 'friends'}
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
