import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, ActivityIndicator,
  Platform, Alert, Pressable, FlatList, SectionList,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';
const PINNED_KEY = 'pium_community_pinned_depts';

/* ── 고정 카테고리 ── */
const FIXED_CATEGORIES = [
  { id: '전체',    label: '전체',    icon: 'grid-outline' },
  { id: '수업Q&A', label: '수업Q&A', icon: 'help-circle-outline' },
  { id: '중고거래', label: '중고거래', icon: 'swap-horizontal-outline' },
  { id: '동아리',  label: '동아리',  icon: 'people-outline' },
  { id: '분실물',  label: '분실물',  icon: 'search-outline' },
  { id: '꿀팁',    label: '꿀팁',    icon: 'bulb-outline' },
] as const;
const FIXED_IDS = FIXED_CATEGORIES.map(c => c.id) as string[];
const FIXED_ORDERABLE_IDS = ['수업Q&A', '중고거래', '동아리', '분실물', '꿀팁']; // 순서 조정 가능한 고정 탭
const DEFAULT_TAB_ORDER = ['수업Q&A', '중고거래', '동아리', '분실물', '꿀팁'];
const TAB_ORDER_KEY = 'pium_community_tab_order';
const WRITE_CATEGORIES = ['수업Q&A', '중고거래', '동아리', '분실물', '꿀팁'];

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
interface Profile { department?: string; studentId?: string | number; }

/* ── 정체성 ── */
const IDENTITY_STYLE = {
  anon: { avatarBg: '#C5D3E3', avatarText: '#1B3A5C' },
  dept: { avatarBg: '#9FE1CB', avatarText: '#0A4D3A' },
  year: { avatarBg: '#CECBF6', avatarText: '#3C3489' },
} as const;
type IdentityType = keyof typeof IDENTITY_STYLE;

function parseAuthor(author: string) {
  if (!author || author === '익명') return { type: 'anon' as IdentityType, label: '익명', avatarText: '익' };
  const parts = author.split('.');
  if (parts.length >= 3 && parts[2]?.endsWith('학번')) {
    const yr = parts[2];
    const dept = parts[1] ?? '';
    return { type: 'year' as IdentityType, label: `${dept.slice(0, 5)} ${yr}`, avatarText: yr.slice(0, 2) };
  }
  if (parts.length >= 2 && parts[1]) {
    const dept = parts[1];
    return { type: 'dept' as IdentityType, label: dept.length > 10 ? dept.slice(0, 8) + '..' : dept, avatarText: dept.slice(0, 2) };
  }
  return { type: 'anon' as IdentityType, label: '익명', avatarText: '익' };
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

/* ── 초성 추출 ── */
function getInitial(str: string): string {
  const code = str.charCodeAt(0) - 0xAC00;
  if (code < 0) return str[0]?.toUpperCase() ?? '#';
  const initials = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return initials[Math.floor(code / 588)] ?? '#';
}

interface DeptItem { name: string; college: string; }

function buildSections(depts: DeptItem[]): { title: string; data: DeptItem[] }[] {
  const map = new Map<string, DeptItem[]>();
  for (const d of depts) {
    if (!map.has(d.college)) map.set(d.college, []);
    map.get(d.college)!.push(d);
  }
  return [...map.entries()].map(([title, data]) => ({ title, data }));
}

function filterPosts(posts: Post[], activeTab: string): Post[] {
  if (activeTab === '전체') return posts;
  if (FIXED_ORDERABLE_IDS.includes(activeTab)) return posts.filter(p => p.category === activeTab);
  return posts.filter(p => p.author.includes(activeTab));
}

/* ── Avatar ── */
function Avatar({ text, type, size = 38 }: { text: string; type: IdentityType; size?: number }) {
  const s = IDENTITY_STYLE[type];
  return (
    <View style={[avSt.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: s.avatarBg }]}>
      <Text style={[avSt.text, { color: s.avatarText, fontSize: size * 0.29 }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}
const avSt = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
});

/* ── Category Badge ── */
const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  '수업Q&A': { bg: '#FEE2E2', text: '#DC2626' },
  '중고거래': { bg: '#EDE9FE', text: '#7C3AED' },
  '동아리':  { bg: '#D1FAE5', text: '#059669' },
  '분실물':  { bg: '#FEF3C7', text: '#D97706' },
  '꿀팁':    { bg: '#DBEAFE', text: '#1D4ED8' },
  '기타':    { bg: '#F3F4F6', text: '#6B7280' },
  '공지':    { bg: '#DBEAFE', text: '#1D4ED8' },
  '질문':    { bg: '#FEE2E2', text: '#DC2626' },
  '모집':    { bg: '#D1FAE5', text: '#059669' },
  '거래':    { bg: '#EDE9FE', text: '#7C3AED' },
};

/* ── Post Card ── */
function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [likeCount] = useState(Math.floor(Math.random() * 30));
  const [saved, setSaved] = useState(false);
  const isTrade = post.category === '중고거래' || post.category === '거래';
  const { type, label, avatarText } = parseAuthor(post.author);
  const badgeStyle = CAT_BADGE[post.category] ?? { bg: '#F3F4F6', text: '#6B7280' };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85}>
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

      {isTrade ? (
        <View style={styles.tradeBody}>
          <View style={styles.tradeImageBox}>
            <Ionicons name="cube-outline" size={26} color="#C4C9D4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
            {post.subCategory && <Text style={styles.tradePrice}>{post.subCategory}</Text>}
            <Text style={styles.tradeLocation} numberOfLines={1}>{post.content}</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
          {!!post.content && <Text style={styles.postBody} numberOfLines={2}>{post.content}</Text>}
        </>
      )}

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setLiked(l => !l)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
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

/* ── Dept Browser Modal ── */
function DeptBrowserModal({
  visible, onClose, pinnedDepts, onPin, onUnpin, onView,
}: {
  visible: boolean;
  onClose: () => void;
  pinnedDepts: string[];
  onPin: (dept: string) => void;
  onUnpin: (dept: string) => void;
  onView: (dept: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [depts, setDepts] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const sectionListRef = useRef<SectionList>(null);
  const pinnedSet = new Set(pinnedDepts);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setQ('');
    fetch(`${API}/community/depts`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setDepts(data.depts ?? []))
      .catch(() => setDepts([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const isSearching = !!q.trim();
  const filtered: DeptItem[] = isSearching
    ? depts.filter(d => d.name.includes(q.trim()) || d.college.includes(q.trim()))
    : [];
  const sections = React.useMemo(() => buildSections(depts), [depts]);
  const collegeNames = sections.map(s => s.title);

  const scrollToSection = (college: string) => {
    const idx = sections.findIndex(s => s.title === college);
    if (idx < 0 || !sectionListRef.current) return;
    try { sectionListRef.current.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true, viewOffset: 4 }); } catch {}
  };

  const renderDeptItem = (item: DeptItem) => {
    const isPinned = pinnedSet.has(item.name);
    return (
      <TouchableOpacity
        key={item.name}
        style={styles.deptItem}
        onPress={() => { onView(item.name); onClose(); }}
        onLongPress={() => { isPinned ? onUnpin(item.name) : onPin(item.name); }}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={styles.deptItemLeft}>
          <Text style={[styles.deptItemName, isPinned && { color: C.primary, fontFamily: 'Inter_600SemiBold' }]}>
            {item.name}
          </Text>
          {isPinned && <Text style={styles.deptPinnedLabel}>탭 고정됨</Text>}
        </View>
        <TouchableOpacity onPress={() => isPinned ? onUnpin(item.name) : onPin(item.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isPinned ? 'star' : 'star-outline'} size={18} color={isPinned ? '#F59E0B' : '#D1D5DB'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheetContainer, styles.sheetContainerTall, { paddingBottom: (isWeb ? 16 : insets.bottom) + 12 }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <View>
              <Text style={styles.sheetTitle}>학과 게시판</Text>
              <Text style={styles.sheetSub}>꾹 누르면 탭에 고정돼요</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Feather name="search" size={14} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder="학과 검색..."
              placeholderTextColor="#9CA3AF"
            />
            {!!q && <TouchableOpacity onPress={() => setQ('')}><Feather name="x" size={13} color="#9CA3AF" /></TouchableOpacity>}
          </View>

          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
          ) : isSearching ? (
            /* 검색 결과: 평탄 리스트 */
            <FlatList
              data={filtered}
              keyExtractor={item => item.name}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              renderItem={({ item }) => renderDeptItem(item)}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ color: '#9CA3AF', fontSize: 14, fontFamily: 'Inter_400Regular' }}>검색 결과가 없습니다</Text>
                </View>
              }
            />
          ) : (
            /* 단과대학별 섹션 + 우측 인덱스 바 */
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <SectionList
                ref={sectionListRef}
                sections={sections}
                keyExtractor={(item) => item.name}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                stickySectionHeadersEnabled
                renderSectionHeader={({ section }) => (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{section.title}</Text>
                  </View>
                )}
                renderItem={({ item }) => renderDeptItem(item)}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Text style={{ color: '#9CA3AF', fontSize: 14, fontFamily: 'Inter_400Regular' }}>학과 목록이 없습니다</Text>
                  </View>
                }
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Reorder Modal ── */
function ReorderModal({
  visible, onClose, tabOrder, myDept, onChange,
}: {
  visible: boolean;
  onClose: () => void;
  tabOrder: string[];
  myDept: string;
  onChange: (order: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<string[]>([]);

  useEffect(() => { if (visible) setLocal([...tabOrder]); }, [visible, tabOrder]);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...local];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setLocal(next);
  };

  const remove = (i: number) => {
    setLocal(prev => prev.filter((_, idx) => idx !== i));
  };

  const save = () => { onChange(local); onClose(); };

  const getTabDisplay = (tabId: string) => {
    const isMyDept = tabId === myDept && !!myDept;
    const fixedCat = FIXED_CATEGORIES.find(c => c.id === tabId);
    if (isMyDept) return { label: `내 학과 (${tabId})`, icon: 'home-outline' as const, isFixed: false, isMyDept: true };
    if (fixedCat) return { label: fixedCat.label, icon: fixedCat.icon as any, isFixed: true, isMyDept: false };
    return { label: tabId, icon: 'school-outline' as const, isFixed: false, isMyDept: false };
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheetContainer, styles.sheetContainerTall, { paddingBottom: (isWeb ? 16 : insets.bottom) + 16 }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <View>
              <Text style={styles.sheetTitle}>탭 순서 편집</Text>
              <Text style={styles.sheetSub}>전체 탭을 제외한 모든 탭 순서를 조정할 수 있어요</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* 고정: 전체 탭 (항상 첫 번째, 편집 불가) */}
          <View style={[styles.reorderItem, { opacity: 0.4 }]}>
            <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" style={{ marginRight: 10 }} />
            <Ionicons name="grid-outline" size={15} color="#9CA3AF" style={{ marginRight: 6 }} />
            <Text style={[styles.reorderItemName, { color: '#9CA3AF' }]}>전체 (항상 첫 번째)</Text>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {local.map((tabId, i) => {
              const { label, icon, isFixed, isMyDept } = getTabDisplay(tabId);
              return (
                <View key={tabId} style={styles.reorderItem}>
                  <Ionicons name="menu-outline" size={18} color="#D1D5DB" style={{ marginRight: 8 }} />
                  <Ionicons name={icon} size={15} color={isMyDept ? C.primary : isFixed ? '#6B7280' : '#F59E0B'} style={{ marginRight: 6 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reorderItemName, isMyDept && { color: C.primary }]} numberOfLines={1}>{label}</Text>
                    {isFixed && <Text style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'Inter_400Regular' }}>고정 카테고리 · 삭제 불가</Text>}
                    {isMyDept && <Text style={{ fontSize: 10, color: C.primary, fontFamily: 'Inter_400Regular' }}>학생증 인증 · 삭제 불가</Text>}
                  </View>
                  <View style={styles.reorderActions}>
                    <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0} style={[styles.reorderArrow, i === 0 && { opacity: 0.25 }]} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                      <Ionicons name="chevron-up" size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => move(i, 1)} disabled={i === local.length - 1} style={[styles.reorderArrow, i === local.length - 1 && { opacity: 0.25 }]} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                      <Ionicons name="chevron-down" size={16} color="#6B7280" />
                    </TouchableOpacity>
                    {!isFixed && !isMyDept ? (
                      <TouchableOpacity onPress={() => remove(i)} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Ionicons name="close-circle" size={20} color="#F87171" />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ width: 20 }} />
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={[styles.submitBtn, { marginTop: 12 }]} onPress={save}>
            <Text style={styles.submitBtnText}>저장</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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
  const [category, setCategory] = useState('수업Q&A');
  const [identity, setIdentity] = useState<IdentityType>('anon');
  const [submitting, setSubmitting] = useState(false);
  const isTrade = category === '중고거래';

  const hasDept = !!profile.department;
  const hasYear = hasDept && !!profile.studentId;
  const identityOptions: { type: IdentityType; label: string; sub: string }[] = [
    { type: 'anon', label: '익명', sub: '비공개' },
    ...(hasDept ? [{ type: 'dept' as IdentityType, label: profile.department!, sub: '학과 표시' }] : []),
    ...(hasYear ? [{ type: 'year' as IdentityType, label: `${String(profile.studentId).substring(2, 4)}학번`, sub: '학번 표시' }] : []),
  ];

  const canSubmit = title.trim() && content.trim() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({
      title: title.trim(), content: content.trim(),
      category, subCategory: isTrade ? price.trim() : '',
      author: buildAuthor(identity, profile),
    });
    setTitle(''); setContent(''); setPrice(''); setCategory('수업Q&A'); setIdentity('anon');
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheetContainer, { paddingBottom: (isWeb ? 16 : insets.bottom) + 16 }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>글 작성</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color="#9CA3AF" /></TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>작성자 표시</Text>
          <View style={styles.identityRow}>
            {identityOptions.map(opt => {
              const sel = identity === opt.type;
              const s = IDENTITY_STYLE[opt.type];
              return (
                <TouchableOpacity key={opt.type} style={[styles.identityCard, sel && styles.identityCardSel]} onPress={() => setIdentity(opt.type)} activeOpacity={0.8}>
                  <View style={[styles.identityAvatar, { backgroundColor: s.avatarBg }]}>
                    <Text style={[styles.identityAvatarText, { color: s.avatarText }]}>
                      {opt.type === 'anon' ? '익' : opt.label.slice(0, 2)}
                    </Text>
                  </View>
                  <Text style={[styles.identityLabel, sel && styles.identityLabelSel]} numberOfLines={1}>{opt.label}</Text>
                  <Text style={styles.identitySub}>{opt.sub}</Text>
                  {sel && <View style={styles.identityCheck}><Ionicons name="checkmark-circle" size={14} color={C.primary} /></View>}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {WRITE_CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} style={[styles.catChip, category === cat && styles.catChipSel]} onPress={() => setCategory(cat)}>
                  <Text style={[styles.catChipText, category === cat && styles.catChipTextSel]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TextInput style={styles.inputField} value={title} onChangeText={setTitle} placeholder={isTrade ? '물품 이름' : '제목'} placeholderTextColor="#9CA3AF" />
          {isTrade && <TextInput style={styles.inputField} value={price} onChangeText={setPrice} placeholder="가격 (예: 12,000원)" placeholderTextColor="#9CA3AF" />}
          <TextInput style={[styles.inputField, styles.inputMultiline]} value={content} onChangeText={setContent} placeholder={isTrade ? '거래 장소 및 상태 설명' : '내용을 입력하세요'} placeholderTextColor="#9CA3AF" multiline textAlignVertical="top" />

          <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
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
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [showDeptBrowser, setShowDeptBrowser] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [tabOrder, setTabOrder] = useState<string[]>([...DEFAULT_TAB_ORDER]);
  const [myDept, setMyDept] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  // pinnedDepts: tabOrder에서 고정 카테고리 제외한 학과 탭
  const pinnedDepts = tabOrder.filter(t => !FIXED_ORDERABLE_IDS.includes(t));

  // 초기 로드
  useEffect(() => {
    AsyncStorage.multiGet(['campus_life_profile', TAB_ORDER_KEY, PINNED_KEY]).then(pairs => {
      const profileRaw = pairs.find(p => p[0] === 'campus_life_profile')?.[1];
      const orderRaw = pairs.find(p => p[0] === TAB_ORDER_KEY)?.[1];
      const legacyRaw = pairs.find(p => p[0] === PINNED_KEY)?.[1];

      let dept = '';
      if (profileRaw) { try { const pr = JSON.parse(profileRaw); dept = pr.department ?? ''; setProfile(pr); } catch {} }
      setMyDept(dept);

      let order: string[];
      if (orderRaw) {
        try { order = JSON.parse(orderRaw); } catch { order = [...DEFAULT_TAB_ORDER]; }
      } else if (legacyRaw) {
        // 이전 버전 데이터 마이그레이션
        try { const pinned: string[] = JSON.parse(legacyRaw); order = [...DEFAULT_TAB_ORDER, ...pinned]; }
        catch { order = [...DEFAULT_TAB_ORDER]; }
      } else {
        order = [...DEFAULT_TAB_ORDER];
      }

      // 인증된 학과 자동 등록
      if (dept && !order.includes(dept)) {
        order = [dept, ...order];
      }

      setTabOrder(order);
      AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order));
    });
  }, []);

  const saveTabOrder = useCallback((order: string[]) => {
    setTabOrder(order);
    AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order));
    if (!order.includes(activeCategory)) setActiveCategory('전체');
  }, [activeCategory]);

  const pinDept = useCallback((dept: string) => {
    setTabOrder(prev => {
      if (prev.includes(dept)) return prev;
      const next = [...prev, dept];
      AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const unpinDept = useCallback((dept: string) => {
    setTabOrder(prev => {
      const next = prev.filter(d => d !== dept);
      AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next));
      if (activeCategory === dept) setActiveCategory('전체');
      return next;
    });
  }, [activeCategory]);

  const fetchPosts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/community?limit=100`);
      if (r.ok) {
        const data = await r.json();
        setPosts(Array.isArray(data) ? data : (data.posts ?? []));
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const newPost = await r.json();
        setPosts(prev => [newPost, ...prev]);
      } else { Alert.alert('오류', '게시글 작성에 실패했습니다.'); }
    } catch { Alert.alert('오류', '게시글 작성에 실패했습니다.'); }
  };

  const filtered = filterPosts(posts, activeCategory);
  const paged = filtered.slice(0, page * PER_PAGE);
  const hasMore = paged.length < filtered.length;

  // 활성 카테고리가 학과 탭인지
  const isDepTabActive = !FIXED_IDS.includes(activeCategory);
  const activeIsMyDept = isDepTabActive && activeCategory === myDept;
  const activeLabel = isDepTabActive
    ? (activeIsMyDept ? `내 학과 · ${activeCategory}` : activeCategory)
    : FIXED_CATEGORIES.find(c => c.id === activeCategory)?.label ?? activeCategory;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerLabel}>부산대학교</Text>
            <Text style={styles.headerTitle}>커뮤니티</Text>
          </View>
          <TouchableOpacity
            style={styles.reorderBtn}
            onPress={() => setShowReorder(true)}
          >
            <Ionicons name="list-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* 카테고리 칩바 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catBar} style={styles.catBarScroll}>
          {/* 전체 탭 (항상 첫 번째) */}
          {(() => { const cat = FIXED_CATEGORIES[0]; const active = activeCategory === cat.id; return (
            <TouchableOpacity key={cat.id} style={[styles.catChipBar, active && styles.catChipBarActive]} onPress={() => setActiveCategory(cat.id)} activeOpacity={0.8}>
              <Ionicons name={cat.icon as any} size={13} color={active ? '#fff' : '#9CA3AF'} />
              <Text style={[styles.catChipBarText, active && styles.catChipBarTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ); })()}

          {/* tabOrder 순서대로 탭 렌더링 */}
          {tabOrder.map(tabId => {
            const active = activeCategory === tabId;
            const isMyDeptTab = tabId === myDept && !!myDept;
            const fixedCat = FIXED_CATEGORIES.find(c => c.id === tabId);

            if (fixedCat) {
              return (
                <TouchableOpacity key={tabId} style={[styles.catChipBar, active && styles.catChipBarActive]} onPress={() => setActiveCategory(tabId)} activeOpacity={0.8}>
                  <Ionicons name={fixedCat.icon as any} size={13} color={active ? '#fff' : '#9CA3AF'} />
                  <Text style={[styles.catChipBarText, active && styles.catChipBarTextActive]}>{fixedCat.label}</Text>
                </TouchableOpacity>
              );
            }

            // 학과 탭
            if (isMyDeptTab) {
              return (
                <TouchableOpacity key={tabId} style={[styles.catChipBar, styles.catChipBarMyDept, active && styles.catChipBarMyDeptActive]} onPress={() => setActiveCategory(tabId)} activeOpacity={0.8}>
                  <Ionicons name="home-outline" size={13} color={active ? '#fff' : C.primary} />
                  <View>
                    <Text style={[styles.catChipBarText, { color: active ? '#fff' : C.primary, fontFamily: 'Inter_700Bold' }]}>내 학과</Text>
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity key={tabId} style={[styles.catChipBar, styles.catChipBarDept, active && styles.catChipBarDeptActive]} onPress={() => setActiveCategory(tabId)} activeOpacity={0.8}>
                <Ionicons name="school-outline" size={13} color={active ? '#fff' : '#F59E0B'} />
                <Text style={[styles.catChipBarText, { color: active ? '#fff' : '#92400E' }]} numberOfLines={1}>
                  {tabId.length > 6 ? tabId.slice(0, 5) + '..' : tabId}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* + 버튼 */}
          <TouchableOpacity style={styles.catChipBarPlus} onPress={() => setShowDeptBrowser(true)} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={C.primary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Feed ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* 내 학과 탭 안내 배너 */}
        {isDepTabActive && (
          <View style={[styles.deptTabBanner, activeIsMyDept && styles.deptTabBannerMyDept]}>
            <Ionicons name={activeIsMyDept ? 'home-outline' : 'school-outline'} size={14} color={activeIsMyDept ? C.primary : '#92400E'} />
            <Text style={[styles.deptTabBannerText, activeIsMyDept && { color: C.primary }]}>
              {activeIsMyDept ? `내 학과 · ${activeCategory} 게시판` : `${activeCategory} 게시판`}
            </Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
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
      <TouchableOpacity style={[styles.fab, { bottom: isWeb ? 28 : insets.bottom + 88 }]} onPress={() => setShowWrite(true)} activeOpacity={0.9}>
        <Feather name="edit-2" size={20} color="#fff" />
      </TouchableOpacity>

      {/* ── Modals ── */}
      <WriteSheet visible={showWrite} onClose={() => setShowWrite(false)} onSubmit={handleSubmit} profile={profile} />

      <DeptBrowserModal
        visible={showDeptBrowser}
        onClose={() => setShowDeptBrowser(false)}
        pinnedDepts={pinnedDepts}
        onPin={pinDept}
        onUnpin={unpinDept}
        onView={(dept) => setActiveCategory(dept)}
      />

      <ReorderModal
        visible={showReorder}
        onClose={() => setShowReorder(false)}
        tabOrder={tabOrder}
        myDept={myDept}
        onChange={saveTabOrder}
      />
    </View>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },

  header: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  headerLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 30, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -0.8 },
  reorderBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },

  catBarScroll: { marginHorizontal: -0, marginBottom: 0 },
  catBar: { paddingHorizontal: 14, gap: 6, paddingBottom: 14, paddingTop: 2 },
  catChipBar: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6' },
  catChipBarActive: { backgroundColor: C.primary },
  catChipBarText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  catChipBarTextActive: { color: '#fff' },
  catChipBarDept: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  catChipBarDeptActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  catChipBarMyDept: { backgroundColor: '#EBF5FF', borderWidth: 1.5, borderColor: C.primary },
  catChipBarMyDeptActive: { backgroundColor: C.primary, borderColor: C.primary },
  catChipBarPlus: {
    width: 32, height: 32, borderRadius: 999,
    borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  feed: { paddingHorizontal: 12, paddingTop: 10 },

  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF4FF', borderRadius: 12, padding: 12, marginBottom: 10 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.primary },
  deptTabBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A' },
  deptTabBannerMyDept: { backgroundColor: '#EBF5FF', borderColor: '#BFDBFE' },
  deptTabBannerText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#92400E' },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
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
  tradeImageBox: { width: 76, height: 76, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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

  fab: { position: 'absolute', right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },

  // Sheets
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  sheetContainerTall: { maxHeight: '88%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' },
  sheetSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },

  // Dept Browser
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular' },
  deptItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  deptItemLeft: { flex: 1 },
  deptItemName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#111827' },
  deptPinnedLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#F59E0B', marginTop: 2 },

  // Section index
  sectionHeader: { backgroundColor: '#F9FAFB', paddingHorizontal: 4, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionHeaderText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1 },
  indexBar: { width: 22, justifyContent: 'center', alignItems: 'center', paddingVertical: 4, gap: 1 },
  indexItem: { paddingVertical: 2, paddingHorizontal: 2, alignItems: 'center' },
  indexText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.primary, lineHeight: 14 },

  // Reorder
  reorderItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  reorderItemName: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: '#111827' },
  reorderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reorderArrow: { padding: 4 },

  // Write
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#6B7280', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  identityRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  identityCard: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', position: 'relative' },
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
  inputField: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#111827', marginBottom: 10 },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
