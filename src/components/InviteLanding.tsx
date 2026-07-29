import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import Auth from './Auth';

interface InviteLandingProps {
  code: string;
  onAuthSuccess: () => void;
}

export default function InviteLanding({ code, onAuthSuccess }: InviteLandingProps) {
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInviter = async () => {
      const { data, error } = await supabase
        .from('Invite_links')
        .select('Profiles(display_name)')
        .eq('code', code)
        .single();
      
      if (data && (data as any).Profiles) {
        setInviterName((data as any).Profiles.display_name);
      }
      setIsLoading(false);
    };

    fetchInviter();
  }, [code]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-netflix-red" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <h1 className="serif-title text-5xl text-netflix-red tracking-tighter">OUR K-LIST</h1>
        <div className="space-y-4">
          <p className="text-xl text-zinc-300 font-serif italic">
            {inviterName ? `${inviterName} invited you to join Our K-List` : "Your friend invited you to join Our K-List"}
          </p>
          <p className="text-zinc-500 text-sm">
            Track your favorite K-Dramas, see what your friends are watching, and share awards.
          </p>
        </div>
        
        <div className="bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 shadow-2xl">
          <Auth onAuthSuccess={onAuthSuccess} />
        </div>
      </div>
    </div>
  );
}
