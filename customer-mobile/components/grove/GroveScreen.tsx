/**
 * GroveScreen.tsx — the whole "friends" tab.
 * Wraps FriendTree with the filter chips, the friend sheet, and the story viewer.
 *
 * deps: @shopify/react-native-skia react-native-gesture-handler react-native-reanimated
 * Wrap your app root in <GestureHandlerRootView style={{flex:1}}>.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, Image } from 'react-native';
import FriendTree from './GroveTreeContainer';
import {
  enrich, HEALTH, unseenStories, liveStories, type Friend, type Story,
} from './friendTree';

type Filter = 'all' | 'stories' | 'water' | 'bonds';
type Tod = 'night' | 'day' | 'dawn' | 'dusk' | 'auto';

const grove = {
  level: (list: ReturnType<typeof enrich>[]) => {
    const total = list.reduce((s, f) => s + f.streak, 0);
    return total > 120 ? 'Ancient' : total > 70 ? 'Rooted' : total > 30 ? 'Young' : 'Sapling';
  },
  nextTier: (list: ReturnType<typeof enrich>[]) => {
    const total = list.reduce((s, f) => s + f.streak, 0);
    if (total > 120) return 'Max Grove Level';
    if (total > 70) return `${120 - total}d to Ancient`;
    if (total > 30) return `${70 - total}d to Rooted`;
    return `${30 - total}d to Young`;
  }
};
const gr = grove;

export default function GroveScreen({
  friends, currentUserId, onSelectFriend, onMessage, onNudge, onWater,
}: {
  friends: Friend[];
  currentUserId: string;
  onSelectFriend?: (id: string) => void;
  onMessage?: (id: string) => void;
  onNudge?: (id: string) => void;
  onWater?: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [tod, setTod] = useState<Tod>('night');
  const [isRaining, setIsRaining] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ fid: string; idx: number } | null>(null);

  const enriched = useMemo(() => friends.map(f => enrich(f)), [friends]);
  const openFriend = enriched.find(f => f.id === openId) ?? null;

  const needWater = enriched.filter(f => f.health === 'wilting' || f.health === 'dormant').length;
  const fresh = enriched.reduce((s, f) => s + f.unseenCount, 0);
  const level = gr.level(enriched);
  const nextTierLabel = gr.nextTier(enriched);

  const openStory = useCallback((fid: string, sid: string) => {
    const f = friends.find(x => x.id === fid); if (!f) return;
    const items = liveStories(f);
    setViewer({ fid, idx: Math.max(0, items.findIndex(s => s.id === sid)) });
  }, [friends]);

  const handleSelectFriend = useCallback((id: string) => {
    onMessage?.(id);
    onSelectFriend?.(id);
  }, [onMessage, onSelectFriend]);

  const triggerNourish = () => {
    setIsRaining(true);
    setTimeout(() => setIsRaining(false), 4500);
    if (needWater > 0) {
      const wilting = enriched.find(f => f.health === 'wilting' || f.health === 'dormant');
      if (wilting) onWater?.(wilting.id);
    }
  };

  return (
    <View style={s.root}>
      {/* Compact Two-Row Header: Title, Controls, Subtitle & Chips */}
      <View style={s.header}>
        <View style={s.headerTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
            <Text style={s.h1}>Your grove</Text>
            <View style={s.levelPill}>
              <Text style={s.levelPillText}>🌱 {level} · {nextTierLabel}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Pressable
              style={[s.nourishButton, isRaining && s.nourishButtonActive]}
              onPress={triggerNourish}
            >
              <Text style={s.nourishButtonText}>{isRaining ? '🌧️ Nourishing...' : '💧 Nourish'}</Text>
            </Pressable>

            {/* Time of day ambient switchers */}
            <View style={s.todContainer}>
              {([
                { id: 'night', icon: '🌙' },
                { id: 'dawn',  icon: '🌅' },
                { id: 'day',   icon: '☀️' },
                { id: 'dusk',  icon: '🌇' },
              ] as const).map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setTod(t.id)}
                  style={[s.todButton, tod === t.id && s.todButtonActive]}
                >
                  <Text style={s.todButtonText}>{t.icon}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Row 2: Subtitle summary & Filter Chips */}
        <View style={s.subRow}>
          <Text style={s.sub} numberOfLines={1}>
            {friends.length} friends · {fresh} new fruits{needWater ? ` · ${needWater} need water` : ''}
          </Text>

          <View style={s.chips}>
            {(['all', 'stories', 'water', 'bonds'] as Filter[]).map(k => (
              <Pressable
                key={k}
                onPress={() => setFilter(filter === k ? 'all' : k)}
                style={[s.chip, filter === k && s.chipOn]}
              >
                <Text style={[s.chipText, filter === k && s.chipTextOn]}>
                  {k === 'all'
                    ? 'All'
                    : k === 'stories'
                    ? 'Stories'
                    : k === 'water'
                    ? 'Water'
                    : 'Bonds ✨'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* The Grove Canvas */}
      <View style={s.canvas}>
        <FriendTree
          friends={friends}
          seedKey={currentUserId}
          tod={tod}
          filter={filter}
          showBonds={filter === 'bonds'}
          isRaining={isRaining}
          onSelectFriend={handleSelectFriend}
          onOpenStory={openStory}
          onPost={() => {/* open your camera / composer */}}
        />
      </View>

      {/* Friend Detail Sheet */}
      {openFriend && (
        <View style={s.sheet}>
          <View style={s.row}>
            <Avatar f={openFriend} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{openFriend.name}</Text>
              <Text style={s.state}>{HEALTH[openFriend.health].label(openFriend)}</Text>
            </View>
            <Pressable onPress={() => setOpenId(null)} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
          </View>
          <View style={s.meta}>
            <Metric big={openFriend.streak} label="day streak" />
            <Metric big={openFriend.liveStories.length} label="fruit on branch" />
            <Metric big={`${Math.round(openFriend.strength * 100)}%`} label="branch strength" />
          </View>
          <View style={s.actions}>
            {openFriend.unseenCount > 0 && (
              <Btn primary label={`Pick ${openFriend.unseenCount} fruit`}
                onPress={() => { const su = unseenStories(openFriend)[0]; if (su) openStory(openFriend.id, su.id); }} />
            )}
            {(openFriend.health === 'wilting' || openFriend.health === 'dormant')
              ? <Btn water label="Water this branch" onPress={() => { onWater?.(openFriend.id); triggerNourish(); setOpenId(null); }} />
              : <Btn primary label="Send a nudge" onPress={() => { onNudge?.(openFriend.id); setOpenId(null); }} />}
            <Btn label="Open chat" onPress={() => {
              onMessage?.(openFriend.id);
              onSelectFriend?.(openFriend.id);
              setOpenId(null);
            }} />
          </View>
        </View>
      )}

      {/* Story Viewer */}
      <StoryViewer
        friend={viewer ? friends.find(f => f.id === viewer.fid) ?? null : null}
        idx={viewer?.idx ?? 0}
        onIdx={i => setViewer(v => v && { ...v, idx: i })}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

function Avatar({ f }: { f: ReturnType<typeof enrich> }) {
  const tint = HEALTH[f.health].tip;
  return f.avatarUrl
    ? <Image source={{ uri: f.avatarUrl }} style={[s.avatar, { borderColor: tint }]} />
    : <View style={[s.avatar, s.avatarFallback, { borderColor: tint }]}>
        <Text style={s.avatarText}>{f.name.split(' ').map(w => w[0]).slice(0,2).join('')}</Text>
      </View>;
}
function Metric({ big, label }: { big: React.ReactNode; label: string }) {
  return <View style={{ flex: 1 }}><Text style={s.metricBig}>{big}</Text><Text style={s.metricLabel}>{label}</Text></View>;
}
function Btn({ label, onPress, primary, water }: { label: string; onPress: () => void; primary?: boolean; water?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.btn, primary && s.btnPrimary, water && s.btnWater]}>
      <Text style={[s.btnText, (primary || water) && s.btnTextOn]}>{label}</Text>
    </Pressable>
  );
}

function StoryViewer({ friend, idx, onIdx, onClose }: {
  friend: Friend | null; idx: number; onIdx: (i: number) => void; onClose: () => void;
}) {
  if (!friend) return null;
  const items = liveStories(friend);
  const st = items[idx];
  if (st) st.seen = true;
  const hue = st?.hue ?? 210;
  const hrs = st ? (Date.now() - st.postedAt) / 3.6e6 : 0;
  const step = (d: number) => { const n = idx + d; if (n < 0) return; if (n >= items.length) onClose(); else onIdx(n); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.viewer}>
        <View style={s.bars}>
          {items.map((_, i) => (
            <View key={i} style={s.bar}><View style={[s.barFill, { width: i < idx ? '100%' : i === idx ? '100%' : '0%' }]} /></View>
          ))}
        </View>
        <View style={s.vhead}>
          <Text style={s.vwho}>{friend.name}</Text>
          <Text style={s.vago}>{hrs < 1 ? 'just now' : `${Math.round(hrs)}h ago · falls in ${Math.max(1, Math.round(24-hrs))}h`}</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        </View>
        <View style={[s.frame, { backgroundColor: `hsl(${hue},60%,26%)` }]}>
          {st?.mediaUrl && <Image source={{ uri: st.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          <Pressable style={s.tapL} onPress={() => step(-1)} />
          <Pressable style={s.tapR} onPress={() => step(1)} />
          {!!st?.caption && <Text style={s.caption}>{st.caption}</Text>}
        </View>
        <View style={s.reacts}>
          {['🔥','😂','💙','👏'].map(r => <Pressable key={r} style={s.react}><Text style={{ fontSize: 20 }}>{r}</Text></Pressable>)}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04050d', overflow: 'hidden' },
  header: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 2 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  h1: { color: '#e8ecff', fontSize: 18, fontWeight: '700', letterSpacing: -0.4 },
  levelPill: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  levelPillText: { color: '#86efac', fontSize: 9.5, fontWeight: '600' },
  todContainer: { flexDirection: 'row', gap: 2, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: 2 },
  todButton: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  todButtonActive: { backgroundColor: 'rgba(56,189,248,0.25)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.6)' },
  todButtonText: { fontSize: 11 },
  nourishButton: { backgroundColor: 'rgba(56,189,248,0.14)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5 },
  nourishButtonActive: { backgroundColor: 'rgba(34,211,238,0.35)', borderColor: '#22d3ee' },
  nourishButtonText: { color: '#7dd3fc', fontSize: 10, fontWeight: '700' },

  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, gap: 6 },
  sub: { color: '#8b95bf', fontSize: 10.5, flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 4 },
  chip: { borderWidth: 1, borderColor: 'rgba(120,160,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5 },
  chipOn: { backgroundColor: 'rgba(34,211,238,0.16)', borderColor: 'rgba(34,211,238,0.5)' },
  chipText: { color: '#8b95bf', fontSize: 10 },
  chipTextOn: { color: '#bdf4ff', fontWeight: '600' },
  canvas: { flex: 1, minHeight: 0 },

  sheet: { position: 'absolute', left: 14, right: 14, bottom: 14, backgroundColor: 'rgba(10,14,32,0.94)', borderColor: 'rgba(120,160,255,0.2)', borderWidth: 1, borderRadius: 22, padding: 16, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2 },
  avatarFallback: { backgroundColor: '#1a2140', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#cdd6ff', fontWeight: '600' },
  name: { color: '#e8ecff', fontSize: 18, fontWeight: '600' },
  state: { color: '#8b95bf', fontSize: 12.5, marginTop: 2 },
  close: { color: '#e8ecff', fontSize: 20, paddingHorizontal: 4 },
  meta: { flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(120,160,255,0.16)' },
  metricBig: { color: '#e8ecff', fontSize: 17, fontWeight: '600' },
  metricLabel: { color: '#8b95bf', fontSize: 11.5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 13, flexWrap: 'wrap' },
  btn: { borderWidth: 1, borderColor: 'rgba(120,160,255,0.16)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 9 },
  btnPrimary: { backgroundColor: '#2ad4c0', borderColor: 'transparent' },
  btnWater: { backgroundColor: '#38bdf8', borderColor: 'transparent' },
  btnText: { color: '#e8ecff', fontSize: 13.5, fontWeight: '600' },
  btnTextOn: { color: '#03131a' },

  viewer: { flex: 1, backgroundColor: 'rgba(3,4,12,0.94)', padding: 14 },
  bars: { flexDirection: 'row', gap: 4, marginTop: 40 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  vhead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  vwho: { color: '#fff', fontWeight: '600', fontSize: 15 },
  vago: { color: '#8b95bf', fontSize: 12, flex: 1 },
  frame: { flex: 1, marginTop: 12, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  tapL: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%' },
  tapR: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '65%' },
  caption: { color: '#fff', fontSize: 19, fontWeight: '500', padding: 20, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 14 },
  reacts: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12 },
  react: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(120,160,255,0.16)', borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 8 },
});
