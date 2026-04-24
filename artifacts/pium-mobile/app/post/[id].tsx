import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  author: string;
  views: number;
  createdAt: string;
}

interface Comment {
  id: number;
  content: string;
  author: string;
  createdAt: string;
  postId: number;
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
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

async function getAuthor() {
  try {
    const raw = await AsyncStorage.getItem('campus_life_profile');
    if (!raw) return '익명';
    const p = JSON.parse(raw);
    const parts = ['익명'];
    const dept = p.major || p.department;
    if (dept) parts.push(dept);
    if (p.studentId) parts.push(`${String(p.studentId).substring(2, 4)}학번`);
    return parts.join('.');
  } catch { return '익명'; }
}

export default function PostDetailScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isWeb = Platform.OS === 'web';
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      const [pr, cr] = await Promise.all([
        fetch(`${API}/community/${id}`),
        fetch(`${API}/community/${id}/comments`),
      ]);
      if (pr.ok) setPost(await pr.json());
      if (cr.ok) {
        const data = await cr.json();
        setComments(Array.isArray(data) ? data : (data.comments ?? []));
      }
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  const submitComment = async () => {
    if (!commentText.trim()) return;
    if (!token) { Alert.alert('오류', '로그인 후 댓글을 작성할 수 있습니다.'); return; }
    setSubmitting(true);
    try {
      const author = await getAuthor();
      const r = await fetch(`${API}/community/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: commentText.trim(), author }),
      });
      if (r.ok) {
        const newComment = await r.json();
        setComments(prev => [...prev, newComment]);
        setCommentText('');
      } else {
        Alert.alert('오류', '댓글 작성에 실패했습니다.');
      }
    } catch { Alert.alert('오류', '댓글 작성에 실패했습니다.'); }
    finally { setSubmitting(false); }
  };

  const deleteComment = (cid: number) => {
    if (!token) { Alert.alert('오류', '로그인 후 이용할 수 있습니다.'); return; }
    Alert.alert('삭제', '댓글을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        const r = await fetch(`${API}/community/${id}/comments/${cid}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (r.ok) setComments(prev => prev.filter(c => c.id !== cid));
        else Alert.alert('오류', '삭제 권한이 없습니다.');
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.notFound}>게시글을 찾을 수 없습니다</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catStyle = CAT_STYLE[post.category] || { bg: '#F3F4F6', text: '#6B7280' };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: isWeb ? 67 : insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{post.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]} showsVerticalScrollIndicator={false}>
        {/* Post */}
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={[styles.catBadge, { backgroundColor: catStyle.bg }]}>
              <Text style={[styles.catText, { color: catStyle.text }]}>{post.category}</Text>
            </View>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <View style={styles.postMeta}>
            <Text style={styles.metaText}>{post.author}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{relTime(post.createdAt)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Feather name="eye" size={12} color="#9CA3AF" />
            <Text style={styles.metaText}>{post.views}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.postContent}>{post.content}</Text>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentTitle}>댓글 {comments.length}개</Text>
          {comments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Text style={styles.emptyCommentsText}>첫 댓글을 남겨보세요</Text>
            </View>
          ) : (
            comments.map(c => (
              <View key={c.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{c.author}</Text>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentTime}>{relTime(c.createdAt)}</Text>
                    <TouchableOpacity onPress={() => deleteComment(c.id)}>
                      <Feather name="trash-2" size={12} color="#D1D5DB" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.commentContent}>{c.content}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment input */}
      <View style={[styles.commentInputWrap, { paddingBottom: isWeb ? 16 : insets.bottom + 8 }]}>
        <TextInput
          style={styles.commentInput}
          value={commentText}
          onChangeText={setCommentText}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor="#9CA3AF"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
          onPress={submitComment}
          disabled={!commentText.trim() || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: '#F5F7FA' },
  notFound: { fontSize: 16, color: '#6B7280', fontFamily: 'Inter_500Medium' },
  backText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  postCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  postHeader: { marginBottom: 10 },
  catBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  postTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', lineHeight: 28, marginBottom: 8 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  metaText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  metaDot: { color: '#D1D5DB' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  postContent: { fontSize: 15, color: '#374151', lineHeight: 24, fontFamily: 'Inter_400Regular' },
  commentsSection: { marginBottom: 16 },
  commentTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 10 },
  emptyComments: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyCommentsText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  commentCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#374151' },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentTime: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  commentContent: { fontSize: 14, color: '#374151', lineHeight: 20, fontFamily: 'Inter_400Regular' },
  commentInputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  commentInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular', maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
});
