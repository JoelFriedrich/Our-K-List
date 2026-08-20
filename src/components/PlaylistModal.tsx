import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Playlist } from '../types';
import { X, Loader2, Check, Globe, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { insertFeedEvent } from '../lib/feed';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  playlist?: Playlist;
}

export default function PlaylistModal({ isOpen, onClose, onSuccess, playlist }: PlaylistModalProps) {
  const [name, setName] = useState(playlist?.name || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [isPublic, setIsPublic] = useState(playlist?.is_public || false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (playlist) {
      setName(playlist.name);
      setDescription(playlist.description);
      setIsPublic(playlist.is_public);
    } else {
      setName('');
      setDescription('');
      setIsPublic(false);
    }
  }, [playlist, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (playlist) {
        const { error } = await supabase
          .from('Playlists')
          .update({
            name,
            description,
            is_public: isPublic
          })
          .eq('id', playlist.id)
          .eq('user_id', user.id);
        
        if (error) throw error;
        toast.success('Playlist updated!');
      } else {
        const { data, error } = await supabase
          .from('Playlists')
          .insert({
            user_id: user.id,
            name,
            description,
            is_public: isPublic
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Feed event
        insertFeedEvent('created_playlist', '', '', { playlist_name: name });
        
        toast.success('Playlist created!');
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-card-bg rounded-xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="serif-title text-2xl">{playlist ? 'Edit Playlist' : 'New Playlist'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. Best Autumn Watches"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field w-full min-h-[100px] resize-none"
              placeholder="What's this playlist about?"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              {isPublic ? <Globe size={20} className="text-netflix-red" /> : <Lock size={20} className="text-zinc-500" />}
              <div>
                <p className="text-sm font-bold">{isPublic ? 'Public' : 'Private'}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                  {isPublic ? 'Anyone can view this playlist' : 'Only you and friends can view'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`w-12 h-6 rounded-full transition-colors relative ${isPublic ? 'bg-netflix-red' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isPublic ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] font-bold"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> {playlist ? 'Update' : 'Create'} Playlist</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
