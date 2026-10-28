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
  Smile
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

// Preset emojis for comment box
const COMMENT_EMOJIS = ['😀', '😂', '❤️', '🔥', '🎉', '👏', '🙌', '💯', '✨', '😍'];

export default function App() {
  const [posts, setPosts] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isPresenterView, setIsPresenterView] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  
  // Active selected post for IG-style detail popup modal
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Sorting filter state: 'latest', 'likes', 'comments'
  const [sortBy, setSortBy] = useState('latest');

  // New Post Form State
  const [caption, setCaption] = useState('');
  const [mediaData, setMediaData] = useState(''); 

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
      
      // Keep selectedPost updated live if modal is open
      setSelectedPost(current => {
        if (!current) return null;
        return postsData.find(p => p.id === current.id) || null;
      });
    }, (error) => {
      console.error("Error fetching posts: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for live reactions/emojis
  useEffect(() => {
    const q = query(collection(db, "boards", "main", "reactions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const reaction = change.data();
          if (reaction.createdAt && Date.now() - reaction.createdAt.toMillis() < 5000) {
            triggerMeetReactionBurst(reaction.emoji, reaction.x || Math.random() * 80 + 10);
          }
        }
      });
    });

    return () => unsubscribe();
  }, []);

  // Google Meet-style animation engine: generates multiple floating particles per tap
  const triggerMeetReactionBurst = (emoji, startX) => {
    const count = Math.floor(Math.random() * 3) + 3; // 3 to 5 floating particles per click
    const newItems = [];

    for (let i = 0; i < count; i++) {
      const id = Math.random().toString(36).substring(2, 9);
      const xOffset = (Math.random() - 0.5) * 15; // random horizontal spread
      const delay = i * 150; // staggered spawn timing
      const scale = 0.8 + Math.random() * 0.6; // random sizing
      const rotation = (Math.random() - 0.5) * 40; // random tilt angle

      newItems.push({
        id,
        emoji,
        x: Math.min(Math.max(startX + xOffset, 5), 90),
        delay,
        scale,
        rotation
      });
    }

    setFloatingEmojis(prev => [...prev, ...newItems]);

    // Clean up after animation finishes (3.5s)
    setTimeout(() => {
      const idsToRemove = newItems.map(item => item.id);
      setFloatingEmojis(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    }, 4000);
  };

  const sendReaction = async (emoji) => {
    const x = Math.floor(Math.random() * 80) + 10;
    // Trigger locally instantly for immediate visual responsiveness
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
      await updateDoc(postRef, {
        likes: increment(1)
      });
    } catch (error) {
      console.error("Error liking post:", error);
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
        createdAt: new Date().toISOString()
      };

      await updateDoc(postRef, {
        comments: [...currentComments, newComment]
      });

      setCommentText('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment.");
    }
  };

  const handleDeleteComment = async (commentToDelete) => {
    if (!selectedPost) return;
    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        const postRef = doc(db, "boards", "main", "posts", selectedPost.id);
        const updatedComments = (selectedPost.comments || []).filter(
          c => c.id !== commentToDelete.id && c.createdAt !== commentToDelete.createdAt
        );

        await updateDoc(postRef, {
          comments: updatedComments
        });
      } catch (error) {
        console.error("Error deleting comment:", error);
        alert("Failed to delete comment.");
      }
    }
  };

  const handleDeletePost = async (postId, e) => {
    e?.stopPropagation();
    if (window.confirm("Are you sure you want to delete this post from the live board?")) {
      try {
        await deleteDoc(doc(db, "boards", "main", "posts", postId));
        setSelectedPost(null);
      } catch (error) {
        console.error("Error deleting post: ", error);
        alert("Failed to delete post.");
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      alert("Direct video files are too large for the database. Please upload an image instead!");
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
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setMediaData(compressedDataUrl);
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
      alert("Failed to post. The image might still be too large.");
    }
  };

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === 'likes') {
      return (b.likes || 0) - (a.likes || 0);
    } else if (sortBy === 'comments') {
      return (b.comments?.length || 0) - (a.comments?.length || 0);
    } else {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    }
  });

  const currentUrl = window.location.href;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      
      {/* Google Meet-Style Live Floating Reaction Animation Canvas */}
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
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-pink-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Live Interactive Wall
            </h1>
            <p className="text-xs text-slate-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Real-time sync active</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition border border-slate-700 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-indigo-400" />
            <span>Scan QR</span>
          </button>

          <button 
            onClick={() => setIsPresenterView(!isPresenterView)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition border cursor-pointer ${
              isPresenterView 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/40 animate-pulse' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <Presentation className="w-4 h-4 text-pink-400" />
            <span>{isPresenterView ? 'Presenter Mode ON' : 'Presenter View'}</span>
          </button>

          {!isPresenterView && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Post</span>
            </button>
          )}
        </div>
      </header>

      {/* Presenter Mode Interactive Banner */}
      {isPresenterView && (
        <div className="bg-gradient-to-r from-indigo-900/50 via-purple-900/50 to-pink-900/50 border-b border-indigo-500/30 px-8 py-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 text-indigo-300">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Interactive Stage Mode</h2>
              <p className="text-xs text-indigo-200">Scan code on screen to participate live • Delete posts or individual comments as host.</p>
            </div>
          </div>

          <div className="flex items-center space-x-6 bg-slate-950/60 px-5 py-2.5 rounded-2xl border border-slate-800">
            <div className="text-center">
              <span className="block text-xl font-extrabold text-indigo-400">{posts.length}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Posts</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-800"></div>
            <div className="bg-white p-2 rounded-xl shadow-md">
              <QRCodeSVG value={currentUrl} size={48} />
            </div>
          </div>
        </div>
      )}

      {/* Sort & Filter Bar */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-6 flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-bold text-slate-200">Live Community Board</h2>
        
        <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 p-1 rounded-2xl">
          <button
            onClick={() => setSortBy('latest')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              sortBy === 'latest' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Latest</span>
          </button>
          
          <button
            onClick={() => setSortBy('likes')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              sortBy === 'likes' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Most Liked</span>
          </button>

          <button
            onClick={() => setSortBy('comments')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              sortBy === 'comments' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-pink-400" />
            <span>Most Commented</span>
          </button>
        </div>
      </div>

      {/* Main Board Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col">
        {posts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4">
            <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl backdrop-blur-md">
              <MessageSquare className="w-12 h-12 text-indigo-400 mx-auto mb-4 opacity-80 animate-bounce" />
              <h3 className="text-lg font-bold mb-2">The Board is Empty</h3>
              <p className="text-sm text-slate-400 mb-6">
                Be the first contributor! Upload a photo using the button below or scan the QR code.
              </p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-sm font-semibold transition cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                Create First Post
              </button>
            </div>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6 pb-20">
            {sortedPosts.map(post => (
              <div 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className="break-inside-avoid bg-slate-900/90 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl hover:border-indigo-500/50 transition duration-300 flex flex-col group relative cursor-pointer"
              >
                {/* Delete button in Presenter View */}
                {isPresenterView && (
                  <button 
                    onClick={(e) => handleDeletePost(post.id, e)}
                    className="absolute top-3 right-3 bg-rose-600 hover:bg-rose-500 text-white p-2.5 rounded-full shadow-lg z-10 transition transform hover:scale-110 cursor-pointer"
                    title="Delete post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {post.media && (
                  <div className="w-full bg-slate-950 relative max-h-80 overflow-hidden flex items-center justify-center">
                    <img 
                      src={post.media} 
                      alt="User upload" 
                      className="w-full object-cover group-hover:scale-105 transition duration-500"
                      loading="lazy"
                    />
                  </div>
                )}
                
                <div className="p-5 flex-1 flex flex-col justify-between">
                  {post.caption && (
                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-normal mb-4">
                      {post.caption}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                    <div className="flex items-center space-x-4">
                      {/* Like Button */}
                      <button 
                        onClick={(e) => handleLike(post.id, e)}
                        className="flex items-center space-x-1.5 text-slate-400 hover:text-rose-500 transition group/btn cursor-pointer"
                      >
                        <Heart className="w-4 h-4 fill-rose-500/20 text-rose-500 group-hover/btn:scale-125 transition transform" />
                        <span className="text-xs font-semibold">{post.likes || 0}</span>
                      </button>

                      {/* Comment Count */}
                      <div className="flex items-center space-x-1.5 text-slate-400">
                        <MessageCircle className="w-4 h-4 text-pink-400" />
                        <span className="text-xs font-semibold">{post.comments?.length || 0}</span>
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-500 font-medium">
                      {post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Instagram-Style Post Detail Popup Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
            
            <button 
              onClick={() => setSelectedPost(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 p-2 rounded-full transition z-20 cursor-pointer shadow-md"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Left side: Image Display */}
            {selectedPost.media && (
              <div className="w-full md:w-3/5 bg-slate-950 flex items-center justify-center max-h-[50vh] md:max-h-[90vh] overflow-hidden">
                <img src={selectedPost.media} alt="Expanded view" className="max-w-full max-h-full object-contain" />
              </div>
            )}

            {/* Right side: Comments & Interaction */}
            <div className="w-full md:w-2/5 flex flex-col bg-slate-900/90 max-h-[50vh] md:max-h-[90vh]">
              
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
                    ✨
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Live Contributor</h4>
                    <span className="text-[10px] text-slate-400">
                      {selectedPost.createdAt?.toDate ? new Date(selectedPost.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrollable Comments Feed */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {selectedPost.caption && (
                  <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/60">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedPost.caption}
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Comments ({selectedPost.comments?.length || 0})
                  </h5>

                  {(!selectedPost.comments || selectedPost.comments.length === 0) ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">No comments yet. Be the first to comment!</p>
                  ) : (
                    selectedPost.comments.map((comm, idx) => (
                      <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1 relative group">
                        
                        {/* Presenter Mode Comment Deletion Button */}
                        {isPresenterView && (
                          <button 
                            onClick={() => handleDeleteComment(comm)}
                            className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                            title="Delete comment"
                          >
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
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Bar & Comment Form */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={(e) => handleLike(selectedPost.id, e)}
                    className="flex items-center space-x-2 text-slate-300 hover:text-rose-500 transition group cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
                  >
                    <Heart className="w-5 h-5 fill-rose-500/20 text-rose-500 group-hover:scale-125 transition transform" />
                    <span className="text-xs font-bold">{selectedPost.likes || 0} Likes</span>
                  </button>

                  <div className="text-xs text-slate-400 font-medium">
                    💬 {selectedPost.comments?.length || 0} Comments
                  </div>
                </div>

                {/* Emoji Picker Row for Comment Box */}
                {showEmojiPicker && (
                  <div className="flex items-center space-x-1.5 p-2 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto scrollbar-none animate-in fade-in zoom-in duration-150">
                    {COMMENT_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCommentText(prev => prev + emoji)}
                        className="text-lg hover:scale-125 transition p-1 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddComment} className="space-y-2">
                  <input 
                    type="text" 
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="Your Name / Alias" 
                    maxLength={30}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <div className="flex space-x-2">
                    <button 
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        showEmojiPicker ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Add Emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    <input 
                      type="text" 
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..." 
                      maxLength={200}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                    />

                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-xs font-semibold text-white transition cursor-pointer shadow-md"
                    >
                      Post
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Google Meet-Style Floating Live Emoji Reaction Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 px-6 py-3 rounded-full shadow-2xl z-40 flex items-center space-x-4">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">Live React:</span>
        <div className="flex items-center space-x-3">
          {['❤️', '🔥', '👏', '🎉', '🙌'].map(emoji => (
            <button 
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-2xl hover:scale-130 active:scale-95 transform transition duration-150 focus:outline-none cursor-pointer"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Add Post Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>Share to Live Board</span>
            </h2>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Upload Photo from Device</label>
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer relative bg-slate-950 transition">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center space-y-2">
                    <Upload className="w-6 h-6 text-indigo-400" />
                    <span className="text-xs text-slate-300">
                      {mediaData ? "Photo selected & compressed! (Click to change)" : "Click to choose an image file"}
                    </span>
                  </div>
                </div>
              </div>

              {mediaData && (
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 max-h-40 flex items-center justify-center border border-slate-800">
                  <img src={mediaData} alt="Preview" className="max-h-40 object-contain" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Caption / Description</label>
                <textarea 
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share a thought or reaction..." 
                  rows={3}
                  maxLength={500}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl text-sm font-semibold transition text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-2xl text-sm font-semibold transition text-white shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Publish Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Sharing Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center relative">
            <button 
              onClick={() => setIsQRModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold mb-1">Scan to Participate</h3>
            <p className="text-xs text-slate-400 mb-6">Scan with your phone camera to post instantly</p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-6 flex justify-center">
              <QRCodeSVG value={currentUrl} size={180} />
            </div>

            <p className="text-xs text-slate-500 break-all px-2">{currentUrl}</p>
          </div>
        </div>
      )}

    </div>
  );
}

// Google Meet Float-up Keyframe Animations
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
  @keyframes meetFloatUp {
    0% {
      transform: translateY(0px) scale(0.5) rotate(0deg);
      opacity: 0;
    }
    15% {
      opacity: 1;
      transform: translateY(-80px) scale(1.2) rotate(-10deg);
    }
    50% {
      transform: translateY(-240px) scale(1) rotate(10deg);
    }
    100% {
      transform: translateY(-520px) scale(0.8) rotate(-20deg);
      opacity: 0;
    }
  }
`;
document.head.appendChild(styleSheet);