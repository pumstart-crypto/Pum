import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, ActivityIndicator,
  Platform, Alert, Pressable, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import C from '@/constants/colors';
import { FIXED_COMMUNITIES, FIXED_IDS, filterPostsByCategory, type Post } from './(tabs)/board';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';
const WRITE_CATEGORIES = ['중고거래', '홍보', '분실물', '학교 생활'];

const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  '중고거래':  { bg: '#EBF3FA', text: C.primary },
  '홍보':     { bg: '#EBF3FA', text: C.primary },
  '분실물':   { bg: '#FEF3C7', text: '#B45309' },
  '습득물':   { bg: '#D1FAE5', text: '#065F46' },
  '학교 생활': { bg: '#EBF3FA', text: C.primary },
  '기타':     { bg: '#F3F4F6', text: '#6B7280' },
};

const IDENTITY_STYLE = {
  anon: { avatarBg: '#C5D3E3', avatarText: '#1B3A5C' },
  dept: { avatarBg: '#9FE1CB', avatarText: '#0A4D3A' },
  year: { avatarBg: '#CECBF6', avatarText: '#3C3489' },
} as const;
type IdentityType = keyof typeof IDENTITY_STYLE;
interface Profile { department?: string; studentId?: string | number; }

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

function parseAuthor(author: string) {
  if (!author || author === '익명') return { type: 'anon' as IdentityType, label: '익명', avatarText: '익' };
  const parts = author.split('.');
  if (parts.length >= 3 && parts[2]?.endsWith('학번')) {
    const yr = parts[2]; const dept = parts[1] ?? '';
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

/* ── Avatar ── */
function Avatar({ text, type, size = 36 }: { text: string; type: IdentityType; size?: number }) {
  const s = IDENTITY_STYLE[type];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: s.avatarBg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: s.avatarText, fontSize: size * 0.29, fontFamily: 'Inter_700Bold' }} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/* ── Image Picker Helper ── */
async function pickImages(max: number): Promise<string[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    quality: 0.6,
    base64: true,
  });
  if (result.canceled) return [];
  return result.assets
    .filter(a => a.base64)
    .map(a => `data:image/jpeg;base64,${a.base64}`);
}

/* ── Post Card ── */
function PostCard({ post, isDeptBoard }: { post: Post; isDeptBoard: boolean }) {
  const [liked, setLiked] = useState(false);
  const [likeCount] = useState(Math.floor(Math.random() * 30));
  const [saved, setSaved] = useState(false);
  const isTrade = post.category === '중고거래';
  const isLost = post.category === '분실물';
  const hasImage = (post.images?.length ?? 0) > 0;
  const showImageLayout = (isTrade || isLost) && hasImage;
  const { type, label, avatarText } = parseAuthor(post.author);
  const badgeStyle = CAT_BADGE[post.category] ?? { bg: '#F3F4F6', text: '#6B7280' };

  const lostSubBadge = isLost && post.subCategory
    ? (CAT_BADGE[post.subCategory] ?? { bg: '#F3F4F6', text: '#6B7280' })
    : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <Avatar text={avatarText} type={type} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.authorLabel}>{label}</Text>
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

      {showImageLayout ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 2 }}>
          <Image source={{ uri: post.images![0] }} style={styles.thumbnailImage} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
            {isTrade && post.subCategory && <Text style={styles.tradePrice}>{post.subCategory}</Text>}
            <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' }} numberOfLines={1}>{post.content}</Text>
          </View>
        </View>
      ) : isTrade ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 2 }}>
          <View style={styles.tradeImageBox}>
            <Ionicons name="cube-outline" size={26} color="#C4C9D4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
            {post.subCategory && <Text style={styles.tradePrice}>{post.subCategory}</Text>}
            <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' }} numberOfLines={1}>{post.content}</Text>
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

/* ── Write Sheet ── */
function WriteSheet({
  visible, onClose, onSubmit, profile, defaultCategory,
}: {
  visible: boolean; onClose: () => void;
  onSubmit: (data: { title: string; content: string; category: string; subCategory: string; author: string; images?: string[] }) => Promise<void>;
  profile: Profile; defaultCategory: string;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [identity, setIdentity] = useState<IdentityType>('anon');
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [lostType, setLostType] = useState<'분실물' | '습득물'>('분실물');

  const isTrade = category === '중고거래';
  const isLost = category === '분실물';
  const showImagePicker = isTrade || isLost;

  useEffect(() => {
    if (visible) { setCategory(defaultCategory); setImages([]); setLostType('분실물'); }
  }, [visible, defaultCategory]);

  const hasDept = !!profile.department;
  const hasYear = hasDept && !!profile.studentId;
  const identityOptions: { type: IdentityType; label: string; sub: string }[] = [
    { type: 'anon', label: '익명', sub: '비공개' },
    ...(hasDept ? [{ type: 'dept' as IdentityType, label: profile.department!, sub: '학과 표시' }] : []),
    ...(hasYear ? [{ type: 'year' as IdentityType, label: `${String(profile.studentId).substring(2, 4)}학번`, sub: '학번 표시' }] : []),
  ];

  const canSubmit = title.trim() && content.trim() && !submitting;

  const handlePickImages = async () => {
    const max = isLost ? 3 : 5;
    const remaining = max - images.length;
    if (remaining <= 0) { Alert.alert('사진 제한', `최대 ${max}장까지 첨부 가능합니다.`); return; }
    const picked = await pickImages(remaining);
    setImages(prev => [...prev, ...picked].slice(0, max));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const subCat = isTrade ? price.trim() : isLost ? lostType : '';
    await onSubmit({
      title: title.trim(), content: content.trim(), category,
      subCategory: subCat,
      author: buildAuthor(identity, profile),
      images: images.length > 0 ? images : undefined,
    });
    setTitle(''); setContent(''); setPrice(''); setIdentity('anon'); setImages([]); setLostType('분실물');
    setSubmitting(false);
    onClose();
  };

  const catList = FIXED_IDS.includes(defaultCategory) ? [defaultCategory] : WRITE_CATEGORIES;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheetContent, { paddingBottom: (isWeb ? 16 : insets.bottom) + 16 }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.sheetTitle}>글 작성</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color="#9CA3AF" /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* 작성자 */}
            <Text style={styles.fieldLabel}>작성자 표시</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {identityOptions.map(opt => {
                const sel = identity === opt.type;
                const s = IDENTITY_STYLE[opt.type];
                return (
                  <TouchableOpacity key={opt.type} style={[styles.identityCard, sel && styles.identityCardSel]} onPress={() => setIdentity(opt.type)} activeOpacity={0.8}>
                    <View style={[styles.identityAvatar, { backgroundColor: s.avatarBg }]}>
                      <Text style={[styles.identityAvatarText, { color: s.avatarText }]}>{opt.type === 'anon' ? '익' : opt.label.slice(0, 2)}</Text>
                    </View>
                    <Text style={[styles.identityLabel, sel && { color: C.primary }]} numberOfLines={1}>{opt.label}</Text>
                    <Text style={styles.identitySub}>{opt.sub}</Text>
                    {sel && <View style={{ position: 'absolute', top: 6, right: 6 }}><Ionicons name="checkmark-circle" size={14} color={C.primary} /></View>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 카테고리 */}
            {catList.length > 1 && (
              <>
                <Text style={styles.fieldLabel}>카테고리</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {catList.map(cat => (
                      <TouchableOpacity key={cat} style={[styles.catChip, category === cat && styles.catChipSel]} onPress={() => setCategory(cat)}>
                        <Text style={[styles.catChipText, category === cat && { color: C.primary }]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* 분실물/습득물 토글 */}
            {isLost && (
              <>
                <Text style={styles.fieldLabel}>유형</Text>
                <View style={styles.lostTypeRow}>
                  {(['분실물', '습득물'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.lostTypeBtn, lostType === t && (t === '분실물' ? styles.lostTypeBtnLost : styles.lostTypeBtnFound)]}
                      onPress={() => setLostType(t)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={t === '분실물' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                        size={16}
                        color={lostType === t ? (t === '분실물' ? '#B45309' : '#065F46') : '#9CA3AF'}
                      />
                      <Text style={[styles.lostTypeBtnText, lostType === t && { color: t === '분실물' ? '#B45309' : '#065F46', fontFamily: 'Inter_700Bold' }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* 입력 필드 */}
            <TextInput
              style={styles.inputField}
              value={title}
              onChangeText={setTitle}
              placeholder={isTrade ? '물품 이름' : isLost ? (lostType === '분실물' ? '분실물 이름 (예: 에어팟 프로)' : '습득한 물건') : '제목'}
              placeholderTextColor="#9CA3AF"
            />
            {isTrade && (
              <TextInput style={styles.inputField} value={price} onChangeText={setPrice} placeholder="가격 (예: 12,000원)" placeholderTextColor="#9CA3AF" />
            )}
            <TextInput
              style={[styles.inputField, { height: 100 }]}
              value={content}
              onChangeText={setContent}
              placeholder={
                isTrade ? '거래 장소 및 상태 설명' :
                isLost && lostType === '분실물' ? '분실 시각, 장소, 특징 등을 적어주세요' :
                isLost ? '습득 장소, 물건 특징 등을 적어주세요' :
                '내용을 입력하세요'
              }
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />

            {/* 사진 첨부 (중고거래 / 분실물) */}
            {showImagePicker && (
              <>
                <Text style={styles.fieldLabel}>사진 첨부 <Text style={{ fontFamily: 'Inter_400Regular', color: '#9CA3AF', textTransform: 'none', fontSize: 11 }}>(선택, 최대 {isLost ? 3 : 5}장)</Text></Text>
                <View style={styles.imageRow}>
                  {images.map((uri, i) => (
                    <View key={i} style={styles.imageThumbnailWrap}>
                      <Image source={{ uri }} style={styles.imageThumbnail} />
                      <TouchableOpacity
                        style={styles.imageRemoveBtn}
                        onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Ionicons name="close-circle" size={18} color="#374151" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {images.length < (isLost ? 3 : 5) && (
                    <TouchableOpacity style={styles.imageAddBtn} onPress={handlePickImages} activeOpacity={0.8}>
                      <Ionicons name="camera-outline" size={22} color="#9CA3AF" />
                      <Text style={styles.imageAddText}>{images.length}/{isLost ? 3 : 5}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity style={[styles.submitBtn, !canSubmit && { opacity: 0.4 }]} onPress={handleSubmit} disabled={!canSubmit}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>게시하기</Text>}
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
  const { token } = useAuth();

  const isDeptBoard = !FIXED_IDS.includes(category);
  const isLostBoard = category === '분실물';
  const fixed = FIXED_COMMUNITIES.find(c => c.id === category);
  const communityColor = C.primary;
  const communityBg = '#EBF3FA';
  const communityIcon = fixed ? fixed.icon : 'school-outline';
  const defaultWriteCategory = FIXED_IDS.includes(category) ? category : '중고거래';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [page, setPage] = useState(1);
  const [lostTab, setLostTab] = useState<LostTab>('전체');

  useEffect(() => {
    AsyncStorage.getItem('campus_life_profile').then(raw => {
      if (raw) { try { setProfile(JSON.parse(raw)); } catch {} }
    });
  }, []);

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

  const handleSubmit = async (data: { title: string; content: string; category: string; subCategory: string; author: string; images?: string[] }) => {
    if (!token) { Alert.alert('오류', '로그인 후 이용할 수 있습니다.'); return; }
    try {
      const r = await fetch(`${API}/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const newPost = await r.json();
        setPosts(prev => [newPost, ...prev]);
      } else { Alert.alert('오류', '게시글 작성에 실패했습니다.'); }
    } catch { Alert.alert('오류', '게시글 작성에 실패했습니다.'); }
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
        <View style={{ flex: 1 }} />
        <Text style={styles.postCount}>{posts.length}개</Text>
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
        onPress={() => setShowWrite(true)}
        activeOpacity={0.9}
      >
        <Feather name="edit-2" size={20} color="#fff" />
      </TouchableOpacity>

      <WriteSheet
        visible={showWrite}
        onClose={() => setShowWrite(false)}
        onSubmit={handleSubmit}
        profile={profile}
        defaultCategory={defaultWriteCategory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'flex-start' },
  headerIconWrap: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  detailHeaderTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827' },
  postCount: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  // 분실물 탭 바
  lostTabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
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
  authorLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
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

  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#6B7280', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },

  identityCard: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', position: 'relative' },
  identityCardSel: { borderColor: C.primary, backgroundColor: '#EEF4FF' },
  identityAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  identityAvatarText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  identityLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#374151', textAlign: 'center' },
  identitySub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center', marginTop: 2 },

  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  catChipSel: { borderColor: C.primary, backgroundColor: '#EEF4FF' },
  catChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },

  // 분실물 유형 토글
  lostTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  lostTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  lostTypeBtnLost: { borderColor: '#B45309', backgroundColor: '#FEF3C7' },
  lostTypeBtnFound: { borderColor: '#065F46', backgroundColor: '#D1FAE5' },
  lostTypeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },

  // 이미지 첨부
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  imageThumbnailWrap: { position: 'relative' },
  imageThumbnail: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F3F4F6' },
  imageRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 9 },
  imageAddBtn: { width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', gap: 4 },
  imageAddText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  inputField: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#111827', marginBottom: 10 },
  submitBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
