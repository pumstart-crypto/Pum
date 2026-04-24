import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Platform, Image, Linking, Alert,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';
import { FIXED_COMMUNITIES, FIXED_IDS, filterPostsByCategory, type Post } from './(tabs)/board';
import { DEPT_LINKS } from '@/constants/deptLinks';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';

const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  '중고거래':  { bg: '#EBF3FA', text: C.primary },
  '홍보':     { bg: '#EBF3FA', text: C.primary },
  '분실물':   { bg: '#FEF3C7', text: '#B45309' },
  '습득물':   { bg: '#D1FAE5', text: '#065F46' },
  '학교 생활': { bg: '#EBF3FA', text: C.primary },
  '기타':     { bg: '#F3F4F6', text: '#6B7280' },
};

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

function parseAuthorDisplay(author: string): { dept: string; year: string } {
  if (!author || author === '익명') return { dept: '', year: '' };

  if (author.startsWith('익명.')) {
    const parts = author.split('.');
    const dept = parts[1] ?? '';
    const year = parts[2]?.endsWith('학번') ? parts[2] : '';
    return { dept, year };
  }

  const spaced = author.split(' ');
  const last = spaced[spaced.length - 1] ?? '';
  if (last.endsWith('학번') && spaced.length >= 2) {
    return { dept: spaced.slice(0, -1).join(' '), year: last };
  }

  const lastWord = spaced[0] ?? '';
  if (['신입생', '대학원생', '교환학생'].includes(lastWord) && spaced.length >= 2) {
    return { dept: spaced.slice(1).join(' '), year: lastWord };
  }

  return { dept: author, year: '' };
}

/* ── Post Card ── */
function PostCard({ post, isDeptBoard }: { post: Post; isDeptBoard: boolean }) {
  const [liked, setLiked] = useState(false);
  const [likeCount] = useState(Math.floor(Math.random() * 30));
  const [saved, setSaved] = useState(false);
  const isTrade = post.category === '중고거래';
  const isLost = post.category === '분실물';
  const hasImage = (post.images?.length ?? 0) > 0;
  const { dept, year } = parseAuthorDisplay(post.author);
  const badgeStyle = CAT_BADGE[post.category] ?? { bg: '#F3F4F6', text: '#6B7280' };

  const lostSubBadge = isLost && post.subCategory
    ? (CAT_BADGE[post.subCategory] ?? { bg: '#F3F4F6', text: '#6B7280' })
    : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {!!dept && <Text style={styles.authorDept}>{dept}</Text>}
            {!!dept && !!year && <Text style={styles.authorDot}>·</Text>}
            {!!year && <Text style={styles.authorYear}>{year}</Text>}
            {isLost && lostSubBadge && post.subCategory && (
              <View style={[styles.catBadge, { backgroundColor: lostSubBadge.bg }]}>
                <Text style={[styles.catBadgeText, { color: lostSubBadge.text }]}>{post.subCategory}</Text>
              </View>
            )}
            <Text style={styles.timeText}>{relTime(post.createdAt)}</Text>
          </View>
          {isDeptBoard && (
            <View style={[styles.catBadge, { backgroundColor: badgeStyle.bg, marginTop: 4 }]}>
              <Text style={[styles.catBadgeText, { color: badgeStyle.text }]}>{post.category}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setSaved(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? C.primary : '#D1D5DB'} />
        </TouchableOpacity>
      </View>

      {(isTrade || isLost) ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 2 }}>
          {hasImage ? (
            <Image source={{ uri: post.images![0] }} style={styles.thumbnailImage} resizeMode="cover" />
          ) : (
            <View style={styles.tradeImageBox}>
              <Ionicons name={isLost ? 'search-outline' : 'cube-outline'} size={26} color="#C4C9D4" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
            {isTrade && post.subCategory && <Text style={styles.tradePrice}>{post.subCategory}</Text>}
            <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' }} numberOfLines={2}>{post.content}</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
          {!!post.content && <Text style={styles.postBody} numberOfLines={2}>{post.content}</Text>}
        </>
      )}

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setLiked(l => !l)}>
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

/* ══════════════════════════════
   Community Detail Screen
══════════════════════════════ */
const PER_PAGE = 20;
type LostTab = '전체' | '분실물' | '습득물';

export default function CommunityDetailScreen() {
  const { category, label } = useLocalSearchParams<{ category: string; label: string }>();
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;

  const isDeptBoard = !FIXED_IDS.includes(category);
  const isLostBoard = category === '분실물';
  const fixed = FIXED_COMMUNITIES.find(c => c.id === category);
  const communityColor = C.primary;
  const communityBg = '#EBF3FA';
  const communityIcon = fixed ? fixed.icon : 'school-outline';
  const defaultWriteCategory = category;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [lostTab, setLostTab] = useState<LostTab>('전체');

  const fetchPosts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/community?limit=200`);
      if (r.ok) {
        const data = await r.json();
        const all: Post[] = Array.isArray(data) ? data : (data.posts ?? []);
        setPosts(filterPostsByCategory(all, category));
      }
    } catch {}
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { setLoading(true); setPage(1); setLostTab('전체'); fetchPosts(); }, [fetchPosts]);

  useFocusEffect(useCallback(() => {
    fetchPosts();
  }, [fetchPosts]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const filteredPosts = isLostBoard && lostTab !== '전체'
    ? posts.filter(p => p.subCategory === lostTab || (!p.subCategory && lostTab === '분실물'))
    : posts;

  const sorted = [...filteredPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const paged = sorted.slice(0, page * PER_PAGE);
  const hasMore = paged.length < sorted.length;

  const lostCount = (tab: LostTab) => {
    if (tab === '전체') return posts.length;
    if (tab === '분실물') return posts.filter(p => !p.subCategory || p.subCategory === '분실물').length;
    return posts.filter(p => p.subCategory === tab).length;
  };

  const deptInfo = isDeptBoard ? DEPT_LINKS[category] : undefined;
  const noticeUrl = deptInfo?.notice ?? null;

  const handleNoticeLink = () => {
    if (!noticeUrl) {
      Alert.alert('안내', '홈페이지가 존재하지 않습니다.');
      return;
    }
    Linking.openURL(noticeUrl).catch(() => Alert.alert('오류', '링크를 열 수 없습니다.'));
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={[styles.headerIconWrap, { backgroundColor: communityBg }]}>
          <Ionicons name={communityIcon as any} size={14} color={communityColor} />
        </View>
        <Text style={styles.detailHeaderTitle}>{label}</Text>
        {isDeptBoard && (
          <TouchableOpacity style={styles.noticeLinkBtn} onPress={handleNoticeLink} activeOpacity={0.75}>
            <Ionicons name="megaphone-outline" size={12} color={noticeUrl ? C.primary : '#9CA3AF'} />
            <Text style={[styles.noticeLinkText, !noticeUrl && { color: '#9CA3AF' }]}>
              {noticeUrl ? '공지사항' : '홈페이지 없음'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 분실물 탭 바 */}
      {isLostBoard && (
        <View style={styles.lostTabBar}>
          {(['전체', '분실물', '습득물'] as LostTab[]).map(tab => {
            const sel = lostTab === tab;
            const badgeCfg = tab === '분실물' ? CAT_BADGE['분실물'] : tab === '습득물' ? CAT_BADGE['습득물'] : null;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.lostTabBtn, sel && styles.lostTabBtnSel]}
                onPress={() => { setLostTab(tab); setPage(1); }}
                activeOpacity={0.8}
              >
                {tab !== '전체' && badgeCfg && (
                  <View style={[styles.lostTabDot, { backgroundColor: badgeCfg.bg, borderColor: badgeCfg.text }]} />
                )}
                <Text style={[styles.lostTabText, sel && styles.lostTabTextSel]}>{tab}</Text>
                <View style={[styles.lostTabCount, sel && styles.lostTabCountSel]}>
                  <Text style={[styles.lostTabCountText, sel && { color: '#fff' }]}>{lostCount(tab)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.feed, { paddingBottom: isWeb ? 40 : insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 48 }} />
        ) : paged.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name={isLostBoard ? 'search-outline' : 'chatbubbles-outline'} size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {isLostBoard && lostTab !== '전체' ? `${lostTab} 게시글이 없어요` : '아직 게시글이 없어요'}
            </Text>
            <Text style={styles.emptySub}>첫 번째 글을 작성해보세요!</Text>
          </View>
        ) : (
          <>
            {paged.map(post => <PostCard key={post.id} post={post} isDeptBoard={isDeptBoard} />)}
            {hasMore && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setPage(p => p + 1)}>
                <Text style={styles.moreBtnText}>더 보기</Text>
                <Ionicons name="chevron-down" size={15} color={C.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: isWeb ? 28 : insets.bottom + 28 }]}
        onPress={() => router.push({ pathname: '/community-write', params: { category: defaultWriteCategory, label } })}
        activeOpacity={0.9}
      >
        <Feather name="edit-2" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F5F7FA', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', gap: 10 },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'flex-start' },
  headerIconWrap: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  detailHeaderTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827' },
  noticeLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EBF3FA' },
  noticeLinkText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
  // 분실물 탭 바
  lostTabBar: { flexDirection: 'row', backgroundColor: '#F5F7FA', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', gap: 8 },
  lostTabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  lostTabBtnSel: { borderColor: C.primary, backgroundColor: '#EEF4FF' },
  lostTabDot: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1 },
  lostTabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  lostTabTextSel: { color: C.primary },
  lostTabCount: { backgroundColor: '#E5E7EB', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 },
  lostTabCountSel: { backgroundColor: C.primary },
  lostTabCountText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#6B7280' },

  feed: { paddingHorizontal: 12, paddingTop: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  moreBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },

  // Post Card
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  authorDept: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  authorDot: { fontSize: 13, color: '#D1D5DB', fontFamily: 'Inter_400Regular' },
  authorYear: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#6B7280' },
  timeText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  catBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  catBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  postTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', lineHeight: 21, marginBottom: 4 },
  postBody: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 19 },
  tradeImageBox: { width: 76, height: 76, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumbnailImage: { width: 76, height: 76, borderRadius: 10, flexShrink: 0, backgroundColor: '#F3F4F6' },
  tradePrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primary, marginBottom: 3 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#B0B7C3' },

  // FAB
  fab: { position: 'absolute', right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
});
