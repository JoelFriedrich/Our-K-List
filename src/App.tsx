import { useState, useEffect } from 'react';
import { LayoutGrid, List, Plus, Heart, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Show } from './types';
import ShowCard from './components/ShowCard';
import ShowList from './components/ShowList';
import ShowDetail from './components/ShowDetail';
import AddShowModal from './components/AddShowModal';
import ActorModal from './components/ActorModal';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

type ViewMode = 'grid' | 'list';

export default function App() {
  const [shows, setShows] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedActorName, setSelectedActorName] = useState<string | null>(null);

  const fetchShows = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.error('Supabase configuration missing! Please check your environment variables.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('Fetching shows from Supabase...');
      const { data, error } = await supabase
        .from('Show_data')
        .select('*')
        .order('friedrich_rating', { ascending: false });
      
      if (error) {
        console.error('Supabase Error:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        throw error;
      }
      
      console.log('Fetched shows successfully:', data);
      setShows(data || []);
    } catch (error) {
      console.error('Error fetching shows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  const handleShowClick = (show: Show) => {
    setSelectedShow(show);
  };

  const handleActorClick = (actorName: string) => {
    setSelectedActorName(actorName);
  };

  const handleShowByTitle = (title: string) => {
    const show = shows.find(s => s.title === title);
    if (show) {
      setSelectedShow(show);
      setSelectedActorName(null);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white pb-20">
      <Toaster position="bottom-center" toastOptions={{
        style: {
          background: '#111',
          color: '#fff',
          border: '2px solid #ff0000',
          fontFamily: '"Press Start 2P", cursive',
          fontSize: '10px'
        }
      }} />

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b-4 border-netflix-red">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <Heart className="text-netflix-red fill-netflix-red" size={32} />
              <h1 className="font-game text-lg sm:text-xl text-white tracking-tighter">
                OUR K-LIST <span className="text-netflix-red">v1.0</span>
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-zinc-900 p-1 border-2 border-zinc-800">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-all ${viewMode === 'grid' ? 'bg-netflix-red text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <LayoutGrid size={20} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-all ${viewMode === 'list' ? 'bg-netflix-red text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <List size={20} />
                </button>
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="pixel-button"
              >
                <Plus size={16} className="inline mr-1" />
                ADD SHOW
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section (Only in Grid View) */}
      {viewMode === 'grid' && shows.length > 0 && !isLoading && (
        <div className="relative h-[50vh] w-full mb-12 overflow-hidden border-b-4 border-zinc-900">
          <div className="absolute inset-0">
            <img
              src={shows[0].poster_url}
              alt="Hero"
              className="w-full h-full object-cover opacity-20"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          </div>
          
          <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-center items-start">
            <div className="bg-netflix-red text-white px-2 py-1 font-game text-[10px] mb-4">
              TOP RATED
            </div>
            <h2 className="retro-title text-3xl md:text-5xl mb-4 max-w-2xl leading-tight">
              {shows[0].title}
            </h2>
            <p className="text-zinc-400 max-w-xl text-lg mb-8 line-clamp-2 font-mono">
              {shows[0].summary}
            </p>
            <button
              onClick={() => handleShowClick(shows[0])}
              className="pixel-button !bg-white !text-black !shadow-[inset_-4px_-4px_0px_0px_#ccc]"
            >
              VIEW DETAILS
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-netflix-red" size={48} />
            <p className="font-game text-[10px] text-zinc-500">LOADING...</p>
          </div>
        ) : shows.length === 0 ? (
          <div className="text-center py-20 border-4 border-zinc-900 bg-zinc-950">
            <h3 className="font-game text-xl text-zinc-600 mb-4">NO SHOWS FOUND</h3>
            <p className="font-mono text-zinc-500 mb-8">ADD YOUR FIRST SHOW TO START</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="pixel-button"
            >
              ADD SHOW
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8"
              >
                {shows.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    onClick={() => handleShowClick(show)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ShowList
                  shows={shows}
                  onShowClick={handleShowClick}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Modals */}
      <AddShowModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchShows}
      />

      {selectedShow && (
        <ShowDetail
          show={selectedShow}
          onClose={() => setSelectedShow(null)}
          onUpdate={fetchShows}
          onActorClick={handleActorClick}
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
      <footer className="mt-20 border-t-4 border-zinc-900 py-12 text-center">
        <div className="font-game text-zinc-800 text-2xl mb-4 opacity-50">GAME OVER</div>
        <p className="font-mono text-zinc-600">© 2026 FRIEDRICH</p>
      </footer>
    </div>
  );
}
