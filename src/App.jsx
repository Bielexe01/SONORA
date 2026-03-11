import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, MessageCircle, Users, ListMusic, TrendingUp, User, 
  Heart, MessageSquare, Share2, Play, Music, Edit3, 
  Check, X, Search, PlusCircle, Headphones, Star, Award, 
  LogOut, Image as ImageIcon, Link as LinkIcon, Trash2, Send, Camera, Chrome
} from 'lucide-react';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';
import CommunitiesHub from './CommunitiesHub.jsx';

// Inicializacao do Supabase (utilizando as variaveis de ambiente do Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vasihzrqjggfbxdmvujc.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhc2loenJxamdnZmJ4ZG12dWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDc5NzIsImV4cCI6MjA4ODcyMzk3Mn0.AYrc6tK94iP2lK78nHrSjdenZvXYw-g1_cC7aisgXyA';
const supabase = createClient(supabaseUrl, supabaseKey);

const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
const COMMUNITY_MEMBERS_STORAGE_KEY = 'sonora_community_members';
const COMMUNITY_POSTS_STORAGE_KEY = 'sonora_community_posts';
const ASCENSAO_POSTS_STORAGE_KEY = 'sonora_ascensao_posts';
const ASCENSAO_LIKES_STORAGE_KEY = 'sonora_ascensao_likes';
const USER_FOLLOWS_STORAGE_KEY = 'sonora_user_follows';
const COMMUNITY_DEFAULT_GENRES = ['Rock', 'Pop', 'Rap', 'Eletronica', 'Gospel', 'MPB'];
const AVAILABLE_APP_TABS = new Set(['feed', 'direct', 'communities', 'playlists', 'ascensao', 'profile']);
const APP_NAV_ITEMS = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'direct', label: 'Direct', icon: MessageCircle },
  { id: 'communities', label: 'Comunidades', icon: Users },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'ascensao', label: 'Ascensao', icon: TrendingUp },
  { id: 'profile', label: 'Perfil', icon: User }
];

const normalizeHandleSeed = (value) => (
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18)
);

const buildProfilePayloadFromAuthUser = (authUser) => {
  const metadata = authUser?.user_metadata || {};
  const fallbackSeed = authUser?.email ? authUser.email.split('@')[0] : 'usuario';
  const rawName = metadata.name || metadata.full_name || metadata.user_name || fallbackSeed || 'Usuario';
  const seed = normalizeHandleSeed(metadata.preferred_username || rawName || fallbackSeed) || 'sonora';
  const uniqueSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');

  return {
    id: authUser.id,
    name: String(rawName).trim() || 'Usuario',
    handle: `@${seed}${uniqueSuffix}`,
    avatar_url: metadata.avatar_url || metadata.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawName || seed)}`
  };
};

const getInitialTabFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    return tab && AVAILABLE_APP_TABS.has(tab) ? tab : 'feed';
  } catch {
    return 'feed';
  }
};

const parseSpotifyLink = (rawUrl) => {
  if (!rawUrl) return null;
  const cleaned = rawUrl.trim();
  if (!cleaned) return null;

  const uriMatch = cleaned.match(/^spotify:(track|album|playlist|artist|episode|show):([a-zA-Z0-9]+)$/i);
  if (uriMatch) {
    const type = uriMatch[1].toLowerCase();
    const id = uriMatch[2];
    return {
      type,
      id,
      canonicalUrl: `https://open.spotify.com/${type}/${id}`,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
    };
  }

  // Remove locale segments like /intl-pt/ to normalize parsing.
  let normalizedInput = cleaned.replace(/^(https?:\/\/open\.spotify\.com\/)intl-[^/]+\//i, '$1');
  if (!/^https?:\/\//i.test(normalizedInput) && /^(open\.)?spotify\.com\//i.test(normalizedInput)) {
    normalizedInput = `https://${normalizedInput}`;
  }

  try {
    const parsed = new URL(normalizedInput);
    if (!/(\.|^)spotify\.com$/i.test(parsed.hostname)) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const startsWithEmbed = parts[0]?.toLowerCase() === 'embed';
    const type = (startsWithEmbed ? parts[1] : parts[0])?.toLowerCase();
    const id = startsWithEmbed ? parts[2] : parts[1];
    if (!type || !id || !SPOTIFY_TYPES.has(type)) return null;

    return {
      type,
      id,
      canonicalUrl: `https://open.spotify.com/${type}/${id}`,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
    };
  } catch {
    return null;
  }
};

const parseYouTubeLink = (rawUrl) => {
  if (!rawUrl) return null;
  const cleaned = rawUrl.trim();
  if (!cleaned) return null;

  let videoId = '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) {
    videoId = cleaned;
  } else {
    let normalizedInput = cleaned;
    if (!/^https?:\/\//i.test(normalizedInput) && /^(www\.)?(youtube\.com|youtu\.be)\//i.test(normalizedInput)) {
      normalizedInput = `https://${normalizedInput}`;
    }

    try {
      const parsed = new URL(normalizedInput);
      const host = parsed.hostname.toLowerCase();
      if (host.includes('youtu.be')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
      } else if (host.includes('youtube.com')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'watch') {
          videoId = parsed.searchParams.get('v') || '';
        } else if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
          videoId = parts[1] || '';
        } else {
          videoId = parsed.searchParams.get('v') || '';
        }
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  return {
    id: videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`
  };
};

const getSpotifyEmbedHeight = (type) => (type === 'track' || type === 'episode' ? 152 : 352);

const getLocalCommunityMembershipState = (userId) => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMMUNITY_MEMBERS_STORAGE_KEY) || '{}');
    const currentUserCommunities = Array.isArray(raw[userId]) ? raw[userId] : [];
    const memberCountMap = {};

    Object.values(raw).forEach((communityIds) => {
      if (!Array.isArray(communityIds)) return;
      communityIds.forEach((communityId) => {
        memberCountMap[communityId] = (memberCountMap[communityId] || 0) + 1;
      });
    });

    return {
      joinedIds: currentUserCommunities,
      memberCountMap,
      allMemberships: raw
    };
  } catch {
    return {
      joinedIds: [],
      memberCountMap: {},
      allMemberships: {}
    };
  }
};

const setLocalCommunityMembershipState = (userId, communityIds) => {
  const state = getLocalCommunityMembershipState(userId).allMemberships;
  state[userId] = communityIds;
  window.localStorage.setItem(COMMUNITY_MEMBERS_STORAGE_KEY, JSON.stringify(state));
};

const getLocalCommunityPostsState = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMMUNITY_POSTS_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const setLocalCommunityPostsState = (postsByCommunity) => {
  window.localStorage.setItem(COMMUNITY_POSTS_STORAGE_KEY, JSON.stringify(postsByCommunity));
};

const getLocalAscensaoPostsState = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ASCENSAO_POSTS_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const setLocalAscensaoPostsState = (posts) => {
  window.localStorage.setItem(ASCENSAO_POSTS_STORAGE_KEY, JSON.stringify(Array.isArray(posts) ? posts : []));
};

const getLocalAscensaoLikesState = (userId) => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ASCENSAO_LIKES_STORAGE_KEY) || '{}');
    const likedIds = Array.isArray(raw[userId]) ? raw[userId] : [];
    return likedIds.map((id) => String(id));
  } catch {
    return [];
  }
};

const setLocalAscensaoLikesState = (userId, likedPostIds) => {
  let state = {};
  try {
    state = JSON.parse(window.localStorage.getItem(ASCENSAO_LIKES_STORAGE_KEY) || '{}');
  } catch {
    state = {};
  }
  state[userId] = Array.isArray(likedPostIds) ? likedPostIds.map((id) => String(id)) : [];
  window.localStorage.setItem(ASCENSAO_LIKES_STORAGE_KEY, JSON.stringify(state));
};

const getLocalUserFollowsState = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(USER_FOLLOWS_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const setLocalUserFollowsState = (state) => {
  window.localStorage.setItem(USER_FOLLOWS_STORAGE_KEY, JSON.stringify(state && typeof state === 'object' ? state : {}));
};

const isUserFollowingLocally = (followerId, followingId) => {
  const state = getLocalUserFollowsState();
  const followerKey = String(followerId || '');
  const followingKey = String(followingId || '');
  if (!followerKey || !followingKey) return false;
  const followingIds = Array.isArray(state[followerKey]) ? state[followerKey] : [];
  return followingIds.map((id) => String(id)).includes(followingKey);
};

const setLocalFollowRelation = (followerId, followingId, shouldFollow) => {
  const followerKey = String(followerId || '');
  const followingKey = String(followingId || '');
  if (!followerKey || !followingKey || followerKey === followingKey) return false;

  const state = getLocalUserFollowsState();
  const set = new Set((Array.isArray(state[followerKey]) ? state[followerKey] : []).map((id) => String(id)));
  const alreadyFollowing = set.has(followingKey);
  if (shouldFollow) set.add(followingKey);
  else set.delete(followingKey);
  state[followerKey] = Array.from(set);
  setLocalUserFollowsState(state);

  return alreadyFollowing !== shouldFollow;
};

const getLocalFollowStats = (userId) => {
  const targetUserId = String(userId);
  const followsByUser = getLocalUserFollowsState();
  const following = new Set(
    (Array.isArray(followsByUser[targetUserId]) ? followsByUser[targetUserId] : [])
      .map((id) => String(id))
      .filter((id) => id && id !== targetUserId)
  );

  let followers = 0;
  Object.entries(followsByUser).forEach(([followerId, followingIds]) => {
    if (!Array.isArray(followingIds) || String(followerId) === targetUserId) return;
    const followingSet = new Set(followingIds.map((id) => String(id)));
    if (followingSet.has(targetUserId)) followers += 1;
  });

  return {
    followers,
    following: following.size
  };
};

const updateLocalCommunityPosts = (communityId, updater) => {
  const state = getLocalCommunityPostsState();
  const currentPosts = Array.isArray(state[communityId]) ? state[communityId] : [];
  const nextPosts = updater(currentPosts);
  state[communityId] = nextPosts;
  setLocalCommunityPostsState(state);
  return nextPosts;
};

const buildCommunityPostSummary = (post) => {
  const spotify = parseSpotifyLink(post.spotify_url);
  const content = post.content || '';
  return {
    ...post,
    spotify,
    likes_count: post.likes_count || 0,
    shares_count: post.shares_count || 0,
    saves_count: post.saves_count || 0,
    comments: Array.isArray(post.comments) ? post.comments : [],
    contentPreview: content.length > 180 ? `${content.slice(0, 177)}...` : content
  };
};

const normalizeAscensaoPost = (post) => {
  const kind = String(post?.post_kind || '').toLowerCase();
  const mediaUrl = String(post?.media_url || '').trim();
  const youtubeData = parseYouTubeLink(mediaUrl);
  const resolvedKind = kind || (youtubeData ? 'youtube' : 'video');

  return {
    id: post?.id || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    user_id: post?.user_id || '',
    title: String(post?.title || '').trim(),
    content: String(post?.content || '').trim(),
    post_kind: ['video', 'audio', 'youtube'].includes(resolvedKind) ? resolvedKind : 'video',
    media_url: youtubeData?.canonicalUrl || mediaUrl,
    likes_count: Number(post?.likes_count || 0),
    created_at: post?.created_at || new Date().toISOString(),
    profiles: post?.profiles || null,
    youtube: youtubeData
  };
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState(() => getInitialTabFromUrl());
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Capturar o token do Spotify se estiver no URL (apos o login)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const token = new URLSearchParams(hash.substring(1)).get('access_token');
      if (token) {
        window.localStorage.setItem('spotify_token', token);
        window.history.replaceState(null, null, ' '); // Limpa o URL
      }
    }

    // Verificar sessao do Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user);
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setSelectedProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (authUser) => {
    const userId = authUser?.id || '';
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (profileError) throw profileError;

      let resolvedProfile = existingProfile;
      if (!resolvedProfile) {
        let lastInsertError = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const payload = buildProfilePayloadFromAuthUser(authUser);
          const { data: insertedProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([payload])
            .select('*')
            .single();

          if (!insertError && insertedProfile) {
            resolvedProfile = insertedProfile;
            lastInsertError = null;
            break;
          }

          lastInsertError = insertError;
          if (!insertError || insertError.code !== '23505') break;
        }

        if (!resolvedProfile && lastInsertError) throw lastInsertError;
      }

      setCurrentUser(resolvedProfile);
      setSelectedProfile((prev) => (!prev || String(prev.id) === String(resolvedProfile.id) ? resolvedProfile : prev));
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openProfile = async (target) => {
    const targetId = typeof target === 'string' ? target : target?.id;
    if (!targetId) return;

    if (currentUser && String(targetId) === String(currentUser.id)) {
      setSelectedProfile(currentUser);
      setActiveTab('profile');
      return;
    }

    if (target && typeof target === 'object') {
      setSelectedProfile((prev) => (prev?.id === target.id ? { ...prev, ...target } : target));
    } else {
      setSelectedProfile(null);
    }
    setActiveTab('profile');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (!error && data) setSelectedProfile(data);
  };

  const handleTabChange = (tabId) => {
    if (tabId === 'profile') setSelectedProfile(currentUser);
    setActiveTab(tabId);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Headphones className="w-12 h-12 text-violet-500 animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div className="flex min-h-screen md:h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <header className="md:hidden fixed top-0 inset-x-0 h-14 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur z-40">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="w-6 h-6 text-violet-500" />
            <span className="text-sm font-bold text-white tracking-tight">Sonora</span>
          </div>
          <button
            onClick={async () => await supabase.auth.signOut()}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <nav className="hidden md:flex w-20 md:w-64 border-r border-zinc-800 flex-col justify-between py-6 bg-zinc-950 z-10">
        <div>
          <div className="flex items-center justify-center md:justify-start md:px-6 mb-10">
            <Headphones className="w-10 h-10 text-violet-500" />
            <span className="hidden md:block ml-3 text-2xl font-bold tracking-tight text-white">Sonora</span>
          </div>
          
          <div className="space-y-2 px-3">
            {APP_NAV_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                icon={React.createElement(item.icon)}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => handleTabChange(item.id)}
              />
            ))}
          </div>
        </div>
        <div className="px-3">
          <button onClick={async () => await supabase.auth.signOut()} className="w-full flex items-center justify-center md:justify-start px-3 py-3 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-red-400">
            <LogOut className="w-6 h-6" />
            <span className="hidden md:block ml-4 font-medium">Sair</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 min-w-0 overflow-y-auto relative bg-zinc-950 pt-14 pb-24 md:pt-0 md:pb-0">
        <div className={`${activeTab === 'direct' || activeTab === 'communities' ? 'w-full' : 'max-w-4xl mx-auto'} min-h-full`}>
          {activeTab === 'feed' && <FeedView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'direct' && <DirectView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'communities' && <CommunitiesHub currentUser={currentUser} onOpenDirect={() => setActiveTab('direct')} onOpenProfile={openProfile} />}
          {activeTab === 'playlists' && <PlaylistsView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'ascensao' && <AscensaoView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'profile' && (
            <ProfileView
              user={selectedProfile || currentUser}
              viewerUser={currentUser}
              setUser={(nextUser) => {
                setCurrentUser(nextUser);
                if (selectedProfile && String(selectedProfile.id) === String(nextUser.id)) setSelectedProfile(nextUser);
              }}
              onOpenProfile={openProfile}
            />
          )}
        </div>
      </main>

      <MobileBottomNav
        items={APP_NAV_ITEMS}
        activeTab={activeTab}
        onSelect={handleTabChange}
      />
    </div>
  );
}

// --- SUB-VIEWS ---

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const getAuthRedirectUrl = () => `${window.location.origin}/`;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
            data: {
              name: name.trim()
            }
          }
        });
        if (error) throw error;
        alert('Conta criada. Verifique seu email para confirmar o acesso.');
        setIsLogin(true);
      }
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl()
      }
    });
    if (error) {
      alert('Erro ao entrar com Google: ' + error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl text-center">
        <Headphones className="w-16 h-16 text-violet-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">Sonora</h1>
        <p className="text-zinc-400 mb-8">A sua rede social de musica.</p>
        <form onSubmit={handleAuth} className="space-y-4 mb-5">
          {!isLogin && <input type="text" placeholder="Nome Artistico" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500" />}
          <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500" />
          <input type="password" placeholder="Palavra-passe" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500" />
          <button disabled={loading} type="submit" className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center">
            {loading ? 'A processar...' : (isLogin ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-zinc-600 mb-5">
          <div className="h-px bg-zinc-800 flex-1"></div>
          <span>ou</span>
          <div className="h-px bg-zinc-800 flex-1"></div>
        </div>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full mb-6 bg-white hover:bg-zinc-200 disabled:opacity-60 text-zinc-950 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Chrome className="w-5 h-5" />
          {googleLoading ? 'A redirecionar...' : 'Entrar com Google'}
        </button>
        <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-zinc-500 hover:text-white text-sm">
          {isLogin ? 'Nao tem conta? Crie uma' : 'Ja tem conta? Inicie sessao'}
        </button>
      </div>
    </div>
  );
}

function FeedView({ currentUser, onOpenProfile }) {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostLink, setNewPostLink] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  
  // Image upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPosts();
    // Escutar novos posts em tempo real
    const channel = supabase.channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(id, name, handle, avatar_url)')
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePost = async () => {
    if (!newPostContent.trim() && !newPostLink.trim() && !imageFile) return;
    setIsPosting(true);
    
    let uploadedMediaUrl = null;
    let spotifyData = null;
    
    // 1. Upload da imagem se existir
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('media').upload(`${currentUser.id}/${fileName}`, imageFile);
      if (data) {
        uploadedMediaUrl = supabase.storage.from('media').getPublicUrl(data.path).data.publicUrl;
      }
    }

    // 2. Validar e normalizar o link do Spotify
    if (newPostLink) {
      spotifyData = parseSpotifyLink(newPostLink);
      if (!spotifyData) {
        alert('Link do Spotify invalido. Use um link oficial do Spotify.');
        setIsPosting(false);
        return;
      }
    }

    // 3. Inserir o post na tabela
    const { error } = await supabase.from('posts').insert([{
      user_id: currentUser.id,
      content: newPostContent,
      spotify_url: spotifyData?.canonicalUrl || null,
      spotify_type: spotifyData?.type || null,
      media_url: uploadedMediaUrl,
      media_type: uploadedMediaUrl ? 'image' : null
    }]);

    if (!error) {
      setNewPostContent('');
      setNewPostLink('');
      setShowLinkInput(false);
      setImageFile(null);
      setImagePreview('');
      fetchPosts();
    } else {
      console.error(error);
      alert("Erro ao publicar.");
    }
    setIsPosting(false);
  };

  const spotifyPreview = parseSpotifyLink(newPostLink);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white sticky top-14 md:top-0 bg-zinc-950/80 backdrop-blur pt-2 pb-4 z-10">Feed</h2>
      
      {/* Caixa de Criacao de Post */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-8">
        <div className="flex space-x-4">
          <img src={currentUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.name}`} className="w-12 h-12 rounded-full bg-zinc-800 object-cover" />
          <div className="flex-1">
            <textarea 
              placeholder="Qual o som de hoje? Ou o que esta a compor?"
              className="w-full bg-transparent text-white border-none focus:ring-0 resize-none outline-none placeholder-zinc-500"
              rows={2} value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)}
            />
            
            {/* Preview da Imagem */}
            {imagePreview && (
              <div className="relative mt-2">
                <img src={imagePreview} className="rounded-xl max-h-48 object-cover" />
                <button onClick={() => {setImageFile(null); setImagePreview('');}} className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white hover:bg-red-500 transition-colors"><X className="w-4 h-4"/></button>
              </div>
            )}

            {/* Input do Spotify */}
            {showLinkInput && (
              <div className="mt-3">
                <input 
                  type="text" placeholder="Cole o link do Spotify aqui para pre-visualizar..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  value={newPostLink} onChange={(e) => setNewPostLink(e.target.value)}
                />
                {spotifyPreview && (
                  <iframe
                    src={spotifyPreview.embedUrl}
                    className="mt-3 w-full rounded-xl"
                    height={getSpotifyEmbedHeight(spotifyPreview.type)}
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  ></iframe>
                )}
                {newPostLink.trim() && !spotifyPreview && (
                  <p className="mt-2 text-xs text-red-400">Nao foi possivel gerar preview desse link.</p>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
              <div className="flex space-x-2">
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageChange} />
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-violet-400 hover:bg-violet-400/10 rounded-full transition-colors">
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setShowLinkInput(!showLinkInput)} className={`p-2 rounded-full transition-colors ${showLinkInput ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10'}`}>
                  <LinkIcon className="w-5 h-5" />
                </button>
              </div>
              <button onClick={handlePost} disabled={isPosting || (!newPostContent.trim() && !newPostLink.trim() && !imageFile)} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-6 py-2 rounded-full font-medium transition-colors">
                {isPosting ? 'A publicar...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {posts.map(post => <PostCard key={post.id} post={post} currentUser={currentUser} fetchPosts={fetchPosts} onOpenProfile={onOpenProfile} />)}
      </div>
    </div>
  );
}

function PostCard({ post, currentUser, fetchPosts, onOpenProfile }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const profile = post.profiles || {};
  const spotifyData = parseSpotifyLink(post.spotify_url);
  const embedUrl = spotifyData?.embedUrl || null;
  const spotifyType = post.spotify_type || spotifyData?.type;
  const isOwner = currentUser?.id === post.user_id;

  useEffect(() => {
    checkLike();
  }, []);

  const checkLike = async () => {
    // Verifica se o utilizador ja deu like
    const { data: likeData } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUser.id)
      .single();
    
    if (likeData) setLiked(true);
    
    // Conta total de likes reais
    const { count } = await supabase
      .from('post_likes')
      .select('id', { count: 'exact' })
      .eq('post_id', post.id);
      
    setLikesCount(count || 0);
  };

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    if (liked) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      if (!error) {
        setLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      }
    } else {
      const { error } = await supabase.from('post_likes').insert([{ post_id: post.id, user_id: currentUser.id }]);
      if (!error) {
        setLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    }

    setIsLiking(false);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(id, name, handle, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const handleToggleComments = () => {
    if (!showComments) fetchComments();
    setShowComments(!showComments);
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: newComment }]);
    setNewComment('');
    fetchComments();
  };

  const handleDelete = async () => {
    if (window.confirm("Pretende apagar esta publicacao?")) {
      await supabase.from('posts').delete().eq('id', post.id);
      fetchPosts();
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5 relative group">
      {isOwner && (
        <button onClick={handleDelete} className="absolute top-4 right-4 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center mb-4">
        <button
          type="button"
          onClick={() => profile?.id && onOpenProfile?.(profile.id)}
          className="flex items-center text-left group/profile"
        >
          <img src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} className="w-12 h-12 rounded-full bg-zinc-800 object-cover" />
          <div className="ml-3">
            <div className="font-bold text-white group-hover/profile:text-violet-300 transition-colors">{profile.name}</div>
            <div className="text-zinc-400 text-sm">{profile.handle} • {new Date(post.created_at).toLocaleDateString()}</div>
          </div>
        </button>
      </div>

      <p className="text-zinc-200 mb-4 whitespace-pre-wrap">{post.content}</p>
      
      {post.media_url && post.media_type === 'image' && (
        <img src={post.media_url} className="rounded-xl w-full object-cover max-h-96 mb-4" />
      )}
      
      {embedUrl && (
        <div className="mb-4 rounded-xl overflow-hidden">
          <iframe src={embedUrl} width="100%" height={getSpotifyEmbedHeight(spotifyType)} frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" className="rounded-xl"></iframe>
        </div>
      )}
      
      <div className="flex items-center space-x-6 text-zinc-400 mt-4 pt-4 border-t border-zinc-800/50">
        <button disabled={isLiking} onClick={handleLike} className={`flex items-center space-x-2 transition-colors disabled:opacity-60 ${liked ? 'text-pink-500' : 'hover:text-pink-500'}`}>
          <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} /> <span>{likesCount}</span>
        </button>
        <button onClick={handleToggleComments} className="flex items-center space-x-2 hover:text-violet-400 transition-colors">
          <MessageSquare className="w-5 h-5" /> <span>{comments.length > 0 ? comments.length : 'Comentar'}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50">
          <div className="space-y-4 mb-4 max-h-48 overflow-y-auto pr-2">
            {comments.map(c => (
              <div key={c.id} className="flex space-x-3 bg-zinc-950/50 p-3 rounded-xl">
                <button
                  type="button"
                  onClick={() => c.profiles?.id && onOpenProfile?.(c.profiles.id)}
                  className="shrink-0"
                >
                  <img src={c.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profiles?.name}`} className="w-8 h-8 rounded-full object-cover" />
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => c.profiles?.id && onOpenProfile?.(c.profiles.id)}
                    className="font-bold text-sm text-white hover:text-violet-300 transition-colors"
                  >
                    {c.profiles?.name}
                  </button>
                  <div className="text-sm text-zinc-300">{c.content}</div>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-zinc-500 text-sm text-center">Seja o primeiro a comentar!</p>}
          </div>
          <form onSubmit={handlePostComment} className="flex space-x-2">
            <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Escreva um comentario..." className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full px-4 py-2 text-sm text-white focus:border-violet-500 outline-none" />
            <button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white p-2 w-10 h-10 rounded-full flex items-center justify-center"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      )}
    </div>
  );
}

function DirectView({ currentUser, onOpenProfile }) {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [conversationMeta, setConversationMeta] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const formatConversationTime = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return isToday
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString();
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .neq('id', currentUser.id)
      .order('name', { ascending: true });

    if (!error) setUsers(data || []);
    setLoadingUsers(false);
  };

  const fetchConversationMeta = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (error) return;

    const nextMeta = {};
    (data || []).forEach((message) => {
      const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
      if (!otherUserId || nextMeta[otherUserId]) return;
      nextMeta[otherUserId] = {
        lastMessage: message.content,
        createdAt: message.created_at
      };
    });

    setConversationMeta(nextMeta);
  };

  useEffect(() => {
    fetchUsers();
    fetchConversationMeta();
  }, [currentUser.id]);

  useEffect(() => {
    if (!activeUser) {
      setMessages([]);
      return;
    }
    fetchMessages();
  }, [activeUser?.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`direct-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new;
        if (!message) return;
        const isRelevant = message.sender_id === currentUser.id || message.receiver_id === currentUser.id;
        if (!isRelevant) return;

        const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
        setConversationMeta((prev) => ({
          ...prev,
          [otherUserId]: {
            lastMessage: message.content,
            createdAt: message.created_at
          }
        }));

        if (activeUser && (message.sender_id === activeUser.id || message.receiver_id === activeUser.id)) {
          setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
          scrollToBottom();
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser.id, activeUser?.id]);

  const fetchMessages = async () => {
    if (!activeUser) return;
    setLoadingMessages(true);
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeUser.id}),and(sender_id.eq.${activeUser.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);
    scrollToBottom();
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeUser) return;
    setSendingMessage(true);
    const messageContent = newMessage.trim();
    const { data } = await supabase
      .from('messages')
      .insert([{ sender_id: currentUser.id, receiver_id: activeUser.id, content: messageContent }])
      .select('*')
      .single();

    if (data) {
      setMessages((prev) => (prev.some((item) => item.id === data.id) ? prev : [...prev, data]));
      setConversationMeta((prev) => ({
        ...prev,
        [activeUser.id]: {
          lastMessage: data.content,
          createdAt: data.created_at
        }
      }));
      scrollToBottom();
    }

    setNewMessage('');
    setSendingMessage(false);
  };

  const filteredUsers = users
    .filter((user) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      const nameMatch = user.name?.toLowerCase().includes(query);
      const handleMatch = user.handle?.toLowerCase().includes(query);
      return nameMatch || handleMatch;
    })
    .sort((a, b) => {
      const aTime = conversationMeta[a.id]?.createdAt ? new Date(conversationMeta[a.id].createdAt).getTime() : 0;
      const bTime = conversationMeta[b.id]?.createdAt ? new Date(conversationMeta[b.id].createdAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (a.name || '').localeCompare(b.name || '');
    });

  useEffect(() => {
    if (!users.length) return;
    const targetUserId = window.localStorage.getItem('sonora_direct_target');
    if (!targetUserId) return;

    const targetUser = users.find((user) => user.id === targetUserId);
    if (targetUser) setActiveUser(targetUser);
    window.localStorage.removeItem('sonora_direct_target');
  }, [users]);

  return (
    <div className="flex min-h-[calc(100dvh-9.5rem)] md:min-h-full border-x border-zinc-800">
      <div className={`w-full md:w-[360px] border-r border-zinc-800 p-4 ${activeUser ? 'hidden md:flex' : 'flex'} flex-col bg-zinc-950`}>
        <h2 className="text-2xl font-bold mb-4 text-white">Direct</h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou handle..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
          />
        </div>

        <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {loadingUsers && <p className="text-sm text-zinc-500 text-center py-8">Carregando contatos...</p>}
          {!loadingUsers && filteredUsers.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">Nenhum contato encontrado.</p>
          )}
          {!loadingUsers && filteredUsers.map((u) => {
            const lastMessage = conversationMeta[u.id]?.lastMessage;
            const createdAt = conversationMeta[u.id]?.createdAt;
            return (
              <div key={u.id} className={`w-full flex items-center gap-2 p-2 rounded-xl transition-colors ${activeUser?.id === u.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}>
                <button type="button" onClick={() => setActiveUser(u)} className="flex items-center text-left overflow-hidden flex-1 min-w-0 p-1">
                  <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} className="w-12 h-12 rounded-full object-cover bg-zinc-800 shrink-0" />
                  <div className="ml-3 text-left overflow-hidden flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-white truncate">{u.name}</div>
                      {createdAt && <span className="text-[10px] text-zinc-500 shrink-0">{formatConversationTime(createdAt)}</span>}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{lastMessage || u.handle}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(u)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-violet-300 hover:bg-zinc-700 transition-colors"
                  title="Abrir perfil"
                >
                  <User className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {activeUser ? (
        <div className="flex-1 flex flex-col bg-zinc-900/50">
          <div className="p-4 border-b border-zinc-800 flex items-center bg-zinc-950">
            <button className="md:hidden mr-4 text-zinc-400" onClick={() => setActiveUser(null)}><X className="w-6 h-6" /></button>
            <img src={activeUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.name}`} className="w-10 h-10 rounded-full object-cover" />
            <h3 className="ml-3 font-bold text-lg text-white">{activeUser.name}</h3>
            <button
              type="button"
              onClick={() => onOpenProfile?.(activeUser)}
              className="ml-auto p-2 rounded-lg text-zinc-400 hover:text-violet-300 hover:bg-zinc-800 transition-colors"
              title="Abrir perfil"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {loadingMessages && <p className="text-sm text-zinc-500 text-center py-4">Carregando conversa...</p>}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-2xl ${msg.sender_id === currentUser.id ? 'bg-violet-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-100 rounded-bl-none'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-4 border-t border-zinc-800 bg-zinc-950">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Digite uma mensagem..." className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-white focus:border-violet-500 outline-none" />
              <button disabled={sendingMessage} type="submit" className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white p-2 w-10 h-10 rounded-full flex items-center justify-center"><Send className="w-4 h-4" /></button>
            </form>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-zinc-500 bg-zinc-950">
          <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
          <p>Selecione uma conversa para comecar</p>
        </div>
      )}
    </div>
  );
}

function CommunitiesView({ currentUser }) {
  const [communities, setCommunities] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newComm, setNewComm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [membershipBackend, setMembershipBackend] = useState('checking');
  const [joinedCommunityIds, setJoinedCommunityIds] = useState([]);
  const [memberCountMap, setMemberCountMap] = useState({});

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Nao foi possivel carregar comunidades.');
      setLoading(false);
      return;
    }

    const baseCommunities = data || [];
    const creatorIds = [...new Set(baseCommunities.map((community) => community.created_by).filter(Boolean))];
    let creatorsById = {};

    if (creatorIds.length) {
      const { data: creators } = await supabase
        .from('profiles')
        .select('id, name, handle')
        .in('id', creatorIds);
      creatorsById = Object.fromEntries((creators || []).map((creator) => [creator.id, creator]));
    }

    const enrichedCommunities = baseCommunities.map((community) => ({
      ...community,
      creator: creatorsById[community.created_by] || null
    }));

    setCommunities(enrichedCommunities);
    await loadMemberships(enrichedCommunities);
    setLoading(false);
  };

  const loadMemberships = async (communitiesData = communities) => {
    const communityIds = (communitiesData || []).map((community) => community.id);
    if (!communityIds.length) {
      setMemberCountMap({});
      setJoinedCommunityIds([]);
      return;
    }

    const { data, error } = await supabase
      .from('community_members')
      .select('community_id, user_id')
      .in('community_id', communityIds);

    if (!error) {
      const nextCounts = {};
      const nextJoinedIds = [];

      (data || []).forEach((membership) => {
        nextCounts[membership.community_id] = (nextCounts[membership.community_id] || 0) + 1;
        if (membership.user_id === currentUser.id) nextJoinedIds.push(membership.community_id);
      });

      communityIds.forEach((id) => {
        if (!nextCounts[id]) nextCounts[id] = 0;
      });

      setMembershipBackend('remote');
      setMemberCountMap(nextCounts);
      setJoinedCommunityIds(nextJoinedIds);
      return;
    }

    const localMembershipState = getLocalCommunityMembershipState(currentUser.id);
    const nextCounts = { ...localMembershipState.memberCountMap };
    communityIds.forEach((id) => {
      if (!nextCounts[id]) nextCounts[id] = 0;
    });

    setMembershipBackend('local');
    setMemberCountMap(nextCounts);
    setJoinedCommunityIds(localMembershipState.joinedIds);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newComm.name.trim();
    const description = newComm.description.trim();
    if (!name || !description) return;

    const { error } = await supabase
      .from('communities')
      .insert([{ name, description, created_by: currentUser.id }]);

    if (error) {
      setErrorMessage('Nao foi possivel criar a comunidade.');
      return;
    }

    setShowCreate(false);
    setNewComm({ name: '', description: '' });
    await fetchCommunities();
  };

  const handleDeleteCommunity = async (community) => {
    if (community.created_by !== currentUser.id) return;
    if (!window.confirm('Deseja apagar esta comunidade?')) return;

    setDeletingId(community.id);
    const { error } = await supabase
      .from('communities')
      .delete()
      .eq('id', community.id)
      .eq('created_by', currentUser.id);

    if (error) {
      setErrorMessage('Nao foi possivel apagar esta comunidade.');
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    await fetchCommunities();
  };

  const toggleMembership = async (communityId) => {
    const isJoined = joinedCommunityIds.includes(communityId);
    setJoiningId(communityId);

    if (membershipBackend === 'remote') {
      const { error } = isJoined
        ? await supabase
            .from('community_members')
            .delete()
            .eq('community_id', communityId)
            .eq('user_id', currentUser.id)
        : await supabase
            .from('community_members')
            .insert([{ community_id: communityId, user_id: currentUser.id }]);

      if (!error) {
        await loadMemberships();
        setJoiningId(null);
        return;
      }

      setMembershipBackend('local');
    }

    const nextJoinedIdsSet = new Set(joinedCommunityIds);
    if (isJoined) nextJoinedIdsSet.delete(communityId);
    else nextJoinedIdsSet.add(communityId);
    const nextJoinedIds = Array.from(nextJoinedIdsSet);
    setJoinedCommunityIds(nextJoinedIds);
    setLocalCommunityMembershipState(currentUser.id, nextJoinedIds);

    const localMembershipState = getLocalCommunityMembershipState(currentUser.id);
    const nextCounts = { ...localMembershipState.memberCountMap };
    communities.forEach((community) => {
      if (!nextCounts[community.id]) nextCounts[community.id] = 0;
    });
    setMemberCountMap(nextCounts);
    setJoiningId(null);
  };

  const filteredCommunities = communities
    .filter((community) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        community.name?.toLowerCase().includes(query) ||
        community.description?.toLowerCase().includes(query)
      );
    })
    .filter((community) => {
      if (activeFilter === 'mine') return community.created_by === currentUser.id;
      if (activeFilter === 'joined') return joinedCommunityIds.includes(community.id);
      return true;
    });

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white">Comunidades</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
          {showCreate ? <X className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />} {showCreate ? 'Cancelar' : 'Criar'}
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar comunidades..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-zinc-950 text-zinc-400'}`}>Todas</button>
          <button onClick={() => setActiveFilter('joined')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'joined' ? 'bg-violet-600 text-white' : 'bg-zinc-950 text-zinc-400'}`}>Participo</button>
          <button onClick={() => setActiveFilter('mine')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'mine' ? 'bg-violet-600 text-white' : 'bg-zinc-950 text-zinc-400'}`}>Criadas por mim</button>
        </div>
      </div>

      {membershipBackend === 'local' && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl px-4 py-3 text-xs">
          Modo local ativo para membros de comunidades (fallback automatico).
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-8 space-y-4">
          <input type="text" placeholder="Nome da Comunidade" required value={newComm.name} onChange={e => setNewComm({...newComm, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-violet-500 outline-none" />
          <textarea placeholder="Descricao" required value={newComm.description} onChange={e => setNewComm({...newComm, description: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-violet-500 outline-none" rows="3" />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-medium">Salvar Comunidade</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && <p className="text-sm text-zinc-500">Carregando comunidades...</p>}
        {!loading && filteredCommunities.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhuma comunidade encontrada.</p>
        )}
        {!loading && filteredCommunities.map((comm) => {
          const isJoined = joinedCommunityIds.includes(comm.id);
          const isOwner = comm.created_by === currentUser.id;
          return (
            <div key={comm.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-violet-500/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-xl font-bold text-white">{comm.name}</h3>
                {isOwner && (
                  <button
                    disabled={deletingId === comm.id}
                    onClick={() => handleDeleteCommunity(comm)}
                    className="text-zinc-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                    title="Apagar comunidade"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{comm.description}</p>
              <p className="text-xs text-zinc-500 mb-4">
                Criada por {comm.creator?.name || 'Usuario'} {comm.creator?.handle ? `(${comm.creator.handle})` : ''}
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md flex items-center"><Users className="w-3 h-3 mr-1" /> {memberCountMap[comm.id] || 0} membros</span>
                <button
                  disabled={joiningId === comm.id}
                  onClick={() => toggleMembership(comm.id)}
                  className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${isJoined ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-violet-600 text-white hover:bg-violet-700'} disabled:opacity-50`}
                >
                  {joiningId === comm.id ? 'Salvando...' : isJoined ? 'Sair' : 'Entrar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaylistsView({ currentUser, onOpenProfile }) {
  const [playlists, setPlaylists] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newPl, setNewPl] = useState({ name: '', url: '' });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const playlistPreview = parseSpotifyLink(newPl.url);

  useEffect(() => {
    fetchPlaylists();

    const channel = supabase
      .channel('playlists-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, fetchPlaylists)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchPlaylists = async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('playlists')
      .select('*, profiles(id, name, handle, avatar_url)')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Nao foi possivel carregar playlists.');
      setLoading(false);
      return;
    }

    setPlaylists(data || []);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newPl.name.trim();
    if (!name) return;
    if (!playlistPreview) {
      setErrorMessage('Use um link valido do Spotify para criar a playlist.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('playlists')
      .insert([{ name, spotify_url: playlistPreview.canonicalUrl, user_id: currentUser.id }]);

    if (error) {
      setErrorMessage('Nao foi possivel criar playlist.');
      setIsSaving(false);
      return;
    }

    setShowCreate(false);
    setNewPl({ name: '', url: '' });
    setIsSaving(false);
    setErrorMessage('');
    await fetchPlaylists();
  };

  const handleDeletePlaylist = async (playlist) => {
    if (playlist.user_id !== currentUser.id) return;
    if (!window.confirm('Deseja apagar esta playlist?')) return;

    setDeletingId(playlist.id);
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlist.id)
      .eq('user_id', currentUser.id);

    if (error) {
      setErrorMessage('Nao foi possivel apagar esta playlist.');
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    setErrorMessage('');
    await fetchPlaylists();
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Playlists</h2>
          <p className="text-zinc-400 text-sm">Partilhe as suas mixtapes favoritas.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
          {showCreate ? <X className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />} Nova
        </button>
      </div>

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-8 space-y-4">
          <input type="text" placeholder="Nome da Playlist" required value={newPl.name} onChange={e => setNewPl({...newPl, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-violet-500 outline-none" />
          <input type="text" placeholder="Link do Spotify" required value={newPl.url} onChange={e => setNewPl({...newPl, url: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-violet-500 outline-none" />
          {playlistPreview && <iframe src={playlistPreview.embedUrl} height={getSpotifyEmbedHeight(playlistPreview.type)} className="w-full rounded-xl" />}
          {newPl.url.trim() && !playlistPreview && <p className="text-xs text-red-400">Link invalido para preview.</p>}
          <button disabled={isSaving} type="submit" className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2 rounded-xl font-medium">Partilhar Playlist</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading && <p className="text-sm text-zinc-500">Carregando playlists...</p>}
        {!loading && playlists.length === 0 && (
          <p className="text-sm text-zinc-500">Ainda nao ha playlists partilhadas.</p>
        )}
        {!loading && playlists.map((pl) => {
          const parsed = parseSpotifyLink(pl.spotify_url);
          return (
            <div key={pl.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-lg font-bold text-white">{pl.name}</h3>
                {pl.user_id === currentUser.id && (
                  <button
                    disabled={deletingId === pl.id}
                    onClick={() => handleDeletePlaylist(pl)}
                    className="text-zinc-500 hover:text-red-400 disabled:opacity-50"
                    title="Apagar playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Por:{' '}
                <button
                  type="button"
                  onClick={() => pl.profiles?.id && onOpenProfile?.(pl.profiles)}
                  className="text-zinc-300 hover:text-violet-300 transition-colors"
                >
                  {pl.profiles?.name || 'Usuario'} {pl.profiles?.handle || ''}
                </button>
              </p>
              {parsed ? (
                <iframe src={parsed.embedUrl} height={getSpotifyEmbedHeight(parsed.type)} className="w-full rounded-xl" />
              ) : (
                <a className="text-sm text-emerald-400 hover:text-emerald-300" target="_blank" rel="noreferrer" href={pl.spotify_url}>
                  Abrir no Spotify
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AscensaoView({ currentUser, onOpenProfile }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [backendMode, setBackendMode] = useState('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [creatorRanking, setCreatorRanking] = useState([]);
  const [hotPosts, setHotPosts] = useState([]);
  const [talentPosts, setTalentPosts] = useState([]);
  const [likedPostIds, setLikedPostIds] = useState(() => getLocalAscensaoLikesState(currentUser.id));
  const [composerType, setComposerType] = useState('video');
  const [composer, setComposer] = useState({
    title: '',
    content: '',
    media_url: '',
    youtube_url: ''
  });
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const mediaInputRef = useRef(null);

  useEffect(() => {
    fetchAscensaoPosts();
  }, []);

  useEffect(() => {
    setLocalAscensaoLikesState(currentUser.id, likedPostIds);
  }, [currentUser.id, likedPostIds]);

  useEffect(() => (
    () => {
      if (mediaPreview && mediaPreview.startsWith('blob:')) {
        URL.revokeObjectURL(mediaPreview);
      }
    }
  ), [mediaPreview]);

  const clearComposerFile = () => {
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview('');
  };

  const updateDerivedData = (postsSource) => {
    const normalized = (postsSource || []).map(normalizeAscensaoPost);
    const orderedByDate = [...normalized].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setTalentPosts(orderedByDate);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rankingMap = {};

    orderedByDate.forEach((post) => {
      const profile = post.profiles || {};
      const entry = rankingMap[post.user_id] || {
        userId: post.user_id,
        name: profile.name || 'Usuario',
        handle: profile.handle || '@sem-handle',
        avatar_url: profile.avatar_url || '',
        posts: 0,
        likes: 0,
        recentPosts: 0,
        score: 0
      };

      entry.posts += 1;
      entry.likes += Number(post.likes_count || 0);
      if (new Date(post.created_at) >= sevenDaysAgo) entry.recentPosts += 1;
      entry.score = entry.likes * 4 + entry.posts * 2 + entry.recentPosts * 3;
      rankingMap[post.user_id] = entry;
    });

    const ranking = Object.values(rankingMap)
      .sort((a, b) => b.score - a.score || b.likes - a.likes || b.posts - a.posts)
      .slice(0, 10);

    const trending = [...orderedByDate]
      .sort((a, b) => Number(b.likes_count || 0) - Number(a.likes_count || 0) || new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);

    setCreatorRanking(ranking);
    setHotPosts(trending);
  };

  const fetchAscensaoPosts = async () => {
    setLoading(true);
    setErrorMessage('');

    const localPosts = getLocalAscensaoPostsState().map(normalizeAscensaoPost);
    const { data, error } = await supabase
      .from('ascensao_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setBackendMode('local');
      if (localPosts.length === 0) {
        setErrorMessage('Feed Ascensao em modo local. Partilhe o seu talento aqui.');
      }
      updateDerivedData(localPosts);
      setLoading(false);
      return;
    }

    setBackendMode('remote');
    const remotePosts = (data || []).map(normalizeAscensaoPost);
    const userIds = [...new Set(remotePosts.map((post) => post.user_id).filter(Boolean))];
    let profilesByUserId = {};

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, handle, avatar_url')
        .in('id', userIds);
      if (!profilesError && profilesData) {
        profilesByUserId = Object.fromEntries(profilesData.map((profile) => [profile.id, profile]));
      }
    }

    const mergedById = {};
    remotePosts.forEach((post) => {
      mergedById[String(post.id)] = {
        ...post,
        profiles: post.profiles || profilesByUserId[post.user_id] || null
      };
    });
    localPosts.forEach((post) => {
      if (!mergedById[String(post.id)]) mergedById[String(post.id)] = post;
    });

    const mergedPosts = Object.values(mergedById).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setLocalAscensaoPostsState(mergedPosts);
    updateDerivedData(mergedPosts);
    setLoading(false);
  };

  const handleMediaFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isVideoMode = composerType === 'video';
    const expectedPrefix = isVideoMode ? 'video/' : 'audio/';
    if (!file.type.startsWith(expectedPrefix)) {
      alert(isVideoMode ? 'Selecione um arquivo de video.' : 'Selecione um arquivo de audio.');
      return;
    }

    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handlePublishTalent = async (event) => {
    event.preventDefault();
    if (saving) return;

    const title = composer.title.trim();
    const content = composer.content.trim();
    let mediaUrl = composer.media_url.trim();
    const youtubeInput = composer.youtube_url.trim();
    let youtubeParsed = null;

    if (composerType === 'youtube') {
      youtubeParsed = parseYouTubeLink(youtubeInput);
      if (!youtubeParsed) {
        alert('Cole um link valido do YouTube.');
        return;
      }
      mediaUrl = youtubeParsed.canonicalUrl;
    }

    if (composerType !== 'youtube' && mediaFile) {
      try {
        const ext = (mediaFile.name.split('.').pop() || (composerType === 'video' ? 'mp4' : 'mp3')).toLowerCase();
        const filePath = `ascensao/${currentUser.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, mediaFile, { upsert: true });

        if (uploadError || !uploadData?.path) {
          throw new Error(uploadError?.message || 'Falha ao enviar midia.');
        }
        mediaUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl;
      } catch {
        if (backendMode === 'local' && mediaPreview) {
          mediaUrl = mediaPreview;
        } else {
          alert('Nao foi possivel enviar o arquivo de midia.');
          return;
        }
      }
    }

    if (!mediaUrl) {
      alert(composerType === 'youtube'
        ? 'Informe um link do YouTube.'
        : `Informe uma URL ou envie um arquivo de ${composerType === 'video' ? 'video' : 'audio'}.`);
      return;
    }

    if (!title && !content) {
      alert('Adicione um titulo ou descricao para o seu talento.');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const localId = `local-${Date.now()}`;
    const basePost = {
      user_id: currentUser.id,
      title,
      content,
      post_kind: composerType,
      media_url: mediaUrl,
      likes_count: 0,
      created_at: now
    };

    let createdPost = normalizeAscensaoPost({
      id: localId,
      ...basePost,
      profiles: {
        name: currentUser.name,
        handle: currentUser.handle,
        avatar_url: currentUser.avatar_url
      }
    });

    if (backendMode !== 'local') {
      const { data, error } = await supabase
        .from('ascensao_posts')
        .insert([basePost])
        .select('*')
        .single();

      if (!error && data) {
        createdPost = normalizeAscensaoPost({
          ...data,
          profiles: {
            name: currentUser.name,
            handle: currentUser.handle,
            avatar_url: currentUser.avatar_url
          }
        });
      } else {
        setBackendMode('local');
      }
    }

    const nextPosts = [createdPost, ...talentPosts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setLocalAscensaoPostsState(nextPosts);
    updateDerivedData(nextPosts);

    setComposer({ title: '', content: '', media_url: '', youtube_url: '' });
    clearComposerFile();
    setSaving(false);
    setErrorMessage('');
  };

  const toggleAscensaoLike = async (postId) => {
    const postKey = String(postId);
    const hasLiked = likedPostIds.includes(postKey);
    const nextLikedPostIds = hasLiked
      ? likedPostIds.filter((id) => id !== postKey)
      : [...likedPostIds, postKey];
    setLikedPostIds(nextLikedPostIds);

    const nextPosts = talentPosts.map((post) => {
      if (String(post.id) !== postKey) return post;
      return {
        ...post,
        likes_count: Math.max(0, Number(post.likes_count || 0) + (hasLiked ? -1 : 1))
      };
    });

    setLocalAscensaoPostsState(nextPosts);
    updateDerivedData(nextPosts);

    if (backendMode !== 'remote' || postKey.startsWith('local-')) return;
    const updatedPost = nextPosts.find((post) => String(post.id) === postKey);
    if (!updatedPost) return;

    const { error } = await supabase
      .from('ascensao_posts')
      .update({ likes_count: Number(updatedPost.likes_count || 0) })
      .eq('id', postId);

    if (error) setBackendMode('local');
  };

  const handleDeleteTalentPost = async (post) => {
    if (!post || post.user_id !== currentUser.id) return;
    if (!window.confirm('Tem certeza que deseja excluir este post da Ascensao?')) return;

    const postKey = String(post.id);
    setDeletingPostId(postKey);

    try {
      if (backendMode === 'remote' && !postKey.startsWith('local-')) {
        const { error } = await supabase
          .from('ascensao_posts')
          .delete()
          .eq('id', post.id)
          .eq('user_id', currentUser.id);

        if (error) {
          alert('Nao foi possivel excluir o post.');
          return;
        }
      }

      const nextPosts = talentPosts.filter((item) => String(item.id) !== postKey);
      const nextLikedPostIds = likedPostIds.filter((id) => id !== postKey);
      setLikedPostIds(nextLikedPostIds);
      setLocalAscensaoPostsState(nextPosts);
      updateDerivedData(nextPosts);
    } finally {
      setDeletingPostId(null);
    }
  };

  const renderComposerPreview = () => {
    if (composerType === 'youtube') {
      const parsed = parseYouTubeLink(composer.youtube_url.trim());
      if (!parsed) return null;
      return (
        <iframe
          src={parsed.embedUrl}
          className="w-full rounded-xl mt-3"
          height="260"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    const source = mediaPreview || composer.media_url.trim();
    if (!source) return null;
    if (composerType === 'video') {
      return <video src={source} controls className="w-full rounded-xl mt-3 max-h-[360px] bg-black" />;
    }
    return <audio src={source} controls className="w-full mt-3" />;
  };

  return (
    <div className="p-4 md:p-8">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
        <h2 className="text-3xl font-extrabold mb-2 flex items-center relative z-10"><TrendingUp className="w-8 h-8 mr-3" /> Ascensao</h2>
        <p className="max-w-2xl text-violet-100 opacity-90 relative z-10">Area dedicada para crescer musicalmente: publique videos, audios autorais e clips do YouTube.</p>
        <button onClick={fetchAscensaoPosts} className="mt-4 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg text-sm font-semibold relative z-10">Atualizar feed</button>
        <TrendingUp className="absolute -right-4 -bottom-4 w-48 h-48 text-white opacity-10" />
      </div>

      {errorMessage && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handlePublishTalent} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'video', label: 'Video', icon: <Play className="w-4 h-4" /> },
            { id: 'audio', label: 'Audio Autoral', icon: <Music className="w-4 h-4" /> },
            { id: 'youtube', label: 'Clip YouTube', icon: <LinkIcon className="w-4 h-4" /> }
          ].map((typeOption) => (
            <button
              key={typeOption.id}
              type="button"
              onClick={() => {
                setComposerType(typeOption.id);
                clearComposerFile();
                setComposer((prev) => ({ ...prev, media_url: '', youtube_url: '' }));
              }}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                composerType === typeOption.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {typeOption.icon}
              {typeOption.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Titulo do talento"
            value={composer.title}
            onChange={(event) => setComposer((prev) => ({ ...prev, title: event.target.value }))}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500"
          />
          {composerType === 'youtube' ? (
            <input
              type="text"
              placeholder="Link do YouTube"
              value={composer.youtube_url}
              onChange={(event) => setComposer((prev) => ({ ...prev, youtube_url: event.target.value }))}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500"
            />
          ) : (
            <input
              type="text"
              placeholder={composerType === 'video' ? 'URL do video (opcional)' : 'URL do audio (opcional)'}
              value={composer.media_url}
              onChange={(event) => setComposer((prev) => ({ ...prev, media_url: event.target.value }))}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500"
            />
          )}
        </div>

        <textarea
          placeholder="Descreva seu som, estilo ou contexto do talento..."
          value={composer.content}
          onChange={(event) => setComposer((prev) => ({ ...prev, content: event.target.value }))}
          rows={3}
          className="mt-3 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 resize-none"
        />

        {composerType !== 'youtube' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={mediaInputRef}
              type="file"
              accept={composerType === 'video' ? 'video/*' : 'audio/*'}
              onChange={handleMediaFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium"
            >
              <ImageIcon className="w-4 h-4" />
              Enviar arquivo
            </button>
            {mediaFile && (
              <button
                type="button"
                onClick={clearComposerFile}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-red-300 hover:bg-zinc-700 text-sm"
              >
                <X className="w-4 h-4" />
                Remover arquivo
              </button>
            )}
            {mediaFile && <p className="text-xs text-zinc-500 truncate">{mediaFile.name}</p>}
          </div>
        )}

        {renderComposerPreview()}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {backendMode === 'local'
              ? 'Modo local ativo para Ascensao.'
              : 'Feed dedicado da Ascensao (separado do Feed geral).'}
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            <PlusCircle className="w-4 h-4" />
            {saving ? 'Publicando...' : 'Publicar Talento'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center"><Music className="w-5 h-5 mr-2 text-violet-400" /> Showcase de Talentos</h3>
          {loading && <p className="text-sm text-zinc-500">Carregando posts da Ascensao...</p>}
          {!loading && talentPosts.length === 0 && (
            <p className="text-sm text-zinc-500">Ainda nao ha talentos publicados nesta area.</p>
          )}
          {!loading && talentPosts.length > 0 && (
            <div className="space-y-4">
              {talentPosts.map((post) => {
                const postKey = String(post.id);
                const hasLiked = likedPostIds.includes(postKey);
                const isAuthor = currentUser?.id === post.user_id;
                const isDeleting = deletingPostId === postKey;
                const youtube = post.post_kind === 'youtube' ? (post.youtube || parseYouTubeLink(post.media_url)) : null;
                return (
                  <div key={post.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => post.user_id && onOpenProfile?.(post.user_id)}
                          className="text-sm font-semibold text-white truncate hover:text-violet-300 transition-colors"
                        >
                          {post.profiles?.name || 'Usuario'}
                        </button>
                        <p className="text-xs text-zinc-500 truncate">{post.profiles?.handle || '@sem-handle'} • {new Date(post.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] uppercase tracking-wide text-zinc-400 bg-zinc-800 px-2 py-1 rounded-md">{post.post_kind}</span>
                        {isAuthor && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTalentPost(post)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:text-red-300 hover:bg-zinc-700 disabled:opacity-50"
                            title="Excluir post"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isDeleting ? 'Excluindo...' : 'Excluir'}
                          </button>
                        )}
                      </div>
                    </div>

                    {post.title && <h4 className="text-base font-bold text-white mb-1">{post.title}</h4>}
                    {post.content && <p className="text-sm text-zinc-300 mb-3 whitespace-pre-wrap">{post.content}</p>}

                    {post.post_kind === 'youtube' && youtube && (
                      <iframe
                        src={youtube.embedUrl}
                        className="w-full rounded-xl"
                        height="280"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    )}
                    {post.post_kind === 'video' && post.media_url && (
                      <video src={post.media_url} controls className="w-full rounded-xl max-h-[420px] bg-black" />
                    )}
                    {post.post_kind === 'audio' && post.media_url && (
                      <audio src={post.media_url} controls className="w-full" />
                    )}

                    <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
                      <button
                        disabled={isDeleting}
                        onClick={() => toggleAscensaoLike(post.id)}
                        className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
                          hasLiked ? 'text-pink-400' : 'text-zinc-400 hover:text-pink-400'
                        } disabled:opacity-50`}
                      >
                        <Heart className={`w-4 h-4 ${hasLiked ? 'fill-pink-400 text-pink-400' : ''}`} />
                        {post.likes_count || 0}
                      </button>
                      {post.post_kind === 'youtube' && post.media_url && (
                        <a href={post.media_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300">
                          Abrir no YouTube
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center"><Award className="w-5 h-5 mr-2 text-amber-400" /> Top Criadores</h3>
            {loading && <p className="text-sm text-zinc-500">Calculando ranking...</p>}
            {!loading && creatorRanking.length === 0 && (
              <p className="text-sm text-zinc-500">Ainda nao ha dados para ranking.</p>
            )}
            {!loading && creatorRanking.length > 0 && (
              <div className="space-y-3">
                {creatorRanking.map((creator, index) => (
                  <div key={creator.userId} className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${currentUser?.id === creator.userId ? 'border-violet-500/60 bg-violet-500/10' : 'border-zinc-800 bg-zinc-950/70'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-200 text-xs font-bold flex items-center justify-center">#{index + 1}</div>
                      <button
                        type="button"
                        onClick={() => creator.userId && onOpenProfile?.(creator.userId)}
                        className="flex items-center gap-3 min-w-0 text-left group/rank"
                      >
                        <img src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.name}`} className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate group-hover/rank:text-violet-300 transition-colors">{creator.name}</p>
                          <p className="text-xs text-zinc-500 truncate">{creator.handle || '@sem-handle'}</p>
                        </div>
                      </button>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">{creator.score} pts</p>
                      <p className="text-[11px] text-zinc-500">{creator.likes} likes - {creator.posts} posts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center"><Star className="w-5 h-5 mr-2 text-violet-400" /> Em Alta na Ascensao</h3>
            {loading && <p className="text-sm text-zinc-500">Buscando destaques...</p>}
            {!loading && hotPosts.length === 0 && (
              <p className="text-sm text-zinc-500">Sem destaques no momento.</p>
            )}
            {!loading && hotPosts.length > 0 && (
              <div className="space-y-3">
                {hotPosts.map((post) => (
                  <div key={`hot-${post.id}`} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                    <button
                      type="button"
                      onClick={() => post.user_id && onOpenProfile?.(post.user_id)}
                      className="text-sm font-semibold text-white truncate hover:text-violet-300 transition-colors text-left"
                    >
                      {post.title || post.profiles?.name || 'Talento'}
                    </button>
                    <p className="text-xs text-zinc-500 mt-1 truncate">{post.profiles?.handle || '@sem-handle'} - {post.post_kind}</p>
                    {post.content && <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{post.content}</p>}
                    <p className="text-xs text-pink-400 mt-2 font-semibold">{post.likes_count || 0} likes</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileView({ user, setUser, viewerUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: user.name, bio: user.bio || '', handle: user.handle });
  const [uploading, setUploading] = useState(false);
  const [capsuleData, setCapsuleData] = useState(null);
  const [activeProfileTab, setActiveProfileTab] = useState('posts');
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [collectionsMessage, setCollectionsMessage] = useState('');
  const [followsMode, setFollowsMode] = useState('checking');
  const [followStats, setFollowStats] = useState(() => getLocalFollowStats(user.id));
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profilePosts, setProfilePosts] = useState([]);
  const [profilePlaylists, setProfilePlaylists] = useState([]);
  const [profileCommunities, setProfileCommunities] = useState([]);
  const [profileAscensaoPosts, setProfileAscensaoPosts] = useState([]);

  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  const spotifyToken = window.localStorage.getItem('spotify_token');
  const isOwnProfile = String(user?.id || '') === String(viewerUser?.id || '');

  useEffect(() => {
    setEditForm({ name: user.name, bio: user.bio || '', handle: user.handle });
  }, [user.id, user.name, user.bio, user.handle]);

  useEffect(() => {
    if (spotifyToken && !capsuleData) {
      fetch('https://api.spotify.com/v1/me/top/artists?limit=4', {
        headers: { Authorization: `Bearer ${spotifyToken}` }
      })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.items) setCapsuleData(data.items);
      })
      .catch(console.error);
    }
  }, [spotifyToken, capsuleData]);

  useEffect(() => {
    setIsEditing(false);
    loadFollowStats();
    loadProfileCollections();
    loadFollowingState();
  }, [user.id, viewerUser?.id]);

  const loadFollowStats = async () => {
    const localStats = getLocalFollowStats(user.id);
    setFollowStats(localStats);

    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_id, following_id')
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

    if (error) {
      setFollowsMode('local');
      return;
    }

    let followers = 0;
    const followingSet = new Set();
    const currentUserId = String(user.id);

    (data || []).forEach((entry) => {
      const followerId = String(entry.follower_id || '');
      const followingId = String(entry.following_id || '');

      if (followingId === currentUserId && followerId && followerId !== currentUserId) {
        followers += 1;
      }
      if (followerId === currentUserId && followingId && followingId !== currentUserId) {
        followingSet.add(followingId);
      }
    });

    setFollowStats({
      followers,
      following: followingSet.size
    });
    setFollowsMode('remote');
  };

  const loadFollowingState = async () => {
    if (!viewerUser?.id || !user?.id || isOwnProfile) {
      setIsFollowingProfile(false);
      return;
    }

    const localFollowing = isUserFollowingLocally(viewerUser.id, user.id);
    setIsFollowingProfile(localFollowing);

    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('follower_id', viewerUser.id)
      .eq('following_id', user.id)
      .limit(1);

    if (error) {
      setFollowsMode('local');
      return;
    }

    setIsFollowingProfile(Array.isArray(data) && data.length > 0);
  };

  const toggleFollowProfile = async () => {
    if (!viewerUser?.id || !user?.id || isOwnProfile || followLoading) return;

    const followerId = viewerUser.id;
    const followingId = user.id;
    const nextFollowing = !isFollowingProfile;

    setFollowLoading(true);
    setIsFollowingProfile(nextFollowing);
    setFollowStats((prev) => ({
      ...prev,
      followers: Math.max(0, Number(prev.followers || 0) + (nextFollowing ? 1 : -1))
    }));
    setLocalFollowRelation(followerId, followingId, nextFollowing);

    const { error } = nextFollowing
      ? await supabase.from('user_follows').insert([{ follower_id: followerId, following_id: followingId }])
      : await supabase.from('user_follows').delete().eq('follower_id', followerId).eq('following_id', followingId);

    if (error) {
      setFollowsMode('local');
    } else {
      setFollowsMode('remote');
    }

    setFollowLoading(false);
  };

  const loadProfileCollections = async () => {
    setLoadingCollections(true);
    setCollectionsMessage('');

    const localMembershipState = getLocalCommunityMembershipState(user.id);
    const localAscensaoPosts = getLocalAscensaoPostsState()
      .map(normalizeAscensaoPost)
      .filter((post) => String(post.user_id) === String(user.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const [postsRes, playlistsRes, createdCommunitiesRes, membershipsRes, ascensaoRes] = await Promise.all([
      supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('playlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('communities').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
      supabase.from('community_members').select('community_id').eq('user_id', user.id),
      supabase.from('ascensao_posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);

    setProfilePosts(postsRes.error ? [] : (postsRes.data || []));
    setProfilePlaylists(playlistsRes.error ? [] : (playlistsRes.data || []));

    const createdCommunities = createdCommunitiesRes.error ? [] : (createdCommunitiesRes.data || []);
    const combinedMap = new Map();
    createdCommunities.forEach((community) => {
      combinedMap.set(String(community.id), { ...community, relation: 'owner' });
    });

    const remoteJoinedIds = membershipsRes.error
      ? []
      : (membershipsRes.data || []).map((membership) => membership.community_id);

    const joinedIds = Array.from(new Set([
      ...remoteJoinedIds,
      ...(localMembershipState.joinedIds || [])
    ].map((id) => String(id)).filter(Boolean)));

    const missingJoinedIds = joinedIds.filter((communityId) => !combinedMap.has(String(communityId)));
    if (missingJoinedIds.length > 0) {
      const { data: joinedCommunitiesData, error: joinedCommunitiesError } = await supabase
        .from('communities')
        .select('*')
        .in('id', missingJoinedIds);

      if (!joinedCommunitiesError && joinedCommunitiesData) {
        joinedCommunitiesData.forEach((community) => {
          const key = String(community.id);
          if (!combinedMap.has(key)) combinedMap.set(key, { ...community, relation: 'member' });
        });
      }
    }

    const communityIds = Array.from(combinedMap.keys());
    const remoteMemberCountMap = {};

    if (communityIds.length > 0) {
      const { data: membersData, error: membersError } = await supabase
        .from('community_members')
        .select('community_id, user_id')
        .in('community_id', communityIds);

      if (!membersError && membersData) {
        const membersByCommunity = {};

        membersData.forEach((membership) => {
          const key = String(membership.community_id);
          if (!membersByCommunity[key]) membersByCommunity[key] = new Set();
          if (membership.user_id) membersByCommunity[key].add(String(membership.user_id));
        });

        Array.from(combinedMap.values()).forEach((community) => {
          const key = String(community.id);
          if (!membersByCommunity[key]) membersByCommunity[key] = new Set();
          if (community.created_by) membersByCommunity[key].add(String(community.created_by));
          remoteMemberCountMap[key] = membersByCommunity[key].size;
        });
      }
    }

    const localMemberCountMap = localMembershipState.memberCountMap || {};
    const nextCommunities = Array.from(combinedMap.values())
      .map((community) => {
        const key = String(community.id);
        const ownerFallback = community.created_by ? 1 : 0;
        const remoteCount = Number(remoteMemberCountMap[key] || 0);
        const localCount = Number(localMemberCountMap[key] || 0);
        const memberCount = Math.max(remoteCount, localCount, ownerFallback);
        return { ...community, member_count: memberCount };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setProfileCommunities(nextCommunities);

    if (ascensaoRes.error) {
      setProfileAscensaoPosts(localAscensaoPosts);
    } else {
      const remoteAscensao = (ascensaoRes.data || [])
        .map(normalizeAscensaoPost)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setProfileAscensaoPosts(remoteAscensao);
    }

    if (postsRes.error && playlistsRes.error && createdCommunitiesRes.error && ascensaoRes.error) {
      setCollectionsMessage('Nao foi possivel carregar os dados do perfil no servidor. Mostrando o que existe localmente.');
    }

    setLoadingCollections(false);
  };

  const handleSpotifyConnect = () => {
    const clientId = 'aeed4c6250654ee6b74e806422f15a3b';
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    const scope = encodeURIComponent('user-top-read user-read-private');
    window.location.href = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  const handleImageUpload = async (event, field) => {
    if (!isOwnProfile) return;
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;

    const { data: uploadData } = await supabase.storage.from('media').upload(`${user.id}/${fileName}`, file);
    if (uploadData?.path) {
      const url = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ [field]: url }).eq('id', user.id);
      if (!error) setUser({ ...user, [field]: url });
    }

    setUploading(false);
  };

  const handleSave = async () => {
    if (!isOwnProfile) return;
    const { error } = await supabase.from('profiles').update(editForm).eq('id', user.id);
    if (!error) {
      setUser({ ...user, ...editForm });
      setIsEditing(false);
    }
  };

  const tabItems = [
    { id: 'posts', label: `Posts (${profilePosts.length})` },
    { id: 'playlists', label: `Playlists (${profilePlaylists.length})` },
    { id: 'communities', label: `Comunidades (${profileCommunities.length})` },
    { id: 'ascensao', label: `Ascensao (${profileAscensaoPosts.length})` }
  ];

  const renderPostsTab = () => {
    if (!profilePosts.length) {
      return <p className="text-sm text-zinc-500">Voce ainda nao publicou no feed principal.</p>;
    }

    return (
      <div className="space-y-4">
        {profilePosts.map((post) => {
          const spotifyData = parseSpotifyLink(post.spotify_url);
          return (
            <div key={`profile-post-${post.id}`} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-2">{new Date(post.created_at).toLocaleDateString()}</p>
              {post.content && <p className="text-sm text-zinc-200 whitespace-pre-wrap mb-3">{post.content}</p>}
              {post.media_url && post.media_type === 'image' && (
                <img src={post.media_url} className="rounded-xl w-full object-cover max-h-80 mb-3" />
              )}
              {spotifyData && (
                <iframe
                  src={spotifyData.embedUrl}
                  className="w-full rounded-xl"
                  height={getSpotifyEmbedHeight(spotifyData.type)}
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
              )}
              {!spotifyData && post.spotify_url && (
                <a href={post.spotify_url} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300">
                  Abrir no Spotify
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPlaylistsTab = () => {
    if (!profilePlaylists.length) {
      return <p className="text-sm text-zinc-500">Voce ainda nao compartilhou playlists.</p>;
    }

    return (
      <div className="space-y-4">
        {profilePlaylists.map((playlist) => {
          const spotifyData = parseSpotifyLink(playlist.spotify_url);
          return (
            <div key={`profile-playlist-${playlist.id}`} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <h4 className="text-base font-bold text-white mb-1">{playlist.name || 'Playlist sem nome'}</h4>
              {playlist.description && <p className="text-sm text-zinc-300 mb-3">{playlist.description}</p>}
              {spotifyData ? (
                <iframe
                  src={spotifyData.embedUrl}
                  className="w-full rounded-xl"
                  height={getSpotifyEmbedHeight(spotifyData.type)}
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
              ) : (
                <a href={playlist.spotify_url} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300">
                  Abrir no Spotify
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCommunitiesTab = () => {
    if (!profileCommunities.length) {
      return <p className="text-sm text-zinc-500">Voce ainda nao participa de comunidades.</p>;
    }

    return (
      <div className="space-y-4">
        {profileCommunities.map((community) => (
          <div key={`profile-community-${community.id}`} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h4 className="text-base font-bold text-white">{community.name}</h4>
              <span className={`text-xs px-2 py-1 rounded-md ${community.relation === 'owner' ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-300'}`}>
                {community.relation === 'owner' ? 'Criador' : 'Membro'}
              </span>
              <span className={`text-xs px-2 py-1 rounded-md ${community.is_public === false ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {community.is_public === false ? 'Privada' : 'Publica'}
              </span>
            </div>
            <p className="text-sm text-zinc-300 mb-3">{community.description || 'Sem descricao.'}</p>
            <p className="text-xs text-zinc-500">{community.member_count || 0} membros</p>
          </div>
        ))}
      </div>
    );
  };

  const renderAscensaoTab = () => {
    if (!profileAscensaoPosts.length) {
      return <p className="text-sm text-zinc-500">Voce ainda nao publicou na area Ascensao.</p>;
    }

    return (
      <div className="space-y-4">
        {profileAscensaoPosts.map((post) => {
          const youtubeData = post.post_kind === 'youtube'
            ? (post.youtube || parseYouTubeLink(post.media_url))
            : null;

          return (
            <div key={`profile-ascensao-${post.id}`} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs text-zinc-500">{new Date(post.created_at).toLocaleDateString()}</p>
                <span className="text-[11px] uppercase tracking-wide text-zinc-400 bg-zinc-800 px-2 py-1 rounded-md">{post.post_kind}</span>
              </div>
              {post.title && <h4 className="text-base font-bold text-white mb-1">{post.title}</h4>}
              {post.content && <p className="text-sm text-zinc-300 mb-3 whitespace-pre-wrap">{post.content}</p>}
              {post.post_kind === 'youtube' && youtubeData && (
                <iframe
                  src={youtubeData.embedUrl}
                  className="w-full rounded-xl"
                  height="280"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
              {post.post_kind === 'video' && post.media_url && (
                <video src={post.media_url} controls className="w-full rounded-xl max-h-[420px] bg-black" />
              )}
              {post.post_kind === 'audio' && post.media_url && (
                <audio src={post.media_url} controls className="w-full" />
              )}
              <p className="text-xs text-pink-400 mt-3 font-semibold">{post.likes_count || 0} likes</p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActiveTabContent = () => {
    if (loadingCollections) {
      return <p className="text-sm text-zinc-500">Carregando conteudo do perfil...</p>;
    }

    if (activeProfileTab === 'posts') return renderPostsTab();
    if (activeProfileTab === 'playlists') return renderPlaylistsTab();
    if (activeProfileTab === 'communities') return renderCommunitiesTab();
    return renderAscensaoTab();
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative mb-8 shadow-xl">
        <div className="h-48 bg-zinc-800 relative group">
          {user.cover_url ? <img src={user.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-r from-violet-900 to-zinc-900" />}
          {isOwnProfile && isEditing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <input type="file" ref={coverRef} onChange={(event) => handleImageUpload(event, 'cover_url')} className="hidden" accept="image/*" />
              <button onClick={() => coverRef.current?.click()} className="bg-white/20 p-2 rounded-full text-white hover:bg-white/40"><Camera className="w-6 h-6" /></button>
            </div>
          )}
          <div className="absolute top-4 right-4 space-x-2 z-10">
            {isOwnProfile ? (
              !isEditing ? (
                <button onClick={() => setIsEditing(true)} className="bg-black/50 hover:bg-black/70 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-medium flex items-center"><Edit3 className="w-4 h-4 mr-2" /> Editar</button>
              ) : (
                <div className="flex space-x-2">
                  <button onClick={() => setIsEditing(false)} className="bg-zinc-800 text-white px-4 py-2 rounded-full text-sm font-medium">Cancelar</button>
                  <button onClick={handleSave} disabled={uploading} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center"><Check className="w-4 h-4 mr-1" /> Salvar</button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={toggleFollowProfile}
                disabled={followLoading}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isFollowingProfile ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'bg-violet-600 text-white hover:bg-violet-700'} disabled:opacity-60`}
              >
                {followLoading ? 'Salvando...' : isFollowingProfile ? 'Seguindo' : 'Seguir'}
              </button>
            )}
          </div>
        </div>

        <div className="px-8 pb-8 relative">
          <div className="relative inline-block -mt-16 mb-4 group">
            <img src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} className="w-32 h-32 rounded-full border-4 border-zinc-900 bg-zinc-800 object-cover" />
            {isOwnProfile && isEditing && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => avatarRef.current?.click()}>
                <input type="file" ref={avatarRef} onChange={(event) => handleImageUpload(event, 'avatar_url')} className="hidden" accept="image/*" />
                <Camera className="w-8 h-8 text-white" />
              </div>
            )}
          </div>

          {isOwnProfile && isEditing ? (
            <div className="space-y-4 max-w-md">
              <input type="text" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
              <input type="text" value={editForm.handle} onChange={(event) => setEditForm({ ...editForm, handle: event.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
              <textarea value={editForm.bio} onChange={(event) => setEditForm({ ...editForm, bio: event.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white resize-none" rows={3} />
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{user.name}</h1>
              <p className="text-zinc-400 font-medium mb-4">{user.handle}</p>
              <p className="text-zinc-300 max-w-xl">{user.bio || 'Sem biografia.'}</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Seguidores</p>
              <p className="text-2xl font-bold text-white mt-1">{followStats.followers}</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Seguindo</p>
              <p className="text-2xl font-bold text-white mt-1">{followStats.following}</p>
            </div>
          </div>
          {followsMode === 'local' && (
            <p className="text-xs text-zinc-500 mt-2">Contagem em modo local.</p>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-8">
        <div className="flex flex-wrap gap-2 mb-5">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveProfileTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeProfileTab === tab.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {collectionsMessage && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl px-4 py-3 text-sm">
            {collectionsMessage}
          </div>
        )}

        {renderActiveTabContent()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Headphones className="h-6 w-6 mr-2 text-emerald-500" /> Conexao Spotify</h3>
          <p className="text-zinc-400 text-sm mb-6">Conecte sua conta para sincronizar a Capsula do Tempo.</p>
          <button onClick={handleSpotifyConnect} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors ${spotifyToken ? 'bg-zinc-800 text-emerald-500 hover:bg-zinc-700' : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'}`}>
            {spotifyToken ? <><Check className="w-5 h-5 mr-2" /> Conectado</> : 'Conectar'}
          </button>
        </div>

        <div className={`border rounded-2xl p-6 relative overflow-hidden ${spotifyToken ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-950 border-zinc-900 opacity-50'}`}>
          <h3 className="text-lg font-bold text-white mb-4 relative z-10">Capsula do Tempo</h3>
          {spotifyToken && capsuleData ? (
            <div className="relative z-10">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Seus artistas mais ouvidos</p>
              <div className="space-y-3">
                {capsuleData.map((artist) => (
                  <div key={artist.id} className="flex items-center space-x-3 bg-zinc-950 p-2 rounded-lg border border-zinc-800/50">
                    <img src={artist.images[0]?.url} className="w-10 h-10 rounded-full object-cover" />
                    <span className="text-sm font-semibold text-white">{artist.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm font-medium text-center pt-8">Conecte o Spotify para desbloquear.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-center md:justify-start px-3 py-3 rounded-xl transition-all ${active ? 'bg-violet-600/10 text-violet-400 font-bold' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white font-medium'}`}>
      <div className={active ? "text-violet-500" : ""}>{React.cloneElement(icon, { className: 'w-6 h-6' })}</div>
      <span className="hidden md:block ml-4">{label}</span>
    </button>
  );
}

function MobileBottomNav({ items, activeTab, onSelect }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.35rem)' }}
    >
      <div className="grid grid-cols-6 gap-1 px-1 pt-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors ${
                isActive ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-violet-400' : ''}`} />
              <span className="text-[10px] leading-none font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}






