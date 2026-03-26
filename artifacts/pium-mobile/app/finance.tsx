import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, RefreshControl, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
}

const INCOME_CATS = ['용돈', '알바', '장학금', '기타 수입'];
const EXPENSE_CATS = ['식비', '교통비', '문화/여가', '학용품', '통신비', '의류', '의료/건강', '기타 지출'];
const CAT_ICONS: Record<string, string> = {
  '식비': 'coffee', '교통비': 'navigation', '문화/여가': 'music', '학용품': 'book',
  '통신비': 'smartphone', '의류': 'package', '의료/건강': 'heart', '기타 지출': 'more-horizontal',
  '용돈': 'dollar-sign', '알바': 'briefcase', '장학금': 'award', '기타 수입': 'plus-circle',
};

type ViewMode = 'list' | 'chart';

function fmt(n: number) {
  return n.toLocaleString();
}

function relDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function FinanceScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('식비');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchTx = useCallback(async () => {
    try {
      const r = await fetch(`${API}/finances?month=${selectedMonth}`);
      if (r.ok) setTransactions(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [selectedMonth]);

  useEffect(() => { setLoading(true); fetchTx(); }, [fetchTx]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTx();
    setRefreshing(false);
  }, [fetchTx]);

  const addTx = async () => {
    const num = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(num) || num <= 0 || !desc.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: txType, amount: num, category, description: desc.trim(), date }),
      });
      if (r.ok) {
        const tx = await r.json();
        setTransactions(prev => [tx, ...prev]);
        setAmount(''); setDesc(''); setCategory('식비'); setDate(new Date().toISOString().split('T')[0]);
        setShowAdd(false);
      }
    } catch { Alert.alert('오류', '추가 실패'); }
    finally { setSubmitting(false); }
  };

  const deleteTx = (id: number) => {
    Alert.alert('삭제', '이 항목을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await fetch(`${API}/finances/${id}`, { method: 'DELETE' });
        setTransactions(prev => prev.filter(t => t.id !== id));
      }},
    ]);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Category breakdown
  const expenseByCategory = EXPENSE_CATS.map(cat => ({
    cat,
    total: transactions.filter(t => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // Months for selector (current + 2 past)
  const getMonths = () => {
    const months = [];
    const now = new Date();
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  };

  // Group by date
  const grouped = transactions.reduce((acc, t) => {
    const key = t.date || t.createdAt?.split('T')[0] || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const cats = txType === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>가계부</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Feather name="plus" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Month selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthContainer}>
        {getMonths().map(m => (
          <TouchableOpacity key={m} style={[styles.monthChip, selectedMonth === m && styles.monthChipActive]} onPress={() => setSelectedMonth(m)}>
            <Text style={[styles.monthChipText, selectedMonth === m && styles.monthChipTextActive]}>
              {m.replace('-', '년 ').replace(/^(\d+)년 0?/, '$1년 ')}월
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.balanceSection}>
                <Text style={styles.balanceLabel}>잔액</Text>
                <Text style={[styles.balanceValue, { color: balance >= 0 ? '#059669' : '#DC2626' }]}>
                  {balance >= 0 ? '+' : ''}{fmt(balance)}원
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconWrap}>
                    <Feather name="arrow-down-circle" size={16} color="#059669" />
                  </View>
                  <View>
                    <Text style={styles.summaryItemLabel}>수입</Text>
                    <Text style={styles.summaryItemValue}>{fmt(totalIncome)}원</Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryIconWrap, { backgroundColor: '#FEF2F2' }]}>
                    <Feather name="arrow-up-circle" size={16} color="#DC2626" />
                  </View>
                  <View>
                    <Text style={styles.summaryItemLabel}>지출</Text>
                    <Text style={[styles.summaryItemValue, { color: '#DC2626' }]}>{fmt(totalExpense)}원</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Category breakdown */}
            {expenseByCategory.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>지출 카테고리</Text>
                {expenseByCategory.slice(0, 5).map(({ cat, total }) => {
                  const pct = totalExpense > 0 ? (total / totalExpense) * 100 : 0;
                  return (
                    <View key={cat} style={styles.catItem}>
                      <View style={styles.catIcon}>
                        <Feather name={(CAT_ICONS[cat] || 'circle') as any} size={14} color={C.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.catLabelRow}>
                          <Text style={styles.catLabel}>{cat}</Text>
                          <Text style={styles.catAmount}>{fmt(total)}원</Text>
                        </View>
                        <View style={styles.catBar}>
                          <View style={[styles.catBarFill, { width: `${pct}%` as any }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Transactions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>거래 내역</Text>
              {sortedDates.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="dollar-sign" size={32} color="#D1D5DB" />
                  <Text style={styles.emptyText}>이번 달 거래 내역이 없습니다</Text>
                </View>
              ) : (
                sortedDates.map(dateKey => (
                  <View key={dateKey}>
                    <Text style={styles.dateLabel}>{relDate(dateKey)}</Text>
                    {grouped[dateKey].map(tx => (
                      <TouchableOpacity key={tx.id} style={styles.txRow} onLongPress={() => deleteTx(tx.id)}>
                        <View style={[styles.txIcon, { backgroundColor: tx.type === 'income' ? '#D1FAE5' : '#FEE2E2' }]}>
                          <Feather name={(CAT_ICONS[tx.category] || 'circle') as any} size={16} color={tx.type === 'income' ? '#059669' : '#DC2626'} />
                        </View>
                        <View style={styles.txInfo}>
                          <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                          <Text style={styles.txCategory}>{tx.category}</Text>
                        </View>
                        <Text style={[styles.txAmount, { color: tx.type === 'income' ? '#059669' : '#DC2626' }]}>
                          {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}원
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalSheet, { maxHeight: '85%' }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>거래 추가</Text>
            <View style={styles.typeToggle}>
              {(['expense', 'income'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.typeBtn, txType === t && (t === 'expense' ? styles.typeBtnExpense : styles.typeBtnIncome)]} onPress={() => { setTxType(t); setCategory(t === 'expense' ? '식비' : '용돈'); }}>
                  <Text style={[styles.typeBtnText, txType === t && styles.typeBtnTextActive]}>{t === 'expense' ? '지출' : '수입'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="금액 (원)" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
            <TextInput style={styles.input} value={desc} onChangeText={setDesc} placeholder="내용" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="날짜 (YYYY-MM-DD)" placeholderTextColor="#9CA3AF" />
            <Text style={styles.inputLabel}>카테고리</Text>
            <View style={styles.catGrid}>
              {cats.map(cat => (
                <TouchableOpacity key={cat} style={[styles.catChip, category === cat && styles.catChipActive]} onPress={() => setCategory(cat)}>
                  <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.btn, (!amount || !desc.trim()) && styles.btnDisabled]} onPress={addTx} disabled={!amount || !desc.trim() || submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>추가하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  monthScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  monthContainer: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  monthChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  monthChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  monthChipTextActive: { color: C.primary },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  balanceSection: { marginBottom: 16 },
  balanceLabel: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  balanceValue: { fontSize: 32, fontFamily: 'Inter_700Bold', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 16 },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#F3F4F6' },
  summaryItemLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  summaryItemValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 12 },
  catItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  catIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#374151' },
  catAmount: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#374151' },
  catBar: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3 },
  catBarFill: { height: '100%', backgroundColor: C.primary, borderRadius: 3 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  dateLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#9CA3AF', marginTop: 12, marginBottom: 6 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  txIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827' },
  txCategory: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  txAmount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 16 },
  typeToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 14 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: '#FEE2E2' },
  typeBtnIncome: { backgroundColor: '#D1FAE5' },
  typeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  typeBtnTextActive: { color: '#111827' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular', marginBottom: 10 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280', marginBottom: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  catChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  catChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  catChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
  btn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
});
