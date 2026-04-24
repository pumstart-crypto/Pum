import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, ActivityIndicator,
  Platform, Pressable, FlatList, SectionList,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';
const TAB_ORDER_KEY = 'pium_community_tab_order';

/* ── 커뮤니티 정의 ── */
export const FIXED_COMMUNITIES = [
  { id: '중고거래',  label: '중고거래',  icon: 'swap-horizontal-outline', color: C.primary, bg: '#EBF3FA' },
  { id: '홍보',     label: '홍보',     icon: 'megaphone-outline',        color: C.primary, bg: '#EBF3FA' },
  { id: '분실물',   label: '분실물',   icon: 'search-outline',           color: C.primary, bg: '#EBF3FA' },
  { id: '학교 생활', label: '학교 생활', icon: 'leaf-outline',             color: C.primary, bg: '#EBF3FA' },
] as const;
export const FIXED_IDS = FIXED_COMMUNITIES.map(c => c.id) as string[];
const DEFAULT_ORDER = FIXED_IDS as unknown as string[];

/* ── 타입 ── */
export interface Post {
  id: number;
  category: string;
  subCategory: string | null;
  title: string;
  content: string;
  author: string;
  views: number;
  commentCount?: number;
  createdAt: string;
}

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return day < 7 ? `${day}일 전` : new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function filterPostsByCategory(posts: Post[], categoryId: string): Post[] {
  if (FIXED_IDS.includes(categoryId)) return posts.filter(p => p.category === categoryId);
  return posts.filter(p => p.author.includes(categoryId));
}

/* ── Dept Browser Modal ── */
interface DeptItem { name: string; college: string; }
function buildSections(depts: DeptItem[]) {
  const map = new Map<string, DeptItem[]>();
  for (const d of depts) {
    if (!map.has(d.college)) map.set(d.college, []);
    map.get(d.college)!.push(d);
  }
  return [...map.entries()].map(([title, data]) => ({ title, data }));
}

function DeptBrowserModal({
  visible, onClose, pinnedDepts, onPin, onUnpin, onView,
}: {
  visible: boolean; onClose: () => void;
  pinnedDepts: string[];
  onPin: (d: string) => void; onUnpin: (d: string) => void; onView: (d: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [depts, setDepts] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const sectionListRef = useRef<SectionList>(null);
  const pinnedSet = new Set(pinnedDepts);

  useEffect(() => {
    if (!visible) return;
    setLoading(true); setQ('');
    fetch(`${API}/community/depts`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setDepts(data.depts ?? []))
      .catch(() => setDepts([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const isSearching = !!q.trim();
  const filtered = isSearching ? depts.filter(d => d.name.includes(q.trim()) || d.college.includes(q.trim())) : [];
  const sections = React.useMemo(() => buildSections(depts), [depts]);

  const renderItem = (item: DeptItem) => {
    const isPinned = pinnedSet.has(item.name);
    return (
      <TouchableOpacity
        key={item.name}
        style={styles.deptItem}
        onPress={() => { onView(item.name); onClose(); }}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.deptItemName, isPinned && { color: C.primary, fontFamily: 'Inter_600SemiBold' }]}>{item.name}</Text>
          {isPinned && <Text style={[styles.deptPinnedLabel, { color: C.primary }]}>추가됨</Text>}
        </View>
        <TouchableOpacity onPress={() => isPinned ? onUnpin(item.name) : onPin(item.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isPinned ? 'star' : 'star-outline'} size={20} color={isPinned ? C.primary : '#D1D5DB'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: (isWeb ? 16 : insets.bottom) + 12 }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <View>
              <Text style={styles.sheetTitle}>학과 게시판 추가</Text>
              <Text style={styles.sheetSub}>별표를 눌러 커뮤니티에 추가하세요</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color="#9CA3AF" /></TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Feather name="search" size={14} color="#9CA3AF" />
            <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="학과 검색..." placeholderTextColor="#9CA3AF" />
            {!!q && <TouchableOpacity onPress={() => setQ('')}><Feather name="x" size={13} color="#9CA3AF" /></TouchableOpacity>}
          </View>
          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
          ) : isSearching ? (
            <FlatList
              data={filtered}
              keyExtractor={item => item.name}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              renderItem={({ item }) => renderItem(item)}
              ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 32 }}><Text style={{ color: '#9CA3AF', fontSize: 14, fontFamily: 'Inter_400Regular' }}>검색 결과가 없습니다</Text></View>}
            />
          ) : (
            <SectionList
              ref={sectionListRef}
              sections={sections}
              keyExtractor={item => item.name}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              stickySectionHeadersEnabled
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item }) => renderItem(item)}
              ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 32 }}><Text style={{ color: '#9CA3AF', fontSize: 14, fontFamily: 'Inter_400Regular' }}>학과 목록이 없습니다</Text></View>}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Reorder Modal ── */
function ReorderModal({
  visible, onClose, communityOrder, onSave,
}: {
  visible: boolean; onClose: () => void;
  communityOrder: string[];
  onSave: (order: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setLocal([...communityOrder]);
  }, [visible, communityOrder]);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...local];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setLocal(next);
  };

  const handleSave = () => { onSave(local); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: (isWeb ? 16 : insets.bottom) + 16 }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <View>
              <Text style={styles.sheetTitle}>게시판 순서 변경</Text>
              <Text style={styles.sheetSub}>위아래 버튼으로 순서를 조정하세요</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color="#9CA3AF" /></TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {local.map((id, i) => {
              const fixed = FIXED_COMMUNITIES.find(c => c.id === id);
              const label = fixed ? fixed.label : id;
              const icon = fixed ? fixed.icon : 'school-outline';
              return (
                <View key={id} style={styles.reorderRow}>
                  <View style={[styles.reorderIcon, { backgroundColor: '#EBF3FA' }]}>
                    <Ionicons name={icon as any} size={13} color={C.primary} />
                  </View>
                  <Text style={styles.reorderLabel} numberOfLines={1}>{label}</Text>
                  <View style={styles.reorderActions}>
                    <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0} style={[styles.reorderArrow, i === 0 && { opacity: 0.2 }]} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="chevron-up" size={18} color="#374151" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => move(i, 1)} disabled={i === local.length - 1} style={[styles.reorderArrow, i === local.length - 1 && { opacity: 0.2 }]} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="chevron-down" size={18} color="#374151" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>저장</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Community Card ── */
function CommunityCard({
  id, label, icon, posts, onRemove,
}: {
  id: string; label: string; icon: string;
  posts: Post[]; onRemove?: () => void;
}) {
  const isDept = !FIXED_IDS.includes(id);
  const recent = posts.slice(0, 5);

  const goDetail = () => {
    router.push({ pathname: '/community-detail', params: { category: id, label } });
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={goDetail} activeOpacity={0.7}>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon as any} size={14} color={C.primary} />
        </View>
        <Text style={styles.cardTitle}>{label}</Text>
        {isDept && onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <View style={styles.enterBtn}>
          <Text style={styles.enterBtnText}>전체보기</Text>
          <Ionicons name="chevron-forward" size={14} color={C.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.cardDivider} />

      {recent.length === 0 ? (
        <View style={styles.cardEmpty}>
          <Text style={styles.cardEmptyText}>아직 게시글이 없어요</Text>
        </View>
      ) : (
        recent.map((post, idx) => (
          <TouchableOpacity
            key={post.id}
            style={[styles.postRow, idx < recent.length - 1 && styles.postRowBorder]}
            onPress={goDetail}
            activeOpacity={0.6}
          >
            <Text style={styles.postRowTitle} numberOfLines={1}>{post.title}</Text>
            <Text style={styles.postRowTime}>{relTime(post.createdAt)}</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

/* ── Dept Section (하단 토글) ── */
function DeptSection({
  deptCommunities, onRemove, onOpenBrowser,
}: {
  deptCommunities: string[];
  onRemove: (dept: string) => void;
  onOpenBrowser: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.deptSection}>
      <TouchableOpacity style={styles.deptSectionToggle} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="school-outline" size={14} color={C.primary} />
        </View>
        <Text style={styles.deptSectionTitle}>학과 게시판</Text>
        <View style={{ flex: 1 }} />
        {deptCommunities.length > 0 && (
          <View style={styles.deptCountBadge}>
            <Text style={styles.deptCountText}>{deptCommunities.length}</Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#9CA3AF"
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.deptSectionBody}>
          {deptCommunities.length === 0 ? (
            <Text style={styles.deptSectionEmpty}>추가된 학과 게시판이 없습니다</Text>
          ) : (
            deptCommunities.map(dept => (
              <View key={dept} style={styles.deptRow}>
                <Ionicons name="school-outline" size={13} color={C.primary} style={{ marginRight: 8 }} />
                <Text style={styles.deptRowName} numberOfLines={1}>{dept}</Text>
                <TouchableOpacity onPress={() => onRemove(dept)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.deptAddBtn} onPress={onOpenBrowser} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={styles.deptAddBtnText}>학과 검색 후 추가</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ══════════════════════════════
   Main Screen
══════════════════════════════ */
export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeptBrowser, setShowDeptBrowser] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [communityOrder, setCommunityOrder] = useState<string[]>([...DEFAULT_ORDER]);

  const deptCommunities = communityOrder.filter(id => !FIXED_IDS.includes(id));

  useEffect(() => {
    AsyncStorage.getItem(TAB_ORDER_KEY).then(raw => {
      if (!raw) return;
      try {
        const saved: string[] = JSON.parse(raw);
        const migrated = saved
          .filter(t => t !== '수업Q&A' && t !== '내 학과' && t !== '전체')
          .map(t => t === '동아리' ? '홍보' : t === '꿀팁' ? '학교 생활' : t);
        const finalOrder = [
          ...DEFAULT_ORDER,
          ...migrated.filter(t => !FIXED_IDS.includes(t)),
        ];
        setCommunityOrder(finalOrder);
      } catch {}
    });
  }, []);

  const saveOrder = useCallback((order: string[]) => {
    setCommunityOrder(order);
    AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order));
  }, []);

  const addDept = useCallback((dept: string) => {
    setCommunityOrder(prev => {
      if (prev.includes(dept)) return prev;
      const next = [...prev, dept];
      AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeDept = useCallback((dept: string) => {
    setCommunityOrder(prev => {
      const next = prev.filter(d => d !== dept);
      AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/community?limit=200`);
      if (r.ok) {
        const data = await r.json();
        setPosts(Array.isArray(data) ? data : (data.posts ?? []));
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { setLoading(true); fetchPosts(); }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>부산대학교</Text>
          <Text style={styles.headerTitle}>커뮤니티</Text>
        </View>
        <TouchableOpacity style={styles.reorderBtn} onPress={() => setShowReorder(true)} activeOpacity={0.8}>
          <Ionicons name="reorder-three-outline" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.feed, { paddingBottom: isWeb ? 40 : insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
        ) : (
          <>
            {communityOrder.map(id => {
              const fixed = FIXED_COMMUNITIES.find(c => c.id === id);
              if (!fixed && !deptCommunities.includes(id)) return null;
              const label = fixed ? fixed.label : id;
              const icon = fixed ? fixed.icon : 'school-outline';
              const communityPosts = filterPostsByCategory(posts, id);
              return (
                <CommunityCard
                  key={id}
                  id={id}
                  label={label}
                  icon={icon}
                  posts={communityPosts}
                />
              );
            })}

            {/* 하단 학과 게시판 토글 */}
            <DeptSection
              deptCommunities={deptCommunities}
              onRemove={removeDept}
              onOpenBrowser={() => setShowDeptBrowser(true)}
            />
          </>
        )}
      </ScrollView>

      <DeptBrowserModal
        visible={showDeptBrowser}
        onClose={() => setShowDeptBrowser(false)}
        pinnedDepts={deptCommunities}
        onPin={addDept}
        onUnpin={removeDept}
        onView={(dept) => {
          if (!communityOrder.includes(dept)) addDept(dept);
          router.push({ pathname: '/community-detail', params: { category: dept, label: dept } });
        }}
      />

      <ReorderModal
        visible={showReorder}
        onClose={() => setShowReorder(false)}
        communityOrder={communityOrder}
        onSave={saveOrder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, backgroundColor: '#F5F7FA', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  headerLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  headerTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -1, lineHeight: 42 },
  reorderBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },

  feed: { paddingHorizontal: 14, paddingTop: 14, gap: 12 },

  card: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  cardIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EBF3FA', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' },
  removeBtn: { marginLeft: 4, padding: 2 },
  enterBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: '#EEF4FF' },
  enterBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },

  cardDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  postRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 8 },
  postRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  postRowTitle: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#374151' },
  postRowTime: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', flexShrink: 0 },
  cardEmpty: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
  cardEmptyText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  // Dept Section
  deptSection: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  deptSectionToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  deptSectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' },
  deptCountBadge: { backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  deptCountText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#fff' },
  deptSectionBody: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10, gap: 2 },
  deptSectionEmpty: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular', paddingVertical: 10, textAlign: 'center' },
  deptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  deptRowName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#374151' },
  deptAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', backgroundColor: '#F8FBFF' },
  deptAddBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },

  // Reorder Modal
  reorderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  reorderIcon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  reorderLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: '#111827' },
  reorderActions: { flexDirection: 'row', gap: 4 },
  reorderArrow: { padding: 4 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Dept Browser Modal
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, height: '88%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' },
  sheetSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular' },
  deptItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  deptItemName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#111827' },
  deptPinnedLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 4, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionHeaderText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1 },
});
