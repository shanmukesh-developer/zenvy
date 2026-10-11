import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import {
  Sparkles,
  MapPin,
  CheckCheck,
  Check,
  Clock,
  Pin,
  VolumeX,
  Users,
  BookOpen,
  ChevronRight,
  Radio,
  Navigation,
  Utensils,
  Dumbbell,
  Sofa,
  Mic,
  Wifi,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
// expo-location is optional — gracefully handle absence
let Location: any = null;
try {
  Location = require('expo-location');
} catch (e) {
  // expo-location not available
}
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';
import { CampusProfileData, CampusUserData, CampusChatListItem } from '../../../types/campus';
import { fetchChats, fetchProximityRooms, ProximityRoomItem } from '../campusApi';
import { connectCampusSocket } from '../campusSocketClient';
import ShimmerLoader from '../../../components/ShimmerLoader';
import { CatchMeUpModal } from '../components/CatchMeUpModal';

// Location is asked for once per app session and reused across ChatsTab remounts.
let locationAsked = false;
let cachedLocation: { lat: number; lng: number } | null = null;

interface ChatItem {
  id: string;
  name: string;
  avatarBg: string;
  avatarText: string;
  lastMessage: string;
  lastSender?: string;
  time: string;
  unreadCount: number;
  type: 'class' | 'club' | 'study' | 'dm' | 'ride' | 'secret';
  isGroup: boolean;
  avatarUrl?: string | null;
  isPinned?: boolean;
  isMuted?: boolean;
  deliveryStatus?: 'clock' | 'sent' | 'delivered' | 'read';
}

interface ChatsTabProps {
  profile: CampusProfileData | null;
  user: CampusUserData | null;
  onSelectChat: (chatId: string, chatName: string) => void;
  onOpenJoinGroup: () => void;
  onOpenGroups: () => void;
  onOpenProximityRoom: (roomSlug: string) => void;
  onUnreadChange?: (total: number) => void;
  /** Chat currently open in ChatDetailScreen: live updates for it must not count as unread. */
  activeChatId?: string | null;
  /** Bump to force a silent reload of the list (after a join, or when a chat closes). */
  refreshKey?: number;
}

type ChatFilter = 'All' | 'Unread' | 'Classes' | 'Clubs' | 'Groups' | 'People';

const ICON_MAP: Record<string, any> = {
  BookOpen,
  Utensils,
  Dumbbell,
  Users,
  MapPin,
  Sofa,
  Mic,
};

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  library: { bg: CampusColors.accentSoft, fg: CampusColors.accentDeep },
  dining: { bg: CampusColors.warmSoft, fg: CampusColors.warmDeep },
  sports: { bg: '#DCFCE7', fg: '#166534' },
  hostel: { bg: CampusColors.roseSoft, fg: CampusColors.roseDeep },
  academic: { bg: CampusColors.accentSoft, fg: CampusColors.accentDeep },
  common: { bg: '#F3E8FF', fg: '#7C3AED' },
};

const initials = (name: string): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const avatarBgFor = (type: string): string => {
  switch (type) {
    case 'class':
      return CampusColors.accentSoft;
    case 'club':
    case 'ride':
      return CampusColors.warmSoft;
    case 'study':
      return '#DCFCE7';
    case 'secret':
      return CampusColors.roseSoft;
    case 'dm':
    default:
      return CampusColors.placeholderFill;
  }
};

const formatChatTime = (value?: string | Date | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

const formatDistance = (meters: number | null): string => {
  if (meters == null) return '';
  if (meters < 100) return `${meters}m away`;
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

const mapServerChat = (c: CampusChatListItem): ChatItem => {
  const name = c.name || (c.isGroup ? 'Group' : 'Direct Message');
  const body = c.lastMessage || (c.isGroup ? 'No messages yet' : 'Say hi 👋');
  const preview =
    c.isGroup && c.lastSender && c.lastMessage ? `${c.lastSender}: ${c.lastMessage}` : body;
  return {
    id: c.id,
    name,
    avatarBg: avatarBgFor(c.type),
    avatarText: initials(name),
    lastMessage: preview,
    time: formatChatTime(c.lastMessageAt),
    unreadCount: c.unreadCount || 0,
    type: (c.type as ChatItem['type']) || (c.isGroup ? 'study' : 'dm'),
    isGroup: !!c.isGroup,
    avatarUrl: c.avatarUrl && /^(https?:|data:)/i.test(c.avatarUrl) ? c.avatarUrl : null,
  };
};

export const ChatsTab: React.FC<ChatsTabProps> = ({
  profile,
  user,
  onSelectChat,
  onOpenJoinGroup,
  onOpenGroups,
  onOpenProximityRoom,
  onUnreadChange,
  activeChatId,
  refreshKey,
}) => {
  const [filter, setFilter] = useState<ChatFilter>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 5: Proximity rooms state
  const [proximityRooms, setProximityRooms] = useState<ProximityRoomItem[]>([]);
  const [proximityLoading, setProximityLoading] = useState(true);
  const [proximityError, setProximityError] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(cachedLocation);
  const [catchMeUpOpen, setCatchMeUpOpen] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);
  const activeChatIdRef = useRef<string | null | undefined>(activeChatId);
  activeChatIdRef.current = activeChatId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const chatsRef = useRef<ChatItem[]>([]);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Pulse animation for live proximity dot
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Request location for proximity (once per app session: ChatsTab remounts on every tab switch).
  useEffect(() => {
    if (!Location || locationAsked) return;
    locationAsked = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy?.Balanced ?? 3,
          });
          cachedLocation = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          if (!mountedRef.current) return;
          setUserLocation(cachedLocation);
        }
      } catch (e) {
        console.warn('[CHATS_TAB] Location error:', e);
      }
    })();
  }, []);

  // Load proximity rooms
  const loadProximityRooms = useCallback(async () => {
    setProximityLoading(true);
    try {
      const rooms = await fetchProximityRooms(userLocation?.lat, userLocation?.lng);
      if (mountedRef.current) {
        setProximityRooms(rooms);
        setProximityError(false);
      }
    } catch (e) {
      if (mountedRef.current) setProximityError(true);
    } finally {
      if (mountedRef.current) setProximityLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    loadProximityRooms();
  }, [loadProximityRooms]);

  const loadChats = useCallback(async () => {
    try {
      const data = await fetchChats();
      if (!mountedRef.current) return;
      const mapped = data.map(mapServerChat);
      // The open chat is being read right now: never show it as unread.
      const openId = activeChatIdRef.current;
      setChats(openId ? mapped.map((c) => (c.id === openId ? { ...c, unreadCount: 0 } : c)) : mapped);
      setError(null);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || "Couldn't load your chats.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Silent reload when the shell asks (group joined, chat closed -> own last message + receipts).
  const firstRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === firstRefreshKey.current) return;
    loadChats();
  }, [refreshKey, loadChats]);

  // Live updates from the /campus socket namespace.
  useEffect(() => {
    const socket = connectCampusSocket();

    const onChatUpdated = (data: any) => {
      if (!data || !data.chatId) return;
      const known = chatsRef.current.some((c) => c.id === data.chatId);
      if (!known) {
        loadChats();
        return;
      }
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === data.chatId);
        if (idx === -1) return prev;
        const current = prev[idx];
        const isOpen = activeChatIdRef.current === data.chatId;
        const updated: ChatItem = {
          ...current,
          lastMessage:
            current.isGroup && data.lastSender
              ? `${data.lastSender}: ${data.lastMessage || ''}`
              : data.lastMessage || current.lastMessage,
          time: formatChatTime(data.time || new Date()),
          unreadCount: isOpen ? 0 : current.unreadCount + 1,
        };
        const next = [...prev];
        next.splice(idx, 1);
        return [updated, ...next];
      });
    };

    socket.on('chat:updated', onChatUpdated);
    return () => {
      socket.off('chat:updated', onChatUpdated);
    };
  }, [loadChats]);

  // Report total unread up to the shell for the bottom-nav badge.
  useEffect(() => {
    if (onUnreadChange && !loading) {
      onUnreadChange(chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
    }
  }, [chats, loading, onUnreadChange]);

  const handleSelect = (id: string, name: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    onSelectChat(id, name);
  };

  const filterChips: ChatFilter[] = ['All', 'Unread', 'Classes', 'Clubs', 'Groups', 'People'];

  const filteredChats = chats.filter((c) => {
    if (filter === 'All') return true;
    if (filter === 'Classes') return c.type === 'class';
    if (filter === 'Clubs') return c.type === 'club';
    if (filter === 'People') return !c.isGroup;
    if (filter === 'Unread') return c.unreadCount > 0;
    if (filter === 'Groups') return c.isGroup;
    return true;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadChats(), loadProximityRooms()]);
    if (mountedRef.current) setRefreshing(false);
  };

  const renderStatusTick = (status?: string) => {
    if (status === 'read') return <CheckCheck size={14} color={CampusColors.accent} strokeWidth={2.2} />;
    if (status === 'delivered') return <CheckCheck size={14} color={CampusColors.muted} strokeWidth={2} />;
    if (status === 'sent') return <Check size={14} color={CampusColors.muted} strokeWidth={2} />;
    if (status === 'clock') return <Clock size={12} color={CampusColors.muted} strokeWidth={2} />;
    return null;
  };

  // Compute catch-me-up summary from unread chats
  const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const unreadChats = chats.filter((c) => c.unreadCount > 0);
  const unreadChatCount = unreadChats.length;
  const topUnreadChats = [...unreadChats].sort((a, b) => b.unreadCount - a.unreadCount).slice(0, 3);
  const nearbyRooms = proximityRooms.filter((r) => r.isNearby);
  const allRooms = proximityRooms.length > 0 ? proximityRooms : [];

  if (loading) {
    return (
      <View style={[styles.container, styles.content]}>
        <ShimmerLoader width="100%" height={46} borderRadius={14} style={{ marginBottom: 12 }} />
        <ShimmerLoader width="100%" height={92} borderRadius={16} style={{ marginBottom: 16 }} />
        <View style={styles.chatListCard}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.chatRow, i === 4 && { borderBottomWidth: 0 }]}>
              <ShimmerLoader width={48} height={48} borderRadius={12} />
              <View style={{ flex: 1, gap: 8 }}>
                <ShimmerLoader width="55%" height={14} borderRadius={6} />
                <ShimmerLoader width="80%" height={12} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error && chats.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Couldn't load chats</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setLoading(true);
            loadChats();
          }}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CampusColors.accent} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Phase 3: Groups entry */}
      <TouchableOpacity style={styles.groupsEntry} onPress={onOpenGroups} activeOpacity={0.85}>
        <Users size={16} color={CampusColors.accentDeep} strokeWidth={2.2} />
        <Text style={styles.groupsEntryText}>My Groups & Classrooms</Text>
      </TouchableOpacity>

      {/* 1. "Catch me up" summary card (real unread data; tap opens the digest of unread chats + announcements) */}
      <TouchableOpacity
        style={styles.catchMeUpCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setCatchMeUpOpen(true);
        }}
        activeOpacity={0.85}
      >
        <View style={styles.catchMeUpHeader}>
          <View style={styles.catchMeUpTag}>
            <Sparkles size={13} color="#F2B27E" strokeWidth={2} />
            <Text style={styles.catchMeUpTagText}>CATCH ME UP</Text>
          </View>
          {totalUnread > 0 && (
            <Text style={styles.catchMeUpTime}>
              Tap for a summary
            </Text>
          )}
        </View>
        {totalUnread > 0 ? (
          <Text style={styles.catchMeUpBody}>
            <Text style={styles.bold}>{totalUnread} unread</Text>
            {' across '}
            <Text style={styles.bold}>
              {unreadChatCount} chat{unreadChatCount > 1 ? 's' : ''}
            </Text>
            {topUnreadChats.length > 0 && (
              <>
                {' • '}
                {topUnreadChats.map((c) => c.name).join(', ')}
              </>
            )}
            {nearbyRooms.length > 0 && (
              <>
                {'\n'}
                <Text style={styles.bold}>{nearbyRooms.length}</Text>
                {' live zone'}
                {nearbyRooms.length > 1 ? 's' : ''} active nearby
              </>
            )}
          </Text>
        ) : (
          <Text style={styles.catchMeUpBody}>
            All caught up! No unread messages.
            {nearbyRooms.length > 0
              ? ` ${nearbyRooms.length} live zone${nearbyRooms.length > 1 ? 's' : ''} active nearby.`
              : ''}
          </Text>
        )}
      </TouchableOpacity>

      {/* 2. "Around you now" — Phase 5 Live Proximity Rooms */}
      <View style={styles.proximitySection}>
        <View style={styles.sectionHeader}>
          <View style={styles.proximityTitleRow}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <Radio size={14} color="#059669" />
            </Animated.View>
            <Text style={styles.sectionTitle}>Around you now</Text>
            {userLocation && (
              <View style={styles.locationBadge}>
                <Navigation size={10} color={CampusColors.accent} />
                <Text style={styles.locationBadgeText}>Live</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            {nearbyRooms.length > 0
              ? `${nearbyRooms.length} zone${nearbyRooms.length > 1 ? 's' : ''} in range`
              : 'Location-bound live chat'}
          </Text>
        </View>

        {proximityLoading ? (
          <View style={styles.proximityLoadingWrap}>
            <ActivityIndicator size="small" color={CampusColors.accent} />
          </View>
        ) : allRooms.length === 0 ? (
          <TouchableOpacity style={styles.proximityLoadingWrap} onPress={loadProximityRooms} activeOpacity={0.7}>
            <Text style={styles.sectionSubtitle}>
              {proximityError
                ? "Couldn't load live zones. Tap to try again."
                : 'No live zones right now. Tap to refresh.'}
            </Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.proximityScroll}>
            {allRooms.map((room) => {
              const IconComp = ICON_MAP[room.icon] || MapPin;
              const colors = CATEGORY_COLORS[room.category] || CATEGORY_COLORS.common;

              return (
                <TouchableOpacity
                  key={room.slug}
                  style={[
                    styles.proximityCard,
                    room.isNearby && styles.proximityCardNearby,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onOpenProximityRoom(room.slug);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.proximityIconWrap, { backgroundColor: colors.bg }]}>
                    <IconComp size={16} color={colors.fg} />
                  </View>
                  <View style={styles.proximityInfo}>
                    <Text style={styles.proximityName} numberOfLines={1}>
                      {room.name}
                    </Text>
                    <View style={styles.proximityMetaRow}>
                      {room.activeUserCount > 0 && (
                        <View style={styles.proximityLiveChip}>
                          <Wifi size={9} color="#059669" />
                          <Text style={styles.proximityLiveText}>
                            {room.activeUserCount}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.proximityMeta} numberOfLines={1}>
                        {room.isNearby
                          ? `📍 ${formatDistance(room.distance)}`
                          : room.distance != null
                          ? formatDistance(room.distance)
                          : room.subtitle}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={14} color={CampusColors.muted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 3. Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
        {filterChips.map((chip) => {
          const isSelected = filter === chip;
          return (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, isSelected && styles.activeChip]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(chip);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.activeChipText]}>
                {chip}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 4. Chat List (real data) */}
      <View style={styles.chatListCard}>
        {filteredChats.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.chatRow,
              idx === filteredChats.length - 1 && { borderBottomWidth: 0 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleSelect(item.id, item.name);
            }}
            activeOpacity={0.7}
          >
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: item.avatarBg, overflow: 'hidden' }]}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{item.avatarText}</Text>
              )}
            </View>

            {/* Chat info */}
            <View style={styles.chatDetails}>
              <View style={styles.chatHeaderRow}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.timeText, item.unreadCount > 0 && styles.activeTimeText]}>
                  {item.time}
                </Text>
              </View>

              <View style={styles.chatMessageRow}>
                <View style={styles.messagePreviewWrap}>
                  {item.deliveryStatus && (
                    <View style={styles.tickWrap}>{renderStatusTick(item.deliveryStatus)}</View>
                  )}
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                </View>

                <View style={styles.rowBadges}>
                  {item.isPinned && <Pin size={12} color={CampusColors.muted} style={styles.iconBadge} />}
                  {item.isMuted && <VolumeX size={12} color={CampusColors.muted} style={styles.iconBadge} />}
                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBubble}>
                      <Text style={styles.unreadBubbleText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredChats.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {chats.length === 0 ? 'No chats yet' : 'No chats found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {chats.length === 0
                ? 'Join a classroom or study group to start chatting.'
                : filter === 'Unread'
                ? "You're all caught up. Nice!"
                : 'Nothing here yet. Try another filter.'}
            </Text>
            {chats.length === 0 && (
              <TouchableOpacity style={styles.joinCta} onPress={onOpenJoinGroup}>
                <Text style={styles.joinCtaText}>Join a Group</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Catch Me Up digest (real unread messages + recent announcements) */}
      <CatchMeUpModal
        visible={catchMeUpOpen}
        onClose={() => {
          setCatchMeUpOpen(false);
          loadChats();
        }}
        onMarkAllRead={() => {
          setChats((prev) => prev.map((c) => ({ ...c, unreadCount: 0 })));
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CampusColors.paper,
  },
  content: {
    paddingHorizontal: CampusLayout.spacing.lg,
    paddingTop: 12,
    paddingBottom: 28,
  },
  groupsEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CampusColors.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  groupsEntryText: {
    fontSize: 14,
    fontWeight: '700',
    color: CampusColors.accentDeep,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CampusColors.paper,
    padding: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CampusColors.ink,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: CampusColors.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: CampusColors.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: CampusLayout.radius.pill,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  catchMeUpCard: {
    backgroundColor: CampusColors.inkCard,
    borderRadius: CampusLayout.radius.card,
    padding: 16,
    marginBottom: 16,
  },
  catchMeUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catchMeUpTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catchMeUpTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: CampusColors.amberOnDark,
    letterSpacing: 0.8,
  },
  catchMeUpTime: {
    fontSize: 11,
    color: CampusColors.inkMuted,
  },
  catchMeUpBody: {
    fontSize: 13,
    color: '#F4F1EA',
    lineHeight: 19,
  },
  bold: {
    fontWeight: '700',
    color: CampusColors.accentOnDark,
  },
  proximitySection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  proximityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: CampusColors.muted,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: CampusColors.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: CampusLayout.radius.pill,
  },
  locationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: CampusColors.accent,
  },
  proximityLoadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  proximityScroll: {
    gap: 12,
  },
  proximityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: CampusColors.line,
    minWidth: 220,
    gap: 10,
  },
  proximityCardNearby: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  proximityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximityInfo: {
    flex: 1,
  },
  proximityName: {
    fontSize: 13,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  proximityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  proximityLiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: CampusLayout.radius.pill,
  },
  proximityLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  proximityMeta: {
    fontSize: 11,
    color: CampusColors.muted,
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.card,
    borderWidth: 1,
    borderColor: CampusColors.chipBorder,
  },
  activeChip: {
    backgroundColor: CampusColors.ink,
    borderColor: CampusColors.ink,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: CampusColors.ink,
  },
  activeChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chatListCard: {
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    borderWidth: 1,
    borderColor: CampusColors.line,
    overflow: 'hidden',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: CampusColors.ink,
  },
  chatDetails: {
    flex: 1,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: CampusColors.ink,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: CampusColors.muted,
  },
  activeTimeText: {
    color: CampusColors.accent,
    fontWeight: '600',
  },
  chatMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tickWrap: {
    marginRight: 4,
  },
  lastMessage: {
    fontSize: 13,
    color: CampusColors.muted,
    flex: 1,
  },
  rowBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBadge: {
    marginRight: 2,
  },
  unreadBubble: {
    backgroundColor: CampusColors.accent,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBubbleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CampusColors.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: CampusColors.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  joinCta: {
    backgroundColor: CampusColors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: CampusLayout.radius.pill,
  },
  joinCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
