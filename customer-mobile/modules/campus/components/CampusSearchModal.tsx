import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Search,
  Users,
  BookOpen,
  HelpCircle,
  Car,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';
import { fetchChats, fetchLostFound, fetchRidePools } from '../campusApi';

export interface SearchResultItem {
  id: string;
  type: 'member' | 'group' | 'lost' | 'ride';
  title: string;
  subtitle: string;
  badge: string;
}

type Category = 'All' | 'Chats' | 'Lost' | 'Rides';
const CATEGORIES: Category[] = ['All', 'Chats', 'Lost', 'Rides'];

const CHAT_BADGE: Record<string, string> = {
  dm: 'Chat',
  class: 'Classroom',
  club: 'Club',
  ride: 'Ride Group',
  secret: 'Chat',
};

const timeAgo = (value?: string | Date | null) => {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const formatDeparture = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

interface CampusSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectResult: (item: SearchResultItem) => void;
}

export const CampusSearchModal: React.FC<CampusSearchModalProps> = ({
  visible,
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPartial(false);
    const [chatsRes, lostRes, ridesRes] = await Promise.allSettled([
      fetchChats(),
      fetchLostFound(),
      fetchRidePools(),
    ]);
    if (!mountedRef.current) return;

    const next: SearchResultItem[] = [];
    if (chatsRes.status === 'fulfilled') {
      chatsRes.value.forEach((c) => {
        const when = timeAgo(c.lastMessageAt);
        next.push({
          id: c.id,
          type: c.isGroup ? 'group' : 'member',
          title: c.name || 'Chat',
          subtitle: [c.lastMessage, when].filter(Boolean).join(' • ') || (c.isGroup ? 'Group chat' : 'Direct chat'),
          badge: CHAT_BADGE[c.type] || (c.isGroup ? 'Group' : 'Chat'),
        });
      });
    }
    if (lostRes.status === 'fulfilled') {
      lostRes.value
        .filter((i) => i.status === 'open')
        .forEach((i) => {
          next.push({
            id: i.id,
            type: 'lost',
            title: `${i.type === 'found' ? 'Found' : 'Lost'}: ${i.title}`,
            subtitle: [i.location, timeAgo(i.createdAt)].filter(Boolean).join(' • '),
            badge: i.type === 'found' ? 'Found Item' : 'Lost Item',
          });
        });
    }
    if (ridesRes.status === 'fulfilled') {
      ridesRes.value
        .filter((r) => r.status === 'open')
        .forEach((r) => {
          const seats = `${r.availableSeats} seat${r.availableSeats === 1 ? '' : 's'} left`;
          const fare = r.farePerSeat > 0 ? `₹${r.farePerSeat}/seat` : 'Free';
          next.push({
            id: r.id,
            type: 'ride',
            title: `${r.origin} → ${r.destination}`,
            subtitle: [r.vehicleType, formatDeparture(r.departureTime), seats, fare].filter(Boolean).join(' • '),
            badge: 'Ride Pool',
          });
        });
    }

    const failed = [chatsRes, lostRes, ridesRes].filter((r) => r.status === 'rejected').length;
    if (failed === 3) {
      setError('Could not load campus search. Check your connection and try again.');
    } else if (failed > 0) {
      setPartial(true);
    }
    setItems(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      load();
    } else {
      setQuery('');
      setActiveCategory('All');
    }
  }, [visible, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory === 'Chats' && item.type !== 'member' && item.type !== 'group') return false;
      if (activeCategory === 'Lost' && item.type !== 'lost') return false;
      if (activeCategory === 'Rides' && item.type !== 'ride') return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
    });
  }, [items, query, activeCategory]);

  const renderBody = () => {
    if (loading && items.length === 0) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={CampusColors.accent} />
          <Text style={styles.emptySubtitle}>Searching your campus…</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Sparkles size={36} color={CampusColors.muted} />
          <Text style={styles.emptyTitle}>Search is unavailable</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <RefreshCw size={14} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (filtered.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Sparkles size={36} color={CampusColors.muted} />
          <Text style={styles.emptyTitle}>
            {query.trim() ? 'No matching results' : 'Nothing here yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {query.trim()
              ? 'Try a group name, place or destination'
              : 'Your chats, open lost & found posts and ride pools will show up here'}
          </Text>
        </View>
      );
    }
    return filtered.map((item) => (
      <TouchableOpacity
        key={`${item.type}-${item.id}`}
        style={styles.resultItem}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onSelectResult(item);
        }}
      >
        <View
          style={[
            styles.iconCircle,
            item.type === 'member' && { backgroundColor: CampusColors.accentSoft },
            item.type === 'group' && { backgroundColor: CampusColors.warmSoft },
            item.type === 'lost' && { backgroundColor: CampusColors.roseSoft },
            item.type === 'ride' && { backgroundColor: '#E0F2FE' },
          ]}
        >
          {item.type === 'member' && <Users size={16} color={CampusColors.accentDeep} />}
          {item.type === 'group' && <BookOpen size={16} color={CampusColors.warmDeep} />}
          {item.type === 'lost' && <HelpCircle size={16} color={CampusColors.roseDeep} />}
          {item.type === 'ride' && <Car size={16} color="#0369A1" />}
        </View>

        <View style={styles.itemInfo}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          </View>
          <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>

        <ChevronRight size={16} color={CampusColors.muted} />
      </TouchableOpacity>
    ));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header Search Bar */}
        <View style={styles.header}>
          <View style={styles.searchBar}>
            <Search size={18} color={CampusColors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats, classrooms, lost items, rides..."
              placeholderTextColor={CampusColors.muted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
                <X size={16} color={CampusColors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Categories */}
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveCategory(cat);
                }}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {partial && !loading && (
          <TouchableOpacity onPress={load}>
            <Text style={styles.partialNote}>Some results could not be loaded. Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {/* Results List */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {renderBody()}
        </ScrollView>
      </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CampusColors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: CampusColors.card,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CampusColors.line,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: CampusColors.ink,
  },
  cancelBtn: {
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: CampusColors.muted,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CampusColors.card,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.paper,
    borderWidth: 1,
    borderColor: CampusColors.line,
  },
  categoryChipActive: {
    backgroundColor: CampusColors.accent,
    borderColor: CampusColors.accent,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CampusColors.muted,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 36,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: CampusColors.line,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CampusColors.ink,
    flex: 1,
  },
  badge: {
    backgroundColor: CampusColors.paper,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: CampusColors.muted,
  },
  itemSubtitle: {
    fontSize: 12,
    color: CampusColors.muted,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CampusColors.accent,
    paddingHorizontal: 18,
    height: 40,
    borderRadius: CampusLayout.radius.pill,
    marginTop: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  partialNote: {
    fontSize: 12,
    color: CampusColors.warmDeep,
    backgroundColor: CampusColors.warmSoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
  emptyState: {
    paddingTop: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    color: CampusColors.muted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
