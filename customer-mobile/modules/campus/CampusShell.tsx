import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Modal,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { X, Link2, KeyRound, Users, WifiOff, LogIn } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CampusColors, CampusLayout } from '../../constants/campusTheme';
import { CampusProfileData, CampusUserData, CampusItem, CampusTab } from '../../types/campus';
import { fetchCampuses, fetchCampusProfile, isCampusAuthError, joinCampusGroup } from './campusApi';
import { useAuth } from '../../context/AuthContext';
import { CampusHeader } from './components/CampusHeader';
import { CampusBottomNav } from './components/CampusBottomNav';
import { VerificationModal } from './components/VerificationModal';
import { ChatsTab } from './tabs/ChatsTab';
import { PulseTab } from './tabs/PulseTab';
import { StudyTab } from './tabs/StudyTab';
import { YouTab } from './tabs/YouTab';
import { ChatDetailScreen } from './components/ChatDetailScreen';
import { GroupsScreen } from './components/GroupsScreen';
import { ClassworkScreen } from './components/ClassworkScreen';
import { LostFoundModal } from './components/LostFoundModal';
import { RidePoolModal } from './components/RidePoolModal';
import { CampusWhispersModal } from './components/CampusWhispersModal';
import { NightQuestionModal } from './components/NightQuestionModal';
import { BranchWarsModal } from './components/BranchWarsModal';
import { StudySyncModal } from './components/StudySyncModal';
import { AssignmentPortalModal } from './components/AssignmentPortalModal';
import { CampusSearchModal } from './components/CampusSearchModal';
import { ProximityRoomModal } from './components/ProximityRoomModal';
import { CampusCallModal, IncomingCampusCallOverlay, CampusCallSession, IncomingCampusCall } from './components/CampusCallModal';
import { QrScannerModal } from './components/QrScannerModal';
import { connectCampusSocket, disconnectCampusSocket, rejectCampusCall } from './campusSocketClient';

let pendingSocketTeardown: ReturnType<typeof setTimeout> | null = null;

interface CampusShellProps {
  onBack?: () => void;
}

export const CampusShell: React.FC<CampusShellProps> = ({ onBack }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CampusTab>('chats');
  const [profile, setProfile] = useState<CampusProfileData | null>(null);
  const [user, setUser] = useState<CampusUserData | null>(null);
  const [campuses, setCampuses] = useState<CampusItem[]>([]);
  const [loading, setLoading] = useState(true);
  // null = ok; 'auth' = must sign in; otherwise a friendly network/server message.
  const [loadError, setLoadError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Modals
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Active chat view state (Phase 2 entry point)
  const [selectedChat, setSelectedChat] = useState<{ id: string; name: string } | null>(null);

  // Phase 3 screens
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [classworkOpen, setClassworkOpen] = useState(false);

  // Phase 4 & Interactive Community Modals
  const [searchOpen, setSearchOpen] = useState(false);
  const [lostFoundOpen, setLostFoundOpen] = useState(false);
  const [ridePoolOpen, setRidePoolOpen] = useState(false);
  const [whispersOpen, setWhispersOpen] = useState(false);
  const [nightQuestionOpen, setNightQuestionOpen] = useState(false);
  const [branchWarsOpen, setBranchWarsOpen] = useState(false);
  const [studySyncOpen, setStudySyncOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  // Bumped when the turn-in portal closes so StudyTab shows the new submission status.
  const [studyRefreshKey, setStudyRefreshKey] = useState(0);
  const [proximityRoomSlug, setProximityRoomSlug] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<CampusCallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCampusCall | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const activeCallRef = useRef<CampusCallSession | null>(null);
  activeCallRef.current = activeCall;

  // Live unread total reported by ChatsTab (drives the bottom-nav badge)
  const [totalUnread, setTotalUnread] = useState(0);
  // Bumped to make ChatsTab silently reload (after a join, or when a chat closes).
  const [chatsRefreshKey, setChatsRefreshKey] = useState(0);
  const activeTabRef = useRef<CampusTab>(activeTab);
  activeTabRef.current = activeTab;
  const selectedChatIdRef = useRef<string | null>(null);
  selectedChatIdRef.current = selectedChat?.id ?? null;

  useEffect(() => {
    mountedRef.current = true;
    if (pendingSocketTeardown) {
      clearTimeout(pendingSocketTeardown);
      pendingSocketTeardown = null;
    }
    return () => {
      mountedRef.current = false;
      // Every campus socket consumer lives inside this shell. Drop the connection when the
      // user leaves Campus so a later logout/login never reuses the previous identity.
      // Deferred so child cleanups (leave chat, end call) run against the old socket first;
      // cancelled if the shell remounts right away (StrictMode / fast refresh).
      pendingSocketTeardown = setTimeout(() => {
        pendingSocketTeardown = null;
        disconnectCampusSocket();
      }, 0);
    };
  }, []);

  // Logging out while Campus is open must not leave the previous student's profile on screen.
  const { user: authUser } = useAuth();
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setUser(null);
      setSelectedChat(null);
      setLoadError('auth');
      setLoading(false);
    }
  }, [authUser]);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setLoadError(null);
    }
    const [campusesRes, profileRes] = await Promise.allSettled([fetchCampuses(), fetchCampusProfile()]);
    if (!mountedRef.current) return;

    if (campusesRes.status === 'fulfilled') setCampuses(campusesRes.value);
    if (profileRes.status === 'fulfilled') {
      setProfile(profileRes.value.profile);
      setUser(profileRes.value.user);
      setLoadError(null);
    } else if (!opts?.silent) {
      const err: any = profileRes.reason;
      setLoadError(isCampusAuthError(err) ? 'auth' : err?.message || "Couldn't reach Campus right now.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Coming back from the Sign in screen: retry so the student lands in Campus, not on the sign-in prompt.
  const loadErrorRef = useRef<string | null>(null);
  loadErrorRef.current = loadError;
  useFocusEffect(
    useCallback(() => {
      if (loadErrorRef.current === 'auth') loadData();
    }, [loadData])
  );

  // Only open the campus socket once we know the student is signed in (profile loaded);
  // a signed-out visitor would otherwise keep a rejected socket retrying in the background.
  const hasProfile = !!profile;

  // Keep the Chats badge live while the user is on Pulse / Study / You (ChatsTab is unmounted then).
  useEffect(() => {
    if (!hasProfile) return;
    const socket = connectCampusSocket();
    const onChatUpdated = (data: any) => {
      if (!data?.chatId) return;
      if (activeTabRef.current === 'chats') return; // ChatsTab owns the count while mounted
      if (selectedChatIdRef.current === data.chatId) return; // being read right now
      setTotalUnread((n) => n + 1);
    };
    socket.on('chat:updated', onChatUpdated);
    return () => {
      socket.off('chat:updated', onChatUpdated);
    };
  }, [hasProfile]);

  // iOS can't present a modal while another one is still sliding away: wait for the dismissal.
  const afterModalDismiss = useCallback((fn: () => void) => {
    setTimeout(() => {
      if (mountedRef.current) fn();
    }, Platform.OS === 'ios' ? 450 : 0);
  }, []);

  const closeChat = useCallback(() => {
    setSelectedChat(null);
    // Pick up our own last message + server-side read receipts in the list.
    setChatsRefreshKey((k) => k + 1);
  }, []);

  const onJoinedGroup = useCallback(
    (group: { id?: string; name?: string; alreadyMember?: boolean }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoinCode('');
      setJoinModalVisible(false);
      setChatsRefreshKey((k) => k + 1);
      setActiveTab('chats');
      const name = group.name || 'the group';
      const title = group.alreadyMember ? 'Already a member' : 'You’re in! 🎉';
      const body = group.alreadyMember
        ? `You're already part of ${name}.`
        : `Welcome to ${name}. Say hi to everyone!`;
      Alert.alert(title, body, [
        { text: 'Later', style: 'cancel' },
        ...(group.id
          ? [{ text: 'Open chat', onPress: () => setSelectedChat({ id: group.id as string, name }) }]
          : []),
      ]);
    },
    []
  );

  useEffect(() => {
    if (!hasProfile) return;
    const socket = connectCampusSocket();
    const onIncoming = (data: IncomingCampusCall) => {
      if (!data?.callId) return;
      if (activeCallRef.current) {
        rejectCampusCall(data.callId, 'busy');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIncomingCall(data);
    };
    const onEnded = (data: { callId: string }) => {
      setIncomingCall((prev) => (prev?.callId === data.callId ? null : prev));
    };
    socket.on('call:incoming', onIncoming);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:ended', onEnded);
    };
  }, [hasProfile]);

  const handleJoinGroupByCode = async () => {
    if (joinLoading) return;
    const code = joinCode.replace(/\s+/g, '').toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Check the code', 'Join codes are 6 characters, like K7X9QP.');
      return;
    }
    setJoinLoading(true);
    try {
      const group = await joinCampusGroup(code);
      if (!mountedRef.current) return;
      onJoinedGroup(group);
    } catch (e: any) {
      Alert.alert("Couldn't join", e?.message || 'Please check the code and try again.');
    } finally {
      if (mountedRef.current) setJoinLoading(false);
    }
  };

  // Full-screen states when the campus profile can't be loaded: never show invented defaults.
  if (!loading && loadError && !profile) {
    const needsSignIn = loadError === 'auth';
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <CampusHeader
          profile={null}
          user={null}
          onOpenVerify={() => {}}
          onOpenJoinGroup={() => {}}
          onSearchPress={() => {}}
          onBack={onBack}
        />
        <View style={styles.centerContainer}>
          <View style={styles.stateIconWrap}>
            {needsSignIn ? (
              <LogIn size={28} color={CampusColors.accent} />
            ) : (
              <WifiOff size={28} color={CampusColors.accent} />
            )}
          </View>
          <Text style={styles.stateTitle}>
            {needsSignIn ? 'Sign in to use Campus' : "Couldn't reach Campus"}
          </Text>
          <Text style={styles.stateSubtitle}>
            {needsSignIn
              ? 'Sign in to your Zenvy account to see your classes, chats and campus feed.'
              : loadError}
          </Text>
          <TouchableOpacity
            style={styles.stateBtn}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (needsSignIn) router.push('/login');
              else loadData();
            }}
          >
            <Text style={styles.stateBtnText}>{needsSignIn ? 'Sign in' : 'Try again'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <CampusHeader
        profile={profile}
        user={user}
        onOpenVerify={() => setVerifyModalVisible(true)}
        onOpenJoinGroup={() => setJoinModalVisible(true)}
        onSearchPress={() => setSearchOpen(true)}
        onBack={onBack}
      />

      {/* Main Tab Content */}
      <View style={styles.tabContent}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={CampusColors.accent} />
          </View>
        ) : (
          <>
            {activeTab === 'chats' && (
              <ChatsTab
                profile={profile}
                user={user}
                onSelectChat={(id, name) => setSelectedChat({ id, name })}
                onOpenJoinGroup={() => setJoinModalVisible(true)}
                onOpenGroups={() => setGroupsOpen(true)}
                onUnreadChange={setTotalUnread}
                onOpenProximityRoom={(roomSlug) => setProximityRoomSlug(roomSlug)}
                activeChatId={selectedChat?.id ?? null}
                refreshKey={chatsRefreshKey}
              />
            )}

            {activeTab === 'pulse' && (
              <PulseTab
                profile={profile}
                user={user}
                onOpenWhispers={() => setWhispersOpen(true)}
                onOpenNightQuestion={() => setNightQuestionOpen(true)}
                onOpenBranchWars={() => setBranchWarsOpen(true)}
                onOpenLostFound={() => setLostFoundOpen(true)}
                onOpenRidePool={() => setRidePoolOpen(true)}
              />
            )}

            {activeTab === 'study' && (
              <StudyTab
                profile={profile}
                user={user}
                onOpenStudySync={() => setStudySyncOpen(true)}
                onOpenAssignment={(id) => setSelectedAssignmentId(id)}
                onOpenClasswork={() => setClassworkOpen(true)}
                refreshKey={studyRefreshKey}
              />
            )}

            {activeTab === 'you' && (
              <YouTab
                profile={profile}
                user={user}
                onOpenVerify={() => setVerifyModalVisible(true)}
                onProfileUpdated={(updated) => setProfile(updated)}
              />
            )}
          </>
        )}
      </View>

      {/* Bottom Navigation */}
      <CampusBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        unreadCount={totalUnread}
      />

      {/* Verification Modal */}
      <VerificationModal
        visible={verifyModalVisible}
        onClose={() => {
          setVerifyModalVisible(false);
          // Pick up a 'pending review' / verified status without a manual reload.
          loadData({ silent: true });
        }}
        profile={profile}
        campuses={campuses}
        onVerifiedSuccess={(updated) => {
          setProfile(updated);
        }}
      />

      {/* Join Group Modal (Section 3.3) */}
      <Modal visible={joinModalVisible} animationType="slide" transparent onRequestClose={() => setJoinModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitle}>
                <Users size={20} color={CampusColors.accent} />
                <Text style={styles.modalTitleText}>Join a Group</Text>
              </View>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <X size={20} color={CampusColors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInstruction}>
              Enter a 6-character Classroom or Club code provided by your teacher, CR, or club admin:
            </Text>

            <View style={styles.joinInputWrap}>
              <KeyRound size={18} color={CampusColors.muted} />
              <TextInput
                style={styles.joinInput}
                placeholder="e.g. K7X9QP"
                placeholderTextColor={CampusColors.muted}
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={handleJoinGroupByCode}
              />
            </View>

            <TouchableOpacity
              style={[styles.joinBtn, joinLoading && { opacity: 0.6 }]}
              onPress={handleJoinGroupByCode}
              disabled={joinLoading}
            >
              {joinLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.joinBtnText}>Join Group</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.scanQrBtn}
              onPress={() => {
                setJoinModalVisible(false);
                afterModalDismiss(() => setQrScannerOpen(true));
              }}
            >
              <Link2 size={18} color={CampusColors.ink} />
              <Text style={styles.scanQrText}>Paste an invite link</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Phase 3: Groups screen */}
      <Modal
        visible={groupsOpen}
        animationType="slide"
        onRequestClose={() => {
          setGroupsOpen(false);
          setChatsRefreshKey((k) => k + 1);
        }}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <GroupsScreen
          onBack={() => {
            setGroupsOpen(false);
            // Groups created or joined here should show up in Chats right away.
            setChatsRefreshKey((k) => k + 1);
          }}
          onOpenChat={(id, name) => {
            setGroupsOpen(false);
            setChatsRefreshKey((k) => k + 1);
            afterModalDismiss(() => setSelectedChat({ id, name }));
          }}
        />
        </SafeAreaView>
      </Modal>

      {/* Phase 3: Classwork screen */}
      <Modal visible={classworkOpen} animationType="slide" onRequestClose={() => setClassworkOpen(false)}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ClassworkScreen currentUser={user} onBack={() => setClassworkOpen(false)} />
        </SafeAreaView>
      </Modal>

      {/* Active Chat Detail View Modal (Phase 2 core messaging) */}
      {selectedChat && (
        <Modal visible={true} animationType="slide" onRequestClose={closeChat}>
          <ChatDetailScreen
            chatId={selectedChat.id}
            chatName={selectedChat.name}
            currentUser={user}
            onBack={closeChat}
            onStartCall={(callType) => {
              setActiveCall({
                chatId: selectedChat.id,
                peerName: selectedChat.name,
                callType: callType === 'video' ? 'video' : 'voice',
                role: 'caller',
              });
            }}
          />
        </Modal>
      )}

      {/* Phase 4: Lost & Found Modal */}
      <LostFoundModal
        visible={lostFoundOpen}
        onClose={() => setLostFoundOpen(false)}
        currentUser={user}
      />

      {/* Phase 4: Ride Pool Modal */}
      <RidePoolModal
        visible={ridePoolOpen}
        onClose={() => setRidePoolOpen(false)}
        currentUser={user}
      />

      {/* Pulse: Campus Whispers Anonymous Feed */}
      <CampusWhispersModal
        visible={whispersOpen}
        onClose={() => setWhispersOpen(false)}
        isVerified={profile?.verificationStatus === 'verified'}
        isPendingVerification={profile?.verificationStatus === 'pending'}
        onRequestVerify={() => {
          // Close the feed first: the verification sheet is a sibling modal.
          setWhispersOpen(false);
          afterModalDismiss(() => setVerifyModalVisible(true));
        }}
      />

      {/* Pulse: The 9 PM Question Night Room */}
      <NightQuestionModal
        visible={nightQuestionOpen}
        onClose={() => setNightQuestionOpen(false)}
      />

      {/* Pulse: Branch Wars Leaderboard */}
      <BranchWarsModal
        visible={branchWarsOpen}
        onClose={() => setBranchWarsOpen(false)}
        userBranch={profile?.branch || undefined}
      />

      {/* Study: Study Sync Pomodoro Focus Room */}
      <StudySyncModal
        visible={studySyncOpen}
        onClose={() => setStudySyncOpen(false)}
      />

      {/* Study: Assignment Turn-In Portal (real assignment by id) */}
      {selectedAssignmentId && (
        <AssignmentPortalModal
          visible={!!selectedAssignmentId}
          onClose={() => {
            setSelectedAssignmentId(null);
            setStudyRefreshKey((k) => k + 1);
          }}
          assignmentId={selectedAssignmentId}
        />
      )}

      {/* Header: Universal Campus Search */}
      <CampusSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectResult={(item) => {
          setSearchOpen(false);
          afterModalDismiss(() => {
            if (item.type === 'member' || item.type === 'group') {
              setSelectedChat({ id: item.id, name: item.title });
            } else if (item.type === 'lost') {
              setLostFoundOpen(true);
            } else if (item.type === 'ride') {
              setRidePoolOpen(true);
            }
          });
        }}
      />

      {/* Proximity: Location-bound Live Chat — Phase 5 */}
      {proximityRoomSlug && (
        <ProximityRoomModal
          visible={!!proximityRoomSlug}
          onClose={() => setProximityRoomSlug(null)}
          roomSlug={proximityRoomSlug}
          currentUser={user}
        />
      )}

      {incomingCall && !activeCall && (
        <IncomingCampusCallOverlay
          incoming={incomingCall}
          onDecline={() => {
            rejectCampusCall(incomingCall.callId);
            setIncomingCall(null);
          }}
          onAccept={() => {
            const incoming = incomingCall;
            setIncomingCall(null);
            setActiveCall({
              chatId: incoming.chatId,
              peerName: incoming.callerName,
              callType: incoming.callType,
              role: 'callee',
              callId: incoming.callId,
            });
          }}
        />
      )}

      {activeCall && (
        <CampusCallModal
          visible={!!activeCall}
          onClose={() => setActiveCall(null)}
          session={activeCall}
        />
      )}

      {/* QR Code Scanner */}
      <QrScannerModal
        visible={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScanCode={async (raw) => {
          setQrScannerOpen(false);
          // QR may carry just the code or a link ending in it.
          const code = String(raw || '').trim().split(/[/=?#]/).pop()?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';
          if (code.length !== 6) {
            Alert.alert("That QR isn't a group code", 'Ask your CR or club admin to show the classroom QR again.');
            return;
          }
          try {
            const group = await joinCampusGroup(code);
            if (!mountedRef.current) return;
            onJoinedGroup(group);
          } catch (e: any) {
            Alert.alert("Couldn't join", e?.message || 'Please try again.');
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: CampusColors.paper,
  },
  tabContent: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: CampusColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CampusColors.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 14,
    color: CampusColors.muted,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  stateBtn: {
    height: CampusLayout.primaryCtaHeight,
    paddingHorizontal: 28,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CampusColors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
    marginBottom: 14,
  },
  modalHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  modalInstruction: {
    fontSize: 14,
    color: CampusColors.muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  joinInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CampusColors.line,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    marginBottom: 16,
  },
  joinInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: CampusColors.ink,
    letterSpacing: 2,
  },
  joinBtn: {
    height: CampusLayout.primaryCtaHeight,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: CampusColors.line,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: CampusColors.muted,
  },
  scanQrBtn: {
    height: 48,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.paper,
    borderWidth: 1,
    borderColor: CampusColors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanQrText: {
    fontSize: 14,
    fontWeight: '600',
    color: CampusColors.ink,
  },
  chatModalSafe: {
    flex: 1,
    backgroundColor: CampusColors.paper,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CampusColors.card,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  chatModalInfo: {
    flex: 1,
  },
  chatModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  chatModalSubtitle: {
    fontSize: 12,
    color: CampusColors.accent,
  },
  chatPlaceholderContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-start',
  },
  chatEncryptedNotice: {
    backgroundColor: '#FAF5EE',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFE5D5',
  },
  chatEncryptedText: {
    fontSize: 11,
    color: CampusColors.muted,
    textAlign: 'center',
  },
  sampleMessageBubble: {
    backgroundColor: CampusColors.card,
    borderRadius: 14,
    borderTopLeftRadius: 2,
    padding: 12,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: CampusColors.line,
    alignSelf: 'flex-start',
  },
  sampleMessageText: {
    fontSize: 14,
    color: CampusColors.ink,
    lineHeight: 20,
    marginBottom: 4,
  },
  sampleMessageTime: {
    fontSize: 10,
    color: CampusColors.muted,
    alignSelf: 'flex-end',
  },
});
