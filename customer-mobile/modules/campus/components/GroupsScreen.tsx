import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { ArrowLeft, Users, Plus, KeyRound, RefreshCw, MessageSquare, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';
import {
  CampusGroup,
  CAMPUS_NO_SESSION_ERROR,
  fetchMyGroups,
  createCampusGroup,
  joinCampusGroup,
  resetCampusGroupCode,
} from '../campusApi';

interface GroupsScreenProps {
  onBack: () => void;
  onOpenChat: (chatId: string, chatName: string) => void;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({ onBack, onOpenChat }) => {
  const [groups, setGroups] = useState<CampusGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const shareInvite = (name: string, code?: string) => {
    if (!code) return;
    Share.share({
      message: `Join "${name}" on Zenvy Campus Buddy with code ${code}. Open Campus Buddy → Groups → Join code.`,
    }).catch(() => {});
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyGroups();
      setGroups(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (busy) return;
    const name = createName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const group = await createCampusGroup({ name, type: 'study' });
      setCreateName('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (group.joinCode) {
        Alert.alert('Group created 🎉', `Invite friends with code ${group.joinCode}.`, [
          { text: 'Later', style: 'cancel' },
          { text: 'Share invite', onPress: () => shareInvite(group.name || name, group.joinCode) },
        ]);
      } else {
        Alert.alert('Group created 🎉', `"${name}" is ready.`);
      }
      load();
    } catch (e: any) {
      Alert.alert('Create failed', e?.message || 'Could not create group');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (busy) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    if (code.length !== 6) {
      Alert.alert('Check the code', 'Join codes are 6 characters, like K7X9QP.');
      return;
    }
    setBusy(true);
    try {
      const joined = await joinCampusGroup(code);
      setJoinCode('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        joined.alreadyMember ? 'Already a member' : "You're in! 🎉",
        joined.name
          ? joined.alreadyMember
            ? `You're already part of ${joined.name}.`
            : `You joined ${joined.name}.`
          : 'Group joined.'
      );
      load();
    } catch (e: any) {
      Alert.alert('Join failed', e?.message || 'Could not join group');
    } finally {
      setBusy(false);
    }
  };

  const handleResetCode = (group: CampusGroup) => {
    Alert.alert('Reset join code?', 'The old code stops working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            const newCode = await resetCampusGroupCode(group.id);
            Alert.alert('New join code', newCode, [
              { text: 'OK', style: 'cancel' },
              { text: 'Share', onPress: () => shareInvite(group.name, newCode) },
            ]);
            load();
          } catch (e: any) {
            Alert.alert('Reset failed', e?.message || 'Could not reset code');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={22} color={CampusColors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Groups</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.actionRow}>
        <View style={styles.createWrap}>
          <TextInput
            style={styles.input}
            placeholder="New group name"
            placeholderTextColor={CampusColors.muted}
            value={createName}
            onChangeText={setCreateName}
          />
          <TouchableOpacity style={styles.smallBtn} onPress={handleCreate} disabled={busy}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.createWrap}>
          <TextInput
            style={styles.input}
            placeholder="Join code"
            placeholderTextColor={CampusColors.muted}
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />
          <TouchableOpacity style={styles.smallBtn} onPress={handleJoin} disabled={busy}>
            <KeyRound size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={CampusColors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          {(error === CAMPUS_NO_SESSION_ERROR || /session has expired/i.test(error)) && (
            <TouchableOpacity style={styles.retryBtn} onPress={() => router.push('/login')}>
              <Text style={styles.retryText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Users size={40} color={CampusColors.muted} />
          <Text style={styles.emptyText}>No groups yet. Create one or join with a code.</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  const data = await fetchMyGroups();
                  setGroups(data);
                } catch {
                  // keep the current list; a full reload shows the error state
                } finally {
                  setRefreshing(false);
                }
              }}
              tintColor={CampusColors.accent}
              colors={[CampusColors.accent]}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.groupCard}>
              <TouchableOpacity
                style={styles.groupMain}
                onPress={() => onOpenChat(item.id, item.name)}
                activeOpacity={0.85}
              >
                <View style={styles.avatar}>
                  <MessageSquare size={18} color={CampusColors.accentDeep} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.groupMeta}>
                    {[
                      typeof item.memberCount === 'number'
                        ? `${item.memberCount} member${item.memberCount === 1 ? '' : 's'}`
                        : null,
                      item.type || 'group',
                      item.isAdmin && item.joinCode ? `Code ${item.joinCode}` : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                </View>
              </TouchableOpacity>
              {item.isAdmin && !!item.joinCode && (
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => shareInvite(item.name, item.joinCode)}
                  accessibilityLabel="Share invite code"
                >
                  <Share2 size={15} color={CampusColors.accent} />
                </TouchableOpacity>
              )}
              {item.isAdmin && (
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => handleResetCode(item)}
                  accessibilityLabel="Reset join code"
                >
                  <RefreshCw size={15} color={CampusColors.muted} />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CampusColors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: CampusColors.card,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
  },
  backBtn: { padding: 4, width: 30 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: CampusColors.ink },
  actionRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  createWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: CampusColors.card,
    borderWidth: 1,
    borderColor: CampusColors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: CampusColors.ink,
  },
  smallBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: CampusColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorText: { color: CampusColors.ink, fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: CampusColors.accent, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  emptyText: { color: CampusColors.muted, fontSize: 13, textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CampusColors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  groupMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CampusColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: '700', color: CampusColors.ink },
  groupMeta: { fontSize: 12, color: CampusColors.muted, marginTop: 2 },
  resetBtn: { padding: 8 },
});
