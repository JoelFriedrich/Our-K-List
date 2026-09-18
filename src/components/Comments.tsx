import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Comment } from '../types';
import {
  MessageSquare, Send, Heart, Reply, Trash2,
  Loader2, Eye, EyeOff, ChevronDown, ChevronUp, X, Pencil, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { insertFeedEvent } from '../lib/feed';
import { logError, reportError } from '../lib/errors';

interface CommentsProps {
  userShowId: string;
  showId: string;
  ownerId: string;
  /** Called whenever the owner's review comment changes, so lists can refresh. */
  onReviewChange?: () => void;
}

/** The owner's review opens the thread, then everything else in posting order. */
const sortComments = (list: Comment[]) =>
  [...list].sort((a, b) => {
    if (a.is_review !== b.is_review) return a.is_review ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

export default function Comments({ userShowId, showId, ownerId, onReviewChange }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [likesLoadError, setLikesLoadError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editIsSpoiler, setEditIsSpoiler] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isOwner = currentUserId === ownerId;
  const review = comments.find(c => c.is_review) || null;
  const ownsReview = isOwner && !!review;

  const fetchComments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    try {
      const { data, error } = await supabase
        .from('Comments')
        .select(`
          *,
          Profiles!comments_user_id_profiles_fkey(*)
        `)
        .eq('user_show_id', userShowId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch likes for current user
      if (user) {
        const { data: likes, error: likesError } = await supabase
          .from('Comment_likes')
          .select('comment_id')
          .eq('user_id', user.id);
        if (likesError) {
          setLikesLoadError(true);
          logError('Comment likes fetch', likesError);
        }

        const likedIds = new Set(likes?.map(l => l.comment_id));

        const processedComments = data?.map(c => ({
          ...c,
          is_liked: likedIds.has(c.id)
        })) || [];
        setComments(sortComments(processedComments));
      } else {
        setComments(sortComments(data || []));
      }
    } catch (error) {
      reportError('Comments fetch', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [userShowId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('Comments')
        .insert({
          user_id: currentUserId,
          user_show_id: userShowId,
          show_id: showId,
          parent_id: replyTo?.id || null,
          body: newComment.trim(),
          is_spoiler: isSpoiler
        })
        .select(`
          *,
          Profiles!comments_user_id_profiles_fkey(*)
        `)
        .single();

      if (error) throw error;

      setComments(sortComments([...comments, { ...data, is_liked: false }]));
      setNewComment('');
      setIsSpoiler(false);
      setReplyTo(null);
      if (data.is_review) onReviewChange?.();

      // Feed event
      if (!replyTo) {
        const feedResult = await insertFeedEvent('commented', showId, userShowId, {
          comment: newComment.trim(),
          is_spoiler: isSpoiler
        });
        if (!feedResult.ok) toast.error('Comment posted, but the activity was not posted to the feed.');
      }

      toast.success(data.is_review ? 'Review posted!' : replyTo ? 'Reply posted!' : 'Comment posted!');
    } catch (error) {
      reportError('Comment submission', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
    setEditIsSpoiler(comment.is_spoiler);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditBody('');
    setEditIsSpoiler(false);
  };

  const handleSaveEdit = async (comment: Comment) => {
    if (!editBody.trim()) return;

    setIsSavingEdit(true);
    try {
      const { data, error } = await supabase
        .from('Comments')
        .update({
          body: editBody.trim(),
          is_spoiler: editIsSpoiler,
          updated_at: new Date().toISOString()
        })
        .eq('id', comment.id)
        .select(`
          *,
          Profiles!comments_user_id_profiles_fkey(*)
        `)
        .single();

      if (error) throw error;

      setComments(sortComments(comments.map(c =>
        c.id === comment.id ? { ...data, is_liked: c.is_liked } : c
      )));
      if (comment.is_review) onReviewChange?.();
      cancelEditing();
      toast.success(comment.is_review ? 'Review updated' : 'Comment updated');
    } catch (error) {
      reportError('Comment update', error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleLike = async (comment: Comment) => {
    if (!currentUserId) return;

    try {
      if (comment.is_liked) {
        const { error } = await supabase
          .from('Comment_likes')
          .delete()
          .eq('comment_id', comment.id)
          .eq('user_id', currentUserId);
        if (error) throw error;

        setComments(comments.map(c =>
          c.id === comment.id
            ? { ...c, is_liked: false, likes_count: Math.max((c.likes_count || 1) - 1, 0) }
            : c
        ));
      } else {
        const { error } = await supabase
          .from('Comment_likes')
          .insert({
            comment_id: comment.id,
            user_show_id: userShowId,
            user_id: currentUserId
          });
        if (error) throw error;

        setComments(comments.map(c =>
          c.id === comment.id
            ? { ...c, is_liked: true, likes_count: (c.likes_count || 0) + 1 }
            : c
        ));

        const feedResult = await insertFeedEvent('liked_comment', showId, userShowId, {
          liked_user_display_name: comment.Profiles?.display_name || 'Friend'
        });
        if (!feedResult.ok) toast.error('Like saved, but the activity was not posted to the feed.');
      }
    } catch (error) {
      reportError('Comment like update', error);
    }
  };

  const handleDelete = async (comment: Comment) => {
    const prompt = comment.is_review
      ? 'Delete your review? Replies to it will be removed too.'
      : 'Delete this comment?';
    if (!window.confirm(prompt)) return;
    try {
      const { error } = await supabase
        .from('Comments')
        .delete()
        .eq('id', comment.id);
      if (error) throw error;

      // Replies cascade in the database — drop them locally too.
      const removed = new Set<string>([comment.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of comments) {
          if (!removed.has(c.id) && c.parent_id && removed.has(c.parent_id)) {
            removed.add(c.id);
            grew = true;
          }
        }
      }

      setComments(comments.filter(c => !removed.has(c.id)));
      if (comment.is_review) onReviewChange?.();
      toast.success(comment.is_review ? 'Review deleted' : 'Comment deleted');
    } catch (error) {
      reportError('Comment deletion', error);
    }
  };

  const toggleThread = (id: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedThreads(newExpanded);
  };

  const toggleSpoiler = (id: string) => {
    const newRevealed = new Set(revealedSpoilers);
    if (newRevealed.has(id)) newRevealed.delete(id);
    else newRevealed.add(id);
    setRevealedSpoilers(newRevealed);
  };

  const renderComment = (comment: Comment, depth = 0) => {
    const replies = comments.filter(c => c.parent_id === comment.id);
    const isExpanded = expandedThreads.has(comment.id);
    const isRevealed = revealedSpoilers.has(comment.id);
    const isEditing = editingId === comment.id;
    const canEdit = comment.user_id === currentUserId;
    const canDelete = canEdit || isOwner;

    return (
      <div key={comment.id} className={`space-y-4 ${depth > 0 ? 'ml-8 border-l border-zinc-800 pl-4' : ''}`}>
        <div className={`group ${comment.is_review ? 'bg-zinc-900/40 border border-zinc-800 rounded-xl p-4' : ''}`}>
          <div className="flex items-start gap-3">
            {comment.Profiles?.avatar_url ? (
              <img
                src={comment.Profiles.avatar_url}
                alt={comment.Profiles.display_name}
                className="w-8 h-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                {comment.Profiles?.display_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold text-white">{comment.Profiles?.display_name}</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
                {comment.is_review && (
                  <span className="text-[8px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase font-bold">Review</span>
                )}
                {comment.user_id === ownerId && (
                  <span className="text-[8px] bg-netflix-red/10 text-netflix-red border border-netflix-red/20 px-1.5 py-0.5 rounded uppercase font-bold">Owner</span>
                )}
                {comment.updated_at && comment.updated_at !== comment.created_at && (
                  <span className="text-[9px] text-zinc-700 uppercase tracking-widest italic">Edited</span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="input-field w-full min-h-[80px] resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setEditIsSpoiler(!editIsSpoiler)}
                      className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        editIsSpoiler ? 'text-netflix-red' : 'text-zinc-500 hover:text-zinc-400'
                      }`}
                    >
                      {editIsSpoiler ? <EyeOff size={12} /> : <Eye size={12} />}
                      {editIsSpoiler ? 'Spoiler On' : 'Mark as Spoiler'}
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(comment)}
                        disabled={isSavingEdit || !editBody.trim()}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-500 hover:text-green-400 transition-colors disabled:opacity-50"
                      >
                        {isSavingEdit ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {comment.is_spoiler && !isRevealed ? (
                    <button
                      onClick={() => toggleSpoiler(comment.id)}
                      className="w-full text-left bg-zinc-900/50 border border-zinc-800 rounded px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-2"
                    >
                      <EyeOff size={12} />
                      Spoiler Content • Click to reveal
                    </button>
                  ) : (
                    <p className={`leading-relaxed break-words whitespace-pre-wrap ${
                      comment.is_review ? 'text-zinc-200 italic font-serif text-base' : 'text-sm text-zinc-300'
                    }`}>
                      {comment.body}
                    </p>
                  )}
                </div>
              )}

              {!isEditing && (
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={() => handleToggleLike(comment)}
                    className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      comment.is_liked ? 'text-netflix-red' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    <Heart size={12} className={comment.is_liked ? 'fill-netflix-red' : ''} />
                    {comment.likes_count || 0}
                  </button>
                  <button
                    onClick={() => {
                      setReplyTo(comment);
                      document.getElementById('comment-input')?.focus();
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <Reply size={12} />
                    Reply
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => startEditing(comment)}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(comment)}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {replies.length > 0 && (
          <div className="space-y-4">
            <button
              onClick={() => toggleThread(comment.id)}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors ml-8"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {isExpanded ? 'Hide Replies' : `Show ${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}`}
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {replies.map(reply => renderComment(reply, depth + 1))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const topLevelComments = comments.filter(c => !c.parent_id);

  const composerPlaceholder = replyTo
    ? 'Write a reply...'
    : isOwner && !ownsReview
      ? 'What did you think of this show? Your first comment becomes your review.'
      : 'Add to the discussion...';

  return (
    <div className="space-y-8">
      {likesLoadError && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-200">
          Comments loaded, but likes are temporarily unavailable.
        </div>
      )}
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-500">
        <MessageSquare size={18} />
        Discussion ({comments.length})
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {replyTo && (
          <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded border border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
              Replying to <span className="text-netflix-red font-bold">{replyTo.Profiles?.display_name}</span>
            </p>
            <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-600 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}
        {isOwner && !ownsReview && !replyTo && (
          <p className="text-[10px] text-yellow-500/80 uppercase tracking-widest font-bold">
            Your review starts the discussion
          </p>
        )}
        <div className="relative">
          <textarea
            id="comment-input"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="input-field w-full min-h-[80px] resize-none pr-16"
            placeholder={composerPlaceholder}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="absolute right-3 bottom-3 p-2 bg-netflix-red text-white rounded-lg hover:bg-netflix-red/80 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsSpoiler(!isSpoiler)}
            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              isSpoiler ? 'text-netflix-red' : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            {isSpoiler ? <EyeOff size={14} /> : <Eye size={14} />}
            {isSpoiler ? 'Spoiler On' : 'Mark as Spoiler'}
          </button>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest italic">
            Be kind and respectful in the comments.
          </p>
        </div>
      </form>

      <div className="space-y-8">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-zinc-800" size={32} />
          </div>
        ) : topLevelComments.length > 0 ? (
          topLevelComments.map(comment => renderComment(comment))
        ) : (
          <div className="text-center py-12 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800">
            <p className="text-zinc-600 text-sm italic">No discussion yet. Start the conversation!</p>
          </div>
        )}
      </div>
    </div>
  );
}
