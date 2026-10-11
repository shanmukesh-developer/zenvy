import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Award,
  Edit3,
  Check,
  School,
  Heart,
  Save,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';
import { CampusProfileData, CampusUserData, CampusRole } from '../../../types/campus';
import { updateCampusProfile } from '../campusApi';

const ROLE_INFO: Record<CampusRole, { name: string; desc: string }> = {
  student: { name: 'Student Member', desc: 'Campus access and chat rights' },
  cr: { name: 'Class Representative', desc: 'Can post classwork and announcements' },
  faculty: { name: 'Faculty', desc: 'Can manage classrooms, assignments and announcements' },
  club_admin: { name: 'Club Admin', desc: 'Can manage club groups and members' },
  moderator: { name: 'Moderator', desc: 'Helps keep campus spaces safe' },
  campus_admin: { name: 'Campus Admin', desc: 'Full campus administration' },
};

// Must match the DB column sizes (CampusProfile) so saves never fail on length.
const LIMITS = { collegeId: 50, branch: 50, section: 20, hostelBlock: 50, roomNumber: 50, bio: 250 };

const notSet = (v?: string | number | null) =>
  v === undefined || v === null || String(v).trim() === '' ? null : String(v);

interface YouTabProps {
  profile: CampusProfileData | null;
  user: CampusUserData | null;
  onOpenVerify: () => void;
  onProfileUpdated: (updated: CampusProfileData) => void;
}

export const YouTab: React.FC<YouTabProps> = ({
  profile,
  user,
  onOpenVerify,
  onProfileUpdated,
}) => {
  const isVerified = profile?.verificationStatus === 'verified';
  const isPending = profile?.verificationStatus === 'pending';

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [hostelBlock, setHostelBlock] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  // Always seed the form from the latest profile when it opens (never from invented defaults).
  const openEditor = () => {
    setBranch(profile?.branch || '');
    setYear(profile?.year ? String(profile.year) : '');
    setSection(profile?.section || '');
    setCollegeId(profile?.collegeId || '');
    setHostelBlock(profile?.hostelBlock || '');
    setRoomNumber(profile?.roomNumber || '');
    setBio(profile?.bio || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (loading) return;
    const yearNum = year.trim() ? Number(year) : null;
    if (yearNum !== null && (!Number.isInteger(yearNum) || yearNum < 1 || yearNum > 6)) {
      Alert.alert('Check your year', 'Year should be a number between 1 and 6.');
      return;
    }
    // Send only what actually changed.
    const changes: Record<string, any> = {};
    const setIfChanged = (key: string, next: string, prev?: string | null) => {
      if (next.trim() !== (prev || '').trim()) changes[key] = next.trim();
    };
    setIfChanged('collegeId', collegeId, profile?.collegeId);
    setIfChanged('branch', branch, profile?.branch);
    setIfChanged('section', section, profile?.section);
    setIfChanged('hostelBlock', hostelBlock, profile?.hostelBlock);
    setIfChanged('roomNumber', roomNumber, profile?.roomNumber);
    setIfChanged('bio', bio, profile?.bio);
    if (yearNum !== null && yearNum !== profile?.year) changes.year = yearNum;

    if (Object.keys(changes).length === 0) {
      setEditModalVisible(false);
      return;
    }

    try {
      setLoading(true);
      const updated = await updateCampusProfile(changes);
      if (updated) {
        onProfileUpdated({ ...(profile || ({} as CampusProfileData)), ...updated });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEditModalVisible(false);
        Alert.alert('Saved ✨', 'Your campus profile is up to date.');
      }
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || 'Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const roles: CampusRole[] = (
    Array.isArray(profile?.roles) && profile!.roles.length ? profile!.roles : ['student']
  ).filter((r): r is CampusRole => !!ROLE_INFO[r as CampusRole]);
  const classLine = [
    notSet(profile?.branch),
    profile?.year ? `Year ${profile.year}` : null,
    notSet(profile?.section) ? `Sec ${profile!.section}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Student Digital ID Card (Section 2) */}
      <View style={styles.idCard}>
        <View style={styles.idCardTop}>
          <View style={styles.universityRow}>
            <School size={18} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.universityName}>
              {profile?.campus?.name || 'Campus not set'}
            </Text>
          </View>
          <View
            style={[
              styles.verifyTag,
              isVerified ? styles.verifiedTag : isPending ? styles.pendingTag : styles.unverifiedTag,
            ]}
          >
            {isVerified ? (
              <ShieldCheck size={12} color="#1E3FB0" strokeWidth={2.4} />
            ) : (
              <AlertCircle size={12} color={isPending ? '#8A3F10' : '#A3321A'} strokeWidth={2.4} />
            )}
            <Text
              style={[
                styles.verifyTagText,
                isVerified ? styles.verifiedTagText : isPending ? styles.pendingTagText : styles.unverifiedTagText,
              ]}
            >
              {isVerified ? 'VERIFIED' : isPending ? 'PENDING REVIEW' : 'UNVERIFIED'}
            </Text>
          </View>
        </View>

        <View style={styles.studentInfoRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.nameDetails}>
            <Text style={styles.studentName}>{user?.name || 'Your name'}</Text>
            <Text style={styles.studentRoll}>
              {profile?.collegeId ? `ID: ${profile.collegeId}` : 'Roll Number: Tap edit to set'}
            </Text>
            <Text style={styles.studentClass}>
              {classLine || 'Branch, year & section: tap Edit to add'}
            </Text>
          </View>
        </View>

        <View style={styles.idCardFooter}>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>HOSTEL / ROOM</Text>
            <Text style={styles.footerValue}>
              {notSet(profile?.hostelBlock) || notSet(profile?.roomNumber)
                ? `${profile?.hostelBlock || '—'} / ${profile?.roomNumber || '—'}`
                : 'Not set'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editCardBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openEditor();
            }}
          >
            <Edit3 size={14} color="#FFFFFF" />
            <Text style={styles.editCardText}>Edit Details</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Verification Banner if unverified */}
      {!isVerified && !isPending && (
        <View style={styles.verifyActionCard}>
          <View style={styles.verifyActionLeft}>
            <AlertCircle size={22} color={CampusColors.warm} strokeWidth={2} />
            <View style={styles.verifyActionTextWrap}>
              <Text style={styles.verifyActionTitle}>Verify Student Identity</Text>
              <Text style={styles.verifyActionSubtitle}>
                Unlock official classroom chats and post whispers (+150 pts)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.verifyActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onOpenVerify();
            }}
          >
            <Text style={styles.verifyActionBtnText}>Verify Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Buddy Points Balance & Rewards (Section 7.4) */}
      <View style={styles.pointsCard}>
        <View style={styles.pointsHeader}>
          <View style={styles.pointsTitleWrap}>
            <Sparkles size={18} color="#F2B27E" strokeWidth={2} />
            <Text style={styles.pointsTitle}>Buddy Points</Text>
          </View>
          <View style={styles.pointsPill}>
            <Text style={styles.pointsNumber}>{profile?.buddyPoints ?? 0}</Text>
            <Text style={styles.pointsLabel}>pts</Text>
          </View>
        </View>
        <Text style={styles.pointsDescription}>
          {isVerified
            ? 'Your points grow as you take part in campus life. Rewards to spend them on are on the way.'
            : 'Verify your student identity to earn +150 points. Rewards to spend them on are on the way.'}
        </Text>
      </View>

      {/* 4. Roles & Adult Status (Section 2.3 & 2.4) */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeading}>Campus Roles & Permissions</Text>

        {roles.map((role) => (
          <View key={role} style={styles.roleRow}>
            <Award size={18} color={CampusColors.accent} strokeWidth={2} />
            <View style={styles.roleTextWrap}>
              <Text style={styles.roleName}>{ROLE_INFO[role].name}</Text>
              <Text style={styles.roleDesc}>{ROLE_INFO[role].desc}</Text>
            </View>
            <View style={styles.roleActiveBadge}>
              <Text style={styles.roleActiveText}>Active</Text>
            </View>
          </View>
        ))}

      </View>

      {/* Profile Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Campus Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={20} color={CampusColors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Student ID / Roll Number</Text>
              <TextInput
                style={styles.modalInput}
                value={collegeId}
                onChangeText={setCollegeId}
                editable={!isVerified}
                maxLength={LIMITS.collegeId}
                autoCapitalize="characters"
                placeholder="e.g. AP21110010123"
                placeholderTextColor={CampusColors.muted}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Branch</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={branch}
                    onChangeText={setBranch}
                    maxLength={LIMITS.branch}
                    autoCapitalize="characters"
                    placeholder="e.g. CSE"
                    placeholderTextColor={CampusColors.muted}
                  />
                </View>
                <View style={{ width: 80, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Year</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={year}
                    onChangeText={(t) => setYear(t.replace(/[^0-9]/g, ''))}
                    maxLength={1}
                    keyboardType="number-pad"
                    placeholder="1-6"
                    placeholderTextColor={CampusColors.muted}
                  />
                </View>
                <View style={{ width: 80 }}>
                  <Text style={styles.inputLabel}>Sec</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={section}
                    onChangeText={setSection}
                    maxLength={LIMITS.section}
                    autoCapitalize="characters"
                    placeholder="A"
                    placeholderTextColor={CampusColors.muted}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Hostel Block</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={hostelBlock}
                    onChangeText={setHostelBlock}
                    maxLength={LIMITS.hostelBlock}
                    placeholder="Block"
                    placeholderTextColor={CampusColors.muted}
                  />
                </View>
                <View style={{ width: 100 }}>
                  <Text style={styles.inputLabel}>Room No</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={roomNumber}
                    onChangeText={setRoomNumber}
                    maxLength={LIMITS.roomNumber}
                    placeholder="Room"
                    placeholderTextColor={CampusColors.muted}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.modalInput, { height: 72 }]}
                value={bio}
                onChangeText={setBio}
                maxLength={LIMITS.bio}
                placeholder="Campus explorer, coffee & code lover"
                placeholderTextColor={CampusColors.muted}
                multiline
              />
              <Text style={styles.charCount}>{bio.length}/{LIMITS.bio}</Text>

              <TouchableOpacity
                style={[styles.saveBtn, loading && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save Profile</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: CampusColors.muted,
    marginTop: -6,
    marginBottom: 8,
  },
  container: {
    flex: 1,
    backgroundColor: CampusColors.paper,
  },
  content: {
    paddingHorizontal: CampusLayout.spacing.lg,
    paddingTop: 12,
    paddingBottom: 28,
  },
  idCard: {
    backgroundColor: CampusColors.inkCard,
    borderRadius: CampusLayout.radius.hero,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  idCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  universityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  universityName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  verifyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CampusLayout.radius.pill,
    gap: 4,
  },
  verifyTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  verifiedTag: {
    backgroundColor: CampusColors.accentSoft,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: CampusColors.accentDeep,
  },
  pendingTag: {
    backgroundColor: CampusColors.warmSoft,
  },
  pendingTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: CampusColors.warmDeep,
  },
  unverifiedTag: {
    backgroundColor: '#FDECEB',
  },
  unverifiedTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A3321A',
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CampusColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nameDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  studentRoll: {
    fontSize: 12,
    color: CampusColors.inkMuted,
    marginBottom: 2,
  },
  studentClass: {
    fontSize: 12,
    fontWeight: '600',
    color: CampusColors.accentOnDark,
  },
  idCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CampusColors.inkBorder,
  },
  footerCol: {},
  footerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: CampusColors.inkMuted,
    letterSpacing: 0.5,
  },
  footerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  editCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: CampusLayout.radius.pill,
    gap: 6,
  },
  editCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  verifyActionCard: {
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: CampusColors.warm,
    marginBottom: 16,
  },
  verifyActionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  verifyActionTextWrap: {
    flex: 1,
  },
  verifyActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CampusColors.ink,
    marginBottom: 2,
  },
  verifyActionSubtitle: {
    fontSize: 12,
    color: CampusColors.muted,
    lineHeight: 17,
  },
  verifyActionBtn: {
    backgroundColor: CampusColors.accent,
    height: 44,
    borderRadius: CampusLayout.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pointsCard: {
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: CampusColors.line,
    marginBottom: 16,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pointsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: CampusColors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: CampusLayout.radius.pill,
    gap: 3,
  },
  pointsNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: CampusColors.accentDeep,
  },
  pointsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CampusColors.accentDeep,
  },
  pointsDescription: {
    fontSize: 13,
    color: CampusColors.muted,
    lineHeight: 18,
    marginBottom: 14,
  },
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CampusColors.paper,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CampusColors.line,
    gap: 8,
  },
  redeemBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: CampusColors.ink,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: CampusColors.line,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: CampusColors.ink,
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
    gap: 12,
  },
  roleTextWrap: {
    flex: 1,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '600',
    color: CampusColors.ink,
  },
  roleDesc: {
    fontSize: 12,
    color: CampusColors.muted,
    marginTop: 2,
  },
  roleActiveBadge: {
    backgroundColor: CampusColors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: CampusColors.accentDeep,
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
    maxHeight: '85%',
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CampusColors.ink,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: CampusColors.paper,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CampusColors.line,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: CampusColors.ink,
    marginBottom: 14,
  },
  rowInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtn: {
    height: CampusLayout.primaryCtaHeight,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
