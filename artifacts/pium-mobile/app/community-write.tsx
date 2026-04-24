import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform, Image,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';

interface Profile { department?: string; major?: string; studentId?: string | number; }

function buildAuthor(profile: Profile): string {
  const dept = profile.major || profile.department;
  if (!dept) return '익명';
  const yr = profile.studentId
    ? String(profile.studentId).substring(2, 4) + '학번'
    : '';
  return yr ? `익명.${dept}.${yr}` : `익명.${dept}`;
}

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

export default function CommunityWriteScreen() {
  const { category: initCategory, label, postId, existingTitle, existingContent } =
    useLocalSearchParams<{ category: string; label: string; postId?: string; existingTitle?: string; existingContent?: string }>();
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const { token } = useAuth();

  const isEditing = !!postId;
  const catList = [initCategory];

  const [profile, setProfile] = useState<Profile>({});
  const [category, setCategory] = useState(initCategory);
  const [title, setTitle] = useState(existingTitle ?? '');
  const [content, setContent] = useState(existingContent ?? '');
  const [price, setPrice] = useState('');
  const [lostType, setLostType] = useState<'분실물' | '습득물'>('분실물');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isTrade = category === '중고거래';
  const isLost = category === '분실물';
  const showImagePicker = true;
  const maxImages = isLost ? 3 : 5;

  useEffect(() => {
    AsyncStorage.getItem('campus_life_profile').then(raw => {
      if (raw) { try { setProfile(JSON.parse(raw)); } catch {} }
    });
  }, []);

  const handlePickImages = async () => {
    const remaining = maxImages - images.length;
    if (remaining <= 0) { Alert.alert('사진 제한', `최대 ${maxImages}장까지 첨부 가능합니다.`); return; }
    const picked = await pickImages(remaining);
    setImages(prev => [...prev, ...picked].slice(0, maxImages));
  };

  const canSubmit = title.trim() && content.trim() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!token) { Alert.alert('오류', '로그인 후 이용할 수 있습니다.'); return; }
    setSubmitting(true);
    try {
      let r: Response;
      if (isEditing) {
        r = await fetch(`${API}/community/${postId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: title.trim(), content: content.trim() }),
        });
      } else {
        const subCategory = isTrade ? price.trim() : isLost ? lostType : '';
        const author = buildAuthor(profile);
        const body = {
          category,
          subCategory,
          title: title.trim(),
          content: content.trim(),
          author,
          ...(images.length > 0 ? { images } : {}),
        };
        r = await fetch(`${API}/community`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }
      if (r.ok) {
        router.back();
      } else {
        Alert.alert('오류', isEditing ? '수정에 실패했습니다.' : '게시글 작성에 실패했습니다.');
      }
    } catch {
      Alert.alert('오류', isEditing ? '수정에 실패했습니다.' : '게시글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? '글 수정' : '글 작성'}</Text>
          <TouchableOpacity
            style={[styles.submitHeaderBtn, !canSubmit && { opacity: 0.35 }]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitHeaderBtnText}>{isEditing ? '수정' : '게시'}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.body, { paddingBottom: isWeb ? 40 : insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 카테고리 */}
          {catList.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>카테고리</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {catList.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, category === cat && styles.chipSel]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.chipText, category === cat && styles.chipTextSel]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* 분실물/습득물 유형 */}
          {isLost && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>유형</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['분실물', '습득물'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.lostTypeBtn,
                      lostType === t && (t === '분실물' ? styles.lostTypeBtnLost : styles.lostTypeBtnFound),
                    ]}
                    onPress={() => setLostType(t)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={t === '분실물' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                      size={17}
                      color={lostType === t ? (t === '분실물' ? '#B45309' : '#065F46') : '#9CA3AF'}
                    />
                    <Text style={[
                      styles.lostTypeBtnText,
                      lostType === t && { color: t === '분실물' ? '#B45309' : '#065F46', fontFamily: 'Inter_700Bold' },
                    ]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 제목 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>제목</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={
                isTrade ? '물품 이름을 입력하세요' :
                isLost && lostType === '분실물' ? '분실물 이름 (예: 에어팟 프로)' :
                isLost ? '습득한 물건 이름' :
                '제목을 입력하세요'
              }
              placeholderTextColor="#9CA3AF"
              returnKeyType="next"
            />
          </View>

          {/* 가격 (중고거래) */}
          {isTrade && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>가격</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="가격 (예: 12,000원)"
                placeholderTextColor="#9CA3AF"
                keyboardType="default"
              />
            </View>
          )}

          {/* 내용 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>내용</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={content}
              onChangeText={setContent}
              placeholder={
                isTrade ? '거래 장소 및 물건 상태를 설명해주세요' :
                isLost && lostType === '분실물' ? '분실 시각, 장소, 특징 등을 적어주세요' :
                isLost ? '습득 장소, 물건 특징 등을 적어주세요' :
                '내용을 입력하세요'
              }
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* 사진 첨부 */}
          {showImagePicker && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                사진 첨부{' '}
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#9CA3AF', textTransform: 'none', fontSize: 11 }}>
                  (선택, 최대 {maxImages}장)
                </Text>
              </Text>
              <View style={styles.imageRow}>
                {images.map((uri, i) => (
                  <View key={i} style={styles.imageThumbnailWrap}>
                    <Image source={{ uri }} style={styles.imageThumbnail} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.imageRemoveBtn}
                      onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Ionicons name="close-circle" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < maxImages && (
                  <TouchableOpacity style={styles.imageAddBtn} onPress={handlePickImages} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.imageAddText}>{images.length}/{maxImages}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#F5F7FA',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827' },
  submitHeaderBtn: {
    backgroundColor: C.primary, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
    minWidth: 54, alignItems: 'center',
  },
  submitHeaderBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },

  body: { paddingHorizontal: 16, paddingTop: 8, gap: 4 },

  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: '#6B7280',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8,
  },

  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  chipSel: { borderColor: C.primary, backgroundColor: '#EEF4FF' },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  chipTextSel: { color: C.primary },

  lostTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  lostTypeBtnLost: { borderColor: '#B45309', backgroundColor: '#FEF3C7' },
  lostTypeBtnFound: { borderColor: '#065F46', backgroundColor: '#D1FAE5' },
  lostTypeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },

  input: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: 'Inter_400Regular', color: '#111827',
  },
  contentInput: { height: 160, textAlignVertical: 'top' },

  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageThumbnailWrap: { position: 'relative' },
  imageThumbnail: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F3F4F6' },
  imageRemoveBtn: { position: 'absolute', top: -7, right: -7, backgroundColor: '#fff', borderRadius: 10 },
  imageAddBtn: {
    width: 80, height: 80, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  imageAddText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

});
