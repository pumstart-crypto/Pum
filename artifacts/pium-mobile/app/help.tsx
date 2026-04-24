import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, LayoutAnimation, UIManager,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── 데이터 ───────────────────────────────────────────────────
interface Article {
  id: string;
  category: string;
  title: string;
  steps?: { icon: string; title: string; desc: string }[];
  tips?: { icon: string; text: string }[];
  faqs?: { q: string; a: string }[];
}

const ARTICLES: Article[] = [
  {
    id: 'library-seat',
    category: '도서관',
    title: '도서관 좌석 불러오기',
    steps: [
      {
        icon: 'map',
        title: '도서관 열람실 화면 열기',
        desc: '홈 화면에서 도서관 아이콘을 탭하거나, 메뉴를 통해 도서관 열람실 화면으로 이동합니다.',
      },
      {
        icon: 'refresh-cw',
        title: '실시간 좌석 현황 확인',
        desc: '새벽벌·미리내·나노생명·의생명 도서관의 열람실별 잔여 좌석을 실시간으로 확인할 수 있습니다. 각 카드를 탭하면 해당 열람실 예약 페이지로 이동합니다.',
      },
      {
        icon: 'download',
        title: '\'내 자리 불러오기\' 버튼 탭',
        desc: '상단의 \'내 자리 불러오기\' 버튼을 탭하면 부산대학교 도서관 웹사이트가 앱 내부 브라우저로 열립니다.',
      },
      {
        icon: 'log-in',
        title: '도서관 웹사이트 로그인',
        desc: '부산대학교 통합 포털(SSO) 계정으로 도서관 웹사이트에 로그인합니다. P:um 계정이 아닌 부산대학교 학생 포털 계정을 사용해야 합니다.',
      },
      {
        icon: 'check-circle',
        title: '좌석 정보 자동 캡처',
        desc: '로그인 후 예약 내역 페이지로 이동하면 앱이 자동으로 내 좌석 정보(열람실·좌석 번호·이용 시간)를 감지해 화면에 표시합니다. 별도의 추가 동작은 필요 없습니다.',
      },
    ],
    tips: [
      { icon: 'clock', text: '좌석 정보는 앱에 로컬로 저장되며, 다음번 앱 실행 시에도 이용 종료 전까지 유지됩니다.' },
      { icon: 'zap', text: '이용 종료 2시간 전부터 연장 버튼이 활성화됩니다. 연장 버튼을 탭하면 도서관 사이트의 연장 페이지로 바로 이동합니다.' },
      { icon: 'wifi-off', text: '\'내 자리 불러오기\'는 부산대학교 도서관 사이트에 실제로 접속하므로 인터넷 연결이 필요합니다.' },
      { icon: 'smartphone', text: 'P:um 앱 계정(학번 인증)과 도서관 포털 계정은 별개입니다. 도서관 웹사이트 로그인 정보는 앱에 저장되지 않습니다.' },
    ],
    faqs: [
      {
        q: '내 자리가 있는데 불러오기가 안 돼요.',
        a: '앱 내부 브라우저에서 도서관 사이트에 로그인한 뒤, 예약 내역 페이지(내 도서관 → 좌석 예약 내역)로 직접 이동해 보세요. 페이지가 완전히 로드되면 자동으로 캡처됩니다.',
      },
      {
        q: '임시배정 상태는 무엇인가요?',
        a: '도서관에서 좌석 배정 후 일정 시간(약 15분) 안에 실제 착석 확인이 이루어지는 대기 상태입니다. 임시배정 시간이 지나면 자동으로 반납됩니다.',
      },
      {
        q: '이용 종료 후에도 내 자리 카드가 남아있어요.',
        a: '\'새로고침\' 버튼을 탭하거나 앱을 재시작하면 자동으로 사라집니다. 앱은 30초마다 남은 시간을 갱신합니다.',
      },
    ],
  },
];

const CATEGORIES = ['전체', ...Array.from(new Set(ARTICLES.map(a => a.category)))];

// ── 컴포넌트 ─────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={toggle}>
      <View style={faqStyles.row}>
        <View style={faqStyles.qBadge}><Text style={faqStyles.qBadgeText}>Q</Text></View>
        <Text style={faqStyles.qText}>{q}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
      </View>
      {open && (
        <View style={faqStyles.aWrap}>
          <View style={faqStyles.aBadge}><Text style={faqStyles.aBadgeText}>A</Text></View>
          <Text style={faqStyles.aText}>{a}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <View style={styles.articleCard}>
      {/* 카테고리 & 제목 */}
      <View style={styles.articleHeader}>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{article.category}</Text>
        </View>
        <Text style={styles.articleTitle}>{article.title}</Text>
      </View>

      {/* 단계별 설명 */}
      {article.steps && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>사용 방법</Text>
          {article.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={[styles.stepIconWrap, { backgroundColor: `${C.primary}15` }]}>
                <Feather name={step.icon as any} size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 팁 */}
      {article.tips && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>알아두면 좋아요</Text>
          <View style={styles.tipsCard}>
            {article.tips.map((tip, i) => (
              <View key={i} style={[styles.tipRow, i < article.tips!.length - 1 && styles.tipBorder]}>
                <Feather name={tip.icon as any} size={15} color={C.primary} style={{ marginTop: 1 }} />
                <Text style={styles.tipText}>{tip.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* FAQ */}
      {article.faqs && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>자주 묻는 질문</Text>
          <View style={styles.faqCard}>
            {article.faqs.map((faq, i) => (
              <View key={i} style={i < article.faqs!.length - 1 && styles.faqBorder}>
                <FaqItem q={faq.q} a={faq.a} />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [selectedCat, setSelectedCat] = useState('전체');

  const filtered = selectedCat === '전체'
    ? ARTICLES
    : ARTICLES.filter(a => a.category === selectedCat);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>도움말 & FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 카테고리 필터 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catBtn, selectedCat === cat && styles.catBtnActive]}
              onPress={() => setSelectedCat(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.catBtnText, selectedCat === cat && styles.catBtnTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 아티클 목록 */}
        {filtered.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="inbox" size={32} color="#D1D5DB" />
            <Text style={styles.emptyText}>해당 카테고리의 도움말이 없습니다.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  catRow: { paddingBottom: 16, gap: 8 },
  catBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  catBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  catBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  catBtnTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  articleCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  articleHeader: { marginBottom: 20 },
  catBadge: {
    alignSelf: 'flex-start', backgroundColor: `${C.primary}15`,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  catBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
  articleTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', lineHeight: 28 },

  block: { marginBottom: 20 },
  blockTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 0 },
  stepNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    marginRight: 0, marginTop: 0, flexShrink: 0,
  },
  stepNum: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' },
  stepLine: { width: 8, flexShrink: 0 },
  stepIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12, flexShrink: 0,
  },
  stepTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827', marginBottom: 4 },
  stepDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20 },

  tipsCard: {
    backgroundColor: '#F8FAFF', borderRadius: 14,
    borderWidth: 1, borderColor: `${C.primary}20`, overflow: 'hidden',
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  tipBorder: { borderBottomWidth: 1, borderBottomColor: `${C.primary}15` },
  tipText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#374151', lineHeight: 20 },

  faqCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden',
  },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
});

const faqStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  qBadge: {
    width: 22, height: 22, borderRadius: 6, backgroundColor: `${C.primary}15`,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  qBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary },
  qText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 20 },
  aWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingBottom: 14, paddingTop: 0,
  },
  aBadge: {
    width: 22, height: 22, borderRadius: 6, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1,
  },
  aBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#6B7280' },
  aText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20 },
});
