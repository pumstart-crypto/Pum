import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useApiUrl, useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  authorName: string;
  views: number;
  likes: number;
  createdAt: string;
}

interface Comment {
  id: number;
  content: string;
  authorName: string;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiUrl = useApiUrl();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);

  const fetchPost = async () => {
    try {
      const [postRes, commentRes] = await Promise.all([
        fetch(`${apiUrl}/community/${id}`),
        fetch(`${apiUrl}/community/${id}/comments`),
      ]);
      if (postRes.ok) setPost(await postRes.ok ? await postRes.json() : null);
      if (commentRes.ok) setComments(await commentRes.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchPost(); }, [id]);

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/community/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: comment,
          authorName: user?.name || user?.username || "익명",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [...prev, created]);
        setComment("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}
    setSubmitting(false);
  };

  const handleLike = async () => {
    if (liked) return;
    try {
      await fetch(`${apiUrl}/community/${id}/like`, { method: "POST" });
      setLiked(true);
      setPost((prev) => prev ? { ...prev, likes: (prev.likes || 0) + 1 } : prev);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.background }}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>;
  }

  if (!post) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.background }}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: C.textSecondary }}>게시글을 찾을 수 없습니다.</Text>
    </View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={
          <>
            {/* Post */}
            <View style={styles.postSection}>
              <View style={styles.catRow}>
                <View style={styles.catBadge}>
                  <Text style={styles.catText}>{post.category}</Text>
                </View>
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <View style={styles.postMeta}>
                <Text style={styles.metaText}>{post.authorName}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{timeAgo(post.createdAt)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Feather name="eye" size={12} color={C.textTertiary} />
                <Text style={styles.metaText}>{post.views}</Text>
              </View>
              <Text style={styles.postContent}>{post.content}</Text>
              <View style={styles.postActions}>
                <Pressable style={styles.likeBtn} onPress={handleLike}>
                  <Feather name="heart" size={18} color={liked ? "#EF4444" : C.textSecondary} />
                  <Text style={[styles.likeCount, liked && { color: "#EF4444" }]}>
                    {post.likes || 0}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Comment header */}
            <View style={styles.commentHeader}>
              <Text style={styles.commentCount}>댓글 {comments.length}개</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.commentCard}>
            <View style={styles.commentAvatar}>
              <Text style={styles.commentAvatarText}>{item.authorName[0]}</Text>
            </View>
            <View style={styles.commentBody}>
              <View style={styles.commentMeta}>
                <Text style={styles.commentAuthor}>{item.authorName}</Text>
                <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.commentContent}>{item.content}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.noComments}>
            <Text style={styles.noCommentsText}>첫 댓글을 달아보세요</Text>
          </View>
        }
      />

      {/* Comment Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.commentInput}
          placeholder="댓글을 입력하세요"
          placeholderTextColor={C.textTertiary}
          value={comment}
          onChangeText={setComment}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: comment.trim() ? C.primary : C.border }]}
          onPress={handleSubmitComment}
          disabled={submitting || !comment.trim()}
        >
          <Feather name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  postSection: { backgroundColor: C.surface, padding: 20, marginBottom: 8 },
  catRow: { marginBottom: 8 },
  catBadge: { alignSelf: "flex-start", backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.primary },
  postTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, lineHeight: 28, marginBottom: 10 },
  postMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  metaDot: { color: C.textTertiary, fontSize: 13 },
  postContent: { fontFamily: "Inter_400Regular", fontSize: 16, color: C.text, lineHeight: 26 },
  postActions: { flexDirection: "row", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: C.border },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  commentHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  commentCount: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  commentCard: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: C.surface, borderTopWidth: 0.5, borderColor: C.borderLight },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.primary },
  commentBody: { flex: 1 },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  commentAuthor: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  commentTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  commentContent: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, lineHeight: 20 },
  noComments: { padding: 24, alignItems: "center" },
  noCommentsText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textTertiary },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderTopWidth: 1, borderColor: C.border, backgroundColor: "#fff" },
  commentInput: { flex: 1, backgroundColor: C.surfaceSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 15, color: C.text, maxHeight: 100, borderWidth: 1, borderColor: C.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
