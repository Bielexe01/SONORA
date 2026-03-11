import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Search, PlusCircle, X, Trash2, Heart, Share2, Bookmark, 
  MessageSquare, MessageCircle, Crown, Users, Hash, Music, 
  LayoutGrid, Award, Radio, PlayCircle, MoreHorizontal, 
  Settings, Edit3, Image as ImageIcon, Mic, Globe, ChevronDown, 
  Disc, Headphones, Play, Pause
} from 'lucide-react';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';
import './CommunitiesHub.css';
import { sendWebPushNotifications } from './pushClient.js';

const supabaseUrl = 'https://vasihzrqjggfbxdmvujc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhc2loenJxamdnZmJ4ZG12dWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDc5NzIsImV4cCI6MjA4ODcyMzk3Mn0.AYrc6tK94iP2lK78nHrSjdenZvXYw-g1_cC7aisgXyA';
const supabase = createClient(supabaseUrl, supabaseKey);

const COMMUNITY_MEMBERS_STORAGE_KEY = 'sonora_community_members';
const COMMUNITY_POSTS_STORAGE_KEY = 'sonora_community_posts';
const COMMUNITY_MEDIA_STORAGE_KEY = 'sonora_community_media';
const COMMUNITY_REACTIONS_STORAGE_KEY = 'sonora_community_post_reactions';
const COMMUNITY_JOIN_REQUESTS_STORAGE_KEY = 'sonora_community_join_requests';
const COMMUNITY_ROLE_ORDER = { owner: 0, admin: 1, mod: 2, member: 3 };
const COMMUNITY_ROLE_LABELS = { owner: 'Owner', admin: 'Admin', mod: 'Mod', member: 'Membro' };
const COMMUNITY_DEFAULT_GENRES = ['Rock', 'Pop', 'Rap', 'Eletrônica', 'Gospel', 'MPB', 'Indie', 'Jazz'];
const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
const REACTION_FIELD_TO_KEY = {
  likes_count: 'likes',
  shares_count: 'shares',
  saves_count: 'saves'
};

const TAB_DEFAULT_POST_TYPE = {
  discussao: 'Discussao',
  topicos: 'Topico',
  colaboracao: 'Colaboracao',
  desafios: 'Desafio',
  midia: 'Discussao'
};

const normalizePostType = (value) => (
  String(value || 'Discussao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const TAB_TITLE_PLACEHOLDER = {
  discussao: 'Pergunta da enquete',
  topicos: 'Titulo do topico',
  colaboracao: 'Titulo da colaboracao',
  desafios: 'Nome do desafio',
  midia: 'Titulo da midia'
};

const TAB_CONTENT_PLACEHOLDER = {
  discussao: 'Contexto da enquete (opcional)',
  topicos: 'Descreva o topico e abra a discussao',
  colaboracao: 'Explique a colaboracao e como participar',
  desafios: 'Explique as regras do desafio',
  midia: 'Descreva a faixa, album ou midia'
};

const normalizeCommunityRole = (value) => {
  const role = String(value || 'member').toLowerCase();
  return COMMUNITY_ROLE_ORDER[role] !== undefined ? role : 'member';
};

const normalizeCommunityStatus = (value) => {
  const status = String(value || 'approved').toLowerCase();
  return ['pending', 'approved', 'rejected'].includes(status) ? status : 'approved';
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

const getSpotifyEmbedHeight = (type) => (type === 'track' || type === 'episode' ? 152 : 352);

const getLocalCommunityMembershipState = (userId) => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMMUNITY_MEMBERS_STORAGE_KEY) || '{}');
    const joinedIds = Array.isArray(raw[userId]) ? raw[userId] : [];
    return { allMemberships: raw, joinedIds };
  } catch {
    return { allMemberships: {}, joinedIds: [] };
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

const getLocalCommunityMediaState = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMMUNITY_MEDIA_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const setLocalCommunityMediaState = (state) => {
  window.localStorage.setItem(COMMUNITY_MEDIA_STORAGE_KEY, JSON.stringify(state));
};

const getLocalCommunityReactionsState = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMMUNITY_REACTIONS_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const setLocalCommunityReactionsState = (state) => {
  window.localStorage.setItem(COMMUNITY_REACTIONS_STORAGE_KEY, JSON.stringify(state));
};

const getLocalCommunityJoinRequestsState = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMMUNITY_JOIN_REQUESTS_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const setLocalCommunityJoinRequestsState = (state) => {
  window.localStorage.setItem(COMMUNITY_JOIN_REQUESTS_STORAGE_KEY, JSON.stringify(state));
};

const setLocalCommunityMediaField = (communityId, field, value) => {
  const state = getLocalCommunityMediaState();
  const current = state[communityId] && typeof state[communityId] === 'object' ? state[communityId] : {};
  state[communityId] = { ...current, [field]: value };
  setLocalCommunityMediaState(state);
};

const updateLocalCommunityPosts = (communityId, updater) => {
  const state = getLocalCommunityPostsState();
  const currentPosts = Array.isArray(state[communityId]) ? state[communityId] : [];
  const nextPosts = updater(currentPosts);
  state[communityId] = nextPosts;
  setLocalCommunityPostsState(state);
  return nextPosts;
};

const createCommunityInviteNotification = async ({ recipientId, actorId, communityId, communityName }) => {
  const recipient = String(recipientId || '');
  const actor = String(actorId || '');
  if (!recipient || !actor || recipient === actor) return;

  const { data, error } = await supabase.from('notifications').insert([{
    recipient_id: recipient,
    actor_id: actor,
    type: 'community_invite',
    title: `${communityName || 'Comunidade'} liberou seu acesso`,
    body: 'Sua solicitacao foi aprovada. Toque para entrar na comunidade.',
    entity_type: 'community',
    entity_id: String(communityId || ''),
    metadata: {
      community_id: String(communityId || ''),
      action: 'approval'
    }
  }]).select('id');

  if (error) return;
  const notificationIds = (data || [])
    .map((item) => item?.id)
    .filter((id) => id !== null && id !== undefined);
  if (notificationIds.length) {
    await sendWebPushNotifications({ supabase, notificationIds });
  }
};

const createCommunityJoinRequestNotifications = async ({
  recipientIds,
  actorId,
  communityId,
  communityName,
  requesterHandle,
  requesterName
}) => {
  const actor = String(actorId || '');
  if (!actor || !Array.isArray(recipientIds) || !recipientIds.length) return;

  const uniqueRecipients = [...new Set(recipientIds
    .map((id) => String(id || '').trim())
    .filter((id) => id && id !== actor))];

  if (!uniqueRecipients.length) return;

  const requesterLabel = requesterHandle || requesterName || 'Um usuario';

  const { data, error } = await supabase.from('notifications').insert(uniqueRecipients.map((recipient) => ({
    recipient_id: recipient,
    actor_id: actor,
    type: 'community_invite',
    title: `Novo pedido em ${communityName || 'Comunidade'}`,
    body: `${requesterLabel} pediu para entrar na comunidade.`,
    entity_type: 'community',
    entity_id: String(communityId || ''),
    metadata: {
      community_id: String(communityId || ''),
      action: 'join_request'
    }
  }))).select('id');

  if (error) return;
  const notificationIds = (data || [])
    .map((item) => item?.id)
    .filter((id) => id !== null && id !== undefined);
  if (notificationIds.length) {
    await sendWebPushNotifications({ supabase, notificationIds });
  }
};

const normalizeCommunityPost = (post) => {
  const content = post.content || '';
  const pollVotes = post.poll_votes && typeof post.poll_votes === 'object' ? post.poll_votes : {};
  const rawPollOptions = Array.isArray(post.poll_options) ? post.poll_options : [];
  const pollOptions = rawPollOptions.map((option, index) => ({
    id: option?.id || `option-${index + 1}`,
    label: String(option?.label || '').trim(),
    votes: Number(option?.votes || 0)
  })).filter((option) => option.label);

  const pollOptionsWithVotes = pollOptions.map((option) => ({ ...option, votes: 0 }));
  Object.values(pollVotes).forEach((selectedOptionId) => {
    const option = pollOptionsWithVotes.find((item) => item.id === selectedOptionId);
    if (option) option.votes += 1;
  });

  const pollTotalVotes = pollOptionsWithVotes.reduce((sum, option) => sum + (option.votes || 0), 0);
  const challengeEntries = Array.isArray(post.challenge_entries)
    ? post.challenge_entries
        .map((entry) => ({
          user_id: entry?.user_id,
          score: Math.max(0, Number(entry?.score || 0)),
          updated_at: entry?.updated_at || post.created_at || new Date().toISOString()
        }))
        .filter((entry) => entry.user_id)
    : [];

  return {
    ...post,
    spotify: parseSpotifyLink(post.spotify_url),
    likes_count: post.likes_count || 0,
    shares_count: post.shares_count || 0,
    saves_count: post.saves_count || 0,
    comments: Array.isArray(post.comments) ? post.comments : [],
    poll_votes: pollVotes,
    poll_options: pollTotalVotes > 0 ? pollOptionsWithVotes : pollOptions,
    poll_total_votes: pollTotalVotes > 0 ? pollTotalVotes : pollOptions.reduce((sum, option) => sum + (option.votes || 0), 0),
    challenge_entries: challengeEntries,
    challenge_unit: String(post.challenge_unit || 'pts'),
    contentPreview: content.length > 180 ? `${content.slice(0, 177)}...` : content
  };
};

export default function CommunitiesHub({ currentUser, onOpenDirect, onOpenProfile }) {
  const [communities, setCommunities] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    rules: '',
    genre: COMMUNITY_DEFAULT_GENRES[0],
    is_public: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [membershipBackend, setMembershipBackend] = useState('checking');
  const [joinedCommunityIds, setJoinedCommunityIds] = useState([]);
  const [pendingRequestsByCommunity, setPendingRequestsByCommunity] = useState({});
  const [communityMembershipsByCommunity, setCommunityMembershipsByCommunity] = useState({});
  const [memberCountMap, setMemberCountMap] = useState({});
  const [memberIdsByCommunity, setMemberIdsByCommunity] = useState({});
  const [joiningId, setJoiningId] = useState(null);
  const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [editingCommunity, setEditingCommunity] = useState(false);
  const [savingCommunity, setSavingCommunity] = useState(false);
  const [communityDraft, setCommunityDraft] = useState({
    name: '',
    description: '',
    rules: '',
    genre: COMMUNITY_DEFAULT_GENRES[0],
    is_public: true
  });

  const [profilesById, setProfilesById] = useState({});

  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [activeTab, setActiveTab] = useState('discussao');
  const [rankingPeriod, setRankingPeriod] = useState('4w');

  const [postsBackend, setPostsBackend] = useState('checking');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [composer, setComposer] = useState({
    post_type: 'Discussao',
    title: '',
    spotify_url: '',
    image_url: '',
    album: '',
    track_number: '',
    content: ''
  });
  const [showComposerExtras, setShowComposerExtras] = useState(false);
  const [showSpotifyInput, setShowSpotifyInput] = useState(false);
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [composerImageFile, setComposerImageFile] = useState(null);
  const [composerImagePreview, setComposerImagePreview] = useState('');
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [postReactions, setPostReactions] = useState({});
  const [copiedPostId, setCopiedPostId] = useState('');
  const [highlightedPostId, setHighlightedPostId] = useState('');
  const [editingPostId, setEditingPostId] = useState('');
  const [editingPostDraft, setEditingPostDraft] = useState({
    title: '',
    content: '',
    spotify_url: '',
    image_url: ''
  });
  const [savingEditPostId, setSavingEditPostId] = useState('');
  const [deletingPostId, setDeletingPostId] = useState('');
  const [pollDraft, setPollDraft] = useState(['', '', '', '']);
  const [challengeUnitDraft, setChallengeUnitDraft] = useState('pts');
  const [uploadingCommunityMedia, setUploadingCommunityMedia] = useState('');
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const composerImageInputRef = useRef(null);
  const sharedLinkRef = useRef(null);

  const communityTabs = [
    { id: 'discussao', label: 'Discussão' },
    { id: 'topicos', label: 'Tópicos' },
    { id: 'colaboracao', label: 'Colaboração' },
    { id: 'desafios', label: 'Desafios' },
    { id: 'midia', label: 'Multimídia' }
  ];

  const periodOptions = [
    { id: '4w', label: 'Últimas 4 Semanas' },
    { id: '6m', label: 'Últimos 6 Meses' },
    { id: 'all', label: 'Sempre' }
  ];

  const postTypeOptions = [
    { value: 'Discussao', label: 'Partilhar no feed' },
    { value: 'Topico', label: 'Tópico' },
    { value: 'Colaboracao', label: 'Colaboração' },
    { value: 'Desafio', label: 'Desafio' },
    { value: 'Playlist', label: 'Lista de Reprodução' }
  ];

  const getCommunityGenre = (community) => {
    if (community.genre) return community.genre;
    const seed = String(community.id || community.name || '')
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return COMMUNITY_DEFAULT_GENRES[seed % COMMUNITY_DEFAULT_GENRES.length];
  };

  const fetchProfilesByIds = async (ids) => {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if (!uniqueIds.length) return {};

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .in('id', uniqueIds);

    if (error || !data) return {};
    return Object.fromEntries(data.map((profile) => [profile.id, profile]));
  };

  const loadMemberships = async (baseCommunities) => {
    const communityIds = baseCommunities.map((community) => community.id);
    if (!communityIds.length) {
      setJoinedCommunityIds([]);
      setPendingRequestsByCommunity({});
      setCommunityMembershipsByCommunity({});
      setMemberCountMap({});
      setMemberIdsByCommunity({});
      return;
    }

    const membershipsByCommunity = {};
    const joinedSet = new Set();

    const { data, error } = await supabase
      .from('community_members')
      .select('community_id, user_id, role, status, created_at, updated_at, approved_at, approved_by')
      .in('community_id', communityIds);

    if (!error) {
      (data || []).forEach((membership) => {
        if (!membership?.community_id || !membership?.user_id) return;
        if (!membershipsByCommunity[membership.community_id]) membershipsByCommunity[membership.community_id] = [];
        membershipsByCommunity[membership.community_id].push({
          ...membership,
          role: normalizeCommunityRole(membership.role),
          status: normalizeCommunityStatus(membership.status)
        });
      });
      setMembershipBackend('remote');
    } else {
      const localMembership = getLocalCommunityMembershipState(currentUser.id);
      Object.entries(localMembership.allMemberships).forEach(([userId, ids]) => {
        if (!Array.isArray(ids)) return;
        ids.forEach((communityId) => {
          if (!membershipsByCommunity[communityId]) membershipsByCommunity[communityId] = [];
          membershipsByCommunity[communityId].push({
            community_id: communityId,
            user_id: userId,
            role: 'member',
            status: 'approved',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
      });
      const localRequests = getLocalCommunityJoinRequestsState();
      Object.entries(localRequests).forEach(([communityId, userIds]) => {
        if (!Array.isArray(userIds)) return;
        userIds.forEach((userId) => {
          if (!membershipsByCommunity[communityId]) membershipsByCommunity[communityId] = [];
          membershipsByCommunity[communityId].push({
            community_id: communityId,
            user_id: userId,
            role: 'member',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
      });
      setMembershipBackend('local');
    }

    const statusWeight = { approved: 3, pending: 2, rejected: 1 };
    const normalizedMemberships = {};
    const approvedMembersByCommunity = {};
    const pendingByCommunity = {};
    const countMap = {};
    const allMemberIds = new Set();

    baseCommunities.forEach((community) => {
      const rows = Array.isArray(membershipsByCommunity[community.id]) ? membershipsByCommunity[community.id] : [];
      const dedupByUser = new Map();

      rows.forEach((membership) => {
        const userId = membership?.user_id;
        if (!userId) return;
        const normalized = {
          ...membership,
          community_id: community.id,
          user_id: userId,
          role: normalizeCommunityRole(membership.role),
          status: normalizeCommunityStatus(membership.status)
        };
        const current = dedupByUser.get(userId);
        if (!current || (statusWeight[normalized.status] || 0) >= (statusWeight[current.status] || 0)) {
          dedupByUser.set(userId, normalized);
        }
      });

      if (community.created_by) {
        dedupByUser.set(community.created_by, {
          community_id: community.id,
          user_id: community.created_by,
          role: 'owner',
          status: 'approved',
          created_at: community.created_at,
          updated_at: community.updated_at
        });
      }

      const memberships = Array.from(dedupByUser.values());
      normalizedMemberships[community.id] = memberships;

      const approvedIds = memberships
        .filter((membership) => membership.status === 'approved')
        .map((membership) => membership.user_id);

      const pendingIds = memberships
        .filter((membership) => membership.status === 'pending')
        .map((membership) => membership.user_id);

      if (approvedIds.includes(currentUser.id)) joinedSet.add(community.id);
      approvedMembersByCommunity[community.id] = Array.from(new Set(approvedIds));
      pendingByCommunity[community.id] = Array.from(new Set(pendingIds));
      countMap[community.id] = approvedMembersByCommunity[community.id].length;
      memberships.forEach((membership) => allMemberIds.add(membership.user_id));
    });

    const profiles = await fetchProfilesByIds(Array.from(allMemberIds));
    setProfilesById((prev) => ({ ...prev, ...profiles }));
    setJoinedCommunityIds(Array.from(joinedSet));
    setPendingRequestsByCommunity(pendingByCommunity);
    setCommunityMembershipsByCommunity(normalizedMemberships);
    setMemberIdsByCommunity(approvedMembersByCommunity);
    setMemberCountMap(countMap);
  };

  const fetchCommunities = async () => {
    setLoadingCommunities(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Não foi possível carregar as comunidades.');
      setLoadingCommunities(false);
      return;
    }

    const base = data || [];
    const creatorIds = [...new Set(base.map((community) => community.created_by).filter(Boolean))];
    const creatorsById = await fetchProfilesByIds(creatorIds);

    const localMedia = getLocalCommunityMediaState();
    const enriched = base.map((community) => {
      const media = localMedia[community.id] || {};
      return {
        ...community,
        genre: getCommunityGenre(community),
        rules: community.rules || '',
        is_public: community.is_public !== false,
        creator: creatorsById[community.created_by] || null,
        avatar_seed: community.name || 'community',
        avatar_url: media.avatar_url || community.avatar_url || null,
        cover_url: media.cover_url || community.cover_url || null
      };
    });

    setProfilesById((prev) => ({ ...prev, ...creatorsById }));
    setCommunities(enriched);
    await loadMemberships(enriched);
    setLoadingCommunities(false);
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  useEffect(() => {
    const requestUserIds = Object.values(pendingRequestsByCommunity)
      .flatMap((ids) => (Array.isArray(ids) ? ids : []))
      .filter(Boolean);
    const uniqueRequestUserIds = [...new Set(requestUserIds)];
    if (!uniqueRequestUserIds.length) return;

    fetchProfilesByIds(uniqueRequestUserIds).then((profiles) => {
      setProfilesById((prev) => ({ ...prev, ...profiles }));
    });
  }, [pendingRequestsByCommunity]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const communityId = params.get('community');
    const postId = params.get('post');
    if (communityId || postId) {
      sharedLinkRef.current = {
        communityId: communityId || null,
        postId: postId || null
      };
    }
  }, []);

  useEffect(() => {
    if (!selectedCommunityId && communities.length) {
      const targetCommunityId = sharedLinkRef.current?.communityId;
      if (targetCommunityId) {
        const matchedCommunity = communities.find((community) => String(community.id) === String(targetCommunityId));
        if (matchedCommunity) {
          setSelectedCommunityId(matchedCommunity.id);
          return;
        }
      }
      setSelectedCommunityId(communities[0].id);
      return;
    }
    if (selectedCommunityId && !communities.some((community) => community.id === selectedCommunityId)) {
      setSelectedCommunityId(communities[0]?.id || null);
    }
  }, [communities, selectedCommunityId]);

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) || null,
    [communities, selectedCommunityId]
  );

  useEffect(() => {
    if (!selectedCommunity) {
      setEditingCommunity(false);
      setCommunityDraft({
        name: '',
        description: '',
        rules: '',
        genre: COMMUNITY_DEFAULT_GENRES[0],
        is_public: true
      });
      return;
    }

    setEditingCommunity(false);
    setCommunityDraft({
      name: selectedCommunity.name || '',
      description: selectedCommunity.description || '',
      rules: selectedCommunity.rules || '',
      genre: selectedCommunity.genre || COMMUNITY_DEFAULT_GENRES[0],
      is_public: selectedCommunity.is_public !== false
    });
  }, [selectedCommunity]);

  useEffect(() => {
    if (!selectedCommunityId) {
      setPostReactions({});
      return;
    }
    const allReactions = getLocalCommunityReactionsState();
    const storedByPost = allReactions[String(selectedCommunityId)];
    if (storedByPost && typeof storedByPost === 'object') {
      setPostReactions(storedByPost);
      return;
    }
    setPostReactions({});
  }, [selectedCommunityId]);

  const fetchCommunityPosts = async (communityId) => {
    setLoadingPosts(true);
    const localState = getLocalCommunityPostsState();
    const localPosts = Array.isArray(localState[communityId]) ? localState[communityId] : [];

    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    if (!error) {
      setPostsBackend('remote');
      const byId = {};
      (data || []).forEach((post) => {
        byId[post.id] = normalizeCommunityPost(post);
      });
      localPosts.forEach((post) => {
        byId[post.id] = normalizeCommunityPost({ ...(byId[post.id] || {}), ...post });
      });
      const merged = Object.values(byId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setCommunityPosts(merged);

      const userIds = [];
      merged.forEach((post) => {
        if (post.user_id) userIds.push(post.user_id);
        (post.comments || []).forEach((comment) => {
          if (comment.user_id) userIds.push(comment.user_id);
        });
      });
      const profiles = await fetchProfilesByIds(userIds);
      setProfilesById((prev) => ({ ...prev, ...profiles }));
      setLoadingPosts(false);
      return;
    }

    setPostsBackend('local');
    const fallback = localPosts.map(normalizeCommunityPost).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setCommunityPosts(fallback);
    setLoadingPosts(false);
  };

  useEffect(() => {
    if (!selectedCommunityId) {
      setCommunityPosts([]);
      return;
    }
    const selected = communities.find((community) => community.id === selectedCommunityId);
    const isCreator = selected?.created_by === currentUser.id;
    const isMember = joinedCommunityIds.includes(selectedCommunityId);
    if (!selected || (!isCreator && !isMember)) {
      setCommunityPosts([]);
      return;
    }
    fetchCommunityPosts(selectedCommunityId);
  }, [selectedCommunityId, communities, joinedCommunityIds, currentUser.id]);

  useEffect(() => {
    const sharedPostId = sharedLinkRef.current?.postId;
    if (!sharedPostId || loadingPosts || !communityPosts.length) return;
    if (rankingPeriod !== 'all') {
      setRankingPeriod('all');
      return;
    }

    const match = communityPosts.find((post) => String(post.id) === String(sharedPostId));
    if (!match) return;

    const targetId = `community-post-${match.id}`;
    requestAnimationFrame(() => {
      const element = document.getElementById(targetId);
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedPostId(String(match.id));
    });
    sharedLinkRef.current = { ...(sharedLinkRef.current || {}), postId: null };
  }, [communityPosts, loadingPosts, rankingPeriod]);

  useEffect(() => {
    if (!highlightedPostId) return;
    const timer = window.setTimeout(() => setHighlightedPostId(''), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightedPostId]);

  useEffect(() => {
    if (!copiedPostId) return;
    const timer = window.setTimeout(() => setCopiedPostId(''), 2200);
    return () => window.clearTimeout(timer);
  }, [copiedPostId]);

  useEffect(() => {
    if (!infoMessage) return;
    const timer = window.setTimeout(() => setInfoMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [infoMessage]);

  useEffect(() => (
    () => {
      if (composerImagePreview && composerImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(composerImagePreview);
      }
    }
  ), [composerImagePreview]);

  const persistPosts = (communityId, nextPosts) => {
    const normalized = nextPosts.map(normalizeCommunityPost).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    updateLocalCommunityPosts(communityId, () => normalized);
    setCommunityPosts(normalized);
  };

  const updatePendingRequests = (updater) => {
    setPendingRequestsByCommunity((current) => {
      const nextState = updater(current);
      setLocalCommunityJoinRequestsState(nextState);
      return nextState;
    });
  };

  const isRequestPending = (communityId, userId = currentUser.id) => {
    const users = pendingRequestsByCommunity[String(communityId)];
    return Array.isArray(users) && users.includes(userId);
  };

  const addJoinRequest = (communityId, userId = currentUser.id) => {
    let changed = false;
    updatePendingRequests((current) => {
      const key = String(communityId);
      const users = Array.isArray(current[key]) ? [...current[key]] : [];
      if (!users.includes(userId)) {
        users.push(userId);
        changed = true;
      }
      return { ...current, [key]: users };
    });
    return changed;
  };

  const removeJoinRequest = (communityId, userId = currentUser.id) => {
    let changed = false;
    updatePendingRequests((current) => {
      const key = String(communityId);
      const users = Array.isArray(current[key]) ? [...current[key]] : [];
      if (!users.includes(userId)) return current;
      changed = true;
      const nextUsers = users.filter((id) => id !== userId);
      if (!nextUsers.length) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: nextUsers };
    });
    return changed;
  };

  const addMemberToLocalState = (communityId, userId) => {
    const localMembership = getLocalCommunityMembershipState(userId);
    const nextJoined = new Set(localMembership.joinedIds || []);
    nextJoined.add(communityId);
    setLocalCommunityMembershipState(userId, Array.from(nextJoined));
  };

  const removeMemberFromLocalState = (communityId, userId) => {
    const localMembership = getLocalCommunityMembershipState(userId);
    const nextJoined = new Set(localMembership.joinedIds || []);
    nextJoined.delete(communityId);
    setLocalCommunityMembershipState(userId, Array.from(nextJoined));
  };

  const getCommunityRoleForUser = (communityId, userId = currentUser.id) => {
    const community = communities.find((item) => item.id === communityId);
    if (!community) return 'visitor';
    if (community.created_by === userId) return 'owner';

    const memberships = communityMembershipsByCommunity[communityId] || [];
    const membership = memberships.find((item) => item.user_id === userId);
    if (!membership) return 'visitor';
    if (membership.status === 'pending') return 'pending';
    if (membership.status !== 'approved') return 'visitor';
    return normalizeCommunityRole(membership.role);
  };

  const canManageMembershipForCommunity = (communityId) => {
    const role = getCommunityRoleForUser(communityId);
    return role === 'owner' || role === 'admin' || role === 'mod';
  };

  const getCommunityManagerRecipientIds = (communityId) => {
    const community = communities.find((item) => String(item.id) === String(communityId));
    const recipients = new Set();

    if (community?.created_by) recipients.add(String(community.created_by));

    const memberships = communityMembershipsByCommunity[communityId] || [];
    memberships.forEach((membership) => {
      if (membership?.status !== 'approved') return;
      const role = normalizeCommunityRole(membership.role);
      if (role === 'admin' || role === 'mod' || role === 'owner') {
        recipients.add(String(membership.user_id));
      }
    });

    return Array.from(recipients);
  };

  const insertMembershipRemote = async ({ communityId, userId, role = 'member', status = 'approved', approvedBy = null }) => {
    await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', userId);

    const payload = {
      community_id: communityId,
      user_id: userId,
      role,
      status
    };

    if (status === 'approved') {
      payload.approved_at = new Date().toISOString();
      payload.approved_by = approvedBy || currentUser.id;
    }

    return supabase.from('community_members').insert([payload]);
  };

  const approveJoinRequest = async (communityId, userId) => {
    const community = communities.find((item) => item.id === communityId);
    if (!community || !canManageMembershipForCommunity(communityId)) return;
    setJoiningId(`${communityId}-${userId}`);

    if (membershipBackend === 'remote') {
      const { error } = await supabase
        .from('community_members')
        .update({
          status: 'approved',
          role: 'member',
          approved_at: new Date().toISOString(),
          approved_by: currentUser.id
        })
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (!error) {
        await loadMemberships(communities);
        await createCommunityInviteNotification({
          recipientId: userId,
          actorId: currentUser.id,
          communityId,
          communityName: community.name
        });
        setInfoMessage('Membro aprovado com sucesso.');
        setJoiningId(null);
        return;
      }

      setMembershipBackend('local');
    }

    addMemberToLocalState(communityId, userId);
    removeJoinRequest(communityId, userId);
    await loadMemberships(communities);
    await createCommunityInviteNotification({
      recipientId: userId,
      actorId: currentUser.id,
      communityId,
      communityName: community.name
    });
    setInfoMessage('Membro aprovado com sucesso.');
    setJoiningId(null);
  };

  const rejectJoinRequest = async (communityId, userId) => {
    const community = communities.find((item) => item.id === communityId);
    if (!community || !canManageMembershipForCommunity(communityId)) return;

    if (membershipBackend === 'remote') {
      setJoiningId(`${communityId}-${userId}`);
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (!error) {
        await loadMemberships(communities);
        setInfoMessage('Solicitação removida.');
        setJoiningId(null);
        return;
      }

      setMembershipBackend('local');
      setJoiningId(null);
    }

    const changed = removeJoinRequest(communityId, userId);
    removeMemberFromLocalState(communityId, userId);
    await loadMemberships(communities);
    if (changed) setInfoMessage('Solicitação removida.');
  };

  const toggleMembership = async (communityId) => {
    const isJoined = joinedCommunityIds.includes(communityId);
    const community = communities.find((item) => item.id === communityId);
    if (!community) return;
    const isPrivateCommunity = community?.is_public === false;
    const pending = isRequestPending(communityId, currentUser.id);

    setJoiningId(communityId);
    setInfoMessage('');
    setErrorMessage('');

    if (!isJoined && isPrivateCommunity) {
      if (membershipBackend === 'remote') {
        if (pending) {
          const { error } = await supabase
            .from('community_members')
            .delete()
            .eq('community_id', communityId)
            .eq('user_id', currentUser.id)
            .eq('status', 'pending');

          if (!error) {
            await loadMemberships(communities);
            setInfoMessage('Solicitação cancelada.');
            setJoiningId(null);
            return;
          }
        } else {
          const { error } = await insertMembershipRemote({
            communityId,
            userId: currentUser.id,
            role: 'member',
            status: 'pending'
          });

          if (!error) {
            await loadMemberships(communities);
            await createCommunityJoinRequestNotifications({
              recipientIds: getCommunityManagerRecipientIds(communityId),
              actorId: currentUser.id,
              communityId,
              communityName: community.name,
              requesterHandle: currentUser.handle,
              requesterName: currentUser.name
            });
            setInfoMessage('Solicitação enviada. Aguarde aprovação da moderação.');
            setJoiningId(null);
            return;
          }
        }

        setMembershipBackend('local');
      }

      if (pending) {
        removeJoinRequest(communityId, currentUser.id);
        setInfoMessage('Solicitação cancelada.');
      } else {
        addJoinRequest(communityId, currentUser.id);
        await createCommunityJoinRequestNotifications({
          recipientIds: getCommunityManagerRecipientIds(communityId),
          actorId: currentUser.id,
          communityId,
          communityName: community.name,
          requesterHandle: currentUser.handle,
          requesterName: currentUser.name
        });
        setInfoMessage('Solicitação enviada. Aguarde aprovação da moderação.');
      }
      setJoiningId(null);
      return;
    }

    if (membershipBackend === 'remote') {
      const { error } = isJoined
        ? await supabase
          .from('community_members')
          .delete()
          .eq('community_id', communityId)
          .eq('user_id', currentUser.id)
        : await insertMembershipRemote({
          communityId,
          userId: currentUser.id,
          role: 'member',
          status: 'approved'
        });

      if (!error) {
        await loadMemberships(communities);
        setJoiningId(null);
        return;
      }

      setMembershipBackend('local');
    }

    const nextJoined = new Set(joinedCommunityIds);
    if (isJoined) nextJoined.delete(communityId);
    else nextJoined.add(communityId);
    const nextJoinedIds = Array.from(nextJoined);
    setJoinedCommunityIds(nextJoinedIds);
    if (isJoined) removeMemberFromLocalState(communityId, currentUser.id);
    else addMemberToLocalState(communityId, currentUser.id);
    setLocalCommunityMembershipState(currentUser.id, nextJoinedIds);
    if (!isJoined) removeJoinRequest(communityId, currentUser.id);
    await loadMemberships(communities);
    setJoiningId(null);
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    const name = newCommunity.name.trim();
    const description = newCommunity.description.trim();
    const rules = newCommunity.rules.trim();
    if (!name || !description) return;

    let insertError = null;
    const withGenre = await supabase
      .from('communities')
      .insert([{
        name,
        description,
        rules,
        created_by: currentUser.id,
        genre: newCommunity.genre,
        is_public: newCommunity.is_public
      }]);

    if (withGenre.error) {
      const withRulesVisibility = await supabase
        .from('communities')
        .insert([{ name, description, rules, created_by: currentUser.id, is_public: newCommunity.is_public }]);

      if (withRulesVisibility.error) {
        const withVisibility = await supabase
          .from('communities')
          .insert([{ name, description, created_by: currentUser.id, is_public: newCommunity.is_public }]);

        if (withVisibility.error) {
          const fallback = await supabase
            .from('communities')
            .insert([{ name, description, created_by: currentUser.id }]);
          insertError = fallback.error || null;
        }
      }
    }

    if (insertError) {
      setErrorMessage('Não foi possível criar a comunidade.');
      return;
    }

    setShowCreate(false);
    setNewCommunity({ name: '', description: '', rules: '', genre: COMMUNITY_DEFAULT_GENRES[0], is_public: true });
    setInfoMessage(newCommunity.is_public ? 'Comunidade pública criada.' : 'Comunidade privada criada.');
    await fetchCommunities();
  };

  const handleSaveCommunitySettings = async () => {
    if (!selectedCommunity) return;
    if (!canManageCommunitySettings) return;

    const payload = {
      name: communityDraft.name.trim(),
      description: communityDraft.description.trim(),
      rules: communityDraft.rules.trim(),
      genre: communityDraft.genre,
      is_public: communityDraft.is_public
    };

    if (!payload.name || !payload.description) {
      setErrorMessage('Nome e descrição são obrigatórios.');
      return;
    }

    setSavingCommunity(true);
    setErrorMessage('');

    const { error } = await supabase
      .from('communities')
      .update(payload)
      .eq('id', selectedCommunity.id);

    setSavingCommunity(false);

    if (error) {
      setErrorMessage('Não foi possível salvar as configurações da comunidade.');
      return;
    }

    setCommunities((prev) => prev.map((community) => (
      community.id === selectedCommunity.id ? { ...community, ...payload } : community
    )));
    setEditingCommunity(false);
    setInfoMessage('Comunidade atualizada.');
  };

  const handleUpdateMemberRole = async (communityId, userId, role) => {
    if (!canManageMemberRoles) return;
    const normalizedRole = normalizeCommunityRole(role);
    if (!['admin', 'mod', 'member'].includes(normalizedRole)) return;

    setUpdatingMemberRoleId(`${communityId}:${userId}`);
    const { error } = await supabase
      .from('community_members')
      .update({ role: normalizedRole })
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .eq('status', 'approved');
    setUpdatingMemberRoleId('');

    if (error) {
      setErrorMessage('Não foi possível atualizar o cargo.');
      return;
    }

    await loadMemberships(communities);
    setInfoMessage('Cargo atualizado.');
  };

  const handleDeleteCommunity = async (community) => {
    if (community.created_by !== currentUser.id) return;
    if (!window.confirm('Deseja eliminar esta comunidade? Esta ação não pode ser desfeita.')) return;

    setDeletingId(community.id);
    const { error } = await supabase
      .from('communities')
      .delete()
      .eq('id', community.id)
      .eq('created_by', currentUser.id);

    if (error) {
      setErrorMessage('Não foi possível eliminar a comunidade.');
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    await fetchCommunities();
  };

  const handleCommunityMediaUpload = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !selectedCommunity) return;
    const currentRole = getCommunityRoleForUser(selectedCommunity.id);
    const canEditCommunityMedia = currentRole === 'owner' || currentRole === 'admin';
    if (!canEditCommunityMedia) return;

    const isCover = field === 'cover_url';
    setUploadingCommunityMedia(field);
    setErrorMessage('');

    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const storagePath = `${currentUser.id}/communities/${selectedCommunity.id}/${field}-${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(storagePath, file, { upsert: true });

      if (uploadError || !uploadData?.path) {
        throw new Error(uploadError?.message || 'Falha ao enviar imagem.');
      }

      const publicUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl;
      const { error: updateError } = await supabase
        .from('communities')
        .update({ [field]: publicUrl })
        .eq('id', selectedCommunity.id);

      setLocalCommunityMediaField(selectedCommunity.id, field, publicUrl);
      setCommunities((prev) =>
        prev.map((community) =>
          community.id === selectedCommunity.id ? { ...community, [field]: publicUrl } : community
        )
      );

      if (updateError) {
        setErrorMessage(`${isCover ? 'Capa' : 'Foto'} atualizada apenas localmente.`);
      }
    } catch {
      setErrorMessage(`Não foi possível atualizar ${isCover ? 'a capa' : 'a foto'} da comunidade.`);
    } finally {
      setUploadingCommunityMedia('');
    }
  };

  const clearComposerImage = () => {
    if (composerImagePreview && composerImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(composerImagePreview);
    }
    setComposerImageFile(null);
    setComposerImagePreview('');
    setComposer((prev) => ({ ...prev, image_url: '' }));
  };

  const handleComposerImageSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      alert('Selecione apenas arquivos de imagem.');
      return;
    }

    if (composerImagePreview && composerImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(composerImagePreview);
    }

    setComposerImageFile(file);
    setComposerImagePreview(URL.createObjectURL(file));
    setShowComposerExtras(true);
  };

  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (!selectedCommunityId) return;
    if (!canPostInCommunity) {
      alert('Junte-se à comunidade para fazer uma publicação.');
      return;
    }

    const title = composer.title.trim();
    const content = composer.content.trim();
    const spotifyInput = composer.spotify_url.trim();
    let imageUrl = composer.image_url.trim();
    const hasImageFile = Boolean(composerImageFile);
    const strictTabType = ['discussao', 'topicos', 'desafios'].includes(activeTab);
    const tabDefaultType = TAB_DEFAULT_POST_TYPE[activeTab] || 'Discussao';
    const postType = strictTabType ? tabDefaultType : (composer.post_type || tabDefaultType);
    const spotify = spotifyInput ? parseSpotifyLink(spotifyInput) : null;
    const pollOptions = pollDraft.map((option) => option.trim()).filter(Boolean);

    if (!title && !content && !spotifyInput && !imageUrl && !hasImageFile) return;
    if (spotifyInput && !spotify) {
      alert('O link do Spotify é inválido.');
      return;
    }
    if (activeTab === 'midia' && !spotifyInput && !imageUrl && !hasImageFile) {
      alert('Na aba Multimídia, adicione uma imagem ou um link do Spotify.');
      return;
    }

    if (activeTab === 'discussao' && pollOptions.length < 2) {
      alert('A enquete precisa de pelo menos 2 opcoes.');
      return;
    }

    setIsPublishingPost(true);

    if (composerImageFile) {
      try {
        const ext = (composerImageFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const filePath = `${currentUser.id}/community-posts/${selectedCommunityId}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, composerImageFile, { upsert: true });

        if (uploadError || !uploadData?.path) {
          throw new Error(uploadError?.message || 'Falha ao enviar imagem.');
        }

        imageUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl;
      } catch {
        if (postsBackend === 'local' && composerImagePreview) {
          imageUrl = composerImagePreview;
        } else {
          alert('Não foi possível anexar a imagem deste post.');
          setIsPublishingPost(false);
          return;
        }
      }
    }

    const now = new Date().toISOString();
    const localId = `local-${Date.now()}`;
    const basePost = {
      community_id: selectedCommunityId,
      user_id: currentUser.id,
      post_type: postType,
      title: title || '',
      spotify_url: spotify?.canonicalUrl || null,
      image_url: imageUrl || null,
      album: composer.album.trim() || null,
      track_number: composer.track_number.trim() || null,
      content,
      likes_count: 0,
      shares_count: 0,
      saves_count: 0,
      comments: [],
      created_at: now
    };
    const modelFields = {
      poll_options: activeTab === 'discussao'
        ? pollOptions.map((label, index) => ({ id: `option-${index + 1}`, label, votes: 0 }))
        : [],
      poll_votes: activeTab === 'discussao' ? {} : {},
      challenge_entries: activeTab === 'desafios' ? [] : [],
      challenge_unit: activeTab === 'desafios' ? (challengeUnitDraft.trim() || 'pts') : null
    };

    let created = { id: localId, ...basePost, ...modelFields };

    if (postsBackend === 'remote') {
      let response = await supabase
        .from('community_posts')
        .insert([basePost])
        .select('*')
        .single();

      if (response.error) {
        const relaxedPost = {
          community_id: selectedCommunityId,
          user_id: currentUser.id,
          post_type: postType,
          title: title || '',
          spotify_url: spotify?.canonicalUrl || null,
          image_url: imageUrl || null,
          content,
          likes_count: 0,
          shares_count: 0,
          saves_count: 0,
          comments: []
        };
        response = await supabase
          .from('community_posts')
          .insert([relaxedPost])
          .select('*')
          .single();
      }

      if (!response.error && response.data) {
        created = {
          ...response.data,
          ...modelFields,
          comments: Array.isArray(response.data.comments) ? response.data.comments : []
        };
      } else {
        setPostsBackend('local');
      }
    }

    persistPosts(selectedCommunityId, [created, ...communityPosts]);
    setComposer({
      post_type: TAB_DEFAULT_POST_TYPE[activeTab] || 'Discussao',
      title: '',
      spotify_url: '',
      image_url: '',
      album: '',
      track_number: '',
      content: ''
    });
    setPollDraft(['', '', '', '']);
    setChallengeUnitDraft('pts');
    setShowComposerExtras(false);
    setShowSpotifyInput(false);
    setShowImageUrlInput(false);
    clearComposerImage();
    setIsPublishingPost(false);
  };

  const openPostEditor = (post) => {
    if (!post) return;
    setEditingPostId(String(post.id));
    setEditingPostDraft({
      title: String(post.title || ''),
      content: String(post.content || ''),
      spotify_url: String(post.spotify_url || ''),
      image_url: String(post.image_url || '')
    });
  };

  const closePostEditor = () => {
    setEditingPostId('');
    setEditingPostDraft({
      title: '',
      content: '',
      spotify_url: '',
      image_url: ''
    });
  };

  const handleSavePostEdit = async (post) => {
    if (!post || !selectedCommunityId) return;

    const canManagePost = post.user_id === currentUser.id || canModerateCommunityPosts;
    if (!canManagePost) return;

    const spotifyInput = editingPostDraft.spotify_url.trim();
    const parsedSpotify = spotifyInput ? parseSpotifyLink(spotifyInput) : null;
    if (spotifyInput && !parsedSpotify) {
      setErrorMessage('O link do Spotify e invalido.');
      return;
    }

    const payload = {
      title: editingPostDraft.title.trim() || '',
      content: editingPostDraft.content.trim(),
      spotify_url: parsedSpotify?.canonicalUrl || null,
      image_url: editingPostDraft.image_url.trim() || null
    };

    setSavingEditPostId(String(post.id));
    persistPosts(
      selectedCommunityId,
      communityPosts.map((current) => (
        String(current.id) === String(post.id)
          ? normalizeCommunityPost({ ...current, ...payload })
          : current
      ))
    );

    if (postsBackend === 'remote' && !String(post.id).startsWith('local-')) {
      let query = supabase
        .from('community_posts')
        .update(payload)
        .eq('id', post.id)
        .eq('community_id', selectedCommunityId);

      if (!canModerateCommunityPosts) {
        query = query.eq('user_id', currentUser.id);
      }

      const { error } = await query;
      if (error) {
        setErrorMessage('Nao foi possivel editar este post.');
        await fetchCommunityPosts(selectedCommunityId);
      }
    }

    setSavingEditPostId('');
    closePostEditor();
  };

  const handleDeletePost = async (post) => {
    if (!post || !selectedCommunityId) return;

    const canManagePost = post.user_id === currentUser.id || canModerateCommunityPosts;
    if (!canManagePost) return;
    if (!window.confirm('Deseja remover este post da comunidade?')) return;

    setDeletingPostId(String(post.id));
    const previousPosts = [...communityPosts];
    persistPosts(
      selectedCommunityId,
      communityPosts.filter((current) => String(current.id) !== String(post.id))
    );

    if (postsBackend === 'remote' && !String(post.id).startsWith('local-')) {
      let query = supabase
        .from('community_posts')
        .delete()
        .eq('id', post.id)
        .eq('community_id', selectedCommunityId);

      if (!canModerateCommunityPosts) {
        query = query.eq('user_id', currentUser.id);
      }

      const { error } = await query;
      if (error) {
        setErrorMessage('Nao foi possivel remover este post.');
        persistPosts(selectedCommunityId, previousPosts);
      }
    }

    setDeletingPostId('');
    if (editingPostId === String(post.id)) closePostEditor();
  };

  const updatePostById = async (postId, updater) => {
    if (!selectedCommunityId) return;
    let updatedPost = null;
    const next = communityPosts.map((post) => {
      if (post.id !== postId) return post;
      updatedPost = normalizeCommunityPost(updater(post));
      return updatedPost;
    });
    persistPosts(selectedCommunityId, next);

    if (!updatedPost || postsBackend !== 'remote' || String(postId).startsWith('local-')) return;

    const { error } = await supabase
      .from('community_posts')
      .update({
        likes_count: updatedPost.likes_count || 0,
        shares_count: updatedPost.shares_count || 0,
        saves_count: updatedPost.saves_count || 0,
        comments: updatedPost.comments || []
      })
      .eq('id', postId)
      .eq('community_id', selectedCommunityId);

    if (error) setPostsBackend('local');
  };

  const persistReactionState = (nextByPost) => {
    if (!selectedCommunityId) return;
    const allReactions = getLocalCommunityReactionsState();
    allReactions[String(selectedCommunityId)] = nextByPost;
    setLocalCommunityReactionsState(allReactions);
  };

  const hasUserReaction = (postId, reactionKey) => {
    const postState = postReactions[String(postId)];
    if (!postState || typeof postState !== 'object') return false;
    const users = Array.isArray(postState[reactionKey]) ? postState[reactionKey] : [];
    return users.includes(currentUser.id);
  };

  const setUserReaction = (postId, reactionKey, shouldAdd) => {
    const postKey = String(postId);
    const postState = postReactions[postKey] && typeof postReactions[postKey] === 'object'
      ? { ...postReactions[postKey] }
      : {};
    const users = Array.isArray(postState[reactionKey]) ? [...postState[reactionKey]] : [];
    const alreadyReacted = users.includes(currentUser.id);

    if (shouldAdd && !alreadyReacted) users.push(currentUser.id);
    if (!shouldAdd && alreadyReacted) {
      const index = users.indexOf(currentUser.id);
      users.splice(index, 1);
    }

    if (shouldAdd === alreadyReacted) return false;

    postState[reactionKey] = users;
    const nextByPost = { ...postReactions, [postKey]: postState };
    setPostReactions(nextByPost);
    persistReactionState(nextByPost);
    return true;
  };

  const toggleReaction = (postId, field) => {
    const reactionKey = REACTION_FIELD_TO_KEY[field];
    if (!reactionKey) return;
    const alreadyReacted = hasUserReaction(postId, reactionKey);
    const shouldAdd = !alreadyReacted;
    const changed = setUserReaction(postId, reactionKey, shouldAdd);
    if (!changed) return;

    const delta = shouldAdd ? 1 : -1;
    updatePostById(postId, (post) => ({
      ...post,
      [field]: Math.max(0, Number(post[field] || 0) + delta)
    }));
  };

  const addReactionOnce = (postId, field) => {
    const reactionKey = REACTION_FIELD_TO_KEY[field];
    if (!reactionKey) return false;
    const changed = setUserReaction(postId, reactionKey, true);
    if (!changed) return false;

    updatePostById(postId, (post) => ({
      ...post,
      [field]: Math.max(0, Number(post[field] || 0) + 1)
    }));
    return true;
  };

  const copyTextToClipboard = async (value) => {
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // fallback below
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch {
      return false;
    }
  };

  const buildPostShareLink = (postId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'communities');
    if (selectedCommunityId) url.searchParams.set('community', String(selectedCommunityId));
    url.searchParams.set('post', String(postId));
    url.hash = `community-post-${postId}`;
    return url.toString();
  };

  const handleSharePost = async (postId) => {
    addReactionOnce(postId, 'shares_count');
    const postLink = buildPostShareLink(postId);
    const copied = await copyTextToClipboard(postLink);
    if (copied) {
      setCopiedPostId(String(postId));
      return;
    }
    window.prompt('Copie o link do post:', postLink);
  };

  const addComment = (postId) => {
    const draft = (commentDrafts[postId] || '').trim();
    if (!draft) return;

    updatePostById(postId, (post) => ({
      ...post,
      comments: [
        ...(post.comments || []),
        {
          id: `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          user_id: currentUser.id,
          content: draft,
          created_at: new Date().toISOString()
        }
      ]
    }));

    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
  };

  const voteOnPoll = (postId, optionId) => {
    if (!canPostInCommunity) return;
    updatePostById(postId, (post) => {
      const pollVotes = post.poll_votes && typeof post.poll_votes === 'object' ? { ...post.poll_votes } : {};
      pollVotes[currentUser.id] = optionId;
      return { ...post, poll_votes: pollVotes };
    });
  };

  const joinChallenge = (postId) => {
    if (!canPostInCommunity) return;
    updatePostById(postId, (post) => {
      const entries = Array.isArray(post.challenge_entries) ? [...post.challenge_entries] : [];
      if (!entries.some((entry) => entry.user_id === currentUser.id)) {
        entries.push({ user_id: currentUser.id, score: 0, updated_at: new Date().toISOString() });
      }
      return { ...post, challenge_entries: entries };
    });
  };

  const addChallengePoints = (postId, points = 10) => {
    if (!canPostInCommunity) return;
    updatePostById(postId, (post) => {
      const entries = Array.isArray(post.challenge_entries) ? [...post.challenge_entries] : [];
      const index = entries.findIndex((entry) => entry.user_id === currentUser.id);
      if (index === -1) {
        entries.push({ user_id: currentUser.id, score: Math.max(0, points), updated_at: new Date().toISOString() });
      } else {
        const currentScore = Number(entries[index].score || 0);
        entries[index] = {
          ...entries[index],
          score: Math.max(0, currentScore + points),
          updated_at: new Date().toISOString()
        };
      }
      return { ...post, challenge_entries: entries };
    });
  };

  const handleMessageCreator = () => {
    if (!selectedCommunity?.created_by || selectedCommunity.created_by === currentUser.id) return;
    window.localStorage.setItem('sonora_direct_target', selectedCommunity.created_by);
    onOpenDirect?.();
  };

  const filteredCommunities = useMemo(() => {
    return communities
      .filter((community) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
          community.name?.toLowerCase().includes(query) ||
          community.description?.toLowerCase().includes(query) ||
          community.genre?.toLowerCase().includes(query)
        );
      })
      .filter((community) => {
        if (activeFilter === 'mine') return community.created_by === currentUser.id;
        if (activeFilter === 'joined') return joinedCommunityIds.includes(community.id) || community.created_by === currentUser.id;
        return true;
      });
  }, [communities, searchQuery, activeFilter, joinedCommunityIds, currentUser.id]);

  const periodStart = useMemo(() => {
    if (rankingPeriod === '4w') return new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    if (rankingPeriod === '6m') return new Date(Date.now() - 182 * 24 * 60 * 60 * 1000);
    return null;
  }, [rankingPeriod]);

  const postsInPeriod = useMemo(() => {
    return communityPosts.filter((post) => {
      if (!periodStart) return true;
      return new Date(post.created_at) >= periodStart;
    });
  }, [communityPosts, periodStart]);

  useEffect(() => {
    setComposer((prev) => ({
      ...prev,
      post_type: TAB_DEFAULT_POST_TYPE[activeTab] || 'Discussao'
    }));
    if (activeTab !== 'discussao') setPollDraft(['', '', '', '']);
    if (activeTab !== 'desafios') setChallengeUnitDraft('pts');
    if (activeTab === 'discussao' || activeTab === 'desafios' || activeTab === 'midia') {
      setShowComposerExtras(true);
    }
    if (activeTab === 'midia') {
      setShowSpotifyInput(true);
      setShowImageUrlInput(true);
    }
  }, [activeTab]);

  const visiblePosts = useMemo(() => {
    return postsInPeriod.filter((post) => {
      const type = normalizePostType(post.post_type);
      if (activeTab === 'discussao') return type === 'discussao' || !post.post_type;
      if (activeTab === 'topicos') return type === 'topico';
      if (activeTab === 'colaboracao') return type === 'colaboracao' || type === 'playlist';
      if (activeTab === 'desafios') return type === 'desafio';
      if (activeTab === 'midia') return Boolean(post.spotify_url || post.image_url || type === 'playlist');
      return true;
    });
  }, [postsInPeriod, activeTab]);

  const topListeners = useMemo(() => {
    if (!selectedCommunity) return [];
    const baseMemberIds = new Set(memberIdsByCommunity[selectedCommunity.id] || []);
    if (selectedCommunity.created_by) baseMemberIds.add(selectedCommunity.created_by);

    const scoreByUser = {};
    Array.from(baseMemberIds).forEach((id, index) => {
      scoreByUser[id] = { user_id: id, points: Math.max(40, 120 - index * 6) };
    });

    postsInPeriod.forEach((post) => {
      if (!scoreByUser[post.user_id]) scoreByUser[post.user_id] = { user_id: post.user_id, points: 0 };
      scoreByUser[post.user_id].points += 30 + (post.likes_count || 0) * 8 + (post.shares_count || 0) * 5 + (post.saves_count || 0) * 6 + (post.comments || []).length * 4;
      (post.comments || []).forEach((comment) => {
        if (!scoreByUser[comment.user_id]) scoreByUser[comment.user_id] = { user_id: comment.user_id, points: 0 };
        scoreByUser[comment.user_id].points += 5;
      });
    });

    return Object.values(scoreByUser)
      .map((entry) => ({ ...entry, profile: profilesById[entry.user_id] || null }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 6);
  }, [selectedCommunity, memberIdsByCommunity, postsInPeriod, profilesById]);

  const selectedCommunityMemberships = selectedCommunity
    ? (communityMembershipsByCommunity[selectedCommunity.id] || [])
    : [];

  const selectedCommunityPendingRequests = selectedCommunityMemberships
    .filter((membership) => membership.status === 'pending')
    .map((membership) => membership.user_id);

  const hasPendingRequestForSelected = selectedCommunityPendingRequests.includes(currentUser.id);
  const selectedRoleKey = selectedCommunity ? getCommunityRoleForUser(selectedCommunity.id) : 'visitor';
  const selectedRole = (
    selectedRoleKey === 'owner'
      ? 'Owner'
      : selectedRoleKey === 'admin'
        ? 'Admin'
        : selectedRoleKey === 'mod'
          ? 'Mod'
          : selectedRoleKey === 'member'
            ? 'Membro'
            : selectedRoleKey === 'pending'
              ? 'Pendente'
              : 'Visitante'
  );

  const canViewCommunityContent = ['owner', 'admin', 'mod', 'member'].includes(selectedRoleKey);
  const canPostInCommunity = canViewCommunityContent;
  const canManageCommunityMembers = ['owner', 'admin', 'mod'].includes(selectedRoleKey);
  const canManageMemberRoles = ['owner', 'admin'].includes(selectedRoleKey);
  const canManageCommunitySettings = ['owner', 'admin'].includes(selectedRoleKey);
  const canModerateCommunityPosts = ['owner', 'admin', 'mod'].includes(selectedRoleKey);
  const canDeleteCommunity = selectedRoleKey === 'owner';

  const pendingRequestProfiles = selectedCommunityMemberships
    .filter((membership) => membership.status === 'pending' && membership.user_id && membership.user_id !== selectedCommunity?.created_by)
    .map((membership) => ({
      user_id: membership.user_id,
      created_at: membership.created_at,
      profile: profilesById[membership.user_id] || null
    }));

  const manageableMemberProfiles = selectedCommunityMemberships
    .filter((membership) => membership.status === 'approved')
    .map((membership) => ({
      ...membership,
      role: normalizeCommunityRole(membership.role),
      profile: profilesById[membership.user_id] || null
    }))
    .sort((a, b) => {
      const roleDiff = (COMMUNITY_ROLE_ORDER[a.role] ?? 999) - (COMMUNITY_ROLE_ORDER[b.role] ?? 999);
      if (roleDiff !== 0) return roleDiff;
      return String(a.profile?.name || '').localeCompare(String(b.profile?.name || ''));
    });
  const composerSpotifyPreview = composer.spotify_url.trim() ? parseSpotifyLink(composer.spotify_url) : null;
  const isExclusivePostTab = ['discussao', 'topicos', 'desafios'].includes(activeTab);
  const composerTypeOptions = isExclusivePostTab
    ? postTypeOptions.filter((option) => option.value === (TAB_DEFAULT_POST_TYPE[activeTab] || 'Discussao'))
    : postTypeOptions;
  const pollOptionDraftValues = pollDraft.map((option) => option.trim()).filter(Boolean);
  const hasComposerPayload = Boolean(
    composer.title.trim() ||
    composer.content.trim() ||
    composer.spotify_url.trim() ||
    composer.image_url.trim() ||
    composerImageFile
  );
  const isPostPublishDisabled = (
    isPublishingPost ||
    !canPostInCommunity ||
    !hasComposerPayload ||
    (activeTab === 'discussao' && pollOptionDraftValues.length < 2) ||
    (activeTab === 'midia' && !composer.spotify_url.trim() && !composer.image_url.trim() && !composerImageFile)
  );
  const emptyStateMessageByTab = {
    discussao: 'Nenhuma discussão por aqui ainda.',
    topicos: 'Nenhum tópico publicado ainda.',
    colaboracao: 'Ainda não há colaborações nesta comunidade.',
    desafios: 'Sem desafios ativos no momento.',
    midia: 'Nenhum post multimídia nesta aba.'
  };

  // Render dummy tags based on genre
  const trendingTags = selectedCommunity 
    ? [`#${selectedCommunity.genre.toLowerCase()}`, '#mix', '#master', '#dicas', '#collab']
    : [];

  return (
    <div className="communities-hub min-h-full bg-black text-slate-200 font-sans selection:bg-violet-500/30">
      
      {/* Top Bar / Global Header */}
      <div className="w-full bg-slate-900 border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-extrabold text-white">Comunidades</h1>
          <button 
            onClick={() => setShowCreate(!showCreate)} 
            className="group flex items-center justify-center gap-2 bg-white text-black hover:bg-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
          >
            {showCreate ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4 transition-transform group-hover:rotate-90" />} 
            {showCreate ? 'Cancelar' : 'Nova Comunidade'}
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 flex flex-col lg:flex-row gap-8">
        
        {/* LEFT SIDEBAR: Community List */}
        <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-4">
          
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar comunidade..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {[
              { id: 'all', label: 'Explorar' },
              { id: 'joined', label: 'Inscrito' },
              { id: 'mine', label: 'Minhas' }
            ].map((filter) => (
              <button 
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)} 
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeFilter === filter.id 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
            {loadingCommunities && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-slate-600 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
            
            {!loadingCommunities && filteredCommunities.length === 0 && (
              <div className="text-center py-8 px-4 border border-slate-800 rounded-2xl bg-slate-900/50">
                <LayoutGrid className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Nenhuma comunidade encontrada.</p>
              </div>
            )}

            {!loadingCommunities && filteredCommunities.map((community) => {
              const isActive = selectedCommunityId === community.id;
              const memberCount = memberCountMap[community.id] || 0;

              return (
                <div 
                  key={community.id} 
                  onClick={() => setSelectedCommunityId(community.id)}
                  className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                    isActive 
                      ? 'bg-slate-800 border-slate-700' 
                      : 'bg-transparent border-transparent hover:bg-slate-900'
                  }`}
                >
                  <img 
                    src={community.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${community.avatar_seed}`} 
                    className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0" 
                    alt={community.name}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                      {community.name}
                    </h3>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {memberCount} membros • {community.genre}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER & RIGHT: Selected Community View */}
        <div className="flex-1 min-w-0 flex flex-col gap-8">
          
          {/* Create Community Form Insert */}
          {showCreate && (
            <form onSubmit={handleCreateCommunity} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl mb-4 shadow-sm animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome</label>
                  <input type="text" placeholder="Ex: Fãs de Synthwave" required value={newCommunity.name} onChange={(e) => setNewCommunity((prev) => ({ ...prev, name: e.target.value }))} className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Gênero</label>
                  <select value={newCommunity.genre} onChange={(e) => setNewCommunity((prev) => ({ ...prev, genre: e.target.value }))} className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 appearance-none cursor-pointer">
                    {COMMUNITY_DEFAULT_GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Privacidade</label>
                  <select
                    value={newCommunity.is_public ? 'public' : 'private'}
                    onChange={(e) => setNewCommunity((prev) => ({ ...prev, is_public: e.target.value === 'public' }))}
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 appearance-none cursor-pointer"
                  >
                    <option value="public">Pública (entrada livre)</option>
                    <option value="private">Privada (aprovação manual)</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descrição</label>
                <textarea placeholder="Sobre o que é esta comunidade?" required value={newCommunity.description} onChange={(e) => setNewCommunity((prev) => ({ ...prev, description: e.target.value }))} className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 resize-none" rows="2" />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Regras (opcional)</label>
                <textarea
                  placeholder="Uma regra por linha. Ex: Sem spam"
                  value={newCommunity.rules}
                  onChange={(e) => setNewCommunity((prev) => ({ ...prev, rules: e.target.value }))}
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 resize-none"
                  rows="3"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-violet-500/20">
                  Criar e Entrar
                </button>
              </div>
            </form>
          )}

          {/* Alerts */}
          {(membershipBackend === 'local' || postsBackend === 'local' || errorMessage || infoMessage) && (
            <div className="flex flex-col gap-2">
              {membershipBackend === 'local' && (
                <div className="bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
                  <Radio className="w-4 h-4 text-amber-400" /> Modo offline ativo.
                </div>
              )}
              {infoMessage && (
                <div className="bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
                  <MessageCircle className="w-4 h-4" /> {infoMessage}
                </div>
              )}
              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
                  <X className="w-4 h-4" /> {errorMessage}
                </div>
              )}
            </div>
          )}

          {!selectedCommunity && !showCreate && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
              <Users className="w-12 h-12 mb-4 text-slate-700" />
              <p className="text-sm font-medium">Selecione uma comunidade no menu para começar.</p>
            </div>
          )}

          {selectedCommunity && (
            <div className="animate-in fade-in duration-300 flex flex-col gap-6">
              
              {/* === MOCKUP STYLED HEADER / HERO === */}
              <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                
                {/* Cover Image */}
                <div className="relative h-48 md:h-64 w-full group">
                  {selectedCommunity.cover_url ? (
                    <img
                      src={selectedCommunity.cover_url}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt={`Capa de ${selectedCommunity.name}`}
                    />
                  ) : (
                    <img 
                      src={selectedCommunity.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedCommunity.avatar_seed}`} 
                      className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50 blur-lg"
                      alt=""
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 to-slate-900 opacity-80 backdrop-blur-3xl"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                  
                  {canManageCommunitySettings && (
                    <>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleCommunityMediaUpload(e, 'cover_url')}
                      />
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCommunityMedia === 'cover_url'}
                        className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white px-3 py-2 rounded-xl hover:bg-black/70 transition text-xs font-semibold disabled:opacity-50"
                      >
                        {uploadingCommunityMedia === 'cover_url' ? 'A enviar...' : 'Editar capa'}
                      </button>
                      {canDeleteCommunity && (
                        <button onClick={() => handleDeleteCommunity(selectedCommunity)} className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-rose-500 hover:text-white transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Community Info Header */}
                <div className="px-4 sm:px-8 pb-4 relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
                  <div className="relative shrink-0">
                    <img 
                      src={selectedCommunity.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedCommunity.avatar_seed}`} 
                      alt="Logo" 
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-4 border-slate-900 object-cover shadow-2xl bg-black"
                    />
                    {canManageCommunitySettings && (
                      <>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleCommunityMediaUpload(e, 'avatar_url')}
                        />
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingCommunityMedia === 'avatar_url'}
                          className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-lg text-[11px] font-semibold hover:bg-black transition disabled:opacity-50"
                        >
                          {uploadingCommunityMedia === 'avatar_url' ? '...' : 'Foto'}
                        </button>
                      </>
                    )}
                    <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full" title="Online"></div>
                  </div>
                  
                  <div className="flex-1 text-center sm:text-left mb-2">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2">
                      {selectedCommunity.name}
                      {selectedRoleKey === 'owner' && <Award className="w-6 h-6 text-fuchsia-500" />}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-slate-400 text-sm font-medium">
                      <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> {selectedCommunity.is_public ? 'Público' : 'Privado'}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {memberCountMap[selectedCommunity.id] || 0} membros</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-fuchsia-400">{selectedCommunity.genre}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{selectedRole}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-2 w-full sm:w-auto shrink-0">
                    {selectedRoleKey === 'owner' ? (
                      <div className="flex-1 sm:flex-none bg-slate-800 text-slate-300 px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-default border border-slate-700">
                        <Crown className="w-5 h-5 text-amber-400" />
                        Owner
                      </div>
                    ) : (
                      <button 
                        onClick={() => toggleMembership(selectedCommunity.id)}
                        disabled={joiningId === selectedCommunity.id || (!joinedCommunityIds.includes(selectedCommunity.id) && !selectedCommunity.is_public && hasPendingRequestForSelected)}
                        className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg ${
                          joinedCommunityIds.includes(selectedCommunity.id)
                            ? 'bg-slate-800 hover:bg-slate-700 text-white'
                            : (!selectedCommunity.is_public && hasPendingRequestForSelected)
                              ? 'bg-slate-800 text-slate-300 cursor-not-allowed'
                              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'
                        }`}
                      >
                        {joiningId === selectedCommunity.id ? '...' : joinedCommunityIds.includes(selectedCommunity.id) ? (
                          <><Users className="w-5 h-5" /> Membro <ChevronDown className="w-4 h-4 text-slate-400" /></>
                        ) : (!selectedCommunity.is_public && hasPendingRequestForSelected)
                          ? 'Solicitação enviada'
                          : (selectedCommunity.is_public ? 'Participar' : 'Pedir entrada')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex overflow-x-auto px-4 sm:px-8 mt-4 gap-6 border-b border-transparent scrollbar-hide">
                  {communityTabs.map((tab) => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`pb-4 px-2 font-semibold text-sm whitespace-nowrap transition-colors relative ${
                        activeTab === tab.id ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-violet-500 rounded-t-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* === TWO COLUMN LAYOUT (FEED + SIDEBAR) === */}
              {canViewCommunityContent ? (
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                
                {/* FEED COLUMN */}
                <div className="flex-1 min-w-0 w-full">
                  
                  {/* Create Post (Composer) */}
                  <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 mb-6 shadow-sm">
                    <form onSubmit={handlePublishPost}>
                      <div className="flex gap-3">
                        <img 
                          src={currentUser?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser?.name || 'U'}`} 
                          alt="You" 
                          className="w-10 h-10 rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700" 
                        />
                        <div className="flex-1 flex flex-col gap-2">
                          <input
                            type="text"
                            value={composer.title}
                            onChange={(e) => setComposer((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder={TAB_TITLE_PLACEHOLDER[activeTab] || 'Titulo'}
                            className="w-full bg-transparent border-none text-white placeholder-slate-500 font-bold focus:outline-none"
                          />
                          <textarea 
                            value={composer.content}
                            onChange={(e) => setComposer((prev) => ({ ...prev, content: e.target.value }))}
                            placeholder={TAB_CONTENT_PLACEHOLDER[activeTab] || 'Escreva sua publicacao'}
                            className="w-full bg-slate-800 text-slate-100 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50 border border-slate-700 min-h-[80px]"
                          ></textarea>
                          <input
                            ref={composerImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleComposerImageSelect}
                          />

                          {showComposerExtras && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 animate-in slide-in-from-top-2">
                              <select
                                value={composer.post_type}
                                onChange={(e) => setComposer((prev) => ({ ...prev, post_type: e.target.value }))}
                                disabled={isExclusivePostTab}
                                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50 appearance-none disabled:opacity-80 disabled:cursor-not-allowed"
                              >
                                {composerTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                              {isExclusivePostTab && (
                                <p className="sm:col-span-2 text-[11px] text-slate-500 -mt-1">
                                  Tipo bloqueado nesta aba para manter os posts exclusivos.
                                </p>
                              )}
                              {(showSpotifyInput || activeTab === 'midia' || composer.spotify_url.trim()) && (
                                <input
                                  type="text"
                                  value={composer.spotify_url}
                                  onChange={(e) => setComposer((prev) => ({ ...prev, spotify_url: e.target.value }))}
                                  placeholder="Cole o link do Spotify"
                                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
                                />
                              )}
                              {(showImageUrlInput || activeTab === 'midia' || composer.image_url.trim()) && (
                                <input
                                  type="text"
                                  value={composer.image_url}
                                  onChange={(e) => setComposer((prev) => ({ ...prev, image_url: e.target.value }))}
                                  placeholder="URL da imagem (opcional)"
                                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50 sm:col-span-2"
                                />
                              )}

                              {activeTab === 'discussao' && (
                                <div className="sm:col-span-2 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                                  <p className="text-xs font-semibold text-slate-400 mb-2">Opcoes da enquete (minimo 2)</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[0, 1, 2, 3].map((index) => (
                                      <input
                                        key={`poll-option-${index}`}
                                        type="text"
                                        value={pollDraft[index] || ''}
                                        onChange={(e) => {
                                          const next = [...pollDraft];
                                          next[index] = e.target.value;
                                          setPollDraft(next);
                                        }}
                                        placeholder={`Opcao ${index + 1}${index < 2 ? ' *' : ''}`}
                                        className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {activeTab === 'desafios' && (
                                <div className="sm:col-span-2 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                                  <label className="text-xs font-semibold text-slate-400 block mb-2">Unidade do ranking</label>
                                  <input
                                    type="text"
                                    value={challengeUnitDraft}
                                    onChange={(e) => setChallengeUnitDraft(e.target.value)}
                                    placeholder="pts"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
                                  />
                                  <p className="text-[11px] text-slate-500 mt-2">Exemplo: pts, xp, km, minutos.</p>
                                </div>
                              )}
                            </div>
                          )}

                          {composerImagePreview && (
                            <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-800 bg-black/40">
                              <img
                                src={composerImagePreview}
                                alt="Prévia da imagem"
                                className="w-full max-h-[280px] object-cover"
                              />
                              <button
                                type="button"
                                onClick={clearComposerImage}
                                className="absolute top-2 right-2 bg-black/60 hover:bg-rose-500 text-white rounded-full p-1.5 transition-colors"
                                title="Remover imagem"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {composerSpotifyPreview && (
                            <div className="mt-2 rounded-xl overflow-hidden bg-black/40">
                              <iframe
                                src={composerSpotifyPreview.embedUrl}
                                title="spotify-preview"
                                className="w-full"
                                height={getSpotifyEmbedHeight(composerSpotifyPreview.type)}
                                frameBorder="0"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              />
                            </div>
                          )}
                          {(showSpotifyInput || activeTab === 'midia' || composer.spotify_url.trim()) && composer.spotify_url.trim() && !composerSpotifyPreview && (
                            <p className="text-xs text-amber-400 mt-1">Link do Spotify inválido.</p>
                          )}

                          {!canPostInCommunity && (
                            <p className="text-xs text-slate-500 mt-2">Participe da comunidade para publicar.</p>
                          )}
                          {activeTab === 'discussao' && pollOptionDraftValues.length < 2 && (
                            <p className="text-xs text-amber-400 mt-2">Adicione pelo menos 2 opcoes para publicar a enquete.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 sm:ml-13">
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowComposerExtras(true);
                              setShowSpotifyInput((prev) => !prev);
                            }}
                            className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                              showSpotifyInput ? 'text-violet-300 bg-violet-400/10' : 'text-slate-400 hover:text-violet-400 hover:bg-violet-400/10'
                            }`}
                          >
                            <Music className="w-4 h-4" />
                            <span className="hidden sm:inline">Música</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowComposerExtras(true);
                              setShowImageUrlInput(true);
                              composerImageInputRef.current?.click();
                            }}
                            className="flex items-center gap-2 text-slate-400 hover:text-fuchsia-400 hover:bg-fuchsia-400/10 px-2 sm:px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                          >
                            <ImageIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Imagem</span>
                          </button>
                        </div>
                        <button 
                          type="submit"
                          disabled={isPostPublishDisabled}
                          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-violet-500/20"
                        >
                          {isPublishingPost ? 'A publicar...' : 'Publicar'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Feed Filters */}
                  <div className="flex items-center justify-between mb-4 bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                      {periodOptions.map((period) => (
                        <button
                          key={period.id}
                          onClick={() => setRankingPeriod(period.id)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                            rankingPeriod === period.id 
                              ? 'bg-slate-800 text-white' 
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Posts list */}
                  <div className="space-y-4">
                    {loadingPosts && (
                      <div className="flex flex-col gap-4">
                        {[1, 2].map(i => (
                          <div key={i} className="bg-slate-900 rounded-2xl p-5 border border-slate-800 animate-pulse">
                            <div className="flex gap-3 items-center mb-4">
                              <div className="w-10 h-10 rounded-full bg-slate-800"></div>
                              <div className="w-32 h-3 bg-slate-800 rounded"></div>
                            </div>
                            <div className="w-full h-24 bg-slate-800 rounded-xl"></div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!loadingPosts && visiblePosts.length === 0 && (
                      <div className="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center">
                        <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">{emptyStateMessageByTab[activeTab] || 'Nenhuma publicação por aqui ainda.'}</p>
                      </div>
                    )}

                    {!loadingPosts && visiblePosts.map((post) => {
                      const author = profilesById[post.user_id] || (post.user_id === currentUser.id ? currentUser : null);
                      const postSpotify = post.spotify || parseSpotifyLink(post.spotify_url);
                      const postType = normalizePostType(post.post_type);
                      const isPollPost = postType === 'discussao' && Array.isArray(post.poll_options) && post.poll_options.length >= 2;
                      const userPollVote = post.poll_votes?.[currentUser.id] || null;
                      const pollTotalVotes = Number(post.poll_total_votes || 0);
                      const challengeUnit = post.challenge_unit || 'pts';
                      const challengeEntries = Array.isArray(post.challenge_entries)
                        ? [...post.challenge_entries].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
                        : [];
                      const currentChallengeEntry = challengeEntries.find((entry) => entry.user_id === currentUser.id) || null;
                      const postIdKey = String(post.id);
                      const hasLikedPost = hasUserReaction(post.id, 'likes');
                      const hasSharedPost = hasUserReaction(post.id, 'shares');
                      const isCopiedPostLink = copiedPostId === postIdKey;
                      const isHighlightedPost = highlightedPostId === postIdKey;
                      const isEditingPost = editingPostId === postIdKey;
                      const canManagePost = post.user_id === currentUser.id || canModerateCommunityPosts;
                      
                      return (
                        <div
                          key={post.id}
                          id={`community-post-${post.id}`}
                          className={`bg-slate-900 rounded-2xl p-5 border mb-4 shadow-sm transition-all ${
                            isHighlightedPost ? 'border-violet-500/80 ring-2 ring-violet-500/40' : 'border-slate-800'
                          }`}
                        >
                          
                          <div className="flex justify-between items-start mb-3">
                            <button
                              type="button"
                              onClick={() => author?.id && onOpenProfile?.(author.id)}
                              className="flex gap-3 items-center text-left"
                            >
                              <img 
                                src={author?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${author?.name || 'U'}`} 
                                alt={author?.name} 
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-800 bg-black" 
                              />
                              <div>
                                <h3 className="text-slate-100 font-bold text-[15px] hover:underline flex items-center gap-1.5">
                                  {author?.name || 'Usuário'}
                                  {author?.id === selectedCommunity.created_by && (
                                    <span className="bg-white text-black text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-black">Owner</span>
                                  )}
                                </h3>
                                <div className="flex items-center gap-1 text-slate-400 text-xs">
                                  <span>{author?.handle || '@usuario'}</span>
                                  <span>•</span>
                                  <span>{new Date(post.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                                </div>
                              </div>
                            </button>
                            {canManagePost ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => (isEditingPost ? closePostEditor() : openPostEditor(post))}
                                  className="text-slate-400 hover:text-violet-300 p-1 rounded-full hover:bg-slate-800 transition-colors"
                                  title={isEditingPost ? 'Cancelar edicao' : 'Editar post'}
                                >
                                  {isEditingPost ? <X className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePost(post)}
                                  disabled={deletingPostId === postIdKey}
                                  className="text-slate-400 hover:text-rose-400 p-1 rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50"
                                  title="Excluir post"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            ) : (
                              <button className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-800 transition-colors">
                                <MoreHorizontal className="w-5 h-5" />
                              </button>
                            )}
                          </div>

                          {isEditingPost && (
                            <div className="mb-4 rounded-xl border border-violet-500/40 bg-slate-950/60 p-3 space-y-2">
                              <input
                                type="text"
                                value={editingPostDraft.title}
                                onChange={(event) => setEditingPostDraft((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder="Titulo do post"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                              />
                              <textarea
                                value={editingPostDraft.content}
                                onChange={(event) => setEditingPostDraft((prev) => ({ ...prev, content: event.target.value }))}
                                placeholder="Conteudo"
                                rows={4}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500 resize-none"
                              />
                              <input
                                type="text"
                                value={editingPostDraft.spotify_url}
                                onChange={(event) => setEditingPostDraft((prev) => ({ ...prev, spotify_url: event.target.value }))}
                                placeholder="Link do Spotify (opcional)"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                              />
                              <input
                                type="text"
                                value={editingPostDraft.image_url}
                                onChange={(event) => setEditingPostDraft((prev) => ({ ...prev, image_url: event.target.value }))}
                                placeholder="URL da imagem (opcional)"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={closePostEditor}
                                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSavePostEdit(post)}
                                  disabled={savingEditPostId === postIdKey}
                                  className="px-3 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                                >
                                  {savingEditPostId === postIdKey ? 'Salvando...' : 'Salvar alteracoes'}
                                </button>
                              </div>
                            </div>
                          )}

                          {!isEditingPost && post.title && <h4 className="text-lg font-bold text-white mb-2 leading-tight">{post.title}</h4>}

                          {!isEditingPost && post.content && (
                            <p className="text-slate-300 text-[15px] leading-relaxed mb-4 whitespace-pre-wrap">
                              {post.content}
                            </p>
                          )}

                          {isPollPost && (
                            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Enquete da discussao</p>
                              <div className="space-y-2">
                                {post.poll_options.map((option) => {
                                  const votes = Number(option.votes || 0);
                                  const percentage = pollTotalVotes > 0 ? Math.round((votes / pollTotalVotes) * 100) : 0;
                                  const isSelected = userPollVote === option.id;
                                  return (
                                    <button
                                      key={`${post.id}-${option.id}`}
                                      type="button"
                                      onClick={() => voteOnPoll(post.id, option.id)}
                                      disabled={!canPostInCommunity}
                                      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                                        isSelected
                                          ? 'border-violet-500 bg-violet-500/10 text-violet-200'
                                          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                                      } disabled:opacity-60`}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium">{option.label}</span>
                                        <span className="text-xs text-slate-400">{votes} votos</span>
                                      </div>
                                      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                          className="h-full bg-violet-500 transition-all"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="mt-2 text-xs text-slate-500">{pollTotalVotes} voto(s) total</p>
                            </div>
                          )}

                          {postType === 'desafio' && (
                            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ranking do desafio</p>
                                <div className="flex gap-2">
                                  {!currentChallengeEntry && (
                                    <button
                                      type="button"
                                      onClick={() => joinChallenge(post.id)}
                                      disabled={!canPostInCommunity}
                                      className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-semibold disabled:opacity-60"
                                    >
                                      Entrar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => addChallengePoints(post.id, 10)}
                                    disabled={!canPostInCommunity}
                                    className="text-xs bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-60"
                                  >
                                    +10 {challengeUnit}
                                  </button>
                                </div>
                              </div>

                              {challengeEntries.length === 0 && (
                                <p className="text-sm text-slate-500">Sem participantes ainda.</p>
                              )}

                              {challengeEntries.length > 0 && (
                                <div className="space-y-2">
                                  {challengeEntries.slice(0, 5).map((entry, index) => {
                                    const entryProfile = profilesById[entry.user_id] || (entry.user_id === currentUser.id ? currentUser : null);
                                    return (
                                      <div key={`${post.id}-challenge-${entry.user_id}`} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="text-xs text-slate-400">#{index + 1}</p>
                                          <p className="text-sm font-semibold text-slate-200 truncate">{entryProfile?.name || 'Usuario'}</p>
                                        </div>
                                        <p className="text-sm font-bold text-violet-300">{Number(entry.score || 0)} {challengeUnit}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Media attachments */}
                          {!isEditingPost && (
                            <div className="space-y-3 mb-2">
                            {postSpotify && (
                              <div className="rounded-xl overflow-hidden bg-black/40 border border-slate-800/50">
                                <iframe
                                  src={postSpotify.embedUrl}
                                  title={`spotify-post-${post.id}`}
                                  className="w-full"
                                  height={getSpotifyEmbedHeight(postSpotify.type)}
                                  frameBorder="0"
                                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                />
                              </div>
                            )}
                            
                            {!postSpotify && post.spotify_url && (
                              <a className="inline-flex items-center gap-2 text-xs font-bold text-black bg-[#1DB954] hover:bg-[#1ed760] px-4 py-2 rounded-full transition-colors" href={post.spotify_url} target="_blank" rel="noreferrer">
                                <PlayCircle className="w-4 h-4" /> Escutar no Spotify
                              </a>
                            )}

                            {post.image_url && (
                              <img
                                src={post.image_url}
                                alt={post.title || 'Mídia anexada'}
                                className="w-full max-h-[400px] object-cover rounded-xl border border-slate-800/50"
                              />
                            )}
                            </div>
                          )}

                          {/* Footer Actions */}
                          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-slate-800/60 text-slate-400">
                            <button
                              onClick={() => toggleReaction(post.id, 'likes_count')}
                              className={`flex items-center gap-2 transition-colors group ${hasLikedPost ? 'text-fuchsia-500' : 'hover:text-fuchsia-500'}`}
                            >
                              <Heart className={`w-5 h-5 transition-transform ${hasLikedPost ? 'fill-fuchsia-500 text-fuchsia-500' : 'group-hover:scale-110'}`} />
                              <span className="text-sm font-medium">{post.likes_count || 0}</span>
                            </button>
                            <button className="flex items-center gap-2 hover:text-violet-400 transition-colors group">
                              <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                              <span className="text-sm font-medium">{(post.comments || []).length}</span>
                            </button>
                            <button
                              onClick={() => handleSharePost(post.id)}
                              className={`flex items-center gap-2 transition-colors group ${hasSharedPost ? 'text-blue-400' : 'hover:text-blue-400'}`}
                              title="Copiar link do post para encaminhar"
                            >
                              <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                              <span className="text-sm font-medium">{post.shares_count || 0}</span>
                            </button>
                          </div>
                          {isCopiedPostLink && (
                            <p className="mt-2 text-xs text-emerald-400">Link do post copiado. Pode encaminhar.</p>
                          )}

                          {/* Comments */}
                          {(post.comments || []).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-3">
                              {(post.comments || []).slice(-3).map((comment, index) => {
                                const commentAuthor = profilesById[comment.user_id] || (comment.user_id === currentUser.id ? currentUser : null);
                                return (
                                  <div key={comment.id || `${post.id}-comment-${index}`} className="flex gap-3 items-start">
                                    <img src={commentAuthor?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${commentAuthor?.name || 'U'}`} className="w-8 h-8 rounded-full object-cover bg-slate-800 shrink-0" alt="Avatar"/>
                                    <div className="bg-slate-800/50 rounded-2xl rounded-tl-sm px-4 py-2 text-sm w-full">
                                      <p className="font-bold text-slate-200 text-xs mb-0.5">{commentAuthor?.name || 'Usuário'}</p>
                                      <p className="text-slate-300 leading-relaxed text-[13px]">{comment.content}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Comment Input */}
                          <div className="mt-4 flex gap-3 items-center">
                            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shrink-0">
                              {currentUser?.avatar_url && <img src={currentUser.avatar_url} className="w-full h-full object-cover" alt="Você" />}
                            </div>
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={commentDrafts[post.id] || ''}
                                onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addComment(post.id);
                                  }
                                }}
                                placeholder="Escreva um comentário..."
                                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-full pl-4 pr-10 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500/50 transition-all"
                                disabled={!canPostInCommunity}
                              />
                              <button
                                type="button"
                                onClick={() => addComment(post.id)}
                                disabled={!canPostInCommunity || !(commentDrafts[post.id] || '').trim()}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white disabled:opacity-0 transition-all"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT COLUMN - SIDEBAR */}
                <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-6">
                  {canManageCommunityMembers && !selectedCommunity.is_public && (
                    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                      <h2 className="text-lg font-bold text-white mb-3">Solicitações de Entrada</h2>
                      {pendingRequestProfiles.length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhuma solicitação pendente.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {pendingRequestProfiles.map((entry) => (
                            <div key={`request-${entry.user_id}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={entry.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${entry.profile?.name || 'U'}`}
                                  alt={entry.profile?.name || 'Usuario'}
                                  className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-700"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-200 truncate">{entry.profile?.name || 'Usuário'}</p>
                                  <p className="text-xs text-slate-500 truncate">{entry.profile?.handle || '@usuario'}</p>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <button
                                  type="button"
                                  onClick={() => approveJoinRequest(selectedCommunity.id, entry.user_id)}
                                  disabled={joiningId === `${selectedCommunity.id}-${entry.user_id}`}
                                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg py-2 disabled:opacity-60"
                                >
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectJoinRequest(selectedCommunity.id, entry.user_id)}
                                  disabled={joiningId === `${selectedCommunity.id}-${entry.user_id}`}
                                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg py-2 disabled:opacity-60"
                                >
                                  Recusar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {canManageCommunitySettings && (
                    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="text-lg font-bold text-white">Gestão da Comunidade</h2>
                        <button
                          type="button"
                          onClick={() => setEditingCommunity((prev) => !prev)}
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold"
                        >
                          {editingCommunity ? 'Cancelar' : 'Editar'}
                        </button>
                      </div>

                      {editingCommunity ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={communityDraft.name}
                            onChange={(event) => setCommunityDraft((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Nome da comunidade"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                          />
                          <textarea
                            value={communityDraft.description}
                            onChange={(event) => setCommunityDraft((prev) => ({ ...prev, description: event.target.value }))}
                            placeholder="Descrição"
                            rows={3}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500 resize-none"
                          />
                          <textarea
                            value={communityDraft.rules}
                            onChange={(event) => setCommunityDraft((prev) => ({ ...prev, rules: event.target.value }))}
                            placeholder="Regras da comunidade (uma por linha)"
                            rows={4}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500 resize-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={communityDraft.genre}
                              onChange={(event) => setCommunityDraft((prev) => ({ ...prev, genre: event.target.value }))}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                            >
                              {COMMUNITY_DEFAULT_GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                            </select>
                            <select
                              value={communityDraft.is_public ? 'public' : 'private'}
                              onChange={(event) => setCommunityDraft((prev) => ({ ...prev, is_public: event.target.value === 'public' }))}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                            >
                              <option value="public">Pública</option>
                              <option value="private">Privada</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={handleSaveCommunitySettings}
                            disabled={savingCommunity}
                            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-60"
                          >
                            {savingCommunity ? 'Salvando...' : 'Salvar alterações'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Gerencie nome, descrição, regras e visibilidade da comunidade.
                        </p>
                      )}
                    </div>
                  )}

                  {canManageMemberRoles && (
                    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                      <h2 className="text-lg font-bold text-white mb-3">Cargos de Membros</h2>
                      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {manageableMemberProfiles.map((member) => {
                          const memberRole = normalizeCommunityRole(member.role);
                          const isOwnerRow = member.user_id === selectedCommunity.created_by || memberRole === 'owner';
                          const isAdminEditingAdmin = selectedRoleKey === 'admin' && memberRole === 'admin';
                          const canEditRole = !isOwnerRow && !isAdminEditingAdmin;
                          const roleOptions = selectedRoleKey === 'owner'
                            ? ['admin', 'mod', 'member']
                            : ['mod', 'member'];

                          return (
                            <div key={`member-role-${member.user_id}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center gap-3">
                              <img
                                src={member.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.profile?.name || 'U'}`}
                                alt={member.profile?.name || 'Usuário'}
                                className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-700"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-200 truncate">{member.profile?.name || 'Usuário'}</p>
                                <p className="text-xs text-slate-500 truncate">{member.profile?.handle || '@usuario'}</p>
                              </div>
                              {canEditRole ? (
                                <select
                                  value={memberRole}
                                  onChange={(event) => handleUpdateMemberRole(selectedCommunity.id, member.user_id, event.target.value)}
                                  disabled={updatingMemberRoleId === `${selectedCommunity.id}:${member.user_id}`}
                                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-violet-500 disabled:opacity-60"
                                >
                                  {roleOptions.map((roleOption) => (
                                    <option key={roleOption} value={roleOption}>
                                      {COMMUNITY_ROLE_LABELS[roleOption]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs px-2 py-1 rounded-md border border-slate-700 bg-slate-800 text-slate-300">
                                  {COMMUNITY_ROLE_LABELS[memberRole] || 'Membro'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* About Section */}
                  <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                    <h2 className="text-lg font-bold text-white mb-3">Sobre</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                      {selectedCommunity.description}
                    </p>
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Regras</p>
                      {selectedCommunity.rules?.trim() ? (
                        <ul className="space-y-1">
                          {selectedCommunity.rules
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((rule, index) => (
                              <li key={`rule-${index}`} className="text-sm text-slate-300 leading-relaxed">• {rule}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">Nenhuma regra cadastrada.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 text-sm mb-4">
                      <Disc className="w-5 h-5 text-fuchsia-400" />
                      <span>Criada em {new Date(selectedCommunity.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Trending Tags (Dynamic from genre/name for display) */}
                  <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Hash className="w-5 h-5 text-violet-400" />
                      Tópicos em Alta
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {trendingTags.map(tag => (
                        <span key={tag} className="bg-slate-800 hover:bg-violet-900/40 hover:text-violet-300 text-slate-300 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors border border-slate-700/50 hover:border-violet-500/30">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Top Listeners / Producers */}
                  <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Headphones className="w-5 h-5 text-fuchsia-400" />
                      Membros Destaque
                    </h2>
                    
                    {topListeners.length === 0 ? (
                      <p className="text-sm text-slate-500 pb-2">Nenhum membro ativo no momento.</p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {topListeners.map((entry, index) => (
                          <div key={entry.user_id} className="flex items-center gap-3">
                            <div className="relative">
                              <img 
                                src={entry.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${entry.profile?.name || 'U'}`} 
                                alt={entry.profile?.name} 
                                className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 object-cover" 
                              />
                              {index === 0 && <Crown className="absolute -top-2 -right-1 w-4 h-4 text-amber-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-slate-200 hover:text-violet-400 cursor-pointer truncate">
                                {entry.profile?.name || 'Usuário'}
                              </h4>
                              <p className="text-xs text-slate-500 truncate">
                                {entry.points} pts • {entry.profile?.handle || '@usuario'}
                              </p>
                            </div>
                            {entry.user_id !== currentUser.id && (
                              <button className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0">
                                Seguir
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                  <Users className="w-10 h-10 mx-auto text-slate-500 mb-3" />
                  <h3 className="text-xl font-bold text-white mb-2">Conteúdo restrito</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Apenas membros podem ver posts, rankings e tópicos desta comunidade.
                  </p>
                  {!['owner', 'admin', 'mod', 'member'].includes(selectedRoleKey) && (
                    <button
                      type="button"
                      onClick={() => toggleMembership(selectedCommunity.id)}
                      disabled={joiningId === selectedCommunity.id || (!selectedCommunity.is_public && hasPendingRequestForSelected)}
                      className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold transition-colors ${
                        !selectedCommunity.is_public && hasPendingRequestForSelected
                          ? 'bg-slate-800 text-slate-300 cursor-not-allowed'
                          : 'bg-violet-600 hover:bg-violet-500 text-white'
                      }`}
                    >
                      {joiningId === selectedCommunity.id
                        ? '...'
                        : (!selectedCommunity.is_public && hasPendingRequestForSelected)
                          ? 'Solicitação enviada'
                          : (selectedCommunity.is_public ? 'Participar para desbloquear' : 'Pedir entrada')}
                    </button>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
