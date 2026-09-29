import * as Haptics from 'expo-haptics';
import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
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
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Vibration,
  SafeAreaView,
  StatusBar,
  Share
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { COLORS, SHADOWS } from '../constants/theme';
import { ENDPOINTS, API_URL } from '../constants/api';
import { apiFetch } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { connectSocket } from '../utils/socket';
import { FloatingPulse } from '../components/AnimatedSection';
import DopaminePressable from '../components/DopaminePressable';
import GroveScreen from '../components/grove/GroveScreen';
import { mapFriends, type BackendFriend } from '../components/grove/mapFriendData';

// Helpers for Grove UI
const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0,2).toUpperCase();
};
const getFirstName = (name: string) => {
  return name ? name.split(' ')[0] : 'Unknown';
};
const getThemeColorForNode = (node: any) => {
  if (!node) return '#FF1493'; // Fallback for "YOU"
  const theme = CHAT_THEMES.find(t => t.name === node.theme);
  return theme ? theme.accent : '#3b82f6';
};

const { width: SW, height: SH } = Dimensions.get('window');

// Visual styling constants

export const VIBE_OPTIONS = [
  { id: 'Roomie', label: 'Roomie', emoji: '⚡', color: '#6E5BFF', desc: 'Squad up for late night food runs & mess escapes' },
  { id: 'Midnight Foodie', label: 'Foodie', emoji: '🍕', color: '#FF7A59', desc: 'Chai, Maggi, treat sharing & split bills' },
  { id: 'Snack Partner', label: 'Partner', emoji: '🎯', color: '#00F2FE', desc: 'Canteen buddy & craving companion' },
  { id: 'Study Gang', label: 'Study', emoji: '📚', color: '#F7971E', desc: 'Exam night fuel & caffeine alarms' },
  { id: 'Secret Nibbler', label: 'Nibbler', emoji: '🤫', color: '#FF1493', desc: 'Mystery snack drops & anonymous gifting' },
];

export const ICEBREAKER_PROMPTS = [
  'Chai & Maggi sponsor? ☕🍜',
  'Midnight cravings squad 🚨🍕',
  'Hostel block neighbour linkup 🏢⚡',
  'Next canteen treat on you? 😋🎁',
  'Roommate emergency snack backup 🍫🚀',
];

const GRAPHITE_BG = '#04050d';
const VIOLET_ACCENT = '#6E5BFF';
const EMBER_ORANGE = '#FF7A59';

const ZENVY_STICKERS = [
  '🍃', '🌿', '🌱', '🌸', '🌳', '🌰', '🍄', '✨', '⚡', '🔥', '🏆', '🎁', '🚀', '🤫', '💖', '💀', '🎉'
];

const CAMPUS_TRUTHS = [
  "Hostel warden movie villain aithe, vaallu evariki matching?",
  "Nee classmate GPA entha low ante, repati exam pass ayye chances kante thakkuva?",
  "Canteen lo free ga dorukuthundi ani thinna chetha food ento cheppu?",
  "Room lo vachina gubulu vasanani, nee roommate meedha thosesi thappinchukunnava?",
  "Exam week lo snanam cheyakunda enni rojulu unnav?",
  "Ae professor voice vinte neeku ventane nidra vasthundi?",
  "Nee crush mundhu nuvvu chesina goppa comedy panento gurthunda?",
  "Roommate sodhi chepthanu ante, act cheyataniki eppudaina padukunnattu natinchava?",
  "Curfew time tharwatha bayataki velladaniki warden ki cheppina peddha abaddham enti?",
  "Nee Netflix password evariki isthe nuvvu safe kadhu anukuntunnav?",
  "Classes ki regular ga vellina, ae subject lo neeku 'zero knowledge' undi?",
  "Oke jodu socks ni enni rojulu thodigaav?",
  "Hostel pocket money tho nuvvu konna parama chetha vasthuuvu enti?",
  "Shared fridge lo unna pakkanolla food ni eppudaina dhochi thinnava?",
  "Nuvvu classes bunk kotte companion tho date ki vellalsi vasthe, pararisthithi entha ghoranga untundi?",
  "Class lo extra homework adige aadini chusthe neeku ae range lo kopam vasthundi?",
  "Proxy sign kosam senior padhaalu eppudaina patte range lo try chesava?",
  "English assignments kosam entha mandhi Google Translate ni vaaduthunnaru?",
  "Campus Wi-Fi lo nuvvu search chesina weirdest vishayam enti?",
  "Ae friend accident ga edhoka pichi pani chesi police case varaku velthadu?",
  "Room lo kettle vaadi nuvvu chesina ghoramaina vanta enti?",
  "If you had to trade your roommate for a bag of Lays, ae flavor choose chesukuntavu?",
  "Library book return cheyakunda fine book cost kante ekkuva chesava?",
  "Nee friends circle lo evari guraka valla hostel shake avthundi?",
  "Nee parents ninnu piliche embarrassing pet name enti?",
  "Internal marks kosam professor chese chetha joke ki navvaka thappaledha?",
  "Class WhatsApp group lo nuvvu accidental ga send chesina awkward message enti?",
  "Study group munigipoye badava aithe, ninnu nuvvu kapadukovadaniki evarini thosesthavu?",
  "Class ki level up avvadaniki enni sarlu alarm snooze chesav?",
  "Roommate clothes valla permission lekunda vesukuni dirty ga return chesava?",
  "Ae canteen food tinte direct ga emergency ward ki pampinchochu?",
  "Assignment submit cheyakunda cheppina worst reason enti?",
  "Nee department lo active gossip partner evaru?",
  "Frustrate ayyi ae friend messages naina mute chesava?",
  "Study time lo Reels scroll cheyataniki enni hours waste chesav?",
  "Dean badhulu oka movie star ni dean ga pedithe, evarini pedathav?",
  "Campus lo bike riding cheyyadam rani worst rider evaru?",
  "Group study session lo emi ardham kakapoina 'ardhamaindi' ani thala oopava?",
  "Phone muttukokunda nuvvu unna maximum time entha?",
  "Nee search history screen meedha play chesthe, campus nundi entha fast ga paripothav?",
  "Back bench lo kurchuni gaming aade target class edhi?",
  "Seniors neeku cheppina absolute waste advice enti?",
  "Roommate tho velladam ishtam leka, eppudaina fake emergency drama aadav?",
  "Canteen tea kosam oka week lo spend chesina highest money entha?",
  "Hostel room thagalabadithe, pranam leni ae vasthuvuni first save chesthav?",
  "Ae exam ni pakkana unna genius paper chusi copy kotti pass ayyav?",
  "Nidra lo eppudaina hostel lo gattiga edhaina embarrassing ga arichava?",
  "Assignment fast ga rayadaniki pakkanolla peru tho paatu copy kottava?",
  "Nee gang lo overaction star evaru?",
  "Ae department ki convert avvadaniki ready ga unnav?",
  "If {friendName} movie villain aithe, first ae professor ni target chestharu?",
  "Nuvvu, {friendName} classes ni skip chesi ae canteen lo spend chestharu?",
  "{friendName} canteen lo thinna ghoramaina food item enti?",
  "{friendName} ni oka plate samosa badhulu trade chesi paneer samosa choose chesthava?",
  "GPA lo evaru topper: nuvva leka {friendName} aa?",
  "{friendName} gurinchi nuvvu vinna worst gossip enti?",
  "{friendName} hostel rule break chesthe evari meedha blame thosestharu?",
  "Warden tho fight chesthe evaru win avtharu: nuvva, {friendName} aa?",
  "{friendName} tho elevator lo irukkapothe first evaru gattiga edustharu?",
  "Ae subject gurinchi {friendName} ki absolute ga emi theliyadhu?",
  "{friendName} unna weirdest habit enti?",
  "If {friendName} hostel warden aithe, first change chese rule enti?",
  "Exam hall lo nidrapoye chance evariki ekkuva undi: neeka leka {friendName} ka?",
  "{friendName} canteen lo unna ae food ki sync avtharu?",
  "{friendName} ki nuvvu iche embarrassing nickname edinaina?",
  "If {friendName} caught you stealing {canteenFood} in the {locationName}, first em ani arusthav?",
  "Nuvvu {friendName} kalisi {locationName} lo edhaina block-list activity chesthe, evarini throw chesthav?",
  "Ae subject kante {friendName} icche free advice waste anukuntunnav: {subjectName} aa leka normal aa?",
  "If you, {friendName}, and {professorRole} were locked in {locationName}, first evaru gattiga edustharu?",
  "GPA ranking lo {friendName} kante nee {subjectName} skills better aa kadha?",
  "If the {professorRole} catches you with {itemName} in the class, direct ga {locationName} ki send chesthara?",
  "{friendName} room lo {itemName} dhochi {canteenFood} thinadam direct ga crime aa kadha?",
  "Dean/Warden room lo {friendName} with {itemName} unte, clear ga photo petti expose chesthava?",
  "Ae {subjectName} exam roju nuvvu {friendName} kante ekkuva sleep veshav?",
  "{friendName} dynamic personality character low aa leka canteen {canteenFood} low aa?"
];

const CAMPUS_DARES = [
  "Roommate ki 'Room lo unna sock ekkado cheppu' ani message petti 1 hour follow up cheyyaku.",
  "Eroju nee phone Screen Time screenshot ni ee chat ki send chey.",
  "WhatsApp status 'Hostel gossip speed calculator' ga 24 hours change chey.",
  "Crush ki 'Library stairs nundi padinapudu emaina debba thagilindha?' ani text petti screenshot pettu.",
  "Extreme confusion face selfie petti send chey.",
  "Creepy voice lo 'Warden chusthunnaru' ani voice note pettu.",
  "Senior ki '1+1 endhuku 3 kadhu?' ani text petti reaction screenshot pettu.",
  "Class WhatsApp group lo 'Exam cancel ayyindha?' ani message petti 5 seconds lo delete chey.",
  "Profile name ni 'Hostel Legend' ga change chesi 2 hours unchu.",
  "Textbook lo unna oka bore line ni voice note lo full dramatic ga read chey.",
  "Kotha number ki 'Nuvvu last semester chesindi naku thelsu' ani text petti screenshot pettu.",
  "Nee room messiest corner photo petti send chey right now.",
  "Keyboard language change chesi kotha language lo message pettu.",
  "Best friend ki 'Nenu Mars ki vellipothunna, emaina kavala?' ani message petti screenshot pettu.",
  "Alphabet song reverse lo voice note pettu fast ga.",
  "Hostel food gurinchi 3 lines bad kavitha rasi send chey.",
  "Spoon microphone ga petti selfie pettu.",
  "Roommate ki 'Room lo unna kettle key dynamic ga configure ayyi automatic ga alert isthundi' ani text pettu.",
  "WhatsApp profile pic okka potato image ga 1 hour change chey.",
  "Evil laugh note pettu for 5 seconds.",
  "Class group chat lo 'Nene design chesina champion' ani petti, reason cheppaku.",
  "Desk photo cleanup cheyakunda pettu.",
  "Senior ki 'Canteen tea lo actual ga warm water kaluputhara?' ani adigi reply screenshot pettu.",
  "Voice note lo 'Zenvy tips kosam subscribe cheyandi' ani radio jockey la cheppu.",
  "Best friend ki 'Naku plate samosa kurchovali nuvvu' ani message petti reaction pettu.",
  "WhatsApp status 'Currently under warden investigation' ga change chey.",
  "Canteen food gurinchi voice note lo Michelin star chef style lo review cheppu.",
  "Roommate ki 'Room door lock chesuko, eroju dheyyaalu active ga unnayi' ani text pettu.",
  "Room lo unna patha plastic container wrapper photo pettu.",
  "Group chat lo 'Repu ae class bunk kodudham?' ani text pettu.",
  "WhatsApp status 'Sleeping until graduation' ga 12 hours change chey.",
  "Microwave oven sound voice note pettu.",
  "Selfie indoors sunglasses to petti send chey.",
  "Crush ki 'Nuvvu library book va? Ninnu check out cheyakunda undalenu' ani message petti screenshot pettu.",
  "Kettle ki apology letter rasina photo pettu.",
  "Classmate ki 'Last week exam notes kavali' ani text petti screenshot pettu.",
  "WhatsApp status 'Motivation missing' ga 24 hours change chey.",
  "Grocery list ni voice note lo complete mass voice lo read chey.",
  "Roommate ki 'Fan chala fast ga thiruguthundi, launch ayye la undi' ani message petti screenshot pettu.",
  "Book thala meedha petti selfie send chey.",
  "Senior ki 'Seniors ki tea bill juniors ye kadathara?' ani adigi screenshot pettu.",
  "Paper meedha 'Zenvy helps my survival' ani rasi photo send chey.",
  "Hostel emergency warning voice note pettu.",
  "Friend ki 'Accidental ga bike konna' ani cheppi screenshot pettu.",
  "WhatsApp status 'Warden tracking me' ga 4 hours update chey.",
  "Text {friendName}: 'Room kettle automatic ga sound chesthundi' ani petti screenshot pettu.",
  "Text {friendName}: 'Library stairs nundi padinapudu emaina debba thagilindha?' ani adigi screenshot pettu.",
  "Text {friendName}: 'Last semester chesindi naku thelsu' ani text petti screenshot pettu.",
  "Text {friendName}: 'Naku plate samosa buy cheyali nuvvu' ani message petti screenshot pettu.",
  "Text {friendName}: 'Block {blockName} lo dheyyaalu unnayanta ga' ani petti screenshot pettu.",
  "Text {friendName}: 'Nuvvu library book va? Ninnu check out cheyakunda undalenu' ani message petti screenshot pettu.",
  "Text {friendName}: 'Phone missing, call chey naku' ani petti screenshot pettu.",
  "Text {friendName}: 'Room {roomNumber} lo fan launch avthundi' ani text petti screenshot pettu.",
  "Text {friendName}: 'Nenu bullet bandi konna' ani message petti screenshot pettu.",
  "Text {friendName}: 'Repati exam cancel ayyindha?' ani message petti screenshot pettu.",
  "Text {friendName}: 'I lost my {itemName} in {locationName}, can you search it?' and screenshot it.",
  "Text {friendName}: 'Please buy me {canteenFood} right now, naku low sugar vundi' and screenshot it.",
  "Change your WhatsApp status to 'Currently learning {subjectName} from {friendName}' for 4 hours.",
  "Text {friendName}: 'Warden has detected your {itemName} in {locationName}' and screenshot the reaction.",
  "Text {friendName}: 'I am declaring {itemName} as national hostel item' and screenshot it.",
  "Voice note {friendName}: whisper '{canteenFood} smell is coming from {locationName}' in a scary tone.",
  "Text {friendName}: 'I accidentally dropped your {itemName} in canteen {canteenFood}' and screenshot the reaction.",
  "Write 'I love {subjectName} and {friendName}' on a paper, take a photo and send it.",
  "Text {friendName}: 'Let's skip {subjectName} class and go to {locationName}' and screenshot it.",
  "Text {friendName}: 'Can you explain why {professorRole} is searching for your {itemName}?' and screenshot it."
];

const CHAT_THEMES = [
  { name: 'grove', label: 'Enchanted Grove', colors: ['#071610', '#0f2b1f', '#06130d'], accent: '#10B981' },
  { name: 'autumn', label: 'Oak & Amber', colors: ['#1a1007', '#2b1b0e', '#130a04'], accent: '#F59E0B' },
  { name: 'blossom', label: 'Cherry Blossom', colors: ['#1a0c16', '#2d1425', '#12070e'], accent: '#F472B6' },
  { name: 'nightfall', label: 'Starry Canopy', colors: ['#080f1e', '#121e38', '#060a14'], accent: '#818CF8' }
];

const STATUS_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#FF512F', '#DD2476'],
  ['#4776E6', '#8E54E9'],
  ['#00B4DB', '#0083B0'],
  ['#f12711', '#f5af19'],
  ['#8E2DE2', '#4A00E0'],
  ['#11998e', '#38ef7d'],
  ['#0E1116', '#171B22'],
];

const CANTEEN_FOODS = ['samosa', 'maggi', 'canteen tea', 'fried rice', 'dosa', 'veg puff', 'aloo bajji', 'biryani', 'watery dal', 'burnt chapati', 'cement idli', 'diluted milk', 'chemical paneer', 'half-boiled egg', 'mystery gravy', 'rubber parotta', 'yellow drinking water', 'undercooked noodles', 'smelly boiled rice', 'expired tomato ketchup', 'diluted rasam', 'sour curd', 'plastic cup tea', 'half-fried onion samosa', 'dusty peanuts', 'uncooked maggi crumbs'];
const SUBJECTS = ['Maths', 'Physics', 'Coding', 'DBMS', 'OS', 'English', 'Data Structures', 'Chemistry', 'Boring Lecture 101', 'Proxy Attendance Class', 'Copy-Paste Lab', 'Sleeping Session', 'Seniors Ragging Class', 'Exam Hall Torture', 'Viva Voce Disaster', 'Seminar Presentation Boredom', 'Assigned Project Failure', 'Assignment Copying Hour', 'Last Bench Gaming session', 'Record Book Writing marathon'];
const PROFESSOR_ROLES = ['HOD', 'lab assistant', 'dean', 'librarian', 'warden', 'maths prof', 'physics prof', 'security guard', 'canteen owner', 'exam supervisor', 'proxy checker', 'gatekeeper', 'fees collector', 'attendance monitor', 'record book signature manager', 'external examiner', 'internship coordinator', 'canteen cashier'];
const LOCATIONS = ['library', 'girls hostel', 'canteen back area', 'seminar hall', 'dean office', 'hostel terrace', 'main gate', 'exam hall bench', 'warden checking post', 'hostel washroom', 'seniors corner', 'dark alley near gate', 'class back row', 'canteen queue', 'admin cell queue', 'security check gate', 'attendance office desk', 'common room television bench', 'hostel lobby elevator', 'parking slot back'];
const ITEMS = ['kettle', 'missing sock', 'cheat sheet', 'hot sauce', 'sunglasses', 'bicycle', 'slipper', 'broken plastic mug', 'empty wallet', '2-rupee coin', 'stolen assignment book', 'mosquito bat', 'expired noodle pack', 'wifi password paper', 'fake medical certificate', 'one-side earphone', 'torn textbook', 'empty water bottle', 'crushed tea cup', 'proxy signature pen', 'dirty bedsheet', 'broken charger cable', 'stolen hanger', 'lost library card', 'used face mask'];

// Helper to resolve profile image fallbacks using premium Unsplash avatars
const getAvatarUrl = (profileImage: string | null, id: string) => {
  if (profileImage && (profileImage.startsWith('http') || profileImage.startsWith('data:'))) {
    return profileImage;
  }
  if (profileImage) {
    return `${API_URL}${profileImage.startsWith('/') ? '' : '/'}${profileImage}`;
  }
  const placeholders = [
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % placeholders.length;
  return placeholders[index];
};


// All friend data, messages, and search suggestions are fetched from backend APIs.
// No hardcoded mock/seed data — everything is real database-backed.

export default function FriendsScreen() {
  const router = useRouter();
  const { user, setUser, refreshUser } = useAuth();
  const { isDark } = useTheme();
  const myUserId = user?.id || user?._id || 'self';

  // Chat Locks State
  const [lockedChats, setLockedChats] = useState<string[]>([]);

  useEffect(() => {
    const loadLockedChats = async () => {
      try {
        const stored = await AsyncStorage.getItem('zenvy_locked_chats');
        if (stored) {
          setLockedChats(JSON.parse(stored));
        }
      } catch (e) {
        console.warn("Failed to load locked chats", e);
      }
    };
    loadLockedChats();
  }, []);

  const toggleChatLock = async (friendId: string) => {
    const isCurrentlyLocked = lockedChats.includes(friendId);
    
    // Require authentication to toggle lock status
    let authSuccess = false;
    if (Platform.OS === 'web') {
      authSuccess = window.confirm(isCurrentlyLocked ? 'Authenticate to unlock chat' : 'Authenticate to lock chat');
    } else {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: isCurrentlyLocked ? 'Authenticate to unlock chat' : 'Authenticate to lock chat',
        fallbackLabel: 'Use Passcode',
      });
      authSuccess = result.success;
    }

    if (authSuccess) {
      const newLockedChats = isCurrentlyLocked 
        ? lockedChats.filter(id => id !== friendId) 
        : [...lockedChats, friendId];
      
      setLockedChats(newLockedChats);
      AsyncStorage.setItem('zenvy_locked_chats', JSON.stringify(newLockedChats));
      
      if (isCurrentlyLocked) {
        Alert.alert('Chat Unlocked', 'This chat is now visible without authentication.');
      } else {
        Alert.alert('Chat Locked', 'This chat will now require authentication to open.');
      }
    }
  };

  // Core list state (real backend data only)
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [syncedContacts, setSyncedContacts] = useState<any[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // QR & Code Connection States
  const [activeSyncTab, setActiveSyncTab] = useState<'scanner' | 'my_qr' | 'code'>('scanner');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [selectedVibe, setSelectedVibe] = useState('Roomie');
  const [selectedIcebreaker, setSelectedIcebreaker] = useState('Chai & Maggi sponsor? ☕🍜');
  const [customIcebreaker, setCustomIcebreaker] = useState('');
  const [torchActive, setTorchActive] = useState(false);
  const [connectingViaCode, setConnectingViaCode] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftAmount, setGiftAmount] = useState<number>(20);
  const [giftingLoading, setGiftingLoading] = useState(false);
  const [vanishMode, setVanishMode] = useState(false);

  // Laser scanner animation
  const laserAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showSyncModal && activeSyncTab === 'scanner') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [showSyncModal, activeSyncTab]);

  
  // Interactive nodes state
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const activeChatRef = useRef<any>(null);
  activeChatRef.current = activeChat;
  const [popoverPending, setPopoverPending] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [usedTruths, setUsedTruths] = useState<number[]>([]);
  const [usedDares, setUsedDares] = useState<number[]>([]);
  
  // Nickname Editing State
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  // Status Modal & Values
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [activeStatusView, setActiveStatusView] = useState<any | null>(null);
  const [statusText, setStatusText] = useState(user?.statusText || '');
  const [statusEmoji, setStatusEmoji] = useState(user?.statusEmoji || '');
  const [statusBgIndex, setStatusBgIndex] = useState(0);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (user) {
      setStatusText(user.statusText || '');
      setStatusEmoji(user.statusEmoji || '');
    }
  }, [user]);

  // Typing status states
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  
  // Real-Time Buddy Notifications Toast State
  const [activeToast, setActiveToast] = useState<{ title: string; text: string } | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const markStatusAsSeen = async (friendId: string) => {
    try {
      await apiFetch(`${API_URL}/api/friends/status/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId })
      });
      loadFriendsData();
    } catch (error) {
      console.error('[MARK_SEEN_ERROR]', error);
    }
  };

  useEffect(() => {
    if (activeStatusView) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: false
      }).start();

      if (!activeStatusView.isSelf) {
        markStatusAsSeen(activeStatusView.friendId);
      }

      const timer = setTimeout(() => {
        setActiveStatusView(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [activeStatusView]);

  const triggerToast = (title: string, text: string) => {
    setActiveToast({ title, text });
    setTimeout(() => setActiveToast(null), 4500);
  };
  
  // Theme state updates instantly
  const [chatTheme, setChatTheme] = useState<string>('grove');
  const chatScrollRef = useRef<ScrollView>(null);

  // Orbit Center position configuration
  const centerPoint = { x: SW / 2, y: 220 };
  const MIN_RADIUS = 75;
  const MAX_RADIUS = 135;

  // Load friends and pending requests on load (with 30s fallback poll alongside live WebSockets)
  useEffect(() => {
    loadFriendsData();
    const interval = setInterval(loadFriendsData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global user socket listener for real-time buddy notifications
  useEffect(() => {
    if (!myUserId) return;
    const socket = connectSocket();
    socket.emit('joinRoom', `user-${myUserId}`);
    
    const onIncomingRequest = (data: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      triggerToast('⚡ FRIEND REQUEST', `${data.requester?.name || 'Someone'} requested to join your orbit!`);
      loadFriendsData();
    };

    const onRequestAccepted = (data: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      triggerToast('🤝 ORBIT LINKED', `${data.friendName || 'A friend'} accepted your request!`);
      loadFriendsData();
    };

    const onNudge = (data: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      triggerToast('⚡ ORBIT NUDGE', `${data.senderName || 'Your friend'} nudged your orbit flame! 🔥`);
      loadFriendsData();
    };

    const onFriendStatusUpdated = () => {
      loadFriendsData();
    };

    socket.on('incoming_friend_request', onIncomingRequest);
    socket.on('friend_request_accepted', onRequestAccepted);
    socket.on('friend_nudge', onNudge);
    socket.on('friend_status_updated', onFriendStatusUpdated);

    return () => {
      socket.off('incoming_friend_request', onIncomingRequest);
      socket.off('friend_request_accepted', onRequestAccepted);
      socket.off('friend_nudge', onNudge);
      socket.off('friend_status_updated', onFriendStatusUpdated);
    };
  }, [myUserId]);

  // Socket listener for messaging integration
  const activeConversationId = activeChat?.conversationId;
  const activeFriendshipId = activeChat?.friendshipId;

  useEffect(() => {
    setIsFriendTyping(false);
    setIsTypingLocal(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!activeConversationId) return;

    const socket = connectSocket();
    socket.emit('joinConversation', activeConversationId);

    const onNewMessage = (msg: any) => {
      if (msg.conversationId === activeConversationId) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          
          // Deduplicate optimistic messages with same text
          const hasOptimistic = prev.some(m => m.id.startsWith('temp-') && m.text === msg.text);
          if (hasOptimistic) {
            // Replace the optimistic message with the real one
            return prev.map(m => (m.id.startsWith('temp-') && m.text === msg.text) ? msg : m);
          }
          return [...prev, msg];
        });
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
        if (msg.senderId !== myUserId) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    };

    const onThemeUpdated = (data: any) => {
      if (data.friendshipId === activeFriendshipId) {
        setChatTheme(data.theme);
      }
    };

    const onFriendTypingStart = (data: any) => {
      if (data.senderId !== myUserId) {
        setIsFriendTyping(true);
      }
    };

    const onFriendTypingEnd = (data: any) => {
      if (data.senderId !== myUserId) {
        setIsFriendTyping(false);
      }
    };

    socket.on('new_friend_message', onNewMessage);
    socket.on('friendship_theme_updated', onThemeUpdated);
    socket.on('friend_typing_start', onFriendTypingStart);
    socket.on('friend_typing_end', onFriendTypingEnd);

    fetchChatHistory(activeConversationId);

    return () => {
      socket.off('new_friend_message', onNewMessage);
      socket.off('friendship_theme_updated', onThemeUpdated);
      socket.off('friend_typing_start', onFriendTypingStart);
      socket.off('friend_typing_end', onFriendTypingEnd);
    };
  }, [activeConversationId, activeFriendshipId]);

  const loadFriendsData = async () => {
    try {
      refreshUser();
      const res = await apiFetch(ENDPOINTS.friendsList);
      if (res.ok) {
        let data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFriends(data.slice(0, 10));
        } else {
          setFriends([]);
        }
        
        // Sync activeChat state if open to update dynamic fields (like conversationId and streakCount)
        if (activeChatRef.current) {
          const updated = (Array.isArray(data) && data.length > 0 ? data : []).find((f: any) => f.friendshipId === activeChatRef.current.friendshipId);
          if (updated) {
            setActiveChat(updated);
          }
        }
      } else {
        setFriends([]);
      }
      const resPending = await apiFetch(ENDPOINTS.friendsPending);
      if (resPending.ok) {
        const data = await resPending.json();
        setPendingRequests(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setFriends([]);
      console.error('[LOAD_DATA_ERROR]', e);
    }
  };

  const fetchChatHistory = async (convId: string) => {
    try {
      const res = await apiFetch(ENDPOINTS.friendsMessages(convId));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setChatMessages(data);
        } else {
          setChatMessages([]);
        }
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 200);
      } else {
        setChatMessages([]);
      }
    } catch (e) {
      setChatMessages([]);
    }
  };

  const handleSaveNickname = async () => {
    if (!activeChat) return;
    const cleanNickname = nicknameInput.trim();
    const originalName = activeChat.originalName || activeChat.name;
    const finalDisplayName = cleanNickname || originalName;

    // Optimistically update current chat and friends list
    setActiveChat((prev: any) => prev ? { ...prev, name: finalDisplayName, nickname: cleanNickname || null } : null);
    setFriends(prev => prev.map(f =>
      f.friendshipId === activeChat.friendshipId
        ? { ...f, name: finalDisplayName, nickname: cleanNickname || null }
        : f
    ));
    setIsEditingNickname(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiFetch(`${API_URL}/api/friends/${activeChat.friendshipId}/nickname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: cleanNickname })
      });
    } catch (e) {
      console.error('[NICKNAME_SAVE_ERROR]', e);
    }
  };

  const handleSendNudge = async () => {
    if (!activeChat) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiFetch(`${API_URL}/api/friends/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: activeChat.friendshipId })
      });
      if (res.ok) {
        const data = await res.json();
        Alert.alert('Nudge Sent! ⚡', `Streak maintained at ${data.streakCount} days!`);
        loadFriendsData();
      }
    } catch (e) {
      console.error('[NUDGE_ERROR]', e);
    }
  };

  // Grove callbacks: nudge/water/open-chat by friend ID (doesn't require chat to be open)
  const handleGroveNudge = async (friendId: string) => {
    const friend = friends.find((f: any) => f.friendId === friendId);
    if (!friend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiFetch(`${API_URL}/api/friends/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: friend.friendshipId })
      });
      if (res.ok) {
        const data = await res.json();
        Alert.alert('Nudge Sent! ⚡', `Streak maintained at ${data.streakCount} days!`);
        loadFriendsData();
      }
    } catch (e) {
      console.error('[GROVE_NUDGE_ERROR]', e);
    }
  };

  const handleGroveWater = async (friendId: string) => {
    // "Watering" a branch is the same as nudging — it maintains the streak
    await handleGroveNudge(friendId);
  };

  const handleGroveOpenChat = async (friendId: string) => {
    const friend = friends.find((f: any) => f.friendId === friendId);
    if (!friend) return;
    if (lockedChats.includes(friendId)) {
      let authSuccess = false;
      if (Platform.OS === 'web') {
        authSuccess = window.confirm('Authenticate to unlock chat');
      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Chat',
          fallbackLabel: 'Use Passcode',
        });
        authSuccess = result.success;
      }
      if (!authSuccess) return;
    }
    setActiveChat(friend);
    setChatTheme(friend.theme || 'graphite');
  };

  // Map backend friends to grove's Friend type for the tree
  const groveFriends = React.useMemo(() => {
    return mapFriends(friends as BackendFriend[], myUserId).treeFriends;
  }, [friends, myUserId]);

  const handleRemoveFriend = async () => {
    if (!activeChat) return;
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${activeChat.name} from your orbit?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiFetch(`${API_URL}/api/friends/${activeChat.friendshipId}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                activeChatRef.current = null;
                setActiveChat(null);
                loadFriendsData();
                Alert.alert('Removed', 'Friend removed from your orbit.');
              }
            } catch (e) {
              console.error('[REMOVE_FRIEND_ERROR]', e);
            }
          }
        }
      ]
    );
  };

  const handleCloseChat = () => {
    activeChatRef.current = null;
    setActiveChat(null);
    setIsEditingNickname(false);
    loadFriendsData();
  };

  // Daily-seeded shuffle: uses today's date as a seed so the pool rotates every day
  const dailySeed = (() => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) {
      h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  })();

  const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
    const copy = [...arr];
    let s = seed;
    for (let i = copy.length - 1; i > 0; i--) {
      s = ((s * 1103515245 + 12345) & 0x7fffffff);
      const j = s % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const getUniqueQuestion = (type: 'truth' | 'dare') => {
    // Shuffle the pool using today's date seed — different order every day
    const rawPool = type === 'truth' ? CAMPUS_TRUTHS : CAMPUS_DARES;
    const pool = seededShuffle(rawPool, dailySeed + (type === 'truth' ? 0 : 7919));
    const used = type === 'truth' ? usedTruths : usedDares;
    const setUsed = type === 'truth' ? setUsedTruths : setUsedDares;

    // Filter out indices that were used in this session
    let availableIndices = pool.map((_, i) => i).filter(i => !used.includes(i));
    
    // If we've exhausted today's shuffled pool, reset
    if (availableIndices.length === 0) {
      availableIndices = pool.map((_, i) => i);
      setUsed([]);
    }

    // Pick the first available (deterministic daily order, session-unique)
    const randomIndex = availableIndices[0];
    setUsed(prev => [...prev, randomIndex]);

    let question = pool[randomIndex];

    // NLP-style dynamic variable substitutions using seeded randomness
    const seededRandom = (max: number, offset: number) => {
      const s = ((dailySeed + offset + randomIndex) * 1103515245 + 12345) & 0x7fffffff;
      return s % max;
    };

    if (question.includes('{friendName}')) {
      const friendPool = friends.map(f => f.name).filter(Boolean);
      const randomFriend = friendPool.length > 0 ? friendPool[seededRandom(friendPool.length, 1)] : 'your roommate';
      question = question.replace(/{friendName}/g, randomFriend);
    }
    if (question.includes('{blockName}')) {
      const blocks = ['A', 'B', 'C', 'D', 'LH', 'MH'];
      question = question.replace(/{blockName}/g, blocks[seededRandom(blocks.length, 2)]);
    }
    if (question.includes('{roomNumber}')) {
      question = question.replace(/{roomNumber}/g, (seededRandom(400, 3) + 100).toString());
    }
    if (question.includes('{canteenFood}')) {
      question = question.replace(/{canteenFood}/g, CANTEEN_FOODS[seededRandom(CANTEEN_FOODS.length, 4)]);
    }
    if (question.includes('{subjectName}')) {
      question = question.replace(/{subjectName}/g, SUBJECTS[seededRandom(SUBJECTS.length, 5)]);
    }
    if (question.includes('{professorRole}')) {
      question = question.replace(/{professorRole}/g, PROFESSOR_ROLES[seededRandom(PROFESSOR_ROLES.length, 6)]);
    }
    if (question.includes('{locationName}')) {
      question = question.replace(/{locationName}/g, LOCATIONS[seededRandom(LOCATIONS.length, 7)]);
    }
    if (question.includes('{itemName}')) {
      question = question.replace(/{itemName}/g, ITEMS[seededRandom(ITEMS.length, 8)]);
    }

    return question;
  };

  // Optimistic UI interaction handlers
  const handleAcceptFriend = async (friendshipId: string, nodeItem: any) => {
    if (friends.length >= 10) {
      Alert.alert('Circle Limit Reached', 'You can only have up to 10 close friends in your orbit circle.');
      return;
    }
    setPopoverPending(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic state promote: remove from pending list and add to friends list
    const promotedRequester = nodeItem.requester;
    setPendingRequests(prev => prev.filter(p => p.friendshipId !== friendshipId));
    setFriends(prev => [
      ...prev,
      {
        friendshipId,
        friendId: promotedRequester.id,
        name: promotedRequester.name,
        originalName: promotedRequester.name,
        nickname: null,
        phone: promotedRequester.phone,
        profileImage: promotedRequester.profileImage,
        streakCount: 1, // Starts with a small streak
        lastInteractionAt: new Date().toISOString(),
        theme: 'graphite',
        conversationId: null
      }
    ].slice(0, 10));

    try {
      const res = await apiFetch(ENDPOINTS.friendsAccept, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId })
      });
      if (!res.ok) {
        loadFriendsData(); // Fallback to server state if failed
      }
    } catch (e) {
      loadFriendsData();
    }
  };

  const handleDeclineFriend = async (friendshipId: string) => {
    setPopoverPending(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Optimistic removal
    setPendingRequests(prev => prev.filter(p => p.friendshipId !== friendshipId));
    try {
      await apiFetch(`${API_URL}/api/friends/${friendshipId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('[DECLINE_FRIEND_ERROR]', e);
      loadFriendsData();
    }
  };

  const handleThemeDotPress = async (themeName: string) => {
    if (!activeChat) return;
    setChatTheme(themeName); // Optimistic UI theme update
    
    try {
      const res = await apiFetch(ENDPOINTS.friendsTheme(activeChat.friendshipId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeName })
      });
      if (res.ok) {
        // Sync local object state
        setFriends(prev =>
          prev.map(f => f.friendshipId === activeChat.friendshipId ? { ...f, theme: themeName } : f)
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (stickerText?: string) => {
    const text = stickerText || draftMessage;
    if (!text.trim() || !activeChat) return;

    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      senderId: myUserId,
      senderName: user?.name,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, optimisticMsg]);
    if (!stickerText) setDraftMessage('');
    setShowStickers(false);
    setShowGames(false);
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await apiFetch(ENDPOINTS.friendsSendMessage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeChat.conversationId,
          friendshipId: activeChat.friendshipId,
          text: text.trim()
        })
      });
      if (res.ok) {
        const newMsg = await res.json();
        // If this is the first message and it created a conversation, update conversationId locally
        if (newMsg.conversationId && !activeChat.conversationId) {
          setActiveChat((prev: any) => prev ? { ...prev, conversationId: newMsg.conversationId } : null);
          setFriends(prev => prev.map(f => 
            f.friendshipId === activeChat.friendshipId 
              ? { ...f, conversationId: newMsg.conversationId } 
              : f
          ));
        }
      } else {
        Alert.alert('Send Failed', 'Failed to send secure message.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not send message. Try again.');
    }
  };

  const handleInputChange = (text: string) => {
    setDraftMessage(text);
    if (!activeConversationId) return;

    const socket = connectSocket();
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      socket.emit('friend_typing_start', { conversationId: activeConversationId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingLocal(false);
      socket.emit('friend_typing_end', { conversationId: activeConversationId });
    }, 3000);
  };

  const handleUpdateStatus = async () => {
    if (!statusText.trim() && !statusEmoji.trim()) {
      Alert.alert('Status Required', 'Please set a status text or emoji.');
      return;
    }
    setUpdatingStatus(true);
    try {
      const res = await apiFetch(`${API_URL}/api/friends/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusText: statusText.trim(), statusEmoji: statusEmoji.trim() })
      });
      if (res.ok) {
        const resData = await res.json();
        // Immediately update client-side status cache
        setUser({
          statusText: resData.statusText,
          statusEmoji: resData.statusEmoji
        });
        Alert.alert('Status Set! 🚀', 'Your status has been updated across your orbit!');
        setShowStatusModal(false);
        await refreshUser();
        loadFriendsData();
      } else {
        Alert.alert('Error', 'Failed to update status.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Status update request failed.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleContactsSync = async () => {
    setSyncing(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access contacts is required to scan for friends on Zenvy.');
        setSyncing(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data && data.length > 0) {
        const phoneNumbers: string[] = [];
        data.forEach(contact => {
          if (contact.phoneNumbers) {
            contact.phoneNumbers.forEach(p => {
              if (p.number) {
                // Strip whitespace & formatting before collecting
                const cleanNum = p.number.replace(/\s+/g, '').replace(/[-()]/g, '');
                if (cleanNum) phoneNumbers.push(cleanNum);
              }
            });
          }
        });

        const uniqueNumbers = [...new Set(phoneNumbers.filter(Boolean))];
        
        if (uniqueNumbers.length === 0) {
          Alert.alert('No Contacts Found', 'No contacts with valid phone numbers were detected.');
          setSyncing(false);
          return;
        }

        const res = await apiFetch(ENDPOINTS.friendsContacts, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: uniqueNumbers })
        });
        
        if (res.ok) {
          const matched = await res.json();
          setSyncedContacts(matched);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Alert.alert('Error', 'Failed to scan matching users from contacts.');
        }
      } else {
        Alert.alert('No Contacts', 'No contacts found on this device.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not sync contacts.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSearchUsers = async (queryText: string) => {
    setSearchQuery(queryText);
    if (!queryText.trim()) {
      setSyncedContacts([]);
      return;
    }
    setSyncing(true);
    try {
      const res = await apiFetch(ENDPOINTS.friendsContacts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText })
      });
      if (res.ok) {
        const data = await res.json();
        setSyncedContacts(data);
      }
    } catch (e) {
      console.error('[SEARCH_USERS_ERROR]', e);
    } finally {
      setSyncing(false);
    }
  };

  
  const handleConnectByCode = async (codeOverride?: string) => {
    const rawCode = (codeOverride || friendCodeInput).trim().toUpperCase();
    if (!rawCode) {
      Alert.alert('Orbit Code Required', 'Please enter or scan a valid Orbit Code (e.g. ZNV-8K92F).');
      return;
    }
    setConnectingViaCode(true);
    try {
      const finalIcebreaker = customIcebreaker.trim() || selectedIcebreaker;
      const res = await apiFetch(ENDPOINTS.friendsRequest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendCode: rawCode,
          vibe: selectedVibe,
          icebreaker: finalIcebreaker
        })
      });
      const data = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Orbit Linked! 🚀', `Request sent with "${selectedVibe}" vibe! When accepted, your greeting will be delivered.`);
        setFriendCodeInput('');
        setCustomIcebreaker('');
        setShowSyncModal(false);
        loadFriendsData();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Notice', data.message || 'Failed to send Orbit request.');
      }
    } catch (err: any) {
      Alert.alert('Network Error', err.message || 'Could not connect to Zenvy Orbit.');
    } finally {
      setConnectingViaCode(false);
    }
  };

  const handlePasteAndScan = async () => {
    try {
      const clipText = await Clipboard.getString();
      if (!clipText || !clipText.trim()) {
        Alert.alert('Clipboard Empty', 'Copy a friend’s Orbit Code or QR link (e.g. ZNV-XXXXX) first!');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      let extracted = clipText.trim();
      if (extracted.includes('code=')) {
        const match = extracted.match(/code=([A-Za-z0-9_-]+)/i);
        if (match) extracted = match[1];
      }
      setFriendCodeInput(extracted.toUpperCase());
      setActiveSyncTab('code');
      Alert.alert('Code Detected! 🎯', `Found Orbit Code: "${extracted.toUpperCase()}". Select your connection vibe and click Connect!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSharePass = async () => {
    const myCode = user?.friendCode || 'ZNV-ORBIT';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `⚡ Add me on Zenvy Orbit! My Friend Code is ${myCode}. Scan my QR or enter my code in the app to join my late-night food circle! 🍕🚀`,
        title: 'Join my Zenvy Orbit'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyMyCode = () => {
    const myCode = user?.friendCode || 'ZNV-ORBIT';
    Clipboard.setString(myCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied! 📋', `Your Orbit Code "${myCode}" copied to clipboard. Share it with your campus buddies!`);
  };

  const handleSendGift = async () => {
    if (!activeChat) return;
    setGiftingLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/features/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: activeChat.friendId,
          amount: giftAmount,
          message: `🎁 Snack treat from ${user?.name || 'your buddy'}!`
        })
      });
      const data = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Gift Sent! 🎁', `₹${giftAmount} snack treat sent to ${activeChat.name}!`);
        setShowGiftModal(false);
        handleSendMessage(`🎁 [TREAT GIFT] Sent ₹${giftAmount} snack treat! Enjoy! 🍕✨`);
        refreshUser();
      } else {
        Alert.alert('Gifting Notice', data.message || 'Could not send gift.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gift transaction failed.');
    } finally {
      setGiftingLoading(false);
    }
  };

  const handleAddFriend = async (friendId: string, vibeTag?: string) => {
    if (friends.length >= 10) {
      Alert.alert('Circle Limit Reached', 'Your orbit is full (10 friends max). Remove someone before adding new friends.');
      return;
    }
    try {
      const res = await apiFetch(ENDPOINTS.friendsRequest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: friendId })
      });
      if (res.ok) {
        Alert.alert('Request Sent', 'Friend request sent!');
        setSyncedContacts(prev =>
          prev.map(c => c.id === friendId ? { ...c, friendshipStatus: 'pending' } : c)
        );
        loadFriendsData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getActiveThemeColors = () => {
    const current = CHAT_THEMES.find(t => t.name === chatTheme);
    return current ? current.colors : ['#0E1116', '#171B22', '#0E1116'];
  };

  const getActiveThemeAccent = () => {
    const current = CHAT_THEMES.find(t => t.name === chatTheme);
    return current ? current.accent : '#6E5BFF';
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBarBackground />
      
      {/* REAL-TIME BUDDY NOTIFICATION TOAST BANNER */}
      {activeToast && (
        <TouchableOpacity style={s.toastBannerContainer} onPress={() => setActiveToast(null)}>
          <View style={s.toastBannerGradient}>
            <Text style={s.toastTitleText}>{activeToast.title}</Text>
            <Text style={s.toastBodyText}>{activeToast.text}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Top Header Navigation */}
      <View style={s.topHeader}>
        <TouchableOpacity 
          style={s.backButton} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)' as any);
            }
          }}
        >
          <Text style={s.backText}>← CLOSE CIRCLE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.syncButtonTrigger} onPress={() => setShowSyncModal(true)}>
          <Text style={s.syncButtonText}>➕ SCAN & ADD</Text>
        </TouchableOpacity>
      </View>

      {/* SKIA GROVE TREE — procedural friend tree */}
      <GroveScreen
        friends={groveFriends}
        currentUserId={myUserId}
        onMessage={handleGroveOpenChat}
        onNudge={handleGroveNudge}
        onWater={handleGroveWater}
      />

      {/* Pending requests badge (floating) */}
      {pendingRequests.length > 0 && (
        <TouchableOpacity style={[s.pendingBannerBadge, { position: 'absolute', top: 110, right: 20, zIndex: 100 }]} onPress={() => setShowSyncModal(true)}>
          <Text style={s.pendingBannerBadgeText}>{pendingRequests.length} INCOMING</Text>
        </TouchableOpacity>
      )}


      {/* SLIDE-UP BOTTOM SHEET FOR SECURE CHATS */}
      {activeChat && (
        <Modal visible={!!activeChat} animationType="slide" transparent={true} onRequestClose={handleCloseChat}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={s.modalContainer}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={s.bottomSheetDimmer} />
              </TouchableWithoutFeedback>
              
              <View style={[s.bottomSheetContent, {
                backgroundColor: '#071610',
                borderWidth: 1.5,
                borderColor: getActiveThemeAccent() + '55',
                shadowColor: getActiveThemeAccent(),
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.35,
                shadowRadius: 24,
                position: 'relative',
              }]}>
                {/* Enchanted Grove Canopy Gradient & Ambient Botanical Glow */}
                <LinearGradient
                  colors={getActiveThemeColors() as unknown as readonly [string, string, ...string[]]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.4, y: 1 }}
                />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15, overflow: 'hidden', pointerEvents: 'none' }}>
                   <View style={{ position: 'absolute', top: -50, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: getActiveThemeAccent(), opacity: 0.25 }} />
                   <View style={{ position: 'absolute', top: 120, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: '#34D399', opacity: 0.15 }} />
                   <View style={{ position: 'absolute', bottom: 100, right: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: '#F59E0B', opacity: 0.1 }} />
                </View>

                {/* Top Grab Handle - Organic Botanical Leaf Pill */}
                <View style={{ alignItems: 'center', marginBottom: 8, marginTop: 2 }}>
                  <View style={[s.bottomSheetGrabHandle, { backgroundColor: getActiveThemeAccent(), width: 44, height: 5, borderRadius: 3, shadowColor: getActiveThemeAccent(), shadowOpacity: 0.8, shadowRadius: 6 }]} />
                </View>

                {/* Header Row: Navigation & Actions */}
                <View style={[s.chatHeaderRow, { borderBottomColor: 'rgba(52, 211, 153, 0.12)', paddingBottom: 10 }]}>
                  <TouchableOpacity style={[s.chatCloseBtn, { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]} onPress={handleCloseChat}>
                    <Ionicons name="close" size={16} color="#A7F3D0" />
                    <Text style={[s.chatCloseText, { color: '#A7F3D0' }]}>CLOSE</Text>
                  </TouchableOpacity>

                  <View style={[s.chatHeaderActions, { gap: 10, alignItems: 'center' }]}>
                    {/* Lock Chat Toggle */}
                    <TouchableOpacity 
                      style={{ padding: 7, borderRadius: 14, backgroundColor: lockedChats.includes(activeChat.friendId) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: lockedChats.includes(activeChat.friendId) ? '#EF4444' : 'rgba(255,255,255,0.12)' }} 
                      onPress={() => toggleChatLock(activeChat.friendId)}
                    >
                      <Ionicons name={lockedChats.includes(activeChat.friendId) ? "lock-closed" : "lock-open-outline"} size={16} color={lockedChats.includes(activeChat.friendId) ? "#EF4444" : "#A7F3D0"} />
                    </TouchableOpacity>
                    
                    {/* Botanical Nudge / Nourish */}
                    <TouchableOpacity style={[s.nudgeActionBtn, { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16, 185, 129, 0.16)', borderWidth: 1, borderColor: '#10B981', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 }]} onPress={handleSendNudge}>
                      <Text style={{ fontSize: 13 }}>🌿</Text>
                      <Text style={[s.nudgeActionText, { color: '#34D399', fontWeight: '900' }]}>NUDGE</Text>
                    </TouchableOpacity>

                    {/* Trash */}
                    <TouchableOpacity style={{ padding: 6 }} onPress={handleRemoveFriend}>
                      <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.45)" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Friend Display Profile Section */}
                <View style={[s.friendProfileSection, { borderBottomColor: 'rgba(52, 211, 153, 0.12)', backgroundColor: 'rgba(0, 0, 0, 0.18)', paddingVertical: 12 }]}>
                  {isEditingNickname ? (
                    <View style={s.nameEditRowInline}>
                      <TextInput
                        style={[s.nicknameInputField, { borderColor: getActiveThemeAccent(), borderWidth: 1 }]}
                        value={nicknameInput}
                        onChangeText={setNicknameInput}
                        placeholder="Set nickname..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        autoFocus
                      />
                      <TouchableOpacity style={[s.nicknameSaveBtn, { backgroundColor: getActiveThemeAccent() }]} onPress={handleSaveNickname}>
                        <Text style={s.nicknameSaveBtnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.nicknameCancelBtn} onPress={() => setIsEditingNickname(false)}>
                        <Text style={s.nicknameCancelBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={s.friendNameInfo}>
                      <TouchableOpacity
                        style={s.nameEditRow}
                        onPress={() => {
                          setNicknameInput(activeChat.nickname || '');
                          setIsEditingNickname(true);
                        }}
                      >
                        <Text style={{ fontSize: 16, marginRight: 6 }}>🍃</Text>
                        <Text style={[s.chatHeaderTitle, { letterSpacing: 0.4 }]} numberOfLines={1}>{activeChat?.name}</Text>
                        <Text style={{ fontSize: 10, marginLeft: 6 }}>✏️</Text>
                      </TouchableOpacity>
                      <Text style={[s.chatHeaderSubtitle, { color: '#6EE7B7' }]}>
                        {activeChat?.nickname ? `🌱 REAL: ${activeChat?.originalName || activeChat?.name}` : '🌿 GROVE BRANCH COMPANION'}
                      </Text>
                    </View>
                  )}

                  {/* Active Tree Theme selector dots */}
                  <View style={s.themeDotsRow}>
                    {CHAT_THEMES.map(themeItem => (
                      <TouchableOpacity
                        key={themeItem.name}
                        style={[
                          s.themeDot,
                          { backgroundColor: themeItem.accent },
                          chatTheme === themeItem.name && [s.activeThemeDot, { borderColor: '#A7F3D0', shadowColor: themeItem.accent, shadowOpacity: 0.8, shadowRadius: 4 }]
                        ]}
                        onPress={() => handleThemeDotPress(themeItem.name)}
                      />
                    ))}
                  </View>
                </View>

              {/* Botanical Branch Streak Banner */}
              <View style={[s.streakBanner, { borderBottomColor: 'rgba(52, 211, 153, 0.12)', backgroundColor: 'rgba(6, 78, 59, 0.25)', paddingVertical: 10 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>🌳</Text>
                  <Text style={[s.streakBannerText, { color: '#FBBF24' }]}>
                    BRANCH STRENGTH: <Text style={s.monoText}>🔥{activeChat?.streakCount || 0}d roots</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.2)' }}>
                  <Text style={{ fontSize: 10 }}>🍃</Text>
                  <Text style={[s.streakBannerSub, { color: '#34D399', fontSize: 10.5 }]}>Whispering Leaves</Text>
                </View>
              </View>

              {/* Message scroll views */}
              <ScrollView
                ref={chatScrollRef}
                style={s.messagesScrollView}
                contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {chatMessages.length === 0 ? (
                  <View style={s.messagesEmptyContainer}>
                    <Text style={s.emptySymbol}>🌱</Text>
                    <Text style={[s.emptyInstruction, { color: '#A7F3D0' }]}>Branch is quiet. Send a leaf whisper.</Text>
                  </View>
                ) : (
                  chatMessages.map((msg, index) => {
                    const isMe = msg.senderId === myUserId;
                    const isSticker = ZENVY_STICKERS.includes(msg.text);
                    const isTruth = msg.text.startsWith('[TRUTH]');
                    const isDare = msg.text.startsWith('[DARE]');
                    const isSpin = msg.text.startsWith('[SPIN]');
                    const isVibe = msg.text.startsWith('[VIBE]');
                    const isWhisper = msg.text.startsWith('[WHISPER]');

                    return (
                      <View key={msg.id || index} style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
                        {!isMe && (
                          <View style={s.msgAvatarCircle}>
                            <Text style={s.msgAvatarInitials}>
                              {msg.senderName?.charAt(0).toUpperCase() || activeChat?.name?.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {isSticker ? (
                          <View style={s.stickerMessageContainer}>
                            <Text style={s.stickerMessageChar}>{msg.text}</Text>
                          </View>
                        ) : isTruth ? (
                          <LinearGradient colors={['#8E2DE2', '#4A00E0']} style={[s.gameCard, { borderBottomRightRadius: isMe ? 2 : 16, borderBottomLeftRadius: isMe ? 16 : 2, borderWidth: 1, borderColor: '#00F2FE' }]}>
                            <Text style={s.gameCardTag}>💡 CAMPUS TRUTH</Text>
                            <Text style={s.gameCardQuestion}>"{msg.text.replace('[TRUTH]', '').trim()}"</Text>
                          </LinearGradient>
                        ) : isDare ? (
                          <LinearGradient colors={['#DD2476', '#FF512F']} style={[s.gameCard, { borderBottomRightRadius: isMe ? 2 : 16, borderBottomLeftRadius: isMe ? 16 : 2, borderWidth: 1, borderColor: '#FF1493' }]}>
                            <Text style={s.gameCardTag}>😈 CAMPUS DARE</Text>
                            <Text style={s.gameCardQuestion}>"{msg.text.replace('[DARE]', '').trim()}"</Text>
                          </LinearGradient>
                        ) : isSpin ? (
                          <LinearGradient colors={['#11998e', '#38ef7d']} style={[s.gameCard, { borderBottomRightRadius: isMe ? 2 : 16, borderBottomLeftRadius: isMe ? 16 : 2, borderWidth: 1, borderColor: '#00FF00' }]}>
                            <Text style={s.gameCardTag}>🍾 SPIN THE BOTTLE</Text>
                            <Text style={s.gameCardQuestion}>{msg.text.replace('[SPIN]', '').trim()}</Text>
                          </LinearGradient>
                        ) : isVibe ? (
                          <LinearGradient colors={['#00B4DB', '#0083B0']} style={[s.gameCard, { borderBottomRightRadius: isMe ? 2 : 16, borderBottomLeftRadius: isMe ? 16 : 2, borderWidth: 1, borderColor: '#00F2FE' }]}>
                            <Text style={s.gameCardTag}>🎯 VIBE CHECK</Text>
                            <Text style={s.gameCardQuestion}>{msg.text.replace('[VIBE]', '').trim()}</Text>
                          </LinearGradient>
                        ) : (
                          <LinearGradient
                            colors={isMe ? [getActiveThemeAccent(), getActiveThemeAccent() + '99'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                            style={[
                              s.msgBubble,
                              isMe ? s.msgBubbleMe : s.msgBubbleThem,
                              { borderWidth: 1, borderColor: isMe ? getActiveThemeAccent() : 'rgba(255,255,255,0.1)' }
                            ]}
                          >
                            <Text style={[s.msgBodyText, isMe ? s.msgBodyTextMe : s.msgBodyTextThem, isWhisper && { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2, opacity: 0.8 }]}>
                              {isWhisper ? msg.text.replace('[WHISPER]', '⚠️ ENCRYPTED:\n') : msg.text}
                            </Text>
                          </LinearGradient>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Expressive sticker drawer */}
              {showStickers && (
                <View style={s.stickerSelectionPanel}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stickerHorizontalScroll}>
                    {ZENVY_STICKERS.map(emoji => (
                      <TouchableOpacity
                        key={emoji}
                        style={s.stickerBubbleBtn}
                        onPress={() => handleSendMessage(emoji)}
                      >
                        <Text style={{ fontSize: 26 }}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Sci-Fi Mini-Game Holo-Deck */}
              {showGames && (
                <View style={[s.stickerSelectionPanel, { backgroundColor: 'rgba(0,0,0,0.8)', borderTopWidth: 1, borderTopColor: '#00F2FE' }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stickerHorizontalScroll}>
                    <TouchableOpacity
                      style={[s.stickerBubbleBtn, { width: 110, backgroundColor: 'rgba(142, 45, 226, 0.3)', borderWidth: 1, borderColor: '#8E2DE2', flexDirection: 'row', gap: 6, paddingHorizontal: 12, height: 44, borderRadius: 22 }]}
                      onPress={() => {
                        const uniqueTruth = getUniqueQuestion('truth');
                        handleSendMessage(`[TRUTH] ${uniqueTruth}`);
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>💡</Text>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>TRUTH</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.stickerBubbleBtn, { width: 110, backgroundColor: 'rgba(221, 36, 118, 0.3)', borderWidth: 1, borderColor: '#DD2476', flexDirection: 'row', gap: 6, paddingHorizontal: 12, height: 44, borderRadius: 22 }]}
                      onPress={() => {
                        const uniqueDare = getUniqueQuestion('dare');
                        handleSendMessage(`[DARE] ${uniqueDare}`);
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>😈</Text>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>DARE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.stickerBubbleBtn, { width: 140, backgroundColor: 'rgba(17, 153, 142, 0.3)', borderWidth: 1, borderColor: '#11998e', flexDirection: 'row', gap: 6, paddingHorizontal: 12, height: 44, borderRadius: 22 }]}
                      onPress={() => {
                        const outcomes = [
                          "You have to pay for the next Canteen trip! 💸",
                          "You must wear your shirt backwards for an hour. 👕",
                          "You owe me a plate of Midnight Maggi! 🍜",
                          "You have to proxy my attendance tomorrow. 📝"
                        ];
                        const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
                        handleSendMessage(`[SPIN] The bottle landed on YOU!\nOutcome: ${randomOutcome}`);
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>🍾</Text>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>SPIN BOTTLE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.stickerBubbleBtn, { width: 130, backgroundColor: 'rgba(0, 180, 219, 0.3)', borderWidth: 1, borderColor: '#00B4DB', flexDirection: 'row', gap: 6, paddingHorizontal: 12, height: 44, borderRadius: 22 }]}
                      onPress={() => {
                        const matchPct = Math.floor(Math.random() * 50) + 50;
                        handleSendMessage(`[VIBE] Vibe Match: ${matchPct}%\nWe both crave midnight snacks! 🍕`);
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>🎯</Text>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>VIBE CHECK</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.stickerBubbleBtn, { width: 120, backgroundColor: 'rgba(255, 0, 0, 0.3)', borderWidth: 1, borderColor: '#FF0000', flexDirection: 'row', gap: 6, paddingHorizontal: 12, height: 44, borderRadius: 22 }]}
                      onPress={() => {
                        handleSendMessage(`[WHISPER] What happens in hostel stays in hostel...`);
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>🤫</Text>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>WHISPER</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              {/* Quick reactions & typing status overlay */}
              <View style={[s.chatInputTopAccessory, { borderTopColor: 'rgba(52, 211, 153, 0.1)' }]}>
                {isFriendTyping ? (
                  <View style={s.typingIndicatorWrap}>
                    <Text style={[s.typingIndicatorText, { color: '#6EE7B7' }]}>🌱 {activeChat?.nickname || activeChat?.name} is typing a whisper...</Text>
                  </View>
                ) : (
                  <View style={s.quickReactionsRow}>
                    {['🍃', '🌿', '❤️', '🔥', '😂', '✨', '👍'].map((emoji) => (
                      <TouchableOpacity key={emoji} onPress={() => handleSendMessage(emoji)} style={[s.quickReactionBtn, { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 5, marginHorizontal: 2 }]}>
                        <Text style={s.quickReactionEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Chat Input controls */}
              <View style={[s.chatInputContainer, { borderTopColor: 'rgba(52, 211, 153, 0.15)', backgroundColor: 'rgba(4, 18, 12, 0.75)' }]}>
                <TouchableOpacity
                  style={[s.stickerTriggerButton, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(52, 211, 153, 0.25)', borderWidth: 1 }, showStickers && s.stickerTriggerButtonActive]}
                  onPress={() => {
                    setShowStickers(!showStickers);
                    setShowGames(false);
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🍃</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.stickerTriggerButton, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)', borderWidth: 1 }]}
                  onPress={() => {
                    setShowGiftModal(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🎁</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.stickerTriggerButton, { backgroundColor: 'rgba(129, 140, 248, 0.12)', borderColor: 'rgba(129, 140, 248, 0.25)', borderWidth: 1 }, showGames && s.stickerTriggerButtonActive]}
                  onPress={() => {
                    setShowGames(!showGames);
                    setShowStickers(false);
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🎲</Text>
                </TouchableOpacity>

                <TextInput
                  style={[s.chatTextInputField, { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.25)', borderRadius: 16 }]}
                  placeholder="Whisper to branch..."
                  placeholderTextColor="rgba(167, 243, 208, 0.45)"
                  value={draftMessage}
                  onChangeText={handleInputChange}
                  onSubmitEditing={() => handleSendMessage()}
                />

                <TouchableOpacity
                  disabled={sendingMessage || !draftMessage.trim()}
                  style={[
                    s.sendMessageBtn,
                    {
                      backgroundColor: draftMessage.trim() ? getActiveThemeAccent() : 'rgba(255,255,255,0.08)',
                      borderRadius: 16,
                      shadowColor: getActiveThemeAccent(),
                      shadowOpacity: draftMessage.trim() ? 0.7 : 0,
                      shadowRadius: 10
                    }
                  ]}
                  onPress={() => handleSendMessage()}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={[s.sendMessageBtnText, { color: draftMessage.trim() ? '#04160e' : 'rgba(255,255,255,0.3)', fontWeight: '900' }]}>SEND</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      )}

      
      {/* SYNC CONTACTS, QR SCANNER AND ORBIT PASS MODAL */}
      <Modal visible={showSyncModal} animationType="slide" transparent={false} onRequestClose={() => setShowSyncModal(false)}>
        <SafeAreaView style={[s.syncModalContainer, { backgroundColor: GRAPHITE_BG }]}>
          {/* Header */}
          <View style={s.syncModalHeader}>
            <View>
              <Text style={s.syncModalTitle}>ORBIT RADAR & FRIENDS</Text>
              <Text style={{ color: '#8A94A6', fontSize: 11, fontWeight: '700', marginTop: 2 }}>QR Scan • Personal Pass • Variable Vibes</Text>
            </View>
            <TouchableOpacity style={s.syncModalCloseBtn} onPress={() => { setShowSyncModal(false); setSearchQuery(''); setSyncedContacts([]); }}>
              <Text style={s.syncModalCloseText}>✕ CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* 3-Way Segmented Tabs */}
          <View style={s.tabSegmentContainer}>
            <TouchableOpacity
              style={[s.tabSegmentBtn, activeSyncTab === 'scanner' && s.tabSegmentBtnActive]}
              onPress={() => { setActiveSyncTab('scanner'); Haptics.selectionAsync(); }}
            >
              <Text style={[s.tabSegmentText, activeSyncTab === 'scanner' && s.tabSegmentTextActive]}>⚡ SCAN QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabSegmentBtn, activeSyncTab === 'my_qr' && s.tabSegmentBtnActive]}
              onPress={() => { setActiveSyncTab('my_qr'); Haptics.selectionAsync(); }}
            >
              <Text style={[s.tabSegmentText, activeSyncTab === 'my_qr' && s.tabSegmentTextActive]}>🪪 MY QR PASS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabSegmentBtn, activeSyncTab === 'code' && s.tabSegmentBtnActive]}
              onPress={() => { setActiveSyncTab('code'); Haptics.selectionAsync(); }}
            >
              <Text style={[s.tabSegmentText, activeSyncTab === 'code' && s.tabSegmentTextActive]}>🎯 CODE & VIBES</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ padding: 16, paddingBottom: 240 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* TAB 0: SCANNER */}
            {activeSyncTab === 'scanner' && (
              <View style={s.scannerViewContainer}>
                {/* Viewfinder frame */}
                <View style={s.viewfinderFrame}>
                  {/* Glowing Corner Brackets */}
                  <View style={[s.cornerBracket, s.cornerTL]} />
                  <View style={[s.cornerBracket, s.cornerTR]} />
                  <View style={[s.cornerBracket, s.cornerBL]} />
                  <View style={[s.cornerBracket, s.cornerBR]} />

                  {/* Animated Laser Beam */}
                  <Animated.View
                    style={[
                      s.laserBeam,
                      {
                        transform: [
                          {
                            translateY: laserAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [10, 210],
                            }),
                          },
                        ],
                      },
                    ]}
                  />

                  {/* Center Target Reticle */}
                  <View style={s.reticleCenter}>
                    <Text style={{ fontSize: 32, opacity: 0.8 }}>⚡</Text>
                    <Text style={s.reticleText}>ALIGN QR INSIDE FRAME</Text>
                  </View>
                </View>

                {/* Scanner Controls Row */}
                <View style={s.scannerControlsRow}>
                  <TouchableOpacity
                    style={[s.scannerToolBtn, torchActive && { borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}
                    onPress={() => { setTorchActive(!torchActive); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <Text style={{ fontSize: 18 }}>{torchActive ? '🔦 ON' : '💡 TORCH'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.scannerToolBtn, { backgroundColor: 'rgba(110, 91, 255, 0.15)', borderColor: '#6E5BFF' }]}
                    onPress={handlePasteAndScan}
                  >
                    <Text style={{ color: '#6E5BFF', fontWeight: '900', fontSize: 12 }}>📋 PASTE QR / CODE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* TAB 1: MY QR PASS */}
            {activeSyncTab === 'my_qr' && (
              <View style={s.myQrContainer}>
                {/* Holographic Student Pass Card */}
                <LinearGradient
                  colors={['#1F2430', '#13161C', '#1B1528']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.hologramCard}
                >
                  <View style={s.hologramCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Image
                        source={{ uri: getAvatarUrl(user?.profileImage || null, myUserId || 'self') }}
                        style={s.hologramAvatar}
                      />
                      <View>
                        <Text style={s.hologramName}>{user?.name || 'Zenvy Student'}</Text>
                        <Text style={s.hologramSubtitle}>{user?.hostelBlock ? `Block ${user.hostelBlock}` : 'Campus Member'} • {user?.roomNumber ? `Rm ${user.roomNumber}` : 'Amaravathi'}</Text>
                      </View>
                    </View>
                    <View style={s.hologramBadge}>
                      <Text style={s.hologramBadgeText}>OFFICIAL PASS</Text>
                    </View>
                  </View>

                  {/* QR Code Container */}
                  <View style={s.qrWrapper}>
                    <View style={s.qrInnerBorder}>
                      <QRCode
                        value={`zenvy://orbit?code=${user?.friendCode || 'ZNV-ORBIT'}&id=${myUserId || 'u1'}`}
                        size={170}
                        color="#000000"
                        backgroundColor="#FFFFFF"
                      />
                    </View>
                  </View>

                  {/* Friend Code Display */}
                  <View style={s.codeDisplayBox}>
                    <Text style={s.codeDisplayLabel}>YOUR PERSONAL ORBIT CODE</Text>
                    <Text style={s.codeDisplayText}>{user?.friendCode || 'ZNV-ORBIT'}</Text>
                  </View>

                  {/* Action Buttons Row */}
                  <View style={s.hologramActionsRow}>
                    <TouchableOpacity style={s.hologramActionBtn} onPress={handleCopyMyCode}>
                      <Text style={s.hologramActionBtnText}>📋 COPY CODE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.hologramActionBtn, { backgroundColor: VIOLET_ACCENT }]} onPress={handleSharePass}>
                      <Text style={[s.hologramActionBtnText, { color: '#FFF' }]}>📤 SHARE PASS</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* TAB 2: ENTER CODE & VARIABLE VIBES */}
            {activeSyncTab === 'code' && (
              <View>
                {/* Code Input Box */}
                <View style={s.codeInputBox}>
                  <Text style={s.sectionHeaderTitle}>ENTER 6-DIGIT ORBIT CODE</Text>
                  <View style={s.codeFieldWrapper}>
                    <TextInput
                      style={s.codeTextInput}
                      placeholder="e.g. ZNV-8K92F"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoCapitalize="characters"
                      value={friendCodeInput}
                      onChangeText={setFriendCodeInput}
                    />
                    <TouchableOpacity style={s.codePasteBtn} onPress={handlePasteAndScan}>
                      <Text style={s.codePasteBtnText}>PASTE</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Variable Connection Options: VIBE ARCHETYPES */}
                <View style={{ marginTop: 20 }}>
                  <Text style={s.sectionHeaderTitle}>CHOOSE CONNECTION VIBE</Text>
                  <Text style={{ color: '#8A94A6', fontSize: 11, marginBottom: 10 }}>Select your relationship type for tailored perks & notifications:</Text>
                  <View style={s.vibeChipsContainer}>
                    {VIBE_OPTIONS.map(v => {
                      const isSelected = selectedVibe === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[s.vibeChip, isSelected && { borderColor: v.color, backgroundColor: 'rgba(255,255,255,0.08)' }]}
                          onPress={() => { setSelectedVibe(v.id); Haptics.selectionAsync(); }}
                        >
                          <Text style={{ fontSize: 16 }}>{v.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.vibeChipLabel, isSelected && { color: v.color, fontWeight: '900' }]}>{v.label}</Text>
                            <Text style={s.vibeChipDesc} numberOfLines={1}>{v.desc}</Text>
                          </View>
                          {isSelected && <Text style={{ color: v.color, fontWeight: '900' }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Variable Icebreaker Prompts */}
                <View style={{ marginTop: 20 }}>
                  <Text style={s.sectionHeaderTitle}>SELECT INITIAL ICEBREAKER GREETING</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
                    {ICEBREAKER_PROMPTS.map(prompt => {
                      const isSelected = selectedIcebreaker === prompt && !customIcebreaker;
                      return (
                        <TouchableOpacity
                          key={prompt}
                          style={[s.icebreakerChip, isSelected && s.icebreakerChipActive]}
                          onPress={() => {
                            setSelectedIcebreaker(prompt);
                            setCustomIcebreaker('');
                            Haptics.selectionAsync();
                          }}
                        >
                          <Text style={[s.icebreakerChipText, isSelected && { color: '#FFF', fontWeight: '800' }]}>{prompt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Custom Note input */}
                  <TextInput
                    style={s.customIcebreakerInput}
                    placeholder="Or type a custom greeting note..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={customIcebreaker}
                    onChangeText={setCustomIcebreaker}
                  />
                </View>

                {/* Connect Action Button */}
                <TouchableOpacity
                  style={[s.connectActionButton, connectingViaCode && { opacity: 0.6 }]}
                  disabled={connectingViaCode}
                  onPress={() => handleConnectByCode()}
                >
                  {connectingViaCode ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <LinearGradient
                      colors={['#6E5BFF', '#8E2DE2', '#FF7A59']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.connectActionGradient}
                    >
                      <Text style={s.connectActionText}>🚀 LINK ORBIT NOW</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>

                {/* Interactive Search Bar Divider */}
                <View style={{ marginTop: 30, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 20 }}>
                  <Text style={s.sectionHeaderTitle}>OR SEARCH BY NAME / PHONE</Text>
                  <View style={s.searchBarContainer}>
                    <TextInput
                      style={s.searchBarInput}
                      placeholder="Search registered students..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={searchQuery}
                      onChangeText={handleSearchUsers}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => handleSearchUsers('')} style={s.searchClearBtn}>
                        <Text style={s.searchClearText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Contact Sync fallback */}
                  {searchQuery.trim().length === 0 && (
                    <TouchableOpacity
                      disabled={syncing}
                      style={[s.primarySyncBtn, { backgroundColor: 'rgba(110, 91, 255, 0.15)', borderWidth: 1, borderColor: '#6E5BFF', marginTop: 10 }]}
                      onPress={handleContactsSync}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={[s.primarySyncBtnText, { color: '#6E5BFF' }]}>🔄 SCAN MATCHING CONTACTS</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* INCOMING REQUESTS PANEL (Shown across tabs if any) */}
            {pendingRequests.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={s.syncedContactsTitle}>INCOMING ORBIT REQUESTS ({pendingRequests.length})</Text>
                {pendingRequests.map(r => {
                  const reqNode = { requester: r.requester };
                  return (
                    <View key={r.friendshipId} style={s.contactItemRow}>
                      <View style={[s.contactAvatarCircle, { backgroundColor: 'rgba(110, 91, 255, 0.15)' }]}>
                        <Text style={[s.contactAvatarInitials, { color: VIOLET_ACCENT }]}>
                          {(r.requester?.name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.contactItemName}>{r.requester?.name || 'Buddy'}</Text>
                          {r.vibe && (
                            <View style={s.vibeBadgeSmall}>
                              <Text style={s.vibeBadgeSmallText}>{r.vibe}</Text>
                            </View>
                          )}
                        </View>
                        {r.icebreaker ? (
                          <Text style={{ color: '#FF7A59', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>"{r.icebreaker}"</Text>
                        ) : (
                          <Text style={s.contactItemPhone}>{r.requester?.friendCode || r.requester?.phone || ''}</Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={[s.contactAddBtn, { borderColor: '#4CAF50' }]}
                          onPress={() => handleAcceptFriend(r.friendshipId, reqNode)}
                        >
                          <Text style={[s.contactAddBtnText, { color: '#4CAF50' }]}>ACCEPT</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.contactAddBtn, { borderColor: '#FF5252' }]}
                          onPress={() => handleDeclineFriend(r.friendshipId)}
                        >
                          <Text style={[s.contactAddBtnText, { color: '#FF5252' }]}>DECLINE</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* SEARCH RESULTS LIST */}
            {syncedContacts.length > 0 && activeSyncTab === 'code' && (
              <View style={{ marginTop: 20 }}>
                <Text style={s.syncedContactsTitle}>
                  {searchQuery.trim().length > 0 ? 'SEARCH RESULTS' : 'SYNCED USERS FOUND'}
                </Text>
                {syncedContacts.map(c => (
                  <View key={c.id} style={s.contactItemRow}>
                    <View style={s.contactAvatarCircle}>
                      <Text style={s.contactAvatarInitials}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.contactItemName}>{c.name}</Text>
                      <Text style={s.contactItemPhone}>{c.friendCode || c.phone}</Text>
                    </View>
                    {c.friendshipStatus === 'none' && (
                      <TouchableOpacity style={s.contactAddBtn} onPress={() => handleAddFriend(c.id)}>
                        <Text style={s.contactAddBtnText}>+ ADD</Text>
                      </TouchableOpacity>
                    )}
                    {c.friendshipStatus === 'pending' && (
                      <Text style={s.contactPendingLabel}>PENDING</Text>
                    )}
                    {c.friendshipStatus === 'accepted' && (
                      <Text style={s.contactFriendLabel}>FRIEND</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* INSTANT SNACK GIFTING MODAL */}
      <Modal visible={showGiftModal} transparent animationType="fade" onRequestClose={() => setShowGiftModal(false)}>
        <View style={s.giftModalOverlay}>
          <View style={s.giftModalBox}>
            <Text style={s.giftModalTitle}>🎁 SEND SNACK TREAT</Text>
            <Text style={s.giftModalSub}>Treat {activeChat?.name || 'your buddy'} with wallet credits for snacks!</Text>

            <View style={s.giftAmountRow}>
              {[10, 20, 50, 100].map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={[s.giftAmtBtn, giftAmount === amt && s.giftAmtBtnActive]}
                  onPress={() => { setGiftAmount(amt); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.giftAmtText, giftAmount === amt && s.giftAmtTextActive]}>₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={s.confirmGiftBtn}
              disabled={giftingLoading}
              onPress={handleSendGift}
            >
              {giftingLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={s.confirmGiftBtnText}>SEND ₹{giftAmount} TREAT 🚀</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setShowGiftModal(false)}>
              <Text style={{ color: '#8A94A6', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* Innovative Full-Screen Status Creator */}
      <Modal visible={showStatusModal} animationType="slide" transparent={false} onRequestClose={() => setShowStatusModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <LinearGradient
            colors={STATUS_GRADIENTS[statusBgIndex]}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Top Navigation */}
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: Platform.OS === 'ios' ? 10 : 40 }}>
                <TouchableOpacity onPress={() => setShowStatusModal(false)} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 }}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>✕ Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setStatusBgIndex((prev) => (prev + 1) % STATUS_GRADIENTS.length)} 
                  style={{ padding: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>🎨 Theme</Text>
                </TouchableOpacity>
              </View>

              {/* Central Text Input */}
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
                  <TextInput
                    style={{
                      fontSize: statusText.length > 30 ? 28 : 42,
                      color: '#FFF',
                      fontWeight: '800',
                      textAlign: 'center',
                      width: '100%',
                      textShadowColor: 'rgba(0,0,0,0.2)',
                      textShadowOffset: { width: 0, height: 2 },
                      textShadowRadius: 10,
                    }}
                    multiline
                    maxLength={100}
                    value={statusText}
                    onChangeText={setStatusText}
                    placeholder="Type a status..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    autoFocus
                  />
                  
                  {/* Optional Emoji Badge */}
                  <View style={{ marginTop: 40, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 12, fontWeight: '600' }}>Vibe (Emoji)</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {['🔥', '✨', '💀', '🍔', '😴', '🎮'].map(emoji => (
                        <TouchableOpacity 
                          key={emoji} 
                          onPress={() => setStatusEmoji(emoji)}
                          style={{
                            padding: 10,
                            backgroundColor: statusEmoji === emoji ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)',
                            borderRadius: 20,
                            borderWidth: 2,
                            borderColor: statusEmoji === emoji ? '#FFF' : 'transparent'
                          }}
                        >
                          <Text style={{ fontSize: 24 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>

              {/* Bottom Post Button */}
              <View style={{ padding: 24, paddingBottom: 40 }}>
                <TouchableOpacity 
                  style={{
                    backgroundColor: '#FFF',
                    paddingVertical: 18,
                    borderRadius: 30,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                  }} 
                  onPress={handleUpdateStatus} 
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={{ color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1 }}>
                      🚀 POST STATUS
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>

      {/* Immersive Instagram-style Status Viewer Modal */}
      <Modal visible={activeStatusView !== null} animationType="fade" transparent={false} onRequestClose={() => setActiveStatusView(null)}>
        {activeStatusView && (() => {
          // Select gradient index based on user ID or deterministic logic
          const indexSeed = activeStatusView.friendId || (activeStatusView.isSelf ? 'self' : 'seed');
          let hash = 0;
          for (let i = 0; i < indexSeed.length; i++) {
            hash = indexSeed.charCodeAt(i) + ((hash << 5) - hash);
          }
          const bgIndex = Math.abs(hash) % STATUS_GRADIENTS.length;
          
          return (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <LinearGradient
                colors={STATUS_GRADIENTS[bgIndex]}
                style={{ flex: 1 }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <SafeAreaView style={{ flex: 1 }}>
                  {/* Progress Indicator */}
                  <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 16, marginTop: Platform.OS === 'ios' ? 10 : 30, borderRadius: 2, overflow: 'hidden' }}>
                    <Animated.View style={{ height: '100%', backgroundColor: '#FFF', width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
                  </View>

                  {/* Header Row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Image
                        source={{ uri: getAvatarUrl(activeStatusView.profileImage, activeStatusView.friendId || 'self') }}
                        style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFF' }}
                      />
                      <View>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>{activeStatusView.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>CAMPUS STATUS</Text>
                      </View>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {activeStatusView.isSelf && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              setActiveStatusView(null);
                              setStatusText(user?.statusText || '');
                              setStatusEmoji(user?.statusEmoji || '');
                              setShowStatusModal(true);
                            }}
                            style={{ padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 16, marginRight: 6 }}
                          >
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>✏️ Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              setActiveStatusView(null);
                              try {
                                const res = await apiFetch(`${API_URL}/api/friends/status`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ statusText: '', statusEmoji: '' })
                                });
                                if (res.ok) {
                                  // Immediately clear client-side status cache
                                  setUser({
                                    statusText: null,
                                    statusEmoji: null
                                  });
                                  await refreshUser();
                                  loadFriendsData();
                                  Alert.alert('Status Deleted', 'Your status has been cleared.');
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            style={{ padding: 8, backgroundColor: 'rgba(255, 0, 0, 0.25)', borderRadius: 16 }}
                          >
                            <Text style={{ color: '#FF7B7B', fontSize: 11, fontWeight: '700' }}>🗑️ Delete</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity onPress={() => setActiveStatusView(null)} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 }}>
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>✕ Close</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Center Content: Status Text & Emoji */}
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
                    {activeStatusView.statusEmoji ? (
                      <Text style={{ fontSize: 72, marginBottom: 20 }}>{activeStatusView.statusEmoji}</Text>
                    ) : null}
                    <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 36, letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 6 }}>
                      {activeStatusView.statusText || 'No status update.'}
                    </Text>
                  </View>

                  {/* Footer message indicator or Seen By list */}
                  {!activeStatusView.isSelf ? (
                    <TouchableOpacity
                      onPress={() => {
                        setActiveStatusView(null);
                        setActiveChat(activeStatusView);
                      }}
                      style={{ padding: 16, backgroundColor: 'rgba(255,255,255,0.12)', margin: 20, borderRadius: 20, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>💬 Send Encrypted Message</Text>
                    </TouchableOpacity>
                  ) : (() => {
                    const seenBy = user?.statusSeenBy || [];
                    const seenNames = seenBy
                      .map(id => friends.find(f => f.friendId === id)?.name)
                      .filter(Boolean);
                    if (seenNames.length === 0) {
                      return (
                        <View style={{ padding: 16, backgroundColor: 'rgba(255,255,255,0.08)', margin: 20, borderRadius: 20, alignItems: 'center' }}>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 }}>👁️ No views yet</Text>
                        </View>
                      );
                    }
                    return (
                      <View style={{ padding: 16, backgroundColor: 'rgba(255,255,255,0.12)', margin: 20, borderRadius: 20 }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>👁️ SEEN BY ({seenNames.length})</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 }}>
                          {seenNames.join(', ')}
                        </Text>
                      </View>
                    );
                  })()}
                </SafeAreaView>
              </LinearGradient>
            </View>
          );
        })()}
      </Modal>
    </SafeAreaView>
  );
}

// Custom StatusBarBackground to handle spacing on Android/iOS
function StatusBarBackground() {
  if (Platform.OS === 'web') return null;
  return (
    <View style={{ height: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24), backgroundColor: GRAPHITE_BG }} />
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GRAPHITE_BG
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 8 : (Platform.OS === 'ios' ? 8 : 16),
    paddingBottom: 6,
    backgroundColor: '#04050d',
  },
  backButton: {
    paddingVertical: 6,
  },
  backText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  syncButtonTrigger: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(110, 91, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(110, 91, 255, 0.3)'
  },
  syncButtonText: {
    color: VIOLET_ACCENT,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1
  },
  storiesWrapper: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#07090C'
  },
  storiesScrollContent: {
    paddingHorizontal: 16,
    gap: 16
  },
  storyItem: {
    alignItems: 'center',
    width: 68
  },
  storyAvatarOutline: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  storyUserOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed'
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
    backgroundColor: '#13161C'
  },
  storyUserAddBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#6E5BFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#07090C'
  },
  storyUserAddText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900'
  },
  storyEmojiBadge: {
    position: 'absolute',
    bottom: 12,
    right: 2,
    backgroundColor: '#1E232E',
    borderWidth: 1.5,
    borderColor: '#6E5BFF',
    borderRadius: 10,
    paddingHorizontal: 3,
    paddingVertical: 1,
    elevation: 3
  },
  storyEmojiBadgeText: {
    fontSize: 10
  },
  storyName: {
    color: '#8A94A6',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
    width: 68
  },
  chatListWrapper: {
    flex: 1,
    backgroundColor: '#07090C'
  },
  chatListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)'
  },
  chatListTitle: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  pendingBannerBadge: {
    backgroundColor: 'rgba(110, 91, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#6E5BFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  pendingBannerBadgeText: {
    color: '#6E5BFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)'
  },
  chatListAvatarContainer: {
    position: 'relative'
  },
  chatListAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#13161C'
  },
  chatListEmojiBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#1E232E',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#07090C'
  },
  chatListMiddle: {
    flex: 1,
    marginLeft: 16
  },
  chatListNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  chatListFriendName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800'
  },
  chatListStreakText: {
    color: '#FF7A59',
    fontSize: 10,
    fontWeight: '900'
  },
  chatListStatusText: {
    color: '#8A94A6',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 4
  },
  chatListRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40
  },
  chatListTimeText: {
    color: '#8A94A6',
    fontSize: 9,
    fontWeight: '800'
  },
  themeDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8
  },
  emptyChatListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80
  },
  emptyChatListTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4
  },
  emptyChatListSub: {
    color: '#8A94A6',
    fontSize: 10.5,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 14
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  bottomSheetDimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  bottomSheetContent: {
    height: '84%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    overflow: 'hidden'
  },
  bottomSheetGrabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignSelf: 'center',
    marginBottom: 10
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)'
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  friendProfileSection: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    backgroundColor: 'rgba(0, 0, 0, 0.1)'
  },
  friendNameInfo: {
    alignItems: 'center',
    marginBottom: 8
  },
  nameEditRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 8
  },
  chatCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  chatCloseText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  chatHeaderTitleContainer: {
    alignItems: 'center',
    flex: 1
  },
  chatHeaderTitleContainerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginHorizontal: 8
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  nicknameInputField: {
    flex: 1,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700'
  },
  nicknameSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: VIOLET_ACCENT,
    borderRadius: 6
  },
  nicknameSaveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900'
  },
  nicknameCancelBtn: {
    padding: 6
  },
  nicknameCancelBtnText: {
    color: '#8A94A6',
    fontSize: 15,
    fontWeight: '900'
  },
  chatHeaderTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 0.5
  },
  toastBannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 44,
    left: 16,
    right: 16,
    zIndex: 999
  },
  toastBannerGradient: {
    backgroundColor: '#1C222D',
    borderWidth: 1,
    borderColor: VIOLET_ACCENT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: VIOLET_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10
  },
  toastTitleText: {
    color: VIOLET_ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2
  },
  toastBodyText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700'
  },
  nudgeActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 122, 89, 0.2)',
    borderWidth: 1,
    borderColor: EMBER_ORANGE,
    borderRadius: 6,
    marginLeft: 6
  },
  nudgeActionText: {
    color: EMBER_ORANGE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  removeActionBtn: {
    padding: 4,
    marginLeft: 4
  },
  removeActionText: {
    fontSize: 16
  },
  chatHeaderSubtitle: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 1
  },
  themeDotsRow: {
    flexDirection: 'row',
    gap: 4
  },
  themeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    opacity: 0.5
  },
  activeThemeDot: {
    opacity: 1,
    borderWidth: 1.5,
    borderColor: '#FFF'
  },
  streakBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  streakBannerText: {
    color: EMBER_ORANGE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  streakBannerSub: {
    color: '#6E5BFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '900'
  },
  messagesScrollView: {
    flex: 1
  },
  messagesEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptySymbol: {
    fontSize: 48,
    marginBottom: 8
  },
  emptyInstruction: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '800'
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
    maxWidth: '85%'
  },
  msgRowMe: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse'
  },
  msgRowThem: {
    alignSelf: 'flex-start'
  },
  msgAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  msgAvatarInitials: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900'
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16
  },
  msgBubbleMe: {
    borderBottomRightRadius: 2
  },
  msgBubbleThem: {
    backgroundColor: '#1E222B',
    borderBottomLeftRadius: 2
  },
  msgBodyText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600'
  },
  msgBodyTextMe: {
    color: '#FFF'
  },
  msgBodyTextThem: {
    color: '#E4E7EB'
  },
  stickerMessageContainer: {
    padding: 2
  },
  stickerMessageChar: {
    fontSize: 48
  },
  stickerSelectionPanel: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 12
  },
  stickerHorizontalScroll: {
    paddingHorizontal: 16,
    gap: 12
  },
  stickerBubbleBtn: {
    width: 50,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 16 : 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  stickerTriggerButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 8
  },
  stickerTriggerButtonActive: {
    backgroundColor: 'rgba(110, 91, 255, 0.2)'
  },
  chatTextInputField: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700'
  },
  sendMessageBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  sendMessageBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  syncModalContainer: {
    flex: 1
  },
  syncModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 38,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)'
  },
  syncModalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5
  },
  syncModalCloseBtn: {
    padding: 6
  },
  syncModalCloseText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '900'
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    justifyContent: 'center'
  },
  searchBarInput: {
    backgroundColor: '#13161C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700'
  },
  searchClearBtn: {
    position: 'absolute',
    right: 28,
    padding: 6
  },
  searchClearText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '900'
  },
  syncPromptBox: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13161C',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)'
  },
  syncPromptText: {
    color: '#8A94A6',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16
  },
  primarySyncBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  primarySyncBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1
  },
  syncedContactsTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 12
  },
  contactItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)'
  },
  contactAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(110, 91, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(110, 91, 255, 0.2)'
  },
  contactAvatarInitials: {
    color: VIOLET_ACCENT,
    fontSize: 15,
    fontWeight: '900'
  },
  contactItemName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800'
  },
  contactItemPhone: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  contactAddBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: VIOLET_ACCENT
  },
  contactAddBtnText: {
    color: VIOLET_ACCENT,
    fontSize: 12,
    fontWeight: '900'
  },
  contactPendingLabel: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '900'
  },
  contactFriendLabel: {
    color: EMBER_ORANGE,
    fontSize: 12,
    fontWeight: '900'
  },
  centerStatusBubble: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1E232E',
    borderWidth: 2,
    borderColor: '#6E5BFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#6E5BFF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4
  },
  friendStatusBubble: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#1E232E',
    borderWidth: 1.5,
    borderColor: '#6E5BFF',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 10
  },
  statusBubbleEmoji: {
    fontSize: 12
  },
  chatInputTopAccessory: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'flex-start'
  },
  typingIndicatorWrap: {
    backgroundColor: 'rgba(110, 91, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(110, 91, 255, 0.3)'
  },
  typingIndicatorText: {
    color: '#6E5BFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontStyle: 'italic'
  },
  quickReactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  quickReactionBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 6,
    borderRadius: 16
  },
  quickReactionEmoji: {
    fontSize: 16
  },
  statusEmojiInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    fontSize: 24,
    color: '#FFF',
    width: 60,
    textAlign: 'center'
  },
  statusTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#FFF'
  },
  saveStatusBtn: {
    backgroundColor: '#6E5BFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24
  },
  saveStatusBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  gameCard: {
    padding: 14,
    borderRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxWidth: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 4
  },
  gameCardTag: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4
  },
  gameCardQuestion: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    fontStyle: 'italic'
  },
  tabSegmentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#12151B'
  },
  tabSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)'
  },
  tabSegmentBtnActive: {
    backgroundColor: '#6E5BFF'
  },
  tabSegmentText: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  tabSegmentTextActive: {
    color: '#FFF',
    fontWeight: '900'
  },
  scannerViewContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  viewfinderFrame: {
    width: 240,
    height: 240,
    backgroundColor: 'rgba(10, 14, 20, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(110, 91, 255, 0.3)',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#00F2FE'
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6
  },
  laserBeam: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: '#00F2FE',
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6
  },
  reticleCenter: {
    alignItems: 'center'
  },
  reticleText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8
  },
  scannerControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%'
  },
  scannerToolBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  demoScanBox: {
    marginTop: 24,
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  demoScanTitle: {
    color: '#8A94A6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  },
  demoCodeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(110, 91, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(110, 91, 255, 0.3)'
  },
  demoCodeChipText: {
    color: '#6E5BFF',
    fontSize: 12,
    fontWeight: '800'
  },
  myQrContainer: {
    paddingVertical: 10,
    alignItems: 'center'
  },
  hologramCard: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center'
  },
  hologramCardHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  hologramAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#6E5BFF'
  },
  hologramName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800'
  },
  hologramSubtitle: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1
  },
  hologramBadge: {
    backgroundColor: 'rgba(110, 91, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6E5BFF'
  },
  hologramBadgeText: {
    color: '#6E5BFF',
    fontSize: 9,
    fontWeight: '900'
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 20,
    shadowColor: '#6E5BFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8
  },
  qrInnerBorder: {
    borderRadius: 8,
    overflow: 'hidden'
  },
  codeDisplayBox: {
    marginTop: 20,
    alignItems: 'center'
  },
  codeDisplayLabel: {
    color: '#8A94A6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  },
  codeDisplayText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  hologramActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%'
  },
  hologramActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  hologramActionBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  codeInputBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  sectionHeaderTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8
  },
  codeFieldWrapper: {
    flexDirection: 'row',
    gap: 8
  },
  codeTextInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  codePasteBtn: {
    backgroundColor: 'rgba(110, 91, 255, 0.2)',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6E5BFF'
  },
  codePasteBtnText: {
    color: '#6E5BFF',
    fontSize: 12,
    fontWeight: '900'
  },
  vibeChipsContainer: {
    gap: 8
  },
  vibeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  vibeChipLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800'
  },
  vibeChipDesc: {
    color: '#8A94A6',
    fontSize: 10.5,
    marginTop: 2
  },
  icebreakerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  icebreakerChipActive: {
    backgroundColor: '#6E5BFF',
    borderColor: '#6E5BFF'
  },
  icebreakerChipText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '700'
  },
  customIcebreakerInput: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 13
  },
  connectActionButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden'
  },
  connectActionGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectActionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1
  },
  vibeBadgeSmall: {
    backgroundColor: 'rgba(110, 91, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#6E5BFF'
  },
  vibeBadgeSmallText: {
    color: '#6E5BFF',
    fontSize: 9,
    fontWeight: '900'
  },
  giftModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  giftModalBox: {
    width: '100%',
    backgroundColor: '#171B22',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  giftModalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  giftModalSub: {
    color: '#8A94A6',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 20
  },
  giftAmountRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  giftAmtBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center'
  },
  giftAmtBtnActive: {
    backgroundColor: '#6E5BFF',
    borderColor: '#6E5BFF'
  },
  giftAmtText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900'
  },
  giftAmtTextActive: {
    color: '#FFF'
  },
  confirmGiftBtn: {
    backgroundColor: '#FF7A59',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center'
  },
  confirmGiftBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1
  },
  orbitContainer: {
    flex: 1,
    backgroundColor: '#07090C',
    overflow: 'hidden',
    position: 'relative'
  },
  radarPulseRing1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: '#00F2FE',
    left: SW/2 - 80,
    top: (SH*0.4) - 80,
    opacity: 0.3,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10
  },
  radarPulseRing2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: '#FF7A59',
    left: SW/2 - 130,
    top: (SH*0.4) - 130,
    opacity: 0.15,
    borderStyle: 'dashed'
  },
  radarPulseRing3: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 1,
    borderColor: '#6E5BFF',
    left: SW/2 - 190,
    top: (SH*0.4) - 190,
    opacity: 0.08
  },
  emptyOrbitContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: -100 }]
  },
  orbitFindBtn: {
    marginTop: 24,
    backgroundColor: '#6E5BFF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    shadowColor: '#6E5BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  orbitFindBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1
  },
  orbitNode: {
    position: 'absolute',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  polaroidCard: {
    backgroundColor: '#FAF9F6', // Off-white photo paper
    padding: 6,
    paddingBottom: 20,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    alignItems: 'center',
    width: 60,
  },
  polaroidImage: {
    width: 48,
    height: 48,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  polaroidInitials: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1
  },
  polaroidName: {
    color: '#333',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    textTransform: 'uppercase'
  },
  orbitEmojiBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 12
  },
  orbitStreakBadge: {
    position: 'absolute',
    bottom: -32,
    backgroundColor: 'rgba(255,122,89,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF7A59'
  },
  orbitStreakText: {
    color: '#FF7A59',
    fontSize: 8,
    fontWeight: '900'
  },
  centerNode: {
    position: 'absolute',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20
  },
  centerAvatarOutline: {
    padding: 3,
    borderRadius: 40,
    shadowColor: '#6E5BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15
  },
  centerAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#07090C'
  },
  centerNodePulse: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#FF1493',
    opacity: 0.5,
    zIndex: -1
  },
  centerNodeLabel: {
    position: 'absolute',
    bottom: -15,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden'
  }
});
