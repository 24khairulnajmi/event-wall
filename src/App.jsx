import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc,
  updateDoc,
  increment,
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Plus, 
  QrCode, 
  Presentation, 
  Sparkles, 
  MessageSquare, 
  X, 
  Upload,
  Trash2,
  Activity,
  Heart,
  MessageCircle,
  Flame,
  TrendingUp,
  Clock,
  Smile,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

const firebaseConfig = {
  apiKey: "AIzaSyAZ324ExJ0jTv5xAdLCbUujlAKy4ueP4mI",
  authDomain: "event-wall-project.firebaseapp.com",
  projectId: "event-wall-project",
  storageBucket: "event-wall-project.firebasestorage.app",
  messagingSenderId: "628733067223",
  appId: "1:628733067223:web:afd45d146e733741a65592",
  measurementId: "G-L61Q44X721"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COMMENT_EMOJIS = ['😀', '😂', '❤️', '🔥', '🎉', '👏', '🙌', '💯', '✨', '😍'];

export default function App() {
  const [posts, setPosts] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPresenterView, setIsPresenterView] = useState(false);
  
  // Auto-Slideshow mode state for Presenter View
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  const [floatingEmojis, setFloatingEmojis] = useState([]);
  
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [sortBy, setSortBy] = useState('latest');
  const [caption, setCaption] = useState('');
  const [mediaData, setMediaData] = useState(''); 

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setIsAdmin(true);
      setIsPresenterView(true);
    }
  }, []);

  // Real-time listener for posts
  useEffect(() => {
    const q = query(collection(db, "boards", "main", "posts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        likes: 0,
        comments: [],
        ...doc.data()
      }));
      setPosts(postsData);
      
      setSelectedPost(current => {
        if (!current) return null;
        return postsData.find(p => p.id === current.id) || null;
      });
    }, (error) => {
      console.error("Error fetching posts: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Auto-Slideshow interval ticker (10 seconds per post)
  useEffect(() => {
    let interval;
    if (isPresenterView && isAutoPlay && posts.length > 0) {
      interval = setInterval(() => {
        setSelectedPost(current => {
          if (!current) return posts[0];
          const currentIndex = posts.findIndex(p => p.id === current.id);
          const nextIndex = (currentIndex + 1) % posts.length;
          return posts[nextIndex];
        });
      }, 10000); // 10 seconds
    }
    return () => clearInterval(interval);
  }, [isPresenterView, isAutoPlay, posts]);

  // Real-time listener for live reactions
  useEffect(() => {
    const q = query(collection(db, "boards", "main", "reactions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const reaction = change.data();
          if (reaction.createdAt && Date.now() - reaction.createdAt.toMillis() < 4000) {
            triggerMeetReactionBurst(reaction.emoji, reaction.x || Math.random() * 80 + 10);
          }
        }
      });
    });

    return () => unsubscribe();
  }, []);

  const triggerMeetReactionBurst = (emoji, startX) => {
    const count = Math.floor(Math.random() * 3) + 3;
    const newItems = [];

    for (let i = 0; i < count; i++) {
      const id = Math.random().toString(36).substring(2, 9);
      const xOffset = (Math.random() - 0.5) * 15;
      const delay = i * 150;
      const scale = 0.8 + Math.random() * 0.6;
      const rotation = (Math.random() - 0.5) * 40;

      newItems.push({ id, emoji, x: Math.min(Math.max(startX + xOffset, 5), 90), delay, scale, rotation });
    }

    setFloatingEmojis(prev => [...prev, ...newItems]);
    setTimeout(() => {
      const idsToRemove = newItems.map(item => item.id);
      setFloatingEmojis(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    }, 4000);
  };

  const sendReaction = async (emoji) => {
    const x = Math.floor(Math.random() * 80) + 10;
    triggerMeetReactionBurst(emoji, x);
    try {
      await addDoc(collection(db, "boards", "main", "reactions"), {
        emoji,
        x,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error sending reaction: ", e);
    }
  };

  const handleLike = async (postId, e) => {
    e?.stopPropagation();
    try {
      const postRef = doc(db, "boards", "main", "posts", postId);
      await updateDoc(postRef, { likes: increment(1) });
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  // Like individual comments
  const handleLikeComment = async (commentId) => {
    if (!selectedPost) return;
    try {
      const postRef = doc(db, "boards", "main", "posts", selectedPost.id);
      const updatedComments = (selectedPost.comments || []).map(c => {
        if (c.id === commentId) {
          return { ...c, likes: (c.likes || 0) + 1 };
        }
        return c;
      });

      await updateDoc(postRef, { comments: updatedComments });
    } catch (error) {
      console.error("Error liking comment:", error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!selectedPost || !commentText.trim()) return;

    try {
      const postRef = doc(db, "boards", "main", "posts", selectedPost.id);
      const currentComments = selectedPost.comments || [];
      const newComment = {
        id: Math.random().toString(36).substring(2, 9),
        author: commentAuthor.trim() || "Anonymous",
        text: commentText.trim(),
        likes: 0,
        createdAt: new Date().toISOString()
      };

      await updateDoc(postRef, { comments: [...currentComments, newComment] });
      setCommentText('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment.");
    }
  };

  const handleDeleteComment = async (commentToDelete) => {
    if (!selectedPost) return;
    if (window.confirm("Delete this comment?")) {
      try {
        const postRef = doc(db, "boards", "main", "posts", selectedPost.id);
        const updatedComments = (selectedPost.comments || []).filter(
          c => c.id !== commentToDelete.id && c.createdAt !== commentToDelete.createdAt
        );
        await updateDoc(postRef, { comments: updatedComments });
      } catch (error) {
        console.error("Error deleting comment:", error);
      }
    }
  };

  const handleDeletePost = async (postId, e) => {
    e?.stopPropagation();
    if (window.confirm("Delete this post?")) {
      try {
        await deleteDoc(doc(db, "boards", "main", "posts", postId));
        setSelectedPost(null);
      } catch (error) {
        console.error("Error deleting post: ", error);
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      alert("Please upload an image instead of a video!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 800;
        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setMediaData(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !mediaData) return;

    try {
      await addDoc(collection(db, "boards", "main", "posts"), {
        caption: caption.trim(),
        media: mediaData || "",
        likes: 0,
        comments: [],
        status: "approved",
        createdAt: serverTimestamp()
      });
      setCaption('');
      setMediaData('');
      setIsAddModalOpen(false);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
    } catch (error) {
      console.error("Error adding post: ", error);
    }
  };

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
    if (sortBy === 'comments') return (b.comments?.length || 0) - (a.comments?.length || 0);
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });

  const currentUrl = window.location.href.split('?')[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden pb-24">
      
      {/* Floating Reactions Canvas */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {floatingEmojis.map(item => (
          <div 
            key={item.id}
            className="absolute bottom-16 text-4xl select-none"
            style={{ 
              left: `${item.x}%`, 
              animation: `meetFloatUp 3.2s cubic-bezier(0.25, 1, 0.5, 1) ${item.delay}ms forwards`,
              transform: `scale(${item.scale}) rotate(${item.rotation}deg)`
            }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-2.5">
          <div className="bg-gradient-to-tr from-indigo-600 to-pink-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Live Wall
            </h1>
            <p className="text-[10px] text-slate-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Synced</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition border border-slate-700 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Scan QR</span>
          </button>

          {isAdmin && (
            <button 
              onClick={() => setIsPresenterView(!isPresenterView)}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 border border-indigo-400 px-3 py-2 rounded-xl text-xs font-medium text-white shadow-lg shadow-indigo-600/40 animate-pulse cursor-pointer"
            >
              <Presentation className="w-3.5 h-3.5 text-pink-300" />
              <span>Stage Mode</span>
            </button>
          )}

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/20 transition cursor-pointer text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Post</span>
          </button>
        </div>
      </header>

      {/* Admin Stage Mode Banner with Slideshow Controls */}
      {isAdmin && isPresenterView && (
        <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-pink-900/60 border-b border-indigo-500/30 px-6 py-3 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30 text-indigo-300">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Stage Slideshow Mode</h2>
              <p className="text-[11px] text-indigo-200">Click any post to view. Toggle auto-play to rotate pictures every 10s.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Auto-Play Toggle Button */}
            <button
              onClick={() => {
                setIsAutoPlay(!isAutoPlay);
                if (!isAutoPlay && posts.length > 0 && !selectedPost) setSelectedPost(posts[0]);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg cursor-pointer ${
                isAutoPlay ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isAutoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isAutoPlay ? 'Pause Slideshow (10s)' : 'Start Auto-Slideshow'}</span>
            </button>

            <div className="flex items-center space-x-3 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-indigo-400">{posts.length} Posts</span>
              <div className="bg-white p-1 rounded-lg">
                <QRCodeSVG value={currentUrl} size={32} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sort & Filter Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-slate-200">Community Feed (Click any card to project)</h2>
        
        <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <button onClick={() => setSortBy('latest')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${sortBy === 'latest' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Latest</button>
          <button onClick={() => setSortBy('likes')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${sortBy === 'likes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Liked</button>
          <button onClick={() => setSortBy('comments')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${sortBy === 'comments' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Commented</button>
        </div>
      </div>

      {/* Main Board Grid */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full flex flex-col">
        {posts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4">
            <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl backdrop-blur-md">
              <MessageSquare className="w-12 h-12 text-indigo-400 mx-auto mb-4 opacity-80 animate-bounce" />
              <h3 className="text-lg font-bold mb-2">The Board is Empty</h3>
              <p className="text-sm text-slate-400 mb-6">Be the first contributor! Upload a photo using the button above.</p>
              <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer shadow-lg">Create First Post</button>
            </div>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6 pb-12">
            {sortedPosts.map(post => (
              <div 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className="break-inside-avoid bg-slate-900/90 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl hover:border-indigo-500/50 transition duration-300 flex flex-col group relative cursor-pointer"
              >
                {isAdmin && (
                  <button onClick={(e) => handleDeletePost(post.id, e)} className="absolute top-3 right-3 bg-rose-600 hover:bg-rose-500 text-white p-2.5 rounded-full shadow-lg z-10 transition transform hover:scale-110 cursor-pointer" title="Delete post">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {post.media && (
                  <div className="w-full bg-slate-950 relative max-h-80 overflow-hidden flex items-center justify-center">
                    <img src={post.media} alt="Upload" className="w-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
                  </div>
                )}
                
                <div className="p-5 flex-1 flex flex-col justify-between">
                  {post.caption && <p className="text-sm text-slate-200 whitespace-pre-wrap mb-4">{post.caption}</p>}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                    <div className="flex items-center space-x-4">
                      <button onClick={(e) => handleLike(post.id, e)} className="flex items-center space-x-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer">
                        <Heart className="w-4 h-4 fill-rose-500/20 text-rose-500" />
                        <span className="text-xs font-semibold">{post.likes || 0}</span>
                      </button>
                      <div className="flex items-center space-x-1.5 text-slate-400">
                        <MessageCircle className="w-4 h-4 text-pink-400" />
                        <span className="text-xs font-semibold">{post.comments?.length || 0}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Post Detail & Slideshow Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[95vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
            
            <button onClick={() => { setSelectedPost(null); setIsAutoPlay(false); }} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 p-2 rounded-full transition z-20 cursor-pointer shadow-md">
              <X className="w-5 h-5" />
            </button>

            {/* Left side: Expanded Image */}
            {selectedPost.media && (
              <div className="w-full md:w-3/5 bg-slate-950 flex items-center justify-center max-h-[50vh] md:max-h-[95vh] overflow-hidden p-2 relative">
                <img src={selectedPost.media} alt="Projector View" className="max-w-full max-h-full object-contain rounded-2xl" />
                {isAutoPlay && (
                  <div className="absolute top-4 left-4 bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-xs font-extrabold animate-pulse shadow-lg flex items-center space-x-1">
                    <span>⏱️ Auto-Slideshow Active (10s)</span>
                  </div>
                )}
              </div>
            )}

            {/* Right side: Comments & Comment Likes */}
            <div className="w-full md:w-2/5 flex flex-col bg-slate-900/90 max-h-[50vh] md:max-h-[95vh]">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">✨</div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Live Contributor</h4>
                    <span className="text-[10px] text-slate-400">Projector Display Mode</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {selectedPost.caption && (
                  <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/60">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedPost.caption}</p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Comments ({selectedPost.comments?.length || 0})</h5>

                  {(!selectedPost.comments || selectedPost.comments.length === 0) ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">No comments yet. Be the first!</p>
                  ) : (
                    selectedPost.comments.map((comm) => (
                      <div key={comm.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1.5 relative group">
                        {isAdmin && (
                          <button onClick={() => handleDeleteComment(comm)} className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer" title="Delete comment">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="flex items-center justify-between pr-6">
                          <span className="font-bold text-indigo-400">@{comm.author}</span>
                          <span className="text-[9px] text-slate-500">
                            {comm.createdAt ? new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-normal pr-2">{comm.text}</p>

                        {/* Comment Like Button */}
                        <div className="flex items-center justify-end pt-1">
                          <button 
                            onClick={() => handleLikeComment(comm.id)}
                            className="flex items-center space-x-1 text-slate-400 hover:text-rose-500 transition cursor-pointer bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800"
                          >
                            <Heart className="w-3 h-3 fill-rose-500/20 text-rose-500" />
                            <span className="text-[10px] font-bold">{comm.likes || 0}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Comment Input */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={(e) => handleLike(selectedPost.id, e)} className="flex items-center space-x-2 text-slate-300 hover:text-rose-500 transition cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Heart className="w-5 h-5 fill-rose-500/20 text-rose-500" />
                    <span className="text-xs font-bold">{selectedPost.likes || 0} Likes</span>
                  </button>
                </div>

                {showEmojiPicker && (
                  <div className="flex items-center space-x-1.5 p-2 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
                    {COMMENT_EMOJIS.map(emoji => (
                      <button key={emoji} type="button" onClick={() => setCommentText(prev => prev + emoji)} className="text-lg hover:scale-125 transition p-1 cursor-pointer">{emoji}</button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddComment} className="space-y-2">
                  <input type="text" value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} placeholder="Your Name / Alias" maxLength={30} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" />
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 rounded-xl border transition cursor-pointer ${showEmojiPicker ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}><Smile className="w-4 h-4" /></button>
                    <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." maxLength={200} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer shadow-md">Post</button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Floating Reactions Bar */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 px-5 py-2.5 rounded-full shadow-2xl z-40 flex items-center space-x-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">React:</span>
        <div className="flex items-center space-x-2 sm:space-x-3">
          {['❤️', '🔥', '👏', '🎉', '🙌'].map(emoji => (
            <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-130 active:scale-95 transform transition duration-150 cursor-pointer">{emoji}</button>
          ))}
        </div>
      </div>

      {/* Add Post Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition cursor-pointer"><X className="w-4 h-4" /></button>
            <h2 className="text-xl font-bold mb-4 flex items-center space-x-2"><Sparkles className="w-5 h-5 text-indigo-400" /><span>Share to Live Board</span></h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Upload Photo from Device</label>
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer relative bg-slate-950 transition">
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <div className="flex flex-col items-center space-y-2">
                    <Upload className="w-6 h-6 text-indigo-400" />
                    <span className="text-xs text-slate-300">{mediaData ? "Photo selected & compressed!" : "Click to choose an image file"}</span>
                  </div>
                </div>
              </div>
              {mediaData && <div className="relative rounded-2xl overflow-hidden bg-slate-950 max-h-40 flex items-center justify-center border border-slate-800"><img src={mediaData} alt="Preview" className="max-h-40 object-contain" /></div>}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Caption / Description</label>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share a thought..." rows={3} maxLength={500} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl text-sm font-semibold text-slate-300 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg cursor-pointer">Publish Post</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center relative">
            <button onClick={() => setIsQRModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition cursor-pointer"><X className="w-4 h-4" /></button>
            <h3 className="text-lg font-bold mb-1">Scan to Participate</h3>
            <p className="text-xs text-slate-400 mb-6">Scan with your phone camera to post instantly</p>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-6 flex justify-center"><QRCodeSVG value={currentUrl} size={180} /></div>
            <p className="text-xs text-slate-500 break-all px-2">{currentUrl}</p>
          </div>
        </div>
      )}

    </div>
  );
}

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
  @keyframes meetFloatUp {
    0% { transform: translateY(0px) scale(0.5) rotate(0deg); opacity: 0; }
    15% { opacity: 1; transform: translateY(-80px) scale(1.2) rotate(-10deg); }
    50% { transform: translateY(-240px) scale(1) rotate(10deg); }
    100% { transform: translateY(-520px) scale(0.8) rotate(-20deg); opacity: 0; }
  }
`;
document.head.appendChild(styleSheet);