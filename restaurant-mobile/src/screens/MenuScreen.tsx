import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuRow, PriceSheet, StockSheet } from '../components/MenuParts';
import { useStore } from '../state/StoreProvider';
import { color, font, radius, space, touch } from '../theme';
import { EmptyState, ErrorStrip, SkeletonCard } from '../ui/kit';
import type { MenuItem } from '../types';

type Filter = 'all' | 'in' | 'out';

export default function MenuScreen() {
  const { menu, menuError, menuLoading, menuPending, refreshMenu, setStock, setPrice, store, restaurant } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [stockFor, setStockFor] = useState<MenuItem | null>(null);
  const [priceFor, setPriceFor] = useState<MenuItem | null>(null);

  const outCount = menu ? menu.filter((m) => !m.isAvailable).length : 0;

  const sections = useMemo(() => {
    if (!menu) return [];
    const needle = q.trim().toLowerCase();
    const groups = new Map<string, MenuItem[]>();
    for (const m of menu) {
      const arr = groups.get(m.category) || [];
      arr.push(m);
      groups.set(m.category, arr);
    }
    const out: { title: string; inStock: number; total: number; data: MenuItem[] }[] = [];
    for (const [title, items] of groups) {
      const data = items
        .filter((m) => (filter === 'all' ? true : filter === 'in' ? m.isAvailable : !m.isAvailable))
        .filter((m) => !needle || m.name.toLowerCase().includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (data.length) out.push({ title, inStock: items.filter((m) => m.isAvailable).length, total: items.length, data });
    }
    return out.sort((a, b) => (a.title === 'Other' ? 1 : b.title === 'Other' ? -1 : a.title.localeCompare(b.title)));
  }, [menu, q, filter]);

  const onToggle = useCallback((item: MenuItem) => {
    if (item.isAvailable) setStockFor(item);
    else setStock(item, { isAvailable: true });
  }, [setStock]);

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'in', label: 'In stock' },
    { key: 'out', label: `Out (${outCount})` },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={color.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search dishes"
            placeholderTextColor={color.textMuted}
            style={[font.body, { flex: 1, color: color.text, paddingVertical: 0 }]}
            accessibilityLabel="Search dishes"
            returnKeyType="search"
          />
          {q ? (
            <Pressable onPress={() => setQ('')} accessibilityLabel="Clear search" hitSlop={12}>
              <Ionicons name="close-circle" size={22} color={color.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.chips}>
          {chips.map((c) => {
            const sel = c.key === filter;
            const warn = c.key === 'out' && outCount > 0 && !sel;
            return (
              <Pressable
                key={c.key}
                onPress={() => setFilter(c.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: sel }}
                style={[styles.chip, sel && { backgroundColor: color.text, borderColor: color.text }, warn && { borderColor: color.alert, borderWidth: 2 }]}
              >
                <Text style={[font.small, { color: sel ? color.textInverse : warn ? color.alertDark : color.text, fontWeight: '800' }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {menu && menuError ? <ErrorStrip text={menuError} onRetry={refreshMenu} busy={menuLoading} /> : null}
      </View>

      {!menu ? (
        menuError ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load your menu" body={menuError} action={{ label: 'Try again', onPress: refreshMenu, loading: menuLoading }} />
        ) : (
          <View style={{ padding: space.md, gap: space.md }}><SkeletonCard lines={4} /><SkeletonCard lines={4} /></View>
        )
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={menuLoading} onRefresh={refreshMenu} colors={[color.text]} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.section}>
              <Text style={[font.h3, { color: color.text, flex: 1 }]}>{section.title}</Text>
              <Text style={[font.small, { color: color.textMuted }]}>{section.inStock}/{section.total} in stock</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MenuRow item={item} pending={!!menuPending[item.id]} onToggle={onToggle} onEditPrice={setPriceFor} />
          )}
          contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
          ListEmptyComponent={
            menu.length === 0
              ? <EmptyState icon="restaurant-outline" title="No dishes yet" body="Ask Zenvy support to add your menu." />
              : <EmptyState icon="search" title="No dishes match" body="Try another search or filter." />
          }
        />
      )}

      <StockSheet
        item={stockFor}
        opensAt={store?.operatingHours?.start || restaurant.operatingHours?.start || null}
        onClose={() => setStockFor(null)}
        onPick={(change) => {
          const it = stockFor;
          setStockFor(null);
          if (it) setStock(it, change);
        }}
      />
      <PriceSheet item={priceFor} onClose={() => setPriceFor(null)} onSave={setPrice} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { padding: space.md, gap: space.sm, backgroundColor: color.bg },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border,
    borderRadius: radius.md, paddingHorizontal: space.sm, minHeight: touch.min + 4,
  },
  chips: { flexDirection: 'row', gap: space.xs },
  chip: { flex: 1, minHeight: touch.min, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  section: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: color.bg, borderBottomWidth: 1, borderBottomColor: color.border },
});
