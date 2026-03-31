import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, LogOut, Users, Plus, Search, User } from 'lucide-react';
import { Profile } from '../types';
import { toast } from 'react-hot-toast';

interface NavbarProps {
  onAddClick: () => void;
  onViewChange: (view: 'my-list' | 'friends') => void;
  onProfileClick: () => void;
  currentView: 'my-list' | 'friends';
  refreshTrigger: number;
}

export default function Navbar({ onAddClick, onViewChange, onProfileClick, currentView, refreshTrigger }: NavbarProps) {
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('Profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) setProfile(data);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [refreshTrigger]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
  };

  return (
    <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewChange('my-list')}>
              <Heart className="text-netflix-red fill-netflix-red" size={28} />
              <h1 className="serif-title text-xl sm:text-2xl text-white tracking-tighter">
                OUR K-LIST
              </h1>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => onViewChange('my-list')}
                className={`text-sm font-semibold transition-colors ${currentView === 'my-list' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                My List
              </button>
              <button
                onClick={() => onViewChange('friends')}
                className={`text-sm font-semibold transition-colors ${currentView === 'friends' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Friends
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={onAddClick}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
              title="Add Show"
            >
              <Plus size={24} />
              <span className="hidden sm:inline text-sm font-medium">Add Show</span>
            </button>

            <div className="flex items-center gap-4 border-l border-zinc-800 pl-4 sm:pl-6">
              <button 
                onClick={onProfileClick}
                className="flex items-center gap-3 hover:text-white transition-colors group"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-8 h-8 rounded-full object-cover border border-zinc-700 group-hover:border-netflix-red transition-colors"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold border border-zinc-700 uppercase group-hover:border-netflix-red transition-colors">
                    {profile?.display_name?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="hidden lg:inline text-sm font-medium text-zinc-300 group-hover:text-white">
                  {profile?.display_name || 'User'}
                </span>
              </button>

              <button
                onClick={handleLogout}
                className="text-zinc-500 hover:text-netflix-red transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-center gap-8 py-3 border-t border-zinc-900 bg-black">
        <button
          onClick={() => onViewChange('my-list')}
          className={`flex flex-col items-center gap-1 text-[10px] uppercase tracking-widest font-bold ${currentView === 'my-list' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Search size={18} />
          List
        </button>
        <button
          onClick={() => onViewChange('friends')}
          className={`flex flex-col items-center gap-1 text-[10px] uppercase tracking-widest font-bold ${currentView === 'friends' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Users size={18} />
          Friends
        </button>
      </div>
    </nav>
  );
}
