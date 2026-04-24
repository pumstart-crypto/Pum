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
  icon: string;
  label: string;
  title: string;
  steps?: { icon: string; title: string; desc: string }[];
  notices?: { icon: string; color: string; bg: string; text: string }[];
  tips?: { icon: string; text: string }[];
  faqs?: { q: string; a: string }[];
}

const ARTICLES: Article[] = [
  {
    id: 'library-seat',
    icon: 'book-open',
    label: '도서관 좌석',
    title: '도서관 좌석 불러오기',
    steps: [
      {
        icon: 'map',
        title: '도서관 열람실 화면 열기',
        desc: '홈 화면에서 도서관 아이콘을 탭하거나 메뉴를 통해 도서관 열람실 화면으로 이동합니다.',
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
        desc: '로그인 후 예약 내역 페이지로 이동하면 앱이 자동으로 내 좌석 정보(열람실·좌석 번호·이용 시간)를 감지해 화면에 표시합니다. 별도 동작은 필요 없습니다.',
      },
    ],
    notices: [
      {
        icon: 'shield',
        color: '#059669',
        bg: '#F0FDF4',
        text: '도서관 웹사이트 로그인 시 입력하는 학번과 비밀번호는 P:um 앱 서버 및 기기 어디에도 저장되지 않습니다. 로그인은 부산대학교 도서관 서버에서 직접 처리되며, P:um은 로그인 완료 후 공개되는 좌석 예약 정보만 읽어옵니다.',
      },
    ],
    tips: [
      { icon: 'clock', text: '좌석 정보는 기기에 로컬로 저장되며, 이용 종료 전까지 앱을 재시작해도 유지됩니다.' },
      { icon: 'zap', text: '이용 종료 2시간 전부터 연장 버튼이 활성화됩니다. 탭하면 도서관 사이트의 연장 페이지로 바로 이동합니다.' },
      { icon: 'wifi-off', text: '\'내 자리 불러오기\'는 부산대 도서관 사이트에 직접 접속하므로 인터넷 연결이 필요합니다.' },
    ],
    faqs: [
      {
        q: '내 자리가 있는데 불러오기가 안 돼요.',
        a: '앱 내부 브라우저에서 도서관 사이트에 로그인한 뒤, 내 도서관 → 좌석 예약 내역 페이지로 직접 이동해 보세요. 페이지가 완전히 로드되면 자동으로 캡처됩니다.',
      },
      {
        q: '임시배정 상태는 무엇인가요?',
        a: '좌석 배정 후 일정 시간(약 15분) 안에 실제 착석 확인이 이루어지는 대기 상태입니다. 시간이 지나면 자동 반납됩니다.',
      },
      {
        q: '이용 종료 후에도 내 자리 카드가 남아 있어요.',
        a: '새로고침 버튼을 탭하거나 앱을 재시작하면 사라집니다. 앱은 30초마다 남은 시간을 갱신합니다.',
      },
    ],
  },
];

// ── FAQ 아이템 ───────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={toggle}>
      <View style={faqSt.row}>
        <View style={faqSt.qBadge}><Text style={faqSt.qBadgeText}>Q</Text></View>
        <Text style={faqSt.qText}>{q}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
      </View>
      {open && (
        <View style={faqSt.aWrap}>
          <View style={faqSt.aBadge}><Text style={faqSt.aBadgeText}>A</Text></View>
          <Text style={faqSt.aText}>{a}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── 아티클 본문 ──────────────────────────────────────────────
function ArticleBody({ article }: { article: Article }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={st.articleContent}
    >
      {/* 사용 방법 */}
      {article.steps && (
        <View style={st.block}>
          <Text style={st.blockTitle}>사용 방법</Text>
          {article.steps.map((step, i) => (
            <View key={i} style={st.stepRow}>
              <View style={st.stepNumWrap}>
                <Text style={st.stepNum}>{i + 1}</Text>
              </View>
              <View style={[st.stepIconWrap, { backgroundColor: `${C.primary}15` }]}>
                <Feather name={step.icon as any} size={15} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.stepTitle}>{step.title}</Text>
                <Text style={st.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 보안/안내 공지 */}
      {article.notices?.map((n, i) => (
        <View key={i} style={[st.noticeCard, { backgroundColor: n.bg, borderColor: n.color + '30' }]}>
          <Feather name={n.icon as any} size={16} color={n.color} style={{ marginTop: 1, flexShrink: 0 }} />
          <Text style={[st.noticeText, { color: n.color.replace('059669', '065F46').replace('2563EB', '1E3A8A') }]}>
            {n.text}
          </Text>
        </View>
      ))}

      {/* 알아두면 좋아요 */}
      {article.tips && (
        <View style={st.block}>
          <Text style={st.blockTitle}>알아두면 좋아요</Text>
          <View style={st.tipsCard}>
            {article.tips.map((tip, i) => (
              <View key={i} style={[st.tipRow, i < article.tips!.length - 1 && st.tipBorder]}>
                <Feather name={tip.icon as any} size={15} color={C.primary} style={{ marginTop: 1 }} />
                <Text style={st.tipText}>{tip.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* FAQ */}
      {article.faqs && (
        <View style={st.block}>
          <Text style={st.blockTitle}>자주 묻는 질문</Text>
          <View style={st.faqCard}>
            {article.faqs.map((faq, i) => (
              <View key={i} style={i < article.faqs!.length - 1 && st.faqBorder}>
                <FaqItem q={faq.q} a={faq.a} />
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── 메인 화면 ────────────────────────────────────────────────
export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [selectedId, setSelectedId] = useState(ARTICLES[0].id);

  const activeArticle = ARTICLES.find(a => a.id === selectedId) ?? ARTICLES[0];

  return (
    <View style={[st.root, { paddingTop: topPad }]}>
      {/* 헤더 */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>도움말 & FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 탭 카드 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.tabRow}
      >
        {ARTICLES.map(article => {
          const active = article.id === selectedId;
          return (
            <TouchableOpacity
              key={article.id}
              style={[st.tabCard, active && st.tabCardActive]}
              onPress={() => setSelectedId(article.id)}
              activeOpacity={0.75}
            >
              <View style={[st.tabIconWrap, { backgroundColor: active ? '#fff3' : `${C.primary}12` }]}>
                <Feather name={article.icon as any} size={18} color={active ? '#fff' : C.primary} />
              </View>
              <Text style={[st.tabLabel, active && st.tabLabelActive]}>{article.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 아티클 제목 */}
      <View style={st.titleBar}>
        <Text style={st.articleTitle}>{activeArticle.title}</Text>
      </View>

      {/* 본문 */}
      <ArticleBody article={activeArticle} />
    </View>
  );
}

// ── 스타일 ───────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },

  tabRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  tabCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  tabCardActive: {
    backgroundColor: C.primary, borderColor: C.primary,
    shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  tabIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  tabLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  tabLabelActive: { color: '#fff' },

  titleBar: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  articleTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' },

  articleContent: { paddingHorizontal: 16 },

  block: { marginBottom: 22 },
  blockTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  stepNumWrap: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 5,
  },
  stepNum: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#fff' },
  stepIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827', marginBottom: 3 },
  stepDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20 },

  noticeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 22,
  },
  noticeText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },

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
});

const faqSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  qBadge: {
    width: 22, height: 22, borderRadius: 6, backgroundColor: `${C.primary}15`,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  qBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary },
  qText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 20 },
  aWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  aBadge: {
    width: 22, height: 22, borderRadius: 6, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1,
  },
  aBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#6B7280' },
  aText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20 },
});
