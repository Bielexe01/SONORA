import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, MessageCircle, Users, ListMusic, TrendingUp, User, 
  Heart, MessageSquare, Share2, Play, Music, Edit3, 
  Check, X, Search, PlusCircle, Headphones, Star, Award, 
  LogOut, Image as ImageIcon, Link as LinkIcon, Trash2, Send, Camera, Chrome,
  Mail, Lock, Eye, EyeOff, Github, ChevronRight, Disc,
  ShoppingBag, CalendarDays, MapPin, Ticket, Flag, UserX, Bell
} from 'lucide-react';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';
import { motion, useMotionValue, useSpring } from 'framer-motion';
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
const AVAILABLE_APP_TABS = new Set(['feed', 'direct', 'communities', 'playlists', 'shopping', 'events', 'notifications', 'ascensao', 'profile']);
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const SPOTIFY_TOKEN_STORAGE_KEY = 'spotify_token';
const SPOTIFY_AUTH_DATA_STORAGE_KEY = 'sonora_spotify_auth_data';
const SPOTIFY_PKCE_VERIFIER_STORAGE_KEY = 'sonora_spotify_pkce_verifier';
const SPOTIFY_PKCE_STATE_STORAGE_KEY = 'sonora_spotify_pkce_state';
const APP_NAV_ITEMS = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'direct', label: 'Direct', icon: MessageCircle },
  { id: 'communities', label: 'Comunidades', icon: Users },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'events', label: 'Eventos', icon: CalendarDays },
  { id: 'notifications', label: 'Notificacoes', icon: Bell },
  { id: 'ascensao', label: 'Ascensao', icon: TrendingUp },
  { id: 'profile', label: 'Perfil', icon: User }
];

const SPOTIFY_CAPSULE_PERIODS = [
  { id: 'short_term', label: '4 semanas' },
  { id: 'medium_term', label: '6 meses' },
  { id: 'long_term', label: 'Sempre' }
];

const getSpotifyRedirectUri = () => {
  const configured = String(import.meta.env.VITE_SPOTIFY_REDIRECT_URI || '').trim();
  if (configured) return configured;
  return `${window.location.origin}/`;
};

const getSpotifyAuthData = () => {
  try {
    const raw = window.localStorage.getItem(SPOTIFY_AUTH_DATA_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const setSpotifyAuthData = (authData) => {
  if (!authData || typeof authData !== 'object') return;
  window.localStorage.setItem(SPOTIFY_AUTH_DATA_STORAGE_KEY, JSON.stringify(authData));
  if (authData.access_token) window.localStorage.setItem(SPOTIFY_TOKEN_STORAGE_KEY, authData.access_token);
};

const clearSpotifyAuthData = () => {
  window.localStorage.removeItem(SPOTIFY_AUTH_DATA_STORAGE_KEY);
  window.localStorage.removeItem(SPOTIFY_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(SPOTIFY_PKCE_VERIFIER_STORAGE_KEY);
  window.localStorage.removeItem(SPOTIFY_PKCE_STATE_STORAGE_KEY);
};

const createRandomString = (length = 64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => chars[value % chars.length]).join('');
};

const toBase64Url = (arrayBuffer) => (
  btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
);

const createCodeChallenge = async (verifier) => {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(digest);
};

const exchangeSpotifyCodeForTokens = async ({ code, codeVerifier }) => {
  if (!SPOTIFY_CLIENT_ID) throw new Error('Spotify client id ausente.');
  const payload = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getSpotifyRedirectUri(),
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });

  if (!response.ok) throw new Error('Falha ao trocar codigo do Spotify por token.');
  return response.json();
};

const refreshSpotifyAccessToken = async (refreshToken) => {
  if (!refreshToken || !SPOTIFY_CLIENT_ID) return null;

  const payload = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });

  if (!response.ok) return null;
  return response.json();
};

const getValidSpotifyAccessToken = async () => {
  const authData = getSpotifyAuthData();
  if (!authData?.access_token) return window.localStorage.getItem(SPOTIFY_TOKEN_STORAGE_KEY) || null;

  const expiresAt = Number(authData.expires_at || 0);
  const isStillValid = Number.isFinite(expiresAt) && Date.now() < expiresAt - 30 * 1000;
  if (isStillValid) return authData.access_token;

  const refreshed = await refreshSpotifyAccessToken(authData.refresh_token);
  if (!refreshed?.access_token) return null;

  const nextAuthData = {
    ...authData,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || authData.refresh_token,
    scope: refreshed.scope || authData.scope,
    token_type: refreshed.token_type || authData.token_type,
    expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000
  };
  setSpotifyAuthData(nextAuthData);
  return nextAuthData.access_token;
};

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

const clampPercent = (value, fallback = 50) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, Math.round(parsed)));
};

const parseLocalDateTimeToIso = (localDateTime) => {
  if (!localDateTime) return null;
  const match = String(localDateTime).trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const parsedDate = new Date(year, month - 1, day, hour, minute, 0);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.toISOString();
};

const buildGoogleMapsSearchUrl = (rawAddress) => {
  const address = String(rawAddress || '').trim();
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

const getSpotifyEmbedHeight = (type) => (type === 'track' || type === 'episode' ? 152 : 352);

const normalizeId = (value) => String(value || '');

const buildBlockedUserIdSet = async (blockerId) => {
  if (!blockerId) return new Set();
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId);
  if (error) return new Set();
  return new Set((data || []).map((row) => normalizeId(row.blocked_id)).filter(Boolean));
};

const askModerationReason = (targetLabel) => {
  const reason = window.prompt(`Motivo da denuncia (${targetLabel}):`);
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) return null;
  const details = window.prompt('Detalhes (opcional):');
  return {
    reason: normalizedReason.slice(0, 280),
    details: String(details || '').trim().slice(0, 2000) || null
  };
};

const submitModerationReport = async ({
  reporterId,
  reportedUserId = null,
  targetType,
  targetPostId = null,
  targetProfileId = null,
  targetListingId = null,
  reason,
  details = null
}) => {
  if (!reporterId || !targetType || !reason) {
    return { ok: false, message: 'Dados da denuncia incompletos.' };
  }

  const payload = {
    reporter_id: reporterId,
    reported_user_id: reportedUserId || null,
    target_type: targetType,
    target_post_id: targetPostId,
    target_profile_id: targetProfileId,
    target_listing_id: targetListingId,
    reason,
    details
  };

  const { error } = await supabase.from('moderation_reports').insert([payload]);
  if (!error) return { ok: true };

  if (error.code === '23505') {
    return { ok: false, message: 'Voce ja denunciou este conteudo.' };
  }
  return { ok: false, message: 'Nao foi possivel enviar a denuncia.' };
};

const blockUser = async ({ blockerId, blockedId }) => {
  if (!blockerId || !blockedId) return { ok: false, message: 'Usuario invalido.' };
  if (normalizeId(blockerId) === normalizeId(blockedId)) {
    return { ok: false, message: 'Nao e possivel bloquear seu proprio perfil.' };
  }

  const { error } = await supabase.from('user_blocks').insert([{ blocker_id: blockerId, blocked_id: blockedId }]);
  if (!error || error.code === '23505') {
    return { ok: true };
  }

  return { ok: false, message: 'Nao foi possivel bloquear este usuario.' };
};

const unblockUser = async ({ blockerId, blockedId }) => {
  if (!blockerId || !blockedId) return { ok: false, message: 'Usuario invalido.' };

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (!error) return { ok: true };
  return { ok: false, message: 'Nao foi possivel desbloquear este usuario.' };
};

const createNotification = async ({
  recipientId,
  actorId,
  type,
  title,
  body = null,
  entityType = null,
  entityId = null,
  metadata = {}
}) => {
  const recipient = normalizeId(recipientId);
  const actor = normalizeId(actorId);
  if (!recipient || !actor || !type || !title) return;
  if (recipient === actor) return;

  await supabase.from('notifications').insert([{
    recipient_id: recipient,
    actor_id: actor,
    type,
    title: String(title).slice(0, 180),
    body: body ? String(body).slice(0, 1000) : null,
    entity_type: entityType || null,
    entity_id: entityId ? String(entityId) : null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {}
  }]);
};

const createNotificationsBulk = async (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) return;

  const payload = entries
    .map((entry) => {
      const recipient = normalizeId(entry?.recipientId);
      const actor = normalizeId(entry?.actorId);
      if (!recipient || !actor || recipient === actor || !entry?.type || !entry?.title) return null;

      return {
        recipient_id: recipient,
        actor_id: actor,
        type: entry.type,
        title: String(entry.title).slice(0, 180),
        body: entry.body ? String(entry.body).slice(0, 1000) : null,
        entity_type: entry.entityType || null,
        entity_id: entry.entityId ? String(entry.entityId) : null,
        metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {}
      };
    })
    .filter(Boolean);

  if (!payload.length) return;
  await supabase.from('notifications').insert(payload);
};

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
    const processSpotifyCallback = async () => {
      // PKCE callback
      const url = new URL(window.location.href);
      const callbackCode = url.searchParams.get('code');
      const callbackState = url.searchParams.get('state');
      const storedState = window.localStorage.getItem(SPOTIFY_PKCE_STATE_STORAGE_KEY);
      const storedVerifier = window.localStorage.getItem(SPOTIFY_PKCE_VERIFIER_STORAGE_KEY);
      const isSpotifyPkceCallback = Boolean(callbackCode && callbackState && storedState && callbackState === storedState && storedVerifier);

      if (isSpotifyPkceCallback) {
        try {
          const tokenData = await exchangeSpotifyCodeForTokens({
            code: callbackCode,
            codeVerifier: storedVerifier
          });

          setSpotifyAuthData({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            scope: tokenData.scope || '',
            token_type: tokenData.token_type || 'Bearer',
            expires_at: Date.now() + Number(tokenData.expires_in || 3600) * 1000
          });
        } catch (error) {
          console.error('Erro no callback do Spotify:', error);
        } finally {
          window.localStorage.removeItem(SPOTIFY_PKCE_STATE_STORAGE_KEY);
          window.localStorage.removeItem(SPOTIFY_PKCE_VERIFIER_STORAGE_KEY);
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          url.searchParams.delete('error');
          url.searchParams.delete('error_description');
          window.history.replaceState(null, '', `${url.pathname}${url.search}`);
        }
        return;
      }

      // Legacy hash token fallback
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const token = hashParams.get('access_token');
        const state = hashParams.get('state');
        const tokenType = hashParams.get('token_type');
        if (token && state === 'sonora_spotify_oauth' && tokenType) {
          window.localStorage.setItem(SPOTIFY_TOKEN_STORAGE_KEY, token);
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        }
      }
    };

    processSpotifyCallback();

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

      <main className="flex-1 min-w-0 overflow-y-auto relative bg-zinc-950 pt-14 pb-28 md:pt-0 md:pb-0">
        <div className={`${activeTab === 'direct' || activeTab === 'communities' ? 'w-full' : 'max-w-4xl mx-auto'} min-h-full`}>
          {activeTab === 'feed' && <FeedView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'direct' && <DirectView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'communities' && <CommunitiesHub currentUser={currentUser} onOpenDirect={() => setActiveTab('direct')} onOpenProfile={openProfile} />}
          {activeTab === 'playlists' && <PlaylistsView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'shopping' && <ShoppingView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'events' && <EventsView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'notifications' && <NotificationsView currentUser={currentUser} onOpenProfile={openProfile} onNavigate={handleTabChange} />}
          {activeTab === 'ascensao' && <AscensaoView currentUser={currentUser} onOpenProfile={openProfile} />}
          {activeTab === 'profile' && (
            <ProfileView
              user={selectedProfile || currentUser}
              viewerUser={currentUser}
              onOpenProfile={openProfile}
              setUser={(nextUser) => {
                setCurrentUser(nextUser);
                if (selectedProfile && String(selectedProfile.id) === String(nextUser.id)) setSelectedProfile(nextUser);
              }}
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

const AnimatedBackground = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const baseX = useMotionValue(0);
  const baseY = useMotionValue(0);
  const inverseX = useMotionValue(0);
  const inverseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const mouseX = useSpring(baseX, springConfig);
  const mouseY = useSpring(baseY, springConfig);
  const mouseInverseX = useSpring(inverseX, springConfig);
  const mouseInverseY = useSpring(inverseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const x = (event.clientX / window.innerWidth) - 0.5;
      const y = (event.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });
      baseX.set(x * 100);
      baseY.set(y * 100);
      inverseX.set(x * -150);
      inverseY.set(y * -150);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [baseX, baseY, inverseX, inverseY]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      <motion.div
        style={{ x: mouseX, y: mouseY }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px]"
      />
      <motion.div
        style={{ x: mouseInverseX, y: mouseInverseY }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        className="absolute top-1/2 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"
      />

      {Array.from({ length: 12 }).map((_, index) => (
        <motion.div
          key={`login-float-${index}`}
          initial={{ opacity: 0, y: '110vh' }}
          animate={{
            opacity: [0, 0.35, 0],
            y: '-10vh',
            x: `${(index * 8) + 10}vw`,
            rotate: [0, 360]
          }}
          transition={{
            duration: 15 + (index % 5),
            repeat: Infinity,
            delay: index * 2,
            ease: 'linear'
          }}
          className="absolute text-white/5 pointer-events-none"
        >
          {index % 3 === 0 ? <Music size={32} /> : index % 3 === 1 ? <Disc size={28} /> : <Headphones size={24} />}
        </motion.div>
      ))}

      <div className="absolute bottom-0 left-0 w-full h-40 flex items-end justify-around px-2 opacity-30 pointer-events-none">
        {Array.from({ length: 30 }).map((_, index) => {
          const barX = (index / 30) - 0.5;
          const distance = Math.abs(barX - mousePos.x);
          const intensity = Math.max(0, 1 - distance * 2);
          return (
            <motion.div
              key={`login-bar-${index}`}
              animate={{
                height: [20, (Math.random() * 60) + (intensity * 80) + 20, 20],
                backgroundColor: intensity > 0.5 ? '#a855f7' : '#3b82f6'
              }}
              transition={{ duration: 0.4 + (index % 3) * 0.1, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1 md:w-2 bg-gradient-to-t from-transparent to-current rounded-t-full transition-colors duration-500"
            />
          );
        })}
      </div>
    </div>
  );
};

const InputField = ({
  label,
  type,
  icon: Icon,
  placeholder,
  value,
  onChange,
  showToggle = false,
  onToggle = null
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-400 ml-1">{label}</label>
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-violet-400 text-slate-500">
        <Icon size={18} />
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="block w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-all text-white placeholder:text-slate-600 backdrop-blur-md"
        placeholder={placeholder}
      />
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"
        >
          {type === 'password' ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      )}
    </div>
  </div>
);

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const getAuthRedirectUrl = () => `${window.location.origin}/`;

  const handleAuth = async (event) => {
    event.preventDefault();
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

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, staggerChildren: 0.1, ease: 'easeOut' }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans text-slate-200 selection:bg-violet-500/30">
      <AnimatedBackground />

      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="w-full max-w-md relative">
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-violet-600 to-blue-600 rounded-3xl shadow-2xl shadow-violet-500/30 mb-6"
          >
            <Headphones size={38} className="text-white" />
          </motion.div>
          <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
            SONORA
          </h1>
          <p className="text-slate-400 mt-2 font-medium tracking-wide">Onde a musica encontra a conexao.</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden relative group"
        >
          <div className="absolute inset-0 border border-violet-500/0 group-hover:border-violet-500/20 transition-colors duration-700 pointer-events-none rounded-[2.5rem]" />

          <div className="p-8 md:p-10">
            <form onSubmit={handleAuth} className="space-y-6">
              {!isLogin && (
                <InputField
                  label="Nome artistico"
                  type="text"
                  icon={Music}
                  placeholder="Seu nome no Sonora"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}

              <InputField
                label="Email"
                type="email"
                icon={Mail}
                placeholder="exemplo@sonora.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <InputField
                label="Palavra-passe"
                type={showPassword ? 'text' : 'password'}
                icon={Lock}
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                showToggle
                onToggle={() => setShowPassword((prev) => !prev)}
              />

              <div className="flex items-center justify-end">
                <button type="button" className="text-xs font-semibold text-violet-400 hover:text-white transition-all uppercase tracking-widest">
                  Esqueceu a senha?
                </button>
              </div>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 20px 25px -5px rgb(168 85 247 / 0.4)' }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 group disabled:opacity-70"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="tracking-wide">{isLogin ? 'ENTRAR NA VIBE' : 'CRIAR PERFIL'}</span>
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </form>

            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
                <span className="bg-[#0b1120] px-3 text-slate-500 font-bold">Ou sintonizar com</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <motion.button
                type="button"
                whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.08)' }}
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-2xl transition-all text-sm font-bold disabled:opacity-60"
              >
                <Chrome size={18} className="text-red-400" />
                {googleLoading ? 'Abrindo...' : 'Google'}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.08)' }}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-2xl transition-all text-sm font-bold opacity-60"
                title="Em breve"
              >
                <Github size={18} />
                Github
              </motion.button>
            </div>
          </div>

          <div className="p-6 bg-white/[0.02] border-t border-white/5 text-center">
            <p className="text-sm text-slate-400 font-medium">
              {isLogin ? 'Ainda nao faz parte?' : 'Ja e da familia?'}
              <button type="button" onClick={() => setIsLogin((prev) => !prev)} className="ml-2 text-violet-400 font-bold hover:text-white transition-colors">
                {isLogin ? 'Registe-se' : 'Entrar'}
              </button>
            </p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-10 text-center space-y-6">
          <div className="flex justify-center gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <a href="#" className="hover:text-violet-400 transition-colors">Termos</a>
            <a href="#" className="hover:text-violet-400 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-violet-400 transition-colors">Cookies</a>
          </div>
        </motion.div>
      </motion.div>
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
    const blockedUsers = await buildBlockedUserIdSet(currentUser.id);
    const { data } = await supabase
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(id, name, handle, avatar_url)')
      .order('created_at', { ascending: false });
    if (data) {
      setPosts(
        data.filter((post) => !blockedUsers.has(normalizeId(post.user_id)))
      );
    }
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
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
            fetchPosts={fetchPosts}
            onOpenProfile={onOpenProfile}
          />
        ))}
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
        await createNotification({
          recipientId: post.user_id,
          actorId: currentUser.id,
          type: 'like',
          title: `${currentUser.name || 'Alguem'} curtiu seu post`,
          body: post.content ? String(post.content).slice(0, 120) : null,
          entityType: 'post',
          entityId: post.id
        });
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
    const commentContent = newComment.trim();
    const { error } = await supabase
      .from('comments')
      .insert([{ post_id: post.id, user_id: currentUser.id, content: commentContent }]);
    if (!error) {
      await createNotification({
        recipientId: post.user_id,
        actorId: currentUser.id,
        type: 'comment',
        title: `${currentUser.name || 'Alguem'} comentou no seu post`,
        body: commentContent.slice(0, 160),
        entityType: 'post',
        entityId: post.id
      });
    }
    setNewComment('');
    fetchComments();
  };

  const handleDelete = async () => {
    if (window.confirm("Pretende apagar esta publicacao?")) {
      await supabase.from('posts').delete().eq('id', post.id);
      fetchPosts();
    }
  };

  const handleReportPost = async () => {
    const reasonPayload = askModerationReason('post');
    if (!reasonPayload) return;

    const result = await submitModerationReport({
      reporterId: currentUser.id,
      reportedUserId: post.user_id || null,
      targetType: 'post',
      targetPostId: post.id,
      reason: reasonPayload.reason,
      details: reasonPayload.details
    });

    alert(result.ok ? 'Denuncia enviada.' : result.message);
  };

  const handleBlockAuthor = async () => {
    const authorName = profile?.name || 'este usuario';
    if (!window.confirm(`Bloquear ${authorName}? Os posts dele nao aparecerao mais para voce.`)) return;
    const result = await blockUser({ blockerId: currentUser.id, blockedId: post.user_id });
    if (!result.ok) {
      alert(result.message);
      return;
    }
    await fetchPosts();
    alert('Usuario bloqueado com sucesso.');
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5 relative group">
      {isOwner && (
        <button onClick={handleDelete} className="absolute top-4 right-4 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      {!isOwner && (
        <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleReportPost}
            className="text-zinc-500 hover:text-amber-300 p-1 rounded-md hover:bg-zinc-800"
            title="Denunciar post"
          >
            <Flag className="w-4 h-4" />
          </button>
          <button
            onClick={handleBlockAuthor}
            className="text-zinc-500 hover:text-red-400 p-1 rounded-md hover:bg-zinc-800"
            title="Bloquear usuario"
          >
            <UserX className="w-4 h-4" />
          </button>
        </div>
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
  const [blockedUserIds, setBlockedUserIds] = useState(() => new Set());
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
    const blockedUsers = await buildBlockedUserIdSet(currentUser.id);
    setBlockedUserIds(blockedUsers);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .neq('id', currentUser.id)
      .order('name', { ascending: true });

    if (!error) {
      setUsers(
        (data || []).filter((profile) => !blockedUsers.has(normalizeId(profile.id)))
      );
    }
    setLoadingUsers(false);
  };

  const fetchConversationMeta = async () => {
    const blockedUsers = await buildBlockedUserIdSet(currentUser.id);
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (error) return;

    const nextMeta = {};
    (data || []).forEach((message) => {
      const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
      if (blockedUsers.has(normalizeId(otherUserId))) return;
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
    if (!activeUser?.id) return;
    if (!blockedUserIds.has(normalizeId(activeUser.id))) return;
    setActiveUser(null);
  }, [activeUser?.id, blockedUserIds]);

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
      await createNotification({
        recipientId: activeUser.id,
        actorId: currentUser.id,
        type: 'message',
        title: `${currentUser.name || 'Alguem'} enviou uma mensagem`,
        body: data.content ? String(data.content).slice(0, 160) : null,
        entityType: 'message',
        entityId: data.id
      });
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

function ShoppingView({ currentUser, onOpenProfile }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [favoriteCountMap, setFavoriteCountMap] = useState({});
  const [favoriteBusyId, setFavoriteBusyId] = useState(null);
  const [activeChatListingId, setActiveChatListingId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatRecipientId, setChatRecipientId] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [mapModal, setMapModal] = useState({ open: false, title: '', query: '' });
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    price: '',
    condition: 'used',
    category: '',
    location: '',
    purchase_url: '',
    image_url: '',
    image_position_x: 50,
    image_position_y: 50
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const imageInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    if (!chatMessages.length) return;
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [chatMessages, activeChatListingId]);

  useEffect(() => {
    if (!activeChatListingId) return undefined;
    const channel = supabase
      .channel(`shopping-chat-${currentUser.id}-${activeChatListingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'marketplace_chat_messages' }, (payload) => {
        const message = payload.new;
        if (!message) return;
        if (normalizeId(message.listing_id) !== normalizeId(activeChatListingId)) return;
        const isRelevant = normalizeId(message.sender_id) === normalizeId(currentUser.id)
          || normalizeId(message.receiver_id) === normalizeId(currentUser.id);
        if (!isRelevant) return;
        setChatMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
        if (normalizeId(message.sender_id) !== normalizeId(currentUser.id)) {
          setChatRecipientId(message.sender_id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, activeChatListingId, listings]);

  const fetchListings = async () => {
    setLoading(true);
    setErrorMessage('');
    const [blockedUsers, listingsResult, favoritesResult] = await Promise.all([
      buildBlockedUserIdSet(currentUser.id),
      supabase
        .from('marketplace_listings')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('marketplace_favorites')
        .select('listing_id')
        .eq('user_id', currentUser.id)
    ]);

    if (listingsResult.error) {
      setErrorMessage(`Nao foi possivel carregar Shopping (${listingsResult.error.message || 'erro desconhecido'}).`);
      setListings([]);
      setLoading(false);
      return;
    }

    const baseListings = (listingsResult.data || []).filter((item) => item.is_active !== false);
    const sellerIds = Array.from(new Set(baseListings.map((item) => normalizeId(item.seller_id)).filter(Boolean)));

    const profilesById = {};
    if (sellerIds.length) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, handle, avatar_url')
        .in('id', sellerIds);

      (profilesData || []).forEach((profile) => {
        profilesById[normalizeId(profile.id)] = profile;
      });
    }

    const visibleListings = baseListings
      .map((item) => ({
        ...item,
        profiles: profilesById[normalizeId(item.seller_id)] || null
      }))
      .filter((item) => !blockedUsers.has(normalizeId(item.seller_id)));

    setListings(visibleListings);

    if (!favoritesResult.error) {
      setFavoriteIds(new Set((favoritesResult.data || []).map((row) => normalizeId(row.listing_id))));
    } else {
      setFavoriteIds(new Set());
    }

    const listingIds = visibleListings.map((item) => item.id).filter((id) => id !== null && id !== undefined);
    if (listingIds.length) {
      const { data: allFavorites } = await supabase
        .from('marketplace_favorites')
        .select('listing_id')
        .in('listing_id', listingIds);

      const counts = {};
      (allFavorites || []).forEach((row) => {
        const key = normalizeId(row.listing_id);
        counts[key] = (counts[key] || 0) + 1;
      });
      setFavoriteCountMap(counts);
    } else {
      setFavoriteCountMap({});
    }

    setLoading(false);
  };

  const clearSelectedImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearSelectedImage();
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const parseNumberFilter = (rawValue) => {
    const normalized = Number(String(rawValue || '').replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : null;
  };

  const handleCreateListing = async (event) => {
    event.preventDefault();
    if (saving) return;

    const title = newItem.title.trim();
    const description = newItem.description.trim();
    const price = Number(String(newItem.price).replace(',', '.'));
    const condition = newItem.condition === 'new' ? 'new' : 'used';
    const category = newItem.category.trim();
    const location = newItem.location.trim();
    const purchaseUrl = newItem.purchase_url.trim();
    let imageUrl = newItem.image_url.trim();
    const imagePositionX = clampPercent(newItem.image_position_x, 50);
    const imagePositionY = clampPercent(newItem.image_position_y, 50);

    if (!title || !Number.isFinite(price) || price < 0) {
      setErrorMessage('Preencha titulo e preco valido.');
      return;
    }

    if (imageFile) {
      try {
        const ext = (imageFile.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `shopping/${currentUser.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('media').upload(path, imageFile, { upsert: true });
        if (uploadError || !uploadData?.path) throw new Error(uploadError?.message || 'Upload falhou');
        imageUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl;
      } catch {
        setErrorMessage('Falha ao enviar imagem do anuncio.');
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from('marketplace_listings').insert([{
      seller_id: currentUser.id,
      title,
      description: description || null,
      price,
      condition,
      category: category || null,
      location: location || null,
      purchase_url: purchaseUrl || null,
      image_url: imageUrl || null,
      image_position_x: imagePositionX,
      image_position_y: imagePositionY,
      is_active: true,
      status: 'available'
    }]);

    if (error) {
      setErrorMessage('Nao foi possivel publicar o anuncio.');
      setSaving(false);
      return;
    }

    setShowCreate(false);
    setSaving(false);
    setNewItem({
      title: '',
      description: '',
      price: '',
      condition: 'used',
      category: '',
      location: '',
      purchase_url: '',
      image_url: '',
      image_position_x: 50,
      image_position_y: 50
    });
    clearSelectedImage();
    await fetchListings();
  };

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Deseja remover este anuncio?')) return;
    setDeletingId(listingId);
    const { error } = await supabase.from('marketplace_listings').delete().eq('id', listingId).eq('seller_id', currentUser.id);
    if (error) {
      setErrorMessage('Nao foi possivel remover este anuncio.');
      setDeletingId(null);
      return;
    }
    if (normalizeId(activeChatListingId) === normalizeId(listingId)) {
      setActiveChatListingId(null);
      setChatMessages([]);
      setChatMessage('');
      setChatRecipientId('');
      setChatLoading(false);
      setChatSending(false);
    }
    setDeletingId(null);
    await fetchListings();
  };

  const handleToggleListingStatus = async (listing) => {
    if (!listing || normalizeId(listing.seller_id) !== normalizeId(currentUser.id)) return;
    const currentStatus = listing.status === 'sold' ? 'sold' : 'available';
    const nextStatus = currentStatus === 'sold' ? 'available' : 'sold';

    setUpdatingStatusId(listing.id);
    const { error } = await supabase
      .from('marketplace_listings')
      .update({ status: nextStatus })
      .eq('id', listing.id)
      .eq('seller_id', currentUser.id);

    if (error) {
      setErrorMessage('Nao foi possivel atualizar o status do anuncio.');
      setUpdatingStatusId(null);
      return;
    }

    setListings((prev) => prev.map((item) => (
      item.id === listing.id ? { ...item, status: nextStatus } : item
    )));
    setUpdatingStatusId(null);
  };

  const handleToggleFavorite = async (listingId) => {
    if (favoriteBusyId === listingId) return;
    const listingKey = normalizeId(listingId);
    const alreadyFavorite = favoriteIds.has(listingKey);
    setFavoriteBusyId(listingId);

    const query = supabase.from('marketplace_favorites');
    const result = alreadyFavorite
      ? await query.delete().eq('listing_id', listingId).eq('user_id', currentUser.id)
      : await query.insert([{ listing_id: listingId, user_id: currentUser.id }]);

    const error = result.error;
    if (error && !(error.code === '23505' && !alreadyFavorite)) {
      setErrorMessage('Nao foi possivel atualizar favoritos.');
      setFavoriteBusyId(null);
      return;
    }

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (alreadyFavorite) next.delete(listingKey);
      else next.add(listingKey);
      return next;
    });

    setFavoriteCountMap((prev) => {
      const currentCount = Number(prev[listingKey] || 0);
      return {
        ...prev,
        [listingKey]: alreadyFavorite ? Math.max(0, currentCount - 1) : currentCount + 1
      };
    });

    setFavoriteBusyId(null);
  };

  const handleReportListing = async (listing) => {
    const reasonPayload = askModerationReason('anuncio');
    if (!reasonPayload) return;

    const result = await submitModerationReport({
      reporterId: currentUser.id,
      reportedUserId: listing?.seller_id || null,
      targetType: 'listing',
      targetListingId: listing?.id || null,
      reason: reasonPayload.reason,
      details: reasonPayload.details
    });

    alert(result.ok ? 'Denuncia enviada.' : result.message);
  };

  const handleBlockSeller = async (listing) => {
    const sellerId = listing?.seller_id;
    if (!sellerId) return;
    const sellerName = listing?.profiles?.name || 'este usuario';
    if (!window.confirm(`Bloquear ${sellerName}? Os anuncios dele nao aparecerao mais para voce.`)) return;

    const result = await blockUser({ blockerId: currentUser.id, blockedId: sellerId });
    if (!result.ok) {
      alert(result.message);
      return;
    }

    await fetchListings();
    alert('Usuario bloqueado com sucesso.');
  };

  const openListingChat = async (listing) => {
    if (!listing?.id) return;
    const listingId = listing.id;
    const sellerId = listing.seller_id;
    const isSeller = normalizeId(sellerId) === normalizeId(currentUser.id);
    const isClosing = normalizeId(activeChatListingId) === normalizeId(listingId);
    if (isClosing) {
      setActiveChatListingId(null);
      setChatMessages([]);
      setChatMessage('');
      setChatRecipientId('');
      return;
    }

    setActiveChatListingId(listingId);
    setChatLoading(true);
    let query = supabase
      .from('marketplace_chat_messages')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true });

    if (isSeller) {
      query = query.or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    } else {
      query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${sellerId}),and(sender_id.eq.${sellerId},receiver_id.eq.${currentUser.id})`);
    }

    const { data, error } = await query;

    if (error) {
      setChatMessages([]);
      setChatRecipientId('');
      setChatLoading(false);
      setErrorMessage('Nao foi possivel carregar chat do anuncio.');
      return;
    }

    const nextMessages = data || [];
    setChatMessages(nextMessages);
    if (isSeller) {
      const latestInbound = [...nextMessages].reverse().find((message) => normalizeId(message.sender_id) !== normalizeId(currentUser.id));
      setChatRecipientId(latestInbound ? latestInbound.sender_id : '');
    } else {
      setChatRecipientId(sellerId);
    }
    setChatLoading(false);
  };

  const handleSendListingChatMessage = async (event, listing) => {
    event.preventDefault();
    if (!listing || chatSending) return;

    const content = chatMessage.trim();
    if (!content) return;
    const defaultRecipient = normalizeId(listing.seller_id) === normalizeId(currentUser.id) ? '' : listing.seller_id;
    const receiverId = chatRecipientId || defaultRecipient;
    if (!receiverId) {
      setErrorMessage('Escolha um comprador para responder no chat.');
      return;
    }

    setChatSending(true);
    const { data, error } = await supabase
      .from('marketplace_chat_messages')
      .insert([{
        listing_id: listing.id,
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content
      }])
      .select('*')
      .single();

    if (error) {
      setChatSending(false);
      setErrorMessage('Nao foi possivel enviar mensagem no chat do anuncio.');
      return;
    }

    setChatMessages((prev) => (prev.some((item) => item.id === data.id) ? prev : [...prev, data]));
    setChatMessage('');
    setChatSending(false);

    await createNotification({
      recipientId: receiverId,
      actorId: currentUser.id,
      type: 'message',
      title: `${currentUser.name || 'Alguem'} enviou mensagem no Shopping`,
      body: content.slice(0, 160),
      entityType: 'message',
      entityId: data.id,
      metadata: {
        marketplace_listing_id: String(listing.id),
        marketplace_listing_title: listing.title || ''
      }
    });
  };

  const minPrice = parseNumberFilter(minPriceFilter);
  const maxPrice = parseNumberFilter(maxPriceFilter);
  const normalizedCategoryFilter = categoryFilter.trim().toLowerCase();
  const normalizedCityFilter = cityFilter.trim().toLowerCase();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredListings = listings.filter((item) => {
    const itemKey = normalizeId(item.id);
    const itemPrice = Number(item.price || 0);
    const itemStatus = item.status === 'sold' ? 'sold' : 'available';
    const title = String(item.title || '').toLowerCase();
    const description = String(item.description || '').toLowerCase();
    const location = String(item.location || '').toLowerCase();
    const category = String(item.category || '').toLowerCase();

    if (normalizedQuery && !(
      title.includes(normalizedQuery)
      || description.includes(normalizedQuery)
      || location.includes(normalizedQuery)
      || category.includes(normalizedQuery)
    )) {
      return false;
    }
    if (statusFilter !== 'all' && itemStatus !== statusFilter) return false;
    if (favoritesOnly && !favoriteIds.has(itemKey)) return false;
    if (normalizedCategoryFilter && !category.includes(normalizedCategoryFilter)) return false;
    if (normalizedCityFilter && !location.includes(normalizedCityFilter)) return false;
    if (minPrice !== null && itemPrice < minPrice) return false;
    if (maxPrice !== null && itemPrice > maxPrice) return false;
    return true;
  });

  const categoryOptions = Array.from(
    new Set(listings.map((item) => String(item.category || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const cityOptions = Array.from(
    new Set(listings.map((item) => String(item.location || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const shoppingMapQuery = newItem.location.trim();
  const shoppingMapSearchUrl = buildGoogleMapsSearchUrl(shoppingMapQuery);
  const shoppingMapEmbedUrl = shoppingMapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(shoppingMapQuery)}&output=embed`
    : '';
  const openMapModal = (title, query) => {
    if (!String(query || '').trim()) return;
    setMapModal({ open: true, title: title || 'Mapa', query: String(query).trim() });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-violet-400" /> Shopping</h2>
          <p className="text-zinc-400 text-sm">Venda e compre instrumentos musicais.</p>
        </div>
        <button onClick={() => setShowCreate((prev) => !prev)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
          {showCreate ? <X className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
          {showCreate ? 'Cancelar' : 'Novo anuncio'}
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar instrumento..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-violet-500 outline-none" />
          </div>
          <input
            type="text"
            value={minPriceFilter}
            onChange={(event) => setMinPriceFilter(event.target.value)}
            placeholder="Preco min"
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
          />
          <input
            type="text"
            value={maxPriceFilter}
            onChange={(event) => setMaxPriceFilter(event.target.value)}
            placeholder="Preco max"
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
          >
            <option value="">Todas categorias</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
          >
            <option value="">Todas cidades</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
          >
            <option value="all">Todos status</option>
            <option value="available">Somente disponiveis</option>
            <option value="sold">Somente vendidos</option>
          </select>
          <button
            type="button"
            onClick={() => setFavoritesOnly((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1 ${
              favoritesOnly ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
            Favoritos
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('');
              setCityFilter('');
              setStatusFilter('all');
              setMinPriceFilter('');
              setMaxPriceFilter('');
              setFavoritesOnly(false);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Limpar filtros
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {filteredListings.length} resultado(s) {favoritesOnly ? 'em favoritos' : 'no Shopping'}.
        </p>
      </div>

      {activeChatListingId && (
        <div className="mb-6 bg-violet-500/10 border border-violet-500/30 text-violet-100 rounded-xl px-4 py-3 text-xs">
          Chat do anuncio ativo. Abra o card correspondente para continuar a conversa.
        </div>
      )}

      {errorMessage && <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">{errorMessage}</div>}

      {showCreate && (
        <form onSubmit={handleCreateListing} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-8 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" required value={newItem.title} onChange={(event) => setNewItem((prev) => ({ ...prev, title: event.target.value }))} placeholder="Titulo do anuncio" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" required value={newItem.price} onChange={(event) => setNewItem((prev) => ({ ...prev, price: event.target.value }))} placeholder="Preco (ex: 2999.90)" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" value={newItem.category} onChange={(event) => setNewItem((prev) => ({ ...prev, category: event.target.value }))} placeholder="Categoria (guitarra, teclado...)" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" value={newItem.location} onChange={(event) => setNewItem((prev) => ({ ...prev, location: event.target.value }))} placeholder="Cidade / Estado" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <select value={newItem.condition} onChange={(event) => setNewItem((prev) => ({ ...prev, condition: event.target.value }))} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500">
              <option value="used">Usado</option>
              <option value="new">Novo</option>
            </select>
            <input type="text" value={newItem.purchase_url} onChange={(event) => setNewItem((prev) => ({ ...prev, purchase_url: event.target.value }))} placeholder="Link de compra/contato" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Local no Maps</span>
              <a
                href={shoppingMapSearchUrl || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!shoppingMapSearchUrl) event.preventDefault();
                }}
                className={`text-xs px-2 py-1 rounded-md ${shoppingMapSearchUrl ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
              >
                Escolher no Maps
              </a>
              <button
                type="button"
                onClick={() => openMapModal('Preview do local', shoppingMapQuery)}
                disabled={!shoppingMapQuery}
                className={`text-xs px-2 py-1 rounded-md ${shoppingMapQuery ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
              >
                Abrir no app
              </button>
            </div>
            {shoppingMapEmbedUrl && (
              <iframe
                src={shoppingMapEmbedUrl}
                title="Preview local Shopping"
                className="w-full h-48 rounded-xl border border-zinc-800"
                loading="lazy"
              />
            )}
          </div>
          <textarea value={newItem.description} onChange={(event) => setNewItem((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="Descricao do produto..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 resize-none" />
          <input type="text" value={newItem.image_url} onChange={(event) => setNewItem((prev) => ({ ...prev, image_url: event.target.value }))} placeholder="URL da imagem (opcional)" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-zinc-400">
              Posicao horizontal da imagem ({clampPercent(newItem.image_position_x, 50)}%)
              <input
                type="range"
                min="0"
                max="100"
                value={clampPercent(newItem.image_position_x, 50)}
                onChange={(event) => setNewItem((prev) => ({ ...prev, image_position_x: Number(event.target.value) }))}
                className="w-full mt-1"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Posicao vertical da imagem ({clampPercent(newItem.image_position_y, 50)}%)
              <input
                type="range"
                min="0"
                max="100"
                value={clampPercent(newItem.image_position_y, 50)}
                onChange={(event) => setNewItem((prev) => ({ ...prev, image_position_y: Number(event.target.value) }))}
                className="w-full mt-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            <button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium">
              <ImageIcon className="w-4 h-4" />
              Enviar foto
            </button>
            {imageFile && (
              <button type="button" onClick={clearSelectedImage} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-red-300 hover:bg-zinc-700 text-sm">
                <X className="w-4 h-4" />
                Remover
              </button>
            )}
          </div>
          {(imagePreview || newItem.image_url.trim()) && (
            <img
              src={imagePreview || newItem.image_url.trim()}
              className="w-full max-h-64 object-cover rounded-xl border border-zinc-800"
              style={{ objectPosition: `${clampPercent(newItem.image_position_x, 50)}% ${clampPercent(newItem.image_position_y, 50)}%` }}
            />
          )}
          <button disabled={saving} type="submit" className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-semibold">{saving ? 'Publicando...' : 'Publicar anuncio'}</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {loading && <p className="text-sm text-zinc-500">Carregando anuncios...</p>}
        {!loading && filteredListings.length === 0 && <p className="text-sm text-zinc-500">Nenhum anuncio encontrado.</p>}
        {!loading && filteredListings.map((item) => (
          <div key={item.id} className={`bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden ${item.status === 'sold' ? 'opacity-90' : ''}`}>
            {item.image_url ? (
              <img
                src={item.image_url}
                className="w-full h-48 object-cover bg-zinc-950"
                style={{ objectPosition: `${clampPercent(item.image_position_x, 50)}% ${clampPercent(item.image_position_y, 50)}%` }}
              />
            ) : (
              <div className="w-full h-48 bg-zinc-950 flex items-center justify-center text-zinc-500"><ShoppingBag className="w-10 h-10 opacity-60" /></div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-1 rounded-md font-semibold ${item.status === 'sold' ? 'bg-red-500/20 text-red-200 border border-red-400/30' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'}`}>
                    {item.status === 'sold' ? 'Vendido' : 'Disponivel'}
                  </span>
                  {item.seller_id === currentUser.id && (
                    <button disabled={deletingId === item.id} onClick={() => handleDeleteListing(item.id)} className="text-zinc-500 hover:text-red-400 disabled:opacity-50" title="Remover anuncio">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-violet-300 font-bold mt-1">{formatBRL(item.price)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300">{item.condition === 'new' ? 'Novo' : 'Usado'}</span>
                {item.category && <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300">{item.category}</span>}
                {item.location && <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>}
                <button
                  type="button"
                  disabled={favoriteBusyId === item.id}
                  onClick={() => handleToggleFavorite(item.id)}
                  className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${favoriteIds.has(normalizeId(item.id)) ? 'bg-red-500/20 text-red-200' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'} disabled:opacity-60`}
                >
                  <Heart className={`w-3 h-3 ${favoriteIds.has(normalizeId(item.id)) ? 'fill-current' : ''}`} />
                  {favoriteCountMap[normalizeId(item.id)] || 0}
                </button>
              </div>
              {item.description && <p className="text-sm text-zinc-300 mt-3 line-clamp-3">{item.description}</p>}
              <div className="mt-4 flex items-center justify-between gap-2">
                <button type="button" onClick={() => item.profiles?.id && onOpenProfile?.(item.profiles)} className="text-xs text-zinc-400 hover:text-violet-300 transition-colors">
                  {item.profiles?.name || 'Usuario'} {item.profiles?.handle || ''}
                </button>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => openListingChat(item)}
                    className={`text-sm font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 ${
                      normalizeId(activeChatListingId) === normalizeId(item.id)
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {normalizeId(activeChatListingId) === normalizeId(item.id) ? 'Fechar chat' : 'Chat'}
                  </button>
                  {item.seller_id !== currentUser.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReportListing(item)}
                        className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1"
                      >
                        <Flag className="w-4 h-4" />
                        Denunciar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBlockSeller(item)}
                        className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 inline-flex items-center gap-1"
                      >
                        <UserX className="w-4 h-4" />
                        Bloquear
                      </button>
                    </>
                  )}
                  {item.seller_id === currentUser.id && (
                    <button
                      type="button"
                      disabled={updatingStatusId === item.id}
                      onClick={() => handleToggleListingStatus(item)}
                      className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 disabled:opacity-60"
                    >
                      {item.status === 'sold' ? 'Marcar disponivel' : 'Marcar vendido'}
                    </button>
                  )}
                  {item.location && (
                    <>
                      <button
                        type="button"
                        onClick={() => openMapModal(item.title || 'Local do anuncio', item.location)}
                        className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                      >
                        Maps
                      </button>
                      <a href={buildGoogleMapsSearchUrl(item.location)} target="_blank" rel="noreferrer" className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200">
                        Abrir
                      </a>
                    </>
                  )}
                  {item.status !== 'sold' && item.purchase_url ? (
                    <a href={item.purchase_url} target="_blank" rel="noreferrer" className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                      Comprar
                    </a>
                  ) : item.status === 'sold' ? (
                    <span className="text-xs text-red-300">Item vendido</span>
                  ) : (
                    <span className="text-xs text-zinc-500">Sem link de compra</span>
                  )}
                </div>
              </div>

              {normalizeId(activeChatListingId) === normalizeId(item.id) && (
                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                  <p className="text-xs text-zinc-500">
                    {normalizeId(item.seller_id) === normalizeId(currentUser.id)
                      ? 'Chat do anuncio (responda o ultimo comprador).'
                      : `Chat com ${item.profiles?.name || 'vendedor'} ${item.profiles?.handle || ''}`}
                  </p>
                  {normalizeId(item.seller_id) === normalizeId(currentUser.id) && chatRecipientId && (
                    <div className="text-xs text-zinc-500">
                      Respondendo para ID: {chatRecipientId}
                    </div>
                  )}
                  {chatLoading && <p className="text-sm text-zinc-500">Carregando chat...</p>}
                  {!chatLoading && (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {chatMessages.length === 0 && (
                        <p className="text-sm text-zinc-500 text-center py-3">Sem mensagens ainda. Inicie o chat.</p>
                      )}
                      {chatMessages.map((message) => {
                        const isMine = normalizeId(message.sender_id) === normalizeId(currentUser.id);
                        return (
                          <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm ${isMine ? 'bg-violet-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-100 rounded-bl-none'}`}>
                              <p>{message.content}</p>
                              <p className={`text-[10px] mt-1 ${isMine ? 'text-violet-100/80' : 'text-zinc-400'}`}>
                                {new Date(message.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                  <form onSubmit={(event) => handleSendListingChatMessage(event, item)} className="flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(event) => setChatMessage(event.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full px-4 py-2 text-sm text-white focus:border-violet-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={chatSending || !chatMessage.trim() || (normalizeId(item.seller_id) === normalizeId(currentUser.id) && !chatRecipientId)}
                      className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white p-2 w-10 h-10 rounded-full flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <MapsModal
        isOpen={mapModal.open}
        title={mapModal.title}
        query={mapModal.query}
        onClose={() => setMapModal({ open: false, title: '', query: '' })}
      />
    </div>
  );
}

function EventsView({ currentUser, onOpenProfile }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [artistFilter, setArtistFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [mapModal, setMapModal] = useState({ open: false, title: '', query: '' });
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_date: '',
    venue: '',
    city: '',
    genre: '',
    ticket_url: '',
    contact_url: '',
    needs_artists: false,
    artist_requirements: '',
    cover_url: '',
    cover_position_x: 50,
    cover_position_y: 50
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const coverInputRef = useRef(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setErrorMessage('');
    const blockedUsers = await buildBlockedUserIdSet(currentUser.id);

    const { data, error } = await supabase
      .from('music_events')
      .select('*, profiles!music_events_organizer_id_fkey(id, name, handle, avatar_url)')
      .order('event_date', { ascending: true });

    if (error) {
      setErrorMessage('Nao foi possivel carregar eventos. Verifique a tabela music_events no banco.');
      setEvents([]);
      setLoading(false);
      return;
    }

    setEvents(
      (data || []).filter((item) => !blockedUsers.has(normalizeId(item.organizer_id)))
    );
    setLoading(false);
  };

  const clearSelectedCover = () => {
    if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview('');
  };

  const handleCoverChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearSelectedCover();
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    if (saving) return;

    const title = newEvent.title.trim();
    const description = newEvent.description.trim();
    const venue = newEvent.venue.trim();
    const city = newEvent.city.trim();
    const genre = newEvent.genre.trim();
    const ticketUrl = newEvent.ticket_url.trim();
    const contactUrl = newEvent.contact_url.trim();
    const artistRequirements = newEvent.artist_requirements.trim();
    const eventDateIso = parseLocalDateTimeToIso(newEvent.event_date);
    const eventTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    const coverPositionX = clampPercent(newEvent.cover_position_x, 50);
    const coverPositionY = clampPercent(newEvent.cover_position_y, 50);
    let coverUrl = newEvent.cover_url.trim();

    if (!title || !venue || !city || !eventDateIso || Number.isNaN(new Date(eventDateIso).getTime())) {
      setErrorMessage('Preencha titulo, data, local e cidade do evento.');
      return;
    }

    if (coverFile) {
      try {
        const ext = (coverFile.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `events/${currentUser.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('media').upload(path, coverFile, { upsert: true });
        if (uploadError || !uploadData?.path) throw new Error(uploadError?.message || 'Upload falhou');
        coverUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl;
      } catch {
        setErrorMessage('Falha ao enviar capa do evento.');
        return;
      }
    }

    setSaving(true);
    const { data: createdEvent, error } = await supabase.from('music_events').insert([{
      organizer_id: currentUser.id,
      title,
      description: description || null,
      event_date: eventDateIso,
      venue,
      city,
      genre: genre || null,
      ticket_url: ticketUrl || null,
      contact_url: contactUrl || null,
      needs_artists: Boolean(newEvent.needs_artists),
      artist_requirements: newEvent.needs_artists ? (artistRequirements || null) : null,
      cover_url: coverUrl || null,
      cover_position_x: coverPositionX,
      cover_position_y: coverPositionY,
      event_timezone: eventTimezone
    }]).select('id, title, city, venue').single();

    if (error) {
      setErrorMessage('Nao foi possivel publicar o evento.');
      setSaving(false);
      return;
    }

    const { data: followersData } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', currentUser.id);

    await createNotificationsBulk(
      (followersData || []).map((row) => ({
        recipientId: row.follower_id,
        actorId: currentUser.id,
        type: 'event_new',
        title: `${currentUser.name || 'Um artista'} publicou um novo evento`,
        body: `${createdEvent?.title || title} - ${(createdEvent?.venue || venue)}, ${(createdEvent?.city || city)}`,
        entityType: 'event',
        entityId: createdEvent?.id || null
      }))
    );

    setShowCreate(false);
    setSaving(false);
    setNewEvent({
      title: '',
      description: '',
      event_date: '',
      venue: '',
      city: '',
      genre: '',
      ticket_url: '',
      contact_url: '',
      needs_artists: false,
      artist_requirements: '',
      cover_url: '',
      cover_position_x: 50,
      cover_position_y: 50
    });
    clearSelectedCover();
    await fetchEvents();
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Deseja remover este evento?')) return;
    setDeletingId(eventId);
    const { error } = await supabase.from('music_events').delete().eq('id', eventId).eq('organizer_id', currentUser.id);
    if (error) {
      setErrorMessage('Nao foi possivel remover este evento.');
      setDeletingId(null);
      return;
    }
    setDeletingId(null);
    await fetchEvents();
  };

  const filteredEvents = events.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    const queryMatch = !query || item.title?.toLowerCase().includes(query) || item.city?.toLowerCase().includes(query) || item.venue?.toLowerCase().includes(query);
    const artistMatch = artistFilter === 'all'
      || (artistFilter === 'needs' && item.needs_artists)
      || (artistFilter === 'no-needs' && !item.needs_artists);
    return queryMatch && artistMatch;
  });

  const formatEventDate = (eventDate, timezone) => {
    if (!eventDate) return 'Data nao informada';
    const parsedDate = new Date(eventDate);
    if (Number.isNaN(parsedDate.getTime())) return 'Data invalida';
    const options = {
      dateStyle: 'short',
      timeStyle: 'short'
    };
    if (timezone) options.timeZone = timezone;
    return new Intl.DateTimeFormat('pt-BR', options).format(parsedDate);
  };
  const eventMapQuery = `${newEvent.venue || ''} ${newEvent.city || ''}`.trim();
  const eventMapSearchUrl = buildGoogleMapsSearchUrl(eventMapQuery);
  const eventMapEmbedUrl = eventMapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(eventMapQuery)}&output=embed`
    : '';
  const openMapModal = (title, query) => {
    if (!String(query || '').trim()) return;
    setMapModal({ open: true, title: title || 'Mapa', query: String(query).trim() });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><CalendarDays className="w-6 h-6 text-violet-400" /> Eventos</h2>
          <p className="text-zinc-400 text-sm">Veja local, ingresso e se o evento precisa de artistas.</p>
        </div>
        <button onClick={() => setShowCreate((prev) => !prev)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
          {showCreate ? <X className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
          {showCreate ? 'Cancelar' : 'Novo evento'}
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar por evento, local ou cidade..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-violet-500 outline-none" />
        </div>
        <select value={artistFilter} onChange={(event) => setArtistFilter(event.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500 outline-none">
          <option value="all">Todos</option>
          <option value="needs">Precisam de artistas</option>
          <option value="no-needs">Nao precisam de artistas</option>
        </select>
      </div>

      {errorMessage && <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">{errorMessage}</div>}

      {showCreate && (
        <form onSubmit={handleCreateEvent} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-8 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" required value={newEvent.title} onChange={(event) => setNewEvent((prev) => ({ ...prev, title: event.target.value }))} placeholder="Titulo do evento" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="datetime-local" required value={newEvent.event_date} onChange={(event) => setNewEvent((prev) => ({ ...prev, event_date: event.target.value }))} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" required value={newEvent.venue} onChange={(event) => setNewEvent((prev) => ({ ...prev, venue: event.target.value }))} placeholder="Local do evento" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" required value={newEvent.city} onChange={(event) => setNewEvent((prev) => ({ ...prev, city: event.target.value }))} placeholder="Cidade / Estado" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" value={newEvent.genre} onChange={(event) => setNewEvent((prev) => ({ ...prev, genre: event.target.value }))} placeholder="Genero (opcional)" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" value={newEvent.ticket_url} onChange={(event) => setNewEvent((prev) => ({ ...prev, ticket_url: event.target.value }))} placeholder="Link para compra de ingressos" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" value={newEvent.contact_url} onChange={(event) => setNewEvent((prev) => ({ ...prev, contact_url: event.target.value }))} placeholder="Link de contato" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <input type="text" value={newEvent.cover_url} onChange={(event) => setNewEvent((prev) => ({ ...prev, cover_url: event.target.value }))} placeholder="URL da capa (opcional)" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500" />
            <label className="text-xs text-zinc-400">
              Posicao horizontal da capa ({clampPercent(newEvent.cover_position_x, 50)}%)
              <input
                type="range"
                min="0"
                max="100"
                value={clampPercent(newEvent.cover_position_x, 50)}
                onChange={(event) => setNewEvent((prev) => ({ ...prev, cover_position_x: Number(event.target.value) }))}
                className="w-full mt-1"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Posicao vertical da capa ({clampPercent(newEvent.cover_position_y, 50)}%)
              <input
                type="range"
                min="0"
                max="100"
                value={clampPercent(newEvent.cover_position_y, 50)}
                onChange={(event) => setNewEvent((prev) => ({ ...prev, cover_position_y: Number(event.target.value) }))}
                className="w-full mt-1"
              />
            </label>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Local no Maps</span>
              <a
                href={eventMapSearchUrl || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!eventMapSearchUrl) event.preventDefault();
                }}
                className={`text-xs px-2 py-1 rounded-md ${eventMapSearchUrl ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
              >
                Escolher no Maps
              </a>
              <button
                type="button"
                onClick={() => openMapModal('Preview do local', eventMapQuery)}
                disabled={!eventMapQuery}
                className={`text-xs px-2 py-1 rounded-md ${eventMapQuery ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
              >
                Abrir no app
              </button>
            </div>
            {eventMapEmbedUrl && (
              <iframe
                src={eventMapEmbedUrl}
                title="Preview local Evento"
                className="w-full h-48 rounded-xl border border-zinc-800"
                loading="lazy"
              />
            )}
          </div>
          <textarea value={newEvent.description} onChange={(event) => setNewEvent((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="Descricao do evento..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 resize-none" />
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={newEvent.needs_artists} onChange={(event) => setNewEvent((prev) => ({ ...prev, needs_artists: event.target.checked }))} className="rounded border-zinc-700 bg-zinc-900 text-violet-500 focus:ring-violet-500/50" />
            Precisa de artistas para este evento
          </label>
          {newEvent.needs_artists && (
            <textarea value={newEvent.artist_requirements} onChange={(event) => setNewEvent((prev) => ({ ...prev, artist_requirements: event.target.value }))} rows={2} placeholder="Requisitos para artistas..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 resize-none" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
            <button type="button" onClick={() => coverInputRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium">
              <ImageIcon className="w-4 h-4" />
              Enviar capa
            </button>
            {coverFile && (
              <button type="button" onClick={clearSelectedCover} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-red-300 hover:bg-zinc-700 text-sm">
                <X className="w-4 h-4" />
                Remover
              </button>
            )}
          </div>
          {(coverPreview || newEvent.cover_url.trim()) && (
            <img
              src={coverPreview || newEvent.cover_url.trim()}
              className="w-full max-h-64 object-cover rounded-xl border border-zinc-800"
              style={{ objectPosition: `${clampPercent(newEvent.cover_position_x, 50)}% ${clampPercent(newEvent.cover_position_y, 50)}%` }}
            />
          )}
          <button disabled={saving} type="submit" className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-semibold">{saving ? 'Publicando...' : 'Publicar evento'}</button>
        </form>
      )}

      <div className="space-y-4">
        {loading && <p className="text-sm text-zinc-500">Carregando eventos...</p>}
        {!loading && filteredEvents.length === 0 && <p className="text-sm text-zinc-500">Nenhum evento encontrado.</p>}
        {!loading && filteredEvents.map((item) => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {item.cover_url && (
              <img
                src={item.cover_url}
                className="w-full h-44 object-cover bg-zinc-950"
                style={{ objectPosition: `${clampPercent(item.cover_position_x, 50)}% ${clampPercent(item.cover_position_y, 50)}%` }}
              />
            )}
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{item.title}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{formatEventDate(item.event_date, item.event_timezone)} • {item.venue}, {item.city}</p>
                </div>
                {item.organizer_id === currentUser.id && (
                  <button disabled={deletingId === item.id} onClick={() => handleDeleteEvent(item.id)} className="text-zinc-500 hover:text-red-400 disabled:opacity-50" title="Remover evento">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                {item.genre && <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300">{item.genre}</span>}
                {item.needs_artists ? <span className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300">Precisa de artistas</span> : <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">Sem vagas para artistas</span>}
              </div>
              {item.description && <p className="text-sm text-zinc-300 mt-3 whitespace-pre-wrap">{item.description}</p>}
              {item.needs_artists && item.artist_requirements && (
                <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-xs text-emerald-300 font-semibold mb-1">Requisitos para artistas</p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{item.artist_requirements}</p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => item.profiles?.id && onOpenProfile?.(item.profiles)} className="text-xs text-zinc-400 hover:text-violet-300 transition-colors">
                  Organizador: {item.profiles?.name || 'Usuario'} {item.profiles?.handle || ''}
                </button>
                <div className="flex flex-wrap gap-2">
                  {(item.venue || item.city) && (
                    <>
                      <button
                        type="button"
                        onClick={() => openMapModal(item.title || 'Local do evento', `${item.venue || ''}, ${item.city || ''}`)}
                        className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                      >
                        Maps
                      </button>
                      <a href={buildGoogleMapsSearchUrl(`${item.venue || ''}, ${item.city || ''}`)} target="_blank" rel="noreferrer" className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200">
                        Abrir
                      </a>
                    </>
                  )}
                  {item.ticket_url && <a href={item.ticket_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white"><Ticket className="w-4 h-4" />Ingressos</a>}
                  {item.contact_url && <a href={item.contact_url} target="_blank" rel="noreferrer" className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100">Contato</a>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <MapsModal
        isOpen={mapModal.open}
        title={mapModal.title}
        query={mapModal.query}
        onClose={() => setMapModal({ open: false, title: '', query: '' })}
      />
    </div>
  );
}

function NotificationsView({ currentUser, onOpenProfile, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, name, handle, avatar_url)')
      .eq('recipient_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(200);

    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUser.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser.id]);

  const formatTime = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} d`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const markRead = async (notificationId) => {
    const id = Number(notificationId);
    if (!Number.isFinite(id)) return;
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', currentUser.id);
  };

  const markAllRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', currentUser.id)
      .eq('is_read', false);
    setMarkingAll(false);
  };

  const openFromNotification = async (item) => {
    await markRead(item.id);
    const entityType = item.entity_type;
    const entityId = String(item.entity_id || '');

    if (entityType === 'profile' && entityId) {
      onOpenProfile?.(entityId);
      return;
    }

    if (entityType === 'message') {
      if (item.actor_id) window.localStorage.setItem('sonora_direct_target', String(item.actor_id));
      onNavigate?.('direct');
      return;
    }

    if (entityType === 'post') {
      onNavigate?.('feed');
      return;
    }

    if (entityType === 'community') {
      onNavigate?.('communities');
      return;
    }

    if (entityType === 'event') {
      onNavigate?.('events');
      return;
    }
  };

  const getTypeBadge = (type) => {
    if (type === 'like') return 'Like';
    if (type === 'comment') return 'Comentario';
    if (type === 'follow') return 'Follow';
    if (type === 'community_invite') return 'Comunidade';
    if (type === 'message') return 'Mensagem';
    if (type === 'event_new') return 'Evento';
    return 'Notificacao';
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Bell className="w-6 h-6 text-violet-400" /> Notificacoes</h2>
          <p className="text-zinc-400 text-sm">{unreadCount} nao lida(s)</p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={!unreadCount || markingAll}
          className="px-3 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Marcar todas como lidas
        </button>
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-zinc-500">Carregando notificacoes...</p>}
        {!loading && notifications.length === 0 && <p className="text-sm text-zinc-500">Sem notificacoes por enquanto.</p>}
        {!loading && notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openFromNotification(item)}
            className={`w-full text-left rounded-2xl border p-4 transition-colors ${
              item.is_read ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/15'
            }`}
          >
            <div className="flex items-start gap-3">
              <img
                src={item.actor?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.actor?.name || item.title || 'N'}`}
                className="w-10 h-10 rounded-full object-cover bg-zinc-800 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                  <span className="text-[11px] text-zinc-400 shrink-0">{formatTime(item.created_at)}</span>
                </div>
                {item.body && <p className="text-sm text-zinc-300 mt-1 line-clamp-2">{item.body}</p>}
                <div className="mt-2">
                  <span className="text-[11px] px-2 py-1 rounded-md bg-zinc-800 text-zinc-300">{getTypeBadge(item.type)}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
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

function ProfileView({ user, setUser, viewerUser, onOpenProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: user.name, bio: user.bio || '', handle: user.handle });
  const [uploading, setUploading] = useState(false);
  const [capsuleData, setCapsuleData] = useState(() => (
    user?.spotify_capsule && typeof user.spotify_capsule === 'object' ? user.spotify_capsule : null
  ));
  const [capsulePeriod, setCapsulePeriod] = useState('short_term');
  const [syncingCapsule, setSyncingCapsule] = useState(false);
  const [capsuleSyncMessage, setCapsuleSyncMessage] = useState('');
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
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const [isBlockedProfile, setIsBlockedProfile] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(false);

  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  const spotifyToken = window.localStorage.getItem(SPOTIFY_TOKEN_STORAGE_KEY);
  const hasSpotifyConnection = Boolean(getSpotifyAuthData()?.refresh_token || spotifyToken);
  const isOwnProfile = String(user?.id || '') === String(viewerUser?.id || '');

  useEffect(() => {
    setEditForm({ name: user.name, bio: user.bio || '', handle: user.handle });
  }, [user.id, user.name, user.bio, user.handle]);

  useEffect(() => {
    const profileCapsule = user?.spotify_capsule && typeof user.spotify_capsule === 'object'
      ? user.spotify_capsule
      : null;
    setCapsuleData(profileCapsule);
    setCapsuleSyncMessage('');
    setCapsulePeriod('short_term');
  }, [user.id, user.spotify_capsule]);

  const fetchSpotifyJson = async (path, token) => {
    const response = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Spotify API falhou em ${path} (${response.status})`);
    return response.json();
  };

  const syncSpotifyCapsule = async () => {
    if (!isOwnProfile) return;
    if (syncingCapsule) return;
    if (!hasSpotifyConnection) {
      setCapsuleSyncMessage('Conecte o Spotify antes de sincronizar.');
      return;
    }

    setSyncingCapsule(true);
    setCapsuleSyncMessage('');

    try {
      const accessToken = await getValidSpotifyAccessToken();
      if (!accessToken) {
        setCapsuleSyncMessage('Sessao do Spotify expirada. Conecte novamente.');
        return;
      }

      const periodEntries = await Promise.all(
        SPOTIFY_CAPSULE_PERIODS.map(async (period) => {
          const [artistsData, tracksData] = await Promise.all([
            fetchSpotifyJson(`/me/top/artists?limit=5&time_range=${period.id}`, accessToken),
            fetchSpotifyJson(`/me/top/tracks?limit=50&time_range=${period.id}`, accessToken)
          ]);

          const topArtists = Array.isArray(artistsData?.items)
            ? artistsData.items.map((artist) => ({
                id: artist.id,
                name: artist.name,
                image_url: artist.images?.[0]?.url || '',
                genres: Array.from(
                  new Set(
                    (Array.isArray(artist.genres) ? artist.genres : [])
                      .map((genre) => String(genre || '').trim())
                      .filter(Boolean)
                  )
                ).slice(0, 3)
              }))
            : [];

          const tracks = Array.isArray(tracksData?.items) ? tracksData.items : [];
          const totalDurationMs = tracks.reduce((sum, track) => sum + Number(track?.duration_ms || 0), 0);
          const weightedDurationMs = tracks.reduce((sum, track, index) => {
            const rankWeight = Math.max(1, 6 - Math.floor(index / 10));
            return sum + Number(track?.duration_ms || 0) * rankWeight;
          }, 0);
          const minutesTopTracks = Math.round(totalDurationMs / 60000);
          const minutesEstimate = Math.round(weightedDurationMs / 60000);

          return [
            period.id,
            {
              period_label: period.label,
              artists_count: topArtists.length,
              tracks_count: tracks.length,
              minutes_estimate: Math.max(minutesTopTracks, minutesEstimate),
              minutes_top_tracks: minutesTopTracks,
              top_artists: topArtists
            }
          ];
        })
      );

      const snapshot = {
        generated_at: new Date().toISOString(),
        periods: Object.fromEntries(periodEntries)
      };

      setCapsuleData(snapshot);

      const updatePayload = {
        spotify_capsule: snapshot,
        spotify_capsule_updated_at: snapshot.generated_at
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);

      if (updateError) {
        setCapsuleSyncMessage('Sincronizada localmente. Falta criar colunas spotify_capsule no banco.');
      } else {
        setUser({ ...user, ...updatePayload });
        setCapsuleSyncMessage('Capsula sincronizada com sucesso.');
      }
    } catch (error) {
      console.error('Erro ao sincronizar Capsula Spotify:', error);
      setCapsuleSyncMessage('Nao foi possivel sincronizar a Capsula agora.');
    } finally {
      setSyncingCapsule(false);
    }
  };

  useEffect(() => {
    if (!isOwnProfile) return;
    if (!hasSpotifyConnection) return;
    if (capsuleData?.periods) return;
    syncSpotifyCapsule();
  }, [isOwnProfile, hasSpotifyConnection, user.id]);

  useEffect(() => {
    setIsEditing(false);
    loadFollowStats();
    loadProfileCollections();
    loadFollowingState();
    if (isOwnProfile) loadBlockedUsers();
    else setBlockedUsers([]);
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
      if (nextFollowing) {
        await createNotification({
          recipientId: followingId,
          actorId: followerId,
          type: 'follow',
          title: `${viewerUser?.name || 'Alguem'} comecou a seguir voce`,
          entityType: 'profile',
          entityId: followerId
        });
      }
    }

    setFollowLoading(false);
  };

  const handleReportProfile = async () => {
    if (!viewerUser?.id || !user?.id || isOwnProfile) return;
    const reasonPayload = askModerationReason('perfil');
    if (!reasonPayload) return;

    const result = await submitModerationReport({
      reporterId: viewerUser.id,
      reportedUserId: user.id,
      targetType: 'profile',
      targetProfileId: user.id,
      reason: reasonPayload.reason,
      details: reasonPayload.details
    });

    alert(result.ok ? 'Denuncia enviada.' : result.message);
  };

  const handleUnblockFromList = async (blockedId) => {
    if (!viewerUser?.id || !blockedId || moderationLoading) return;
    setModerationLoading(true);
    const result = await unblockUser({ blockerId: viewerUser.id, blockedId });
    if (!result.ok) {
      alert(result.message);
      setModerationLoading(false);
      return;
    }
    setBlockedUsers((prev) => prev.filter((entry) => String(entry.id) !== String(blockedId)));
    if (String(user.id) === String(blockedId)) {
      setIsBlockedProfile(false);
      await loadProfileCollections();
    }
    setModerationLoading(false);
  };

  const handleToggleBlockProfile = async () => {
    if (!viewerUser?.id || !user?.id || isOwnProfile || moderationLoading) return;

    if (isBlockedProfile) {
      if (!window.confirm(`Desbloquear ${user.name || 'este usuario'}?`)) return;
      setModerationLoading(true);
      const result = await unblockUser({ blockerId: viewerUser.id, blockedId: user.id });
      if (!result.ok) {
        alert(result.message);
        setModerationLoading(false);
        return;
      }
      setIsBlockedProfile(false);
      setCollectionsMessage('');
      await loadProfileCollections();
      setModerationLoading(false);
      alert('Usuario desbloqueado com sucesso.');
      return;
    }

    if (!window.confirm(`Bloquear ${user.name || 'este usuario'}? O conteudo dele sera ocultado para voce.`)) return;

    setModerationLoading(true);
    const result = await blockUser({ blockerId: viewerUser.id, blockedId: user.id });
    if (!result.ok) {
      alert(result.message);
      setModerationLoading(false);
      return;
    }

    setIsBlockedProfile(true);
    setIsFollowingProfile(false);
    setProfilePosts([]);
    setProfilePlaylists([]);
    setProfileCommunities([]);
    setProfileAscensaoPosts([]);
    setCollectionsMessage('Usuario bloqueado. Use o botao "Desbloquear" para voltar a ver o conteudo.');
    setModerationLoading(false);
    alert('Usuario bloqueado com sucesso.');
  };

  const loadBlockedUsers = async () => {
    if (!viewerUser?.id || !isOwnProfile) {
      setBlockedUsers([]);
      return;
    }

    setLoadingBlockedUsers(true);
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, profiles!user_blocks_blocked_id_fkey(id, name, handle, avatar_url)')
      .eq('blocker_id', viewerUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      setBlockedUsers([]);
      setLoadingBlockedUsers(false);
      return;
    }

    const normalized = (data || [])
      .map((entry) => entry?.profiles)
      .filter((profile) => profile?.id)
      .map((profile) => ({
        id: profile.id,
        name: profile.name || 'Usuario',
        handle: profile.handle || '',
        avatar_url: profile.avatar_url || ''
      }));

    setBlockedUsers(normalized);
    setLoadingBlockedUsers(false);
  };

  const loadProfileCollections = async () => {
    setLoadingCollections(true);
    setCollectionsMessage('');

    if (!isOwnProfile && viewerUser?.id && user?.id) {
      const { data: blockData, error: blockError } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', viewerUser.id)
        .eq('blocked_id', user.id)
        .limit(1);

      const blockedByViewer = !blockError && Array.isArray(blockData) && blockData.length > 0;
      setIsBlockedProfile(blockedByViewer);

      if (blockedByViewer) {
        setProfilePosts([]);
        setProfilePlaylists([]);
        setProfileCommunities([]);
        setProfileAscensaoPosts([]);
        setCollectionsMessage('Usuario bloqueado. Desbloqueie no banco para voltar a ver o conteudo.');
        setLoadingCollections(false);
        return;
      }
    } else {
      setIsBlockedProfile(false);
    }

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

  const handleSpotifyConnect = async () => {
    try {
      if (!SPOTIFY_CLIENT_ID) {
        alert('Configure VITE_SPOTIFY_CLIENT_ID para ligar o Spotify.');
        return;
      }
      const codeVerifier = createRandomString(96);
      const state = createRandomString(32);
      const codeChallenge = await createCodeChallenge(codeVerifier);
      const scope = 'user-top-read user-read-private';

      window.localStorage.setItem(SPOTIFY_PKCE_VERIFIER_STORAGE_KEY, codeVerifier);
      window.localStorage.setItem(SPOTIFY_PKCE_STATE_STORAGE_KEY, state);

      const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: getSpotifyRedirectUri(),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        scope,
        state,
        show_dialog: 'true'
      });

      window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    } catch (error) {
      console.error('Erro ao iniciar OAuth Spotify:', error);
      alert('Nao foi possivel iniciar conexao com Spotify.');
    }
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

  const handleDeleteProfilePost = async (postId) => {
    if (!isOwnProfile || !postId) return;
    if (!window.confirm('Remover este post do seu perfil e do feed?')) return;
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', viewerUser.id);
    if (error) {
      alert('Nao foi possivel remover este post.');
      return;
    }
    await loadProfileCollections();
  };

  const handleReportProfilePost = async (post) => {
    if (isOwnProfile || !viewerUser?.id || !post?.id) return;
    const reasonPayload = askModerationReason('post');
    if (!reasonPayload) return;

    const result = await submitModerationReport({
      reporterId: viewerUser.id,
      reportedUserId: post.user_id || user.id || null,
      targetType: 'post',
      targetPostId: post.id,
      reason: reasonPayload.reason,
      details: reasonPayload.details
    });

    alert(result.ok ? 'Denuncia enviada.' : result.message);
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
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-zinc-500">{new Date(post.created_at).toLocaleDateString()}</p>
                {isOwnProfile ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteProfilePost(post.id)}
                    className="text-zinc-500 hover:text-red-400"
                    title="Remover conteudo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleReportProfilePost(post)}
                    className="text-zinc-500 hover:text-amber-300"
                    title="Denunciar post"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
              </div>
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

    if (isBlockedProfile) {
      return <p className="text-sm text-zinc-500">Este perfil esta bloqueado para voce.</p>;
    }

    if (activeProfileTab === 'posts') return renderPostsTab();
    if (activeProfileTab === 'playlists') return renderPlaylistsTab();
    if (activeProfileTab === 'communities') return renderCommunitiesTab();
    return renderAscensaoTab();
  };

  const capsulePeriods = capsuleData?.periods && typeof capsuleData.periods === 'object'
    ? capsuleData.periods
    : null;
  const availableCapsulePeriodIds = SPOTIFY_CAPSULE_PERIODS
    .map((period) => period.id)
    .filter((periodId) => Boolean(capsulePeriods?.[periodId]));
  const activeCapsulePeriod = capsulePeriods?.[capsulePeriod]
    ? capsulePeriod
    : (availableCapsulePeriodIds[0] || 'short_term');
  const selectedCapsulePeriodData = capsulePeriods?.[activeCapsulePeriod]
    || (capsulePeriods ? capsulePeriods[Object.keys(capsulePeriods)[0]] : null);
  const capsuleUpdatedAt = user?.spotify_capsule_updated_at || capsuleData?.generated_at || null;
  const formatMinutes = (minutesValue) => {
    const totalMinutes = Math.max(0, Number(minutesValue || 0));
    if (!totalMinutes) return '0 min';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${minutes} min`;
    if (!minutes) return `${hours}h`;
    return `${hours}h ${minutes}min`;
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
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={toggleFollowProfile}
                  disabled={followLoading || moderationLoading || isBlockedProfile}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isFollowingProfile ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'bg-violet-600 text-white hover:bg-violet-700'} disabled:opacity-60`}
                >
                  {followLoading ? 'Salvando...' : isFollowingProfile ? 'Seguindo' : 'Seguir'}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReportProfile}
                    disabled={moderationLoading}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-60 inline-flex items-center gap-1"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Denunciar
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleBlockProfile}
                    disabled={moderationLoading}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-200 hover:bg-zinc-800 disabled:opacity-60 inline-flex items-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    {isBlockedProfile ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </div>
              </div>
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

          <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base md:text-lg font-bold text-white flex items-center">
                  <Headphones className="h-5 w-5 mr-2 text-emerald-400" />
                  Capsula do Tempo Spotify
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {capsuleUpdatedAt
                    ? `Atualizada em ${new Date(capsuleUpdatedAt).toLocaleString()}`
                    : 'Ainda sem sincronizacao publica'}
                </p>
              </div>

              {isOwnProfile && (
                <div className="flex flex-wrap items-center gap-2">
                  {!hasSpotifyConnection && (
                    <button
                      type="button"
                      onClick={handleSpotifyConnect}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                    >
                      Conectar Spotify
                    </button>
                  )}
                  {hasSpotifyConnection && (
                    <button
                      type="button"
                      onClick={syncSpotifyCapsule}
                      disabled={syncingCapsule}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      {syncingCapsule ? 'Sincronizando...' : 'Atualizar capsula'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {isOwnProfile && capsuleSyncMessage && (
              <p className="text-xs text-zinc-400 mb-3">{capsuleSyncMessage}</p>
            )}

            {!selectedCapsulePeriodData && (
              <p className="text-sm text-zinc-500">
                {isOwnProfile
                  ? 'Conecte e sincronize seu Spotify para mostrar sua capsula no perfil.'
                  : 'Este usuario ainda nao publicou a Capsula do Tempo.'}
              </p>
            )}

            {selectedCapsulePeriodData && (
              <div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SPOTIFY_CAPSULE_PERIODS.filter((period) => capsulePeriods?.[period.id]).map((period) => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => setCapsulePeriod(period.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        activeCapsulePeriod === period.id
                          ? 'bg-violet-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Periodo</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {selectedCapsulePeriodData.period_label || 'Resumo'}
                    </p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Minutos (estimado)</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {formatMinutes(
                        selectedCapsulePeriodData.minutes_estimate
                        || selectedCapsulePeriodData.minutes_top_tracks
                        || (Number(selectedCapsulePeriodData.tracks_count || 0) * 3)
                      )}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Top faixas: {formatMinutes(
                        selectedCapsulePeriodData.minutes_top_tracks
                        || (Number(selectedCapsulePeriodData.tracks_count || 0) * 3)
                      )}
                    </p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 col-span-2 md:col-span-1">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Faixas / Artistas</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {Number(selectedCapsulePeriodData.tracks_count || 0)} / {Number(selectedCapsulePeriodData.artists_count || 0)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {(Array.isArray(selectedCapsulePeriodData.top_artists) ? selectedCapsulePeriodData.top_artists : [])
                    .slice(0, 5)
                    .map((artist, index) => {
                      const genresList = Array.isArray(artist?.genres)
                        ? artist.genres.filter(Boolean)
                        : (artist?.genre ? [artist.genre] : []);
                      const artistImage = artist?.image_url || artist?.images?.[0]?.url || '';

                      return (
                        <div key={artist.id || `${artist.name}-${index}`} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0">
                            #{index + 1}
                          </div>
                          {artistImage ? (
                            <img src={artistImage} className="w-9 h-9 rounded-full object-cover bg-zinc-800" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-zinc-800" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{artist.name || 'Artista'}</p>
                            <p className="text-xs text-zinc-500 truncate">
                              {genresList.length ? genresList.join(' - ') : 'Genero nao informado'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-white">Usuarios bloqueados</h3>
            {loadingBlockedUsers && <span className="text-xs text-zinc-500">Atualizando...</span>}
          </div>

          {!loadingBlockedUsers && blockedUsers.length === 0 && (
            <p className="text-sm text-zinc-500">Voce ainda nao bloqueou ninguem.</p>
          )}

          <div className="space-y-2">
            {blockedUsers.map((blockedProfile) => (
              <div key={`blocked-${blockedProfile.id}`} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(blockedProfile.id)}
                  className="flex items-center gap-3 text-left min-w-0"
                >
                  <img src={blockedProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${blockedProfile.name}`} className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{blockedProfile.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{blockedProfile.handle}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleUnblockFromList(blockedProfile.id)}
                  disabled={moderationLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Desbloquear
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}

function MapsModal({ isOpen, title, query, onClose }) {
  if (!isOpen) return null;
  const mapQuery = String(query || '').trim();
  if (!mapQuery) return null;
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  const externalUrl = buildGoogleMapsSearchUrl(mapQuery);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-6">
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{title || 'Mapa'}</p>
            <p className="text-xs text-zinc-500 truncate">{mapQuery}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={externalUrl} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
              Abrir no Maps
            </a>
            <button type="button" onClick={onClose} className="p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800" title="Fechar mapa">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <iframe src={embedUrl} title={title || 'Mapa'} className="w-full h-[52vh] md:h-[68vh] border-0" loading="lazy" />
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
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="overflow-x-auto px-2 pt-1.5">
        <div className="flex items-center gap-1 min-w-max">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${
                  isActive ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-violet-400' : ''}`} />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}






