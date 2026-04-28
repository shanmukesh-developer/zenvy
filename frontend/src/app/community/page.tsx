"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Magnetic from '@/components/Magnetic';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';



interface PostType {
  id: string;
  parentId: string | null;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  imageUrl: string | null;
  likes: number;
  likedBy: string[];
  replyCount: number;
  createdAt: string;
  replies?: PostType[];
}

export default function CommunityPage() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [draft, setDraft] = useState('');
  const [draftImage, setDraftImage] = useState<string | null>(null);

  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [replyingTo, setReplyingTo] = useState<PostType | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setOnlineCount(Math.floor(Math.random() * 20) + 8);
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    else router.push('/login');

    fetchPosts();
    const interval = setInterval(fetchPosts, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/community`);
      if (res.ok) {
        const data = await res.json();
        // Filter out system error strings that accidentally got posted to the feed
        const ERROR_PATTERNS = [
          /^INVALID\s/i, /^PAYMENT\s/i, /^ERROR:/i, /^FAILED:/i,
          /^DB\s/i, /^SQL/i, /^SEQUELIZE/i, /SequelizeValidation/i,
          /^TypeError/i, /^ReferenceError/i, /^UnhandledPromise/i
        ];
        const cleanPosts = data.filter((p: PostType) => {
          if (!p.content) return true; // image-only posts are fine
          return !ERROR_PATTERNS.some(rx => rx.test(p.content.trim()));
        });
        setPosts(cleanPosts);
      }
    } catch (e) { console.error('Fetch error:', e); }
    finally { setIsLoading(false); }
  };

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      setDraftImage(data.imageUrl);
    } catch (e) { console.error('Image upload error:', e); }
    finally { setIsUploading(false); }
  };

  const handlePost = async () => {
    if (!draft.trim() && !draftImage) return;
    setIsPosting(true);
    try {
      const token = localStorage.getItem('token');
      const body: Record<string, string> = { content: draft };
      if (draftImage) body.imageUrl = draftImage;
      if (replyingTo) body.parentId = replyingTo.id;

      const res = await fetch(`${API_URL}/api/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const newPost = await res.json();
        if (replyingTo) {
          // Insert into the correct thread
          setPosts(prev => prev.map(p => {
            if (p.id === replyingTo.id) {
              return { ...p, replyCount: (p.replyCount || 0) + 1, replies: [...(p.replies || []), newPost] };
            }
            return p;
          }));
          // Auto-expand the thread
          setExpandedThreads(prev => new Set([...prev, replyingTo.id]));
        } else {
          setPosts(prev => [{ ...newPost, replies: [] }, ...prev]);
        }
        setDraft('');
        setDraftImage(null);
        setReplyingTo(null);
        setShowComposer(false);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (error) { console.error('Post error:', error); }
    finally { setIsPosting(false); }
  };

  const handleLike = async (id: string, currentLikedBy: string[]) => {
    if (!user) return;
    const isLiked = currentLikedBy.includes(user.id);
    const updateLike = (p: PostType): PostType => {
      if (p.id === id) {
        return { ...p, likes: isLiked ? Math.max(0, p.likes - 1) : p.likes + 1, likedBy: isLiked ? p.likedBy.filter(u => u !== user.id) : [...p.likedBy, user.id] };
      }
      if (p.replies) {
        return { ...p, replies: p.replies.map(updateLike) };
      }
      return p;
    };
    setPosts(prev => prev.map(updateLike));

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/community/${id}/like`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (e) { console.error('Like error:', e); }
  };

  const toggleThread = (postId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const openReply = (post: PostType) => {
    setReplyingTo(post);
    setDraft('');
    setDraftImage(null);
    setShowComposer(true);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };


  /* ═══════════════════════════════════════════════════════════ */
  /*  RENDER A SINGLE POST CARD (reused for root and replies)   */
  /* ═══════════════════════════════════════════════════════════ */
  const renderPost = (post: PostType, isReply = false, depth = 0) => {
    const isLiked = user && (post.likedBy || []).includes(user.id);
    const hasReplies = (post.replies && post.replies.length > 0) || (post.replyCount > 0);
    const isExpanded = expandedThreads.has(post.id);

    return (
      <div key={post.id} className={`relative ${isReply ? '' : 'animate-in fade-in slide-in-from-bottom-4'}`}
        style={!isReply ? { animationDelay: '0.05s', animationFillMode: 'both' } : {}}
      >
        {/* Thread connector line */}
        {isReply && (
          <div className="absolute left-[21px] -top-4 w-[2px] h-4 bg-gradient-to-b from-transparent to-white/10" />
        )}

        <div className={`group relative rounded-[24px] p-4 transition-all duration-300 
          ${isReply 
            ? 'bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] ml-6' 
            : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'}`}
        >
          {/* Hover glow */}
          {!isReply && <div className="absolute inset-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-[#38BDF8]/[0.03] via-transparent to-[#C9A84C]/[0.03] pointer-events-none" />}

          <div className="relative z-10">
            {/* Author */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className={`${isReply ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl'} bg-gradient-to-br from-[#38BDF8]/20 to-[#0EA5E9]/20 border border-[#38BDF8]/20 flex items-center justify-center overflow-hidden shadow-[0_0_12px_rgba(56,189,248,0.08)]`}>
                    {post.userAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.userAvatar} alt={post.userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className={`${isReply ? 'text-xs' : 'text-base'} font-black bg-gradient-to-br from-[#38BDF8] to-[#0EA5E9] bg-clip-text text-transparent`}>
                        {(post.userName || 'A').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {!isReply && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#060608] rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /></div>}
                </div>
                <div>
                  <h4 className={`${isReply ? 'text-[11px]' : 'text-[13px]'} font-black text-white group-hover:text-[#38BDF8] transition-colors tracking-tight`}>{post.userName}</h4>
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{formatTime(post.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className={`${isReply ? 'pl-[46px]' : 'pl-[54px]'}`}>
              {post.content && (
                <p className={`${isReply ? 'text-[13px]' : 'text-[15px]'} text-gray-200 leading-[1.7] mb-3 font-medium`}>
                  {post.content}
                </p>
              )}

              {/* Image Attachment */}
              {post.imageUrl && (
                <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 max-w-[340px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={post.imageUrl} 
                    alt="Shared image" 
                    className="w-full h-auto max-h-[300px] object-cover rounded-2xl"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                {/* Like */}
                <button
                  onClick={() => handleLike(post.id, post.likedBy || [])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all active:scale-90 text-[10px] font-black ${
                    isLiked
                      ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/20'
                      : 'bg-white/[0.03] text-white/25 border border-white/5 hover:bg-white/5 hover:text-white/50'
                  }`}
                >
                  <svg className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#C9A84C]' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {post.likes || 0}
                </button>

                {/* Reply Button */}
                <button
                  onClick={() => openReply(isReply && post.parentId ? posts.find(p => p.id === post.parentId) || post : post)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-white/25 hover:bg-white/5 hover:text-white/50 transition-all active:scale-90 text-[10px] font-black"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Reply
                </button>

                {/* Thread expand (root posts only) */}
                {!isReply && hasReplies && (
                  <button
                    onClick={() => toggleThread(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black transition-all active:scale-90 ${
                      isExpanded
                        ? 'bg-[#38BDF8]/10 border-[#38BDF8]/20 text-[#38BDF8]'
                        : 'bg-white/[0.03] border-white/5 text-white/30 hover:text-white/50'
                    }`}
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    {post.replyCount || (post.replies?.length || 0)} {(post.replyCount || post.replies?.length || 0) === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── NESTED REPLIES (Thread) ── */}
        {!isReply && isExpanded && post.replies && post.replies.length > 0 && (
          <div className="relative mt-2 space-y-2">
            {/* Continuous thread line */}
            <div className="absolute left-[21px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#38BDF8]/20 via-white/10 to-transparent" />
            {post.replies.map(reply => renderPost(reply, true, depth + 1))}
          </div>
        )}
      </div>
    );
  };


  /* ═══════════════════════════════════════════════ */
  /*  MAIN RENDER                                    */
  /* ═══════════════════════════════════════════════ */
  return (
    <main className="min-h-screen bg-[#060608] text-white relative overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(201,168,76,0.06)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(167,139,250,0.04)_0%,transparent_50%)]" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#38BDF8]/[0.03] blur-[100px] top-[10%] left-[20%] animate-pulse" />
        <div className="absolute w-[200px] h-[200px] rounded-full bg-[#C9A84C]/[0.04] blur-[80px] top-[60%] right-[10%] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.3) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <Magnetic>
            <Link href="/" className="w-11 h-11 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all active:scale-90">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </Link>
          </Magnetic>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl">
            <div className="relative flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <div className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">{onlineCount} Live</span>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#38BDF8] to-[#0EA5E9] flex items-center justify-center shadow-[0_0_30px_rgba(56,189,248,0.3)]">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-[#38BDF8] via-[#7dd3fc] to-[#38BDF8] bg-clip-text text-transparent">Nexus Comms</h1>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">Threaded Discussions • Campus Hub</p>
            </div>
          </div>
        </div>

      </div>



      {/* ═══════ FEED ═══════ */}
      <div className="relative z-10 px-5 space-y-4 pb-40">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-[#38BDF8]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#38BDF8] animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-[#C9A84C] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#38BDF8]/60 animate-pulse">Decrypting Streams...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center"><span className="text-5xl">📻</span></div>
            <p className="text-base font-black uppercase tracking-widest text-white/20 mb-2">Dead Air</p>
            <p className="text-[10px] font-bold tracking-widest text-white/10">Be the first operative to break the silence.</p>
          </div>
        ) : (
          posts.map(post => renderPost(post))
        )}
      </div>

      {/* ═══════ FLOATING COMPOSE FAB ═══════ */}
      {!showComposer && (
        <button onClick={() => { setReplyingTo(null); setShowComposer(true); }}
          className="fixed bottom-[88px] right-5 z-[90] w-14 h-14 bg-gradient-to-br from-[#38BDF8] to-[#0EA5E9] rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgba(56,189,248,0.4)] hover:shadow-[0_8px_40px_rgba(56,189,248,0.6)] transition-all active:scale-90 hover:scale-105"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
        </button>
      )}

      {/* ═══════ COMPOSER MODAL (Bottom Sheet) ═══════ */}
      {showComposer && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowComposer(false); setReplyingTo(null); }} />

          <div className="relative bg-[#111113] border-t border-white/10 rounded-t-[32px] p-6 pb-8 animate-in slide-in-from-bottom-8 duration-300 max-h-[80vh] overflow-y-auto">
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />

            {/* Reply banner */}
            {replyingTo && (
              <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-[#38BDF8]/10 border border-[#38BDF8]/20 rounded-2xl">
                <svg className="w-4 h-4 text-[#38BDF8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#38BDF8]">Replying to {replyingTo.userName}</p>
                  <p className="text-[11px] text-white/40 truncate">{replyingTo.content}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-white/30 hover:text-white p-1">✕</button>
              </div>
            )}

            {/* Author preview */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#38BDF8]/20 to-[#0EA5E9]/20 border border-[#38BDF8]/20 flex items-center justify-center">
                <span className="text-sm font-black bg-gradient-to-br from-[#38BDF8] to-[#0EA5E9] bg-clip-text text-transparent">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-black text-white">{user?.name || 'Anonymous'}</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-[#38BDF8]/40">
                  {replyingTo ? 'Thread Reply' : 'Broadcasting to all nodes'}
                </p>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value.slice(0, 500))}
              placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : "What's happening on campus? Share a review, drop a pic..."}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-4 text-sm placeholder:text-white/15 outline-none focus:border-[#38BDF8]/30 transition-all resize-none"
              rows={3}
              autoFocus
            />

            {/* Image preview */}
            {draftImage && (
              <div className="relative mt-3 rounded-2xl overflow-hidden border border-white/10 max-w-[200px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draftImage} alt="Attachment" className="w-full h-auto max-h-[160px] object-cover" />
                <button onClick={() => setDraftImage(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/70 backdrop-blur rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500/80 transition-all">✕</button>
              </div>
            )}

            {/* Bottom actions */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                {/* Image upload */}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                />
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                >
                  {isUploading ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-[#38BDF8] animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  Photo
                </button>
                <span className={`text-[10px] font-black tracking-widest ${draft.length > 450 ? 'text-red-400' : 'text-white/15'}`}>{draft.length}/500</span>
              </div>

              <button onClick={handlePost} disabled={(!draft.trim() && !draftImage) || isPosting}
                className="bg-gradient-to-r from-[#38BDF8] to-[#0EA5E9] text-white px-7 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 shadow-[0_4px_20px_rgba(56,189,248,0.3)]"
              >
                {isPosting ? (
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />Sending</div>
                ) : (
                  <span className="flex items-center gap-2">
                    {replyingTo ? 'Reply' : 'Transmit'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <footer className="fixed bottom-0 left-0 right-0 h-16 bg-[#060608]/90 backdrop-blur-3xl border-t border-white/5 flex items-center justify-around sm:hidden z-[100] pb-safe">
        <Magnetic><Link href="/" className="flex flex-col items-center gap-1.5 opacity-40"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg><span className="text-[9px] font-black uppercase tracking-widest">Home</span></Link></Magnetic>
        <Magnetic><Link href="/orders" className="flex flex-col items-center gap-1.5 opacity-40"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg><span className="text-[9px] font-bold">Orders</span></Link></Magnetic>
        <Magnetic><Link href="/basket" className="flex flex-col items-center gap-1.5 opacity-40"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg><span className="text-[9px] font-bold">Basket</span></Link></Magnetic>
        <Magnetic><Link href="/community" className="flex flex-col items-center gap-1.5"><div className="relative"><svg className="w-5 h-5 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg><div className="absolute -top-1 -right-1.5 w-2 h-2 bg-[#38BDF8] rounded-full animate-pulse" /></div><span className="text-[9px] font-black text-[#38BDF8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">Comms</span></Link></Magnetic>
        <Magnetic><Link href="/profile" className="flex flex-col items-center gap-1.5 opacity-40"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><span className="text-[9px] font-bold">Profile</span></Link></Magnetic>
      </footer>
    </main>
  );
}
