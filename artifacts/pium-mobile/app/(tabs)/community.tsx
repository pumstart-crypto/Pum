import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApiUrl, useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

const CATEGORIES = ["전체", "자유게시판", "질문게시판", "정보공유", "거래게시판"];

interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  authorName: string;
  views: number;
  commentsCount: number;
  createdAt: string;
  likes: number;
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

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const apiUrl = useApiUrl();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState("전체");
  const [showWrite, setShowWrite] = useState(false);

  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeCat, setWriteCat] = useState("자유게시판");
  const [writing, setWriting] = useState(false);

  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;
  const bottomPadding = isWeb ? 34 : 100;

  const fetchPosts = async () => {
    try {
      const query = selectedCat !== "전체" ? `?category=${encodeURIComponent(selectedCat)}` : "";
      const res = await fetch(`${apiUrl}/community${query}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || data || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchPosts();
  }, [selectedCat]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleWrite = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) return;
    setWriting(true);
    try {
      const res = await fetch(`${apiUrl}/community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: writeTitle,
          content: writeContent,
          category: writeCat,
          authorName: user?.name || user?.username || "익명",
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowWrite(false);
        setWriteTitle("");
        setWriteContent("");
        fetchPosts();
      }
    } catch {}
    setWriting(false);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <Pressable
      style={({ pressed }) => [styles.postCard, { opacity: pressed ? 0.9 : 1 }]}
      onPress={() => router.push({ pathname: "/community/[id]", params: { id: String(item.id) } })}
    >
      <View style={styles.postTop}>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{item.category}</Text>
        </View>
        <Text style={styles.postTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.postContent} numberOfLines={2}>{item.content}</Text>
      <View style={styles.postFooter}>
        <Text style={styles.postAuthor}>{item.authorName}</Text>
        <View style={styles.postStats}>
          <Feather name="eye" size={12} color={C.textTertiary} />
          <Text style={styles.postStat}>{item.views}</Text>
          <Feather name="message-circle" size={12} color={C.textTertiary} />
          <Text style={styles.postStat}>{item.commentsCount || 0}</Text>
          <Feather name="heart" size={12} color={C.textTertiary} />
          <Text style={styles.postStat}>{item.likes || 0}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={styles.headerTitle}>커뮤니티</Text>
        <Pressable style={styles.writeBtn} onPress={() => setShowWrite(true)}>
          <Feather name="edit-3" size={20} color={C.primary} />
        </Pressable>
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        style={styles.catScroll}
        contentContainerStyle={styles.catList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.catChip, selectedCat === item && { backgroundColor: C.primary }]}
            onPress={() => setSelectedCat(item)}
          >
            <Text style={[styles.catChipText, selectedCat === item && { color: "#fff" }]}>
              {item}
            </Text>
          </Pressable>
        )}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="message-circle" size={40} color={C.textTertiary} />
              <Text style={styles.emptyText}>아직 게시글이 없습니다</Text>
              <Text style={styles.emptySubText}>첫 번째 글을 작성해보세요</Text>
            </View>
          }
        />
      )}

      {/* Write Modal */}
      <Modal visible={showWrite} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowWrite(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowWrite(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Text style={styles.modalTitle}>글 작성</Text>
            <Pressable onPress={handleWrite} disabled={writing}>
              <Text style={[styles.submitText, { color: C.primary }]}>
                {writing ? "등록 중..." : "등록"}
              </Text>
            </Pressable>
          </View>

          {/* Category */}
          <View style={styles.writeCatRow}>
            {CATEGORIES.filter((c) => c !== "전체").map((c) => (
              <Pressable
                key={c}
                style={[styles.writeCatChip, writeCat === c && { backgroundColor: C.primary }]}
                onPress={() => setWriteCat(c)}
              >
                <Text style={[styles.writeCatText, writeCat === c && { color: "#fff" }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.titleInput}
            placeholder="제목을 입력하세요"
            placeholderTextColor={C.textTertiary}
            value={writeTitle}
            onChangeText={setWriteTitle}
            fontFamily="Inter_600SemiBold"
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.contentInput}
            placeholder="내용을 입력하세요..."
            placeholderTextColor={C.textTertiary}
            value={writeContent}
            onChangeText={setWriteContent}
            multiline
            textAlignVertical="top"
            fontFamily="Inter_400Regular"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: C.background,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
  },
  writeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  catScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  catList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  catChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  postCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  postTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  catBadge: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.primary,
  },
  postTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textTertiary,
  },
  postTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  postContent: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postAuthor: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: C.textSecondary,
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postStat: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textTertiary,
    marginRight: 6,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: C.textSecondary,
  },
  emptySubText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textTertiary,
  },
  modal: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.text,
  },
  cancelText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.textSecondary,
  },
  submitText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  writeCatRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  writeCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  writeCatText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  titleInput: {
    fontSize: 20,
    color: C.text,
    paddingVertical: 12,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 12,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: C.text,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
});
