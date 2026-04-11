import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, ActivityIndicator,
  Platform, Alert, Pressable,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';

/* ── 카테고리 ── */
const CATEGORIES = [
  { id: '전체',    label: '전체',    icon: 'grid-outline' },
  { id: '수업Q&A', label: '수업Q&A', icon: 'help-circle-outline' },
  { id: '중고거래', label: '중고거래', icon: 'swap-horizontal-outline' },
  { id: '동아리',  label: '동아리',  icon: 'people-outline' },
  { id: '분실물',  label: '분실물',  icon: 'search-outline' },
  { id: '꿀팁',    label: '꿀팁',    icon: 'bulb-outline' },
  { id: '기타',    label: '기타',    icon: 'ellipsis-horizontal-outline' },
] as const;
type CategoryId = typeof CATEGORIES[number]['id'];

const WRITE_CATEGORIES: CategoryId[] = ['수업Q&A', '중고거래', '동아리', '분실물', '꿀팁', '기타'];

/* ── 정체성 색상 ── */
const IDENTITY_STYLE = {
  anon: { avatarBg: '#C5D3E3', avatarText: '#1B3A5C' },
  dept: { avatarBg: '#9FE1CB', avatarText: '#0A4D3A' },
  year: { avatarBg: '#CECBF6', avatarText: '#3C3489' },
} as const;
type IdentityType = keyof typeof IDENTITY_STYLE;

/* ── 타입 ── */
interface Post {
  id: number;
  category: string;
  subCategory: string | null;
  title: string;
  content: string;
  images?: string[] | null;
  author: string;
  views: number;
  commentCount?: number;
  createdAt: string;
}

interface Profile {
  department?: string;
  studentId?: string | number;
}

/* ── author 파싱 ── */
function parseAuthor(author: string): { type: IdentityType; label: string; avatarText: string } {
  if (!author || author === '익명') return { type: 'anon', label: '익명', avatarText: '익' };
  const parts = author.split('.');
  if (parts.length >= 3 && parts[2]?.endsWith('학번')) {
    const yr = parts[2];
    return { type: 'year', label: `${shortenDept(parts[1] ?? '')} ${yr}`, avatarText: yr.slice(0, 2) };
  }
  if (parts.length >= 2 && parts[1]) {
    const dept = parts[1];
    return { type: 'dept', label: dept.length > 10 ? dept.slice(0, 8) + '..' : dept, avatarText: dept.slice(0, 2) };
  }
  return { type: 'anon', label: '익명', avatarText: '익' };
}

function shortenDept(dept: string) {
  if (dept.length <= 6) return dept;
  return dept.slice(0, 5) + '..';
}

function buildAuthor(identity: IdentityType, profile: Profile): string {
  if (identity === 'anon' || !profile.department) return '익명';
  if (identity === 'dept') return `익명.${profile.department}`;
  const yr = profile.studentId ? String(profile.studentId).substring(2, 4) + '학번' : '';
  return yr ? `익명.${profile.department}.${yr}` : `익명.${profile.department}`;
}

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return day < 7 ? `${day}일 전` : new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/* ── Avatar ── */
function Avatar({ text, type, size = 38 }: { text: string; type: IdentityType; size?: number }) {
  const s = IDENTITY_STYLE[type];
  return (
    <View style={[avatarSt.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: s.avatarBg }]}>
      <Text style={[avatarSt.text, { color: s.avatarText, fontSize: size * 0.29 }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
const avatarSt = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
});

/* ── Category Badge ── */
const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  '수업Q&A':  { bg: '#FEE2E2', text: '#DC2626' },
  '중고거래':  { bg: '#EDE9FE', text: '#7C3AED' },
  '동아리':   { bg: '#D1FAE5', text: '#059669' },
  '분실물':   { bg: '#FEF3C7', text: '#D97706' },
  '꿀팁':     { bg: '#DBEAFE', text: '#1D4ED8' },
  '기타':     { bg: '#F3F4F6', text: '#6B7280' },
  '공지':     { bg: '#DBEAFE', text: '#1D4ED8' },
  '질문':     { bg: '#FEE2E2', text: '#DC2626' },
  '모집':     { bg: '#D1FAE5', text: '#059669' },
  '거래':     { bg: '#EDE9FE', text: '#7C3AED' },
};

/* ── Post Card ── */
function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 30));
  const [saved, setSaved] = useState(false);
  const isTrade = post.category === '중고거래' || post.category === '거래';
  const { type, label, avatarText } = parseAuthor(post.author);
  const badgeStyle = CAT_BADGE[post.category] ?? { bg: '#F3F4F6', text: '#6B7280' };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => {}}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <Avatar text={avatarText} type={type} />
        <View style={{ flex: 1 }}>
          <View style={styles.authorRow}>
            <Text style={styles.authorLabel}>{label}</Text>
            <Text style={styles.timeText}>{relTime(post.createdAt)}</Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={[styles.catBadge, { backgroundColor: badgeStyle.bg }]}>
              <Text style={[styles.catBadgeText, { color: badgeStyle.text }]}>{post.category}</Text>
            </View>
            {post.subCategory && !isTrade && (
              <Text style={styles.subCatText}>{post.subCategory}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => setSaved(s => !s)} style={styles.bookmarkBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? C.primary : '#D1D5DB'} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {isTrade ? (
        <View style={styles.tradeBody}>
          <View style={styles.tradeImageBox}>
            <Ionicons name="cube-outline" size={26} color="#C4C9D4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
            {post.subCategory ? (
              <Text style={styles.tradePrice}>{post.subCategory}</Text>
            ) : null}
            <Text style={styles.tradeLocation} numberOfLines={1}>{post.content}</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
          {!!post.content && (
            <Text style={styles.postBody} numberOfLines={2}>{post.content}</Text>
          )}
        </>
      )}

      {/* Footer actions */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={15} color={liked ? '#E24B4A' : '#B0B7C3'} />
          <Text style={[styles.actionText, liked && { color: '#E24B4A' }]}>{likeCount}</Text>
        </TouchableOpacity>
        <View style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={14} color="#B0B7C3" />
          <Text style={styles.actionText}>{post.commentCount ?? 0}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.actionBtn}>
          <Ionicons name="eye-outline" size={14} color="#B0B7C3" />
          <Text style={styles.actionText}>{post.views}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ── Write Sheet ── */
function WriteSheet({
  visible, onClose, onSubmit, profile,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; content: string; category: string; subCategory: string; author: string }) => Promise<void>;
  profile: Profile;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<CategoryId>('수업Q&A');
  const [identity, setIdentity] = useState<IdentityType>('anon');
  const [submitting, setSubmitting] = useState(false);
  const isTrade = category === '중고거래';

  const hasDept = !!profile.department;
  const hasYear = hasDept && !!profile.studentId;

  const identityOptions: { type: IdentityType; label: string; sub: string }[] = [
    { type: 'anon', label: '익명', sub: '학과/학번 비공개' },
    ...(hasDept ? [{ type: 'dept' as IdentityType, label: profile.department!, sub: '학과 표시' }] : []),
    ...(hasYear ? [{ type: 'year' as IdentityType, label: `${String(profile.studentId).substring(2, 4)}학번`, sub: '학번 표시' }] : []),
  ];

  const canSubmit = title.trim() && content.trim() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({
      title: title.trim(),
      content: content.trim(),
      category,
      subCategory: isTrade ? price.trim() : '',
      author: buildAuthor(identity, profile),
    });
    setTitle(''); setContent(''); setPrice(''); setCategory('수업Q&A'); setIdentity('anon');
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable
          style={[styles.sheetContainer, { paddingBottom: (isWeb ? 16 : insets.bottom) + 16 }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>글 작성</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* 정체성 선택 */}
          <Text style={styles.fieldLabel}>작성자 표시</Text>
          <View style={styles.identityRow}>
            {identityOptions.map(opt => {
              const sel = identity === opt.type;
              const s = IDENTITY_STYLE[opt.type];
              return (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.identityCard, sel && styles.identityCardSel]}
                  onPress={() => setIdentity(opt.type)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.identityAvatar, { backgroundColor: s.avatarBg }]}>
                    <Text style={[styles.identityAvatarText, { color: s.avatarText }]}>
                      {opt.type === 'anon' ? '익' : opt.label.slice(0, 2)}
                    </Text>
                  </View>
                  <Text style={[styles.identityLabel, sel && styles.identityLabelSel]} numberOfLines={1}>{opt.label}</Text>
                  <Text style={styles.identitySub}>{opt.sub}</Text>
                  {sel && (
                    <View style={styles.identityCheck}>
                      <Ionicons name="checkmark-circle" size={14} color={C.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 카테고리 */}
          <Text style={styles.fieldLabel}>카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {WRITE_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipSel]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catChipText, category === cat && styles.catChipTextSel]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* 제목 */}
          <TextInput
            style={styles.inputField}
            value={title}
            onChangeText={setTitle}
            placeholder={isTrade ? '물품 이름' : '제목'}
            placeholderTextColor="#9CA3AF"
          />

          {/* 가격 (중고거래만) */}
          {isTrade && (
            <TextInput
              style={styles.inputField}
              value={price}
              onChangeText={setPrice}
              placeholder="가격 (예: 12,000원)"
              placeholderTextColor="#9CA3AF"
            />
          )}

          {/* 내용 */}
          <TextInput
            style={[styles.inputField, styles.inputMultiline]}
            value={content}
            onChangeText={setContent}
            placeholder={isTrade ? '거래 장소 및 상태 설명' : '내용을 입력하세요'}
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>게시하기</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ══════════════════════════════
   Main Screen
══════════════════════════════ */
export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const [activeCategory, setActiveCategory] = useState<CategoryId>('전체');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  // 프로필 로드
  useEffect(() => {
    AsyncStorage.getItem('campus_life_profile').then(raw => {
      if (raw) { try { setProfile(JSON.parse(raw)); } catch {} }
    });
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory !== '전체') params.set('category', activeCategory);
      params.set('limit', '100');
      const r = await fetch(`${API}/community?${params}`);
      if (r.ok) {
        const data = await r.json();
        setPosts(Array.isArray(data) ? data : (data.posts ?? []));
      }
    } catch {}
    finally { setLoading(false); }
  }, [activeCategory]);

  useEffect(() => { setLoading(true); fetchPosts(); }, [fetchPosts]);
  useEffect(() => { setPage(1); }, [activeCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const handleSubmit = async (data: { title: string; content: string; category: string; subCategory: string; author: string }) => {
    try {
      const r = await fetch(`${API}/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const newPost = await r.json();
        setPosts(prev => [newPost, ...prev]);
      } else {
        Alert.alert('오류', '게시글 작성에 실패했습니다.');
      }
    } catch {
      Alert.alert('오류', '게시글 작성에 실패했습니다.');
    }
  };

  const paged = posts.slice(0, page * PER_PAGE);
  const hasMore = paged.length < posts.length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>부산대학교</Text>
        <Text style={styles.headerTitle}>커뮤니티</Text>

        {/* 카테고리 칩바 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catBar}
          style={styles.catBarScroll}
        >
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChipBar, active && styles.catChipBarActive]}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={13}
                  color={active ? '#fff' : '#9CA3AF'}
                />
                <Text style={[styles.catChipBarText, active && styles.catChipBarTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Feed ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 48 }} />
        ) : posts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={44} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>아직 게시글이 없어요</Text>
            <Text style={styles.emptySub}>첫 번째 글을 작성해보세요!</Text>
          </View>
        ) : (
          <>
            {paged.map(post => <PostCard key={post.id} post={post} />)}
            {hasMore && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setPage(p => p + 1)}>
                <Text style={styles.moreBtnText}>더 보기</Text>
                <Ionicons name="chevron-down" size={15} color={C.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: isWeb ? 40 : 110 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: isWeb ? 28 : insets.bottom + 88 }]}
        onPress={() => setShowWrite(true)}
        activeOpacity={0.9}
      >
        <Feather name="edit-2" size={20} color="#fff" />
      </TouchableOpacity>

      {/* ── Write Sheet ── */}
      <WriteSheet
        visible={showWrite}
        onClose={() => setShowWrite(false)}
        onSubmit={handleSubmit}
        profile={profile}
      />
    </View>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: C.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  catBarScroll: { marginHorizontal: -20, marginBottom: 0 },
  catBar: { paddingHorizontal: 20, gap: 6, paddingBottom: 14 },
  catChipBar: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  catChipBarActive: { backgroundColor: C.primary },
  catChipBarText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  catChipBarTextActive: { color: '#fff' },

  feed: { paddingHorizontal: 12, paddingTop: 10 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  authorLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  timeText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  catBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  catBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  subCatText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  bookmarkBtn: { marginLeft: 'auto' as any, paddingLeft: 6 },

  postTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', lineHeight: 21, marginBottom: 4 },
  postBody: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 19 },

  tradeBody: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 2 },
  tradeImageBox: {
    width: 76, height: 76, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tradePrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primary, marginBottom: 3 },
  tradeLocation: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#B0B7C3' },

  emptyBox: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#374151' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  moreBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },

  fab: {
    position: 'absolute', right: 20, width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },

  // Write Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' },

  fieldLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#6B7280', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },

  identityRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  identityCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', position: 'relative',
  },
  identityCardSel: { borderColor: C.primary, backgroundColor: '#EEF4FF' },
  identityAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  identityAvatarText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  identityLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#374151', textAlign: 'center' },
  identityLabelSel: { color: C.primary },
  identitySub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  identityCheck: { position: 'absolute', top: 6, right: 6 },

  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4F6' },
  catChipSel: { backgroundColor: C.primary },
  catChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  catChipTextSel: { color: '#fff' },

  inputField: {
    backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontFamily: 'Inter_400Regular', color: '#111827', marginBottom: 10,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },

  submitBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
