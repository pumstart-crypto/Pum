import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
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
  subCategory?: string | null;
  author: string;
  views: number;
  createdAt: string;
  images?: string[] | null;
  userId?: number | null;
}

interface Comment {
  id: number;
  content: string;
  author: string;
  createdAt: string;
  postId: number;
  userId?: number | null;
}

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
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isWeb = Platform.OS === 'web';
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageViewIdx, setImageViewIdx] = useState<number | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      const [pr, cr] = await Promise.all([
        fetch(`${API}/community/${id}`),
        fetch(`${API}/community/${id}/comments`),
      ]);
      if (pr.ok) {
        const p: Post = await pr.json();
        setPost(p);
        setLikeCount(Math.floor(Math.random() * 30));
      }
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
    if (!token) return;
    Alert.alert('삭제', '댓글을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        const r = await fetch(`${API}/community/${id}/comments/${cid}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
        });
        if (r.ok) setComments(prev => prev.filter(c => c.id !== cid));
        else Alert.alert('오류', '삭제 권한이 없습니다.');
      }},
    ]);
  };

  const confirmDelete = async () => {
    if (!token || !post) return;
    setShowDeleteModal(false);
    const r = await fetch(`${API}/community/${post.id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
    });
    if (r.ok) {
      router.back();
    } else {
      Alert.alert('오류', '삭제에 실패했습니다.');
    }
  };

  const handleEdit = () => {
    if (!post) return;
    router.push({
      pathname: '/community-write',
      params: {
        postId: String(post.id),
        category: post.category,
        label: post.category,
        existingTitle: post.title,
        existingContent: post.content,
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingRoot, { paddingTop: isWeb ? 67 : insets.top }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.loadingRoot, { paddingTop: isWeb ? 67 : insets.top }]}>
        <Text style={styles.notFound}>게시글을 찾을 수 없습니다</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = user?.id != null && post.userId === user.id;
  const images = post.images ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: isWeb ? 67 : insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={isWeb ? 0 : insets.top}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{post.title}</Text>
        {isOwner ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity onPress={handleEdit} style={styles.ownerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="edit-2" size={17} color={C.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={styles.ownerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={17} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 80 : 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Post card */}
        <View style={styles.postCard}>
          <View style={styles.postMeta}>
            <View style={styles.catBadge}>
              <Text style={styles.catText}>{post.category}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={styles.metaTime}>{relTime(post.createdAt)}</Text>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <View style={styles.authorRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person-outline" size={13} color="#9CA3AF" />
            </View>
            <Text style={styles.authorText}>{post.author}</Text>
            <Feather name="eye" size={11} color="#C4C9D4" style={{ marginLeft: 8 }} />
            <Text style={styles.metaSmall}>{post.views}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.postContent}>{post.content}</Text>

          {/* 이미지 */}
          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map((uri, i) => (
                <TouchableOpacity key={i} onPress={() => setImageViewIdx(i)} activeOpacity={0.9}>
                  <Image source={{ uri }} style={[styles.postImage, images.length === 1 && styles.postImageFull]} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 공감 / 스크랩 */}
          <View style={styles.reactionRow}>
            <TouchableOpacity
              style={[styles.reactionBtn, liked && styles.reactionBtnActive]}
              onPress={() => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }}
              activeOpacity={0.8}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#E24B4A' : '#6B7280'} />
              <Text style={[styles.reactionText, liked && { color: '#E24B4A' }]}>공감 {likeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reactionBtn, saved && styles.reactionBtnSaved]}
              onPress={() => setSaved(s => !s)}
              activeOpacity={0.8}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? C.primary : '#6B7280'} />
              <Text style={[styles.reactionText, saved && { color: C.primary }]}>스크랩</Text>
            </TouchableOpacity>
          </View>
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
                  <View style={styles.commentAvatarCircle}>
                    <Ionicons name="person-outline" size={10} color="#9CA3AF" />
                  </View>
                  <Text style={styles.commentAuthor}>{c.author}</Text>
                  <Text style={styles.commentTime}>{relTime(c.createdAt)}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => deleteComment(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="trash-2" size={12} color="#D1D5DB" />
                  </TouchableOpacity>
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

      {/* 삭제 확인 모달 */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>게시글 삭제</Text>
            <Text style={styles.modalMsg}>이 게시글을 삭제하시겠습니까?{'\n'}삭제 후 복구할 수 없습니다.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 이미지 전체화면 모달 */}
      <Modal visible={imageViewIdx !== null} transparent animationType="fade" onRequestClose={() => setImageViewIdx(null)}>
        <TouchableOpacity style={styles.imageOverlay} activeOpacity={1} onPress={() => setImageViewIdx(null)}>
          {imageViewIdx !== null && (
            <Image source={{ uri: images[imageViewIdx] }} style={styles.imageFullscreen} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.imageCloseBtn} onPress={() => setImageViewIdx(null)}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  ownerActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  ownerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  content: { paddingHorizontal: 14, paddingTop: 12 },

  postCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  postMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  catBadge: { backgroundColor: '#EBF3FA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary },
  metaTime: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  postTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', lineHeight: 28, marginBottom: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  avatarCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  authorText: { fontSize: 13, color: '#4B5563', fontFamily: 'Inter_500Medium' },
  metaSmall: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 14 },
  postContent: { fontSize: 15, color: '#374151', lineHeight: 24, fontFamily: 'Inter_400Regular', marginBottom: 4 },

  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  postImage: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#F3F4F6' },
  postImageFull: { width: '100%', height: 220, borderRadius: 14 },

  reactionRow: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB' },
  reactionBtnActive: { backgroundColor: '#FFF0F0', borderColor: '#FECACA' },
  reactionBtnSaved: { backgroundColor: '#EEF4FF', borderColor: '#BFDBFE' },
  reactionText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },

  commentsSection: { marginBottom: 16 },
  commentTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 10 },
  emptyComments: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyCommentsText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  commentCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  commentAvatarCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  commentAuthor: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#374151' },
  commentTime: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  commentContent: { fontSize: 14, color: '#374151', lineHeight: 20, fontFamily: 'Inter_400Regular', paddingLeft: 26 },

  commentInputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  commentInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular', maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalBox: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center' },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 10 },
  modalMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#4B5563', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  modalDelete: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center' },
  modalDeleteText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#EF4444' },

  imageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  imageFullscreen: { width: '100%', height: '80%' },
  imageCloseBtn: { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
});
