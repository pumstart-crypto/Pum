import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, ActivityIndicator,
  Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const TABS = ['전체', '공지', '질문', '모집', '거래'] as const;
type BoardTab = typeof TABS[number];

interface Post {
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

const CAT_STYLE: Record<string, { bg: string; text: string }> = {
  공지: { bg: '#DBEAFE', text: '#1D4ED8' },
  질문: { bg: '#FEE2E2', text: '#DC2626' },
  모집: { bg: '#D1FAE5', text: '#059669' },
  거래: { bg: '#EDE9FE', text: '#7C3AED' },
};

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

async function getAuthor() {
  try {
    const raw = await AsyncStorage.getItem('campus_life_profile');
    if (!raw) return '익명';
    const p = JSON.parse(raw);
    const parts = ['익명'];
    if (p.department) parts.push(p.department);
    if (p.studentId) parts.push(`${String(p.studentId).substring(2, 4)}학번`);
    return parts.join('.');
  } catch { return '익명'; }
}

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [activeTab, setActiveTab] = useState<BoardTab>('전체');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeCat, setWriteCat] = useState<BoardTab>('질문');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab !== '전체') params.set('category', activeTab);
      params.set('limit', '100');
      const r = await fetch(`${API}/community?${params}`);
      if (r.ok) {
        const data = await r.json();
        setPosts(Array.isArray(data) ? data : (data.posts ?? []));
      }
    } catch {}
    finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { setLoading(true); fetchPosts(); }, [fetchPosts]);
  useEffect(() => { setPage(1); }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const submitPost = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) return;
    setSubmitting(true);
    try {
      const author = await getAuthor();
      const r = await fetch(`${API}/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: writeTitle.trim(), content: writeContent.trim(), category: writeCat, author }),
      });
      if (r.ok) {
        const newPost = await r.json();
        setPosts(prev => [newPost, ...prev]);
        setWriteTitle(''); setWriteContent(''); setWriteCat('질문');
        setShowWrite(false);
      }
    } catch {
      Alert.alert('오류', '게시글 작성에 실패했습니다.');
    } finally { setSubmitting(false); }
  };

  const paged = posts.slice(0, page * PER_PAGE);
  const hasMore = paged.length < posts.length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>커뮤니티</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : posts.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="message-square" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>게시글이 없습니다</Text>
          </View>
        ) : (
          <>
            {paged.map(post => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                onPress={() => router.push(`/post/${post.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.postHeader}>
                  {CAT_STYLE[post.category] ? (
                    <View style={[styles.catBadge, { backgroundColor: CAT_STYLE[post.category].bg }]}>
                      <Text style={[styles.catText, { color: CAT_STYLE[post.category].text }]}>{post.category}</Text>
                    </View>
                  ) : null}
                  {post.subCategory ? (
                    <Text style={styles.subCat}>{post.subCategory}</Text>
                  ) : null}
                </View>
                <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
                <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
                <View style={styles.postMeta}>
                  <Text style={styles.metaText}>{post.author}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{relTime(post.createdAt)}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Feather name="eye" size={12} color="#9CA3AF" />
                  <Text style={styles.metaText}>{post.views}</Text>
                  {(post.commentCount ?? 0) > 0 && (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Feather name="message-circle" size={12} color="#9CA3AF" />
                      <Text style={styles.metaText}>{post.commentCount}</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {hasMore && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setPage(p => p + 1)}>
                <Text style={styles.moreBtnText}>더 보기</Text>
                <Feather name="chevron-down" size={16} color={C.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: isWeb ? 50 : insets.bottom + 90 }]} onPress={() => setShowWrite(true)}>
        <Feather name="edit-2" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Write Modal */}
      <Modal visible={showWrite} transparent animationType="slide" onRequestClose={() => setShowWrite(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>글 작성</Text>
              <TouchableOpacity onPress={() => setShowWrite(false)}>
                <Feather name="x" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>카테고리</Text>
            <View style={styles.catRow}>
              {(['공지', '질문', '모집', '거래'] as BoardTab[]).map(cat => (
                <TouchableOpacity key={cat} style={[styles.catChip, writeCat === cat && styles.catChipActive]} onPress={() => setWriteCat(cat)}>
                  <Text style={[styles.catChipText, writeCat === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.titleInput} value={writeTitle} onChangeText={setWriteTitle} placeholder="제목" placeholderTextColor="#9CA3AF" />
            <TextInput
              style={styles.contentInput}
              value={writeContent}
              onChangeText={setWriteContent}
              placeholder="내용을 입력하세요"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitBtn, (!writeTitle.trim() || !writeContent.trim()) && styles.submitBtnDisabled]}
              onPress={submitPost}
              disabled={!writeTitle.trim() || !writeContent.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>게시하기</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  headerArea: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pageTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#111827', paddingBottom: 12 },
  tabScroll: { marginBottom: -1 },
  tabContainer: { gap: 4, paddingBottom: 0 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.primary },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  tabTextActive: { color: C.primary },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  postCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  subCat: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  postTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#111827', lineHeight: 21 },
  postContent: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginTop: 4, fontFamily: 'Inter_400Regular' },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  metaDot: { color: '#D1D5DB', fontSize: 12 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  moreBtnText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' },
  modalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280', marginBottom: 8 },
  catRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  catChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  catChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  catChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
  titleInput: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular', marginBottom: 10 },
  contentInput: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular', minHeight: 100, marginBottom: 14 },
  submitBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
