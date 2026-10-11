import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldCheck, AlertCircle, Plus, Search, Sparkles, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CampusColors, CampusTypography, CampusLayout } from '../../../constants/campusTheme';
import { CampusProfileData, CampusUserData } from '../../../types/campus';

interface CampusHeaderProps {
  profile: CampusProfileData | null;
  user: CampusUserData | null;
  onOpenVerify: () => void;
  onOpenJoinGroup: () => void;
  onSearchPress: () => void;
  onBack?: () => void;
}

export const CampusHeader: React.FC<CampusHeaderProps> = ({
  profile,
  user,
  onOpenVerify,
  onOpenJoinGroup,
  onSearchPress,
  onBack,
}) => {
  // No profile = signed out, still loading, or Campus unreachable: never nag about verification
  // (or show actions that can't work) until we actually know who the student is.
  const hasProfile = !!profile;
  const isVerified = profile?.verificationStatus === 'verified';
  const isPending = profile?.verificationStatus === 'pending';
  const campusName = profile?.campus?.code || 'Campus';

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onBack();
            }}
            accessibilityLabel="Back to Food Delivery"
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={CampusColors.ink} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Campus Buddy</Text>
          <View style={styles.badgeRow}>
            <View style={styles.campusBadge}>
              <Text style={styles.campusBadgeText}>{campusName}</Text>
            </View>

            {hasProfile && (
            <TouchableOpacity
              style={[
                styles.verifyPill,
                isVerified ? styles.verifiedPill : isPending ? styles.pendingPill : styles.unverifiedPill,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onOpenVerify();
              }}
              activeOpacity={0.8}
            >
              {isVerified ? (
                <ShieldCheck size={12} color="#1E3FB0" strokeWidth={2.2} />
              ) : (
                <AlertCircle size={12} color={isPending ? '#8A3F10' : CampusColors.warm} strokeWidth={2.2} />
              )}
              <Text
                style={[
                  styles.verifyPillText,
                  isVerified ? styles.verifiedPillText : isPending ? styles.pendingPillText : styles.unverifiedPillText,
                ]}
              >
                {isVerified ? 'Verified' : isPending ? 'Pending' : 'Verify ID'}
              </Text>
            </TouchableOpacity>
            )}
          </View>
        </View>

        {hasProfile && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onSearchPress();
            }}
            accessibilityLabel="Search campus chats and people"
          >
            <Search size={20} color={CampusColors.ink} strokeWidth={1.8} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, styles.primaryButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onOpenJoinGroup();
            }}
            accessibilityLabel="Create or join group"
          >
            <Plus size={20} color="#FFFFFF" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        )}
      </View>

      {/* Points & Verification Callout if unverified */}
      {hasProfile && !isVerified && (
        <TouchableOpacity
          style={styles.verifyBanner}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onOpenVerify();
          }}
          activeOpacity={0.85}
        >
          <View style={styles.verifyBannerLeft}>
            <Sparkles size={16} color={CampusColors.warm} strokeWidth={2} />
            <Text style={styles.verifyBannerText}>
              {isPending
                ? 'ID verification in review. Features will unlock shortly.'
                : 'Verify your student ID to unlock Classwork & Whispers (+150 pts)'}
            </Text>
          </View>
          <Text style={styles.verifyBannerAction}>{isPending ? 'Status' : 'Verify'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: CampusColors.paper,
    paddingHorizontal: CampusLayout.spacing.lg,
    paddingTop: CampusLayout.spacing.md,
    paddingBottom: CampusLayout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: CampusColors.placeholderFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: CampusColors.ink,
    letterSpacing: -0.6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  campusBadge: {
    backgroundColor: CampusColors.placeholderFill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  campusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: CampusColors.ink,
    letterSpacing: 0.5,
  },
  verifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CampusLayout.radius.pill,
    gap: 4,
  },
  verifyPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  verifiedPill: {
    backgroundColor: CampusColors.accentSoft,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: CampusColors.accentDeep,
  },
  pendingPill: {
    backgroundColor: CampusColors.warmSoft,
  },
  pendingPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: CampusColors.warmDeep,
  },
  unverifiedPill: {
    backgroundColor: '#FDECEB',
  },
  unverifiedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: CampusColors.warm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: CampusLayout.radius.pill,
    backgroundColor: CampusColors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CampusColors.line,
  },
  primaryButton: {
    backgroundColor: CampusColors.accent,
    borderColor: CampusColors.accent,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CampusColors.warmSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E8D4C0',
  },
  verifyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  verifyBannerText: {
    fontSize: 12,
    fontWeight: '500',
    color: CampusColors.warmDeep,
    flex: 1,
  },
  verifyBannerAction: {
    fontSize: 12,
    fontWeight: '700',
    color: CampusColors.warm,
  },
});
