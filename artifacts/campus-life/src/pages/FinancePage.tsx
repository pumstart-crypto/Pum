import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subMonths, addMonths } from "date-fns";
import { Plus, X, ArrowUpCircle, ArrowDownCircle, Trash2, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Layout } from "@/components/Layout";
import { 
  useGetFinances, 
  useGetFinanceSummary, 
  useCreateFinance, 
  useDeleteFinance,
  type Finance,
  CreateFinanceRequestType
} from "@workspace/api-client-react";
import { cn, formatCurrency } from "@/lib/utils";

const INCOME_CATEGORIES = ["용돈", "알바", "장학금", "기타"];
const EXPENSE_CATEGORIES = ["식비", "교통비", "학용품", "문화생활", "기타"];

export function FinancePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, "yyyy-MM");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: summary } = useGetFinanceSummary({ month: monthStr });
  const { data: finances = [] } = useGetFinances({ month: monthStr });

  return (
    <Layout>
      {/* Header & Summary */}
      <div className="bg-primary text-primary-foreground pt-12 pb-8 px-6 rounded-b-[2.5rem] shadow-lg relative">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold font-display tracking-wider">
            {format(currentMonth, "yyyy년 MM월")}
          </h1>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center mb-6">
          <p className="text-primary-foreground/80 text-sm font-medium mb-1">총 잔액</p>
          <h2 className="text-5xl font-extrabold tracking-tight">
            {formatCurrency(summary?.balance || 0)}
          </h2>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="flex items-center text-green-300 mb-1">
              <ArrowUpCircle className="w-4 h-4 mr-1" />
              <span className="text-xs font-bold">수입</span>
            </div>
            <p className="font-bold text-lg">{formatCurrency(summary?.totalIncome || 0)}</p>
          </div>
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="flex items-center text-red-300 mb-1">
              <ArrowDownCircle className="w-4 h-4 mr-1" />
              <span className="text-xs font-bold">지출</span>
            </div>
            <p className="font-bold text-lg">{formatCurrency(summary?.totalExpense || 0)}</p>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-foreground">내역</h3>
        </div>

        {finances.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-muted-foreground">
            <Receipt className="w-16 h-16 mb-4 opacity-20" />
            <p>이 달의 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {finances.map((finance) => (
              <FinanceItem key={finance.id} finance={finance} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsAddOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-accent text-white rounded-full shadow-[0_8px_30px_rgba(255,94,98,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <Plus className="w-7 h-7" />
      </button>

      {isAddOpen && <AddFinanceDialog onClose={() => setIsAddOpen(false)} />}
    </Layout>
  );
}

function FinanceItem({ finance }: { finance: Finance }) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteFinance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/finance'] });
        queryClient.invalidateQueries({ queryKey: ['/api/finance/summary'] });
      }
    }
  });

  const isIncome = finance.type === "income";

  return (
    <div className="bg-card p-4 rounded-2xl shadow-sm border border-border flex items-center justify-between group hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          isIncome ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
        )}>
          {isIncome ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
        </div>
        <div>
          <h4 className="font-bold text-foreground text-lg leading-tight">{finance.category}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {finance.date} {finance.description && `• ${finance.description}`}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <span className={cn(
          "font-extrabold text-lg",
          isIncome ? "text-green-600" : "text-foreground"
        )}>
          {isIncome ? "+" : "-"}{formatCurrency(finance.amount)}
        </span>
        <button 
          onClick={() => deleteMutation.mutate({ id: finance.id })}
          disabled={deleteMutation.isPending}
          className="text-muted-foreground hover:text-destructive p-2 rounded-full hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AddFinanceDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [formData, setFormData] = useState({
    amount: "",
    category: EXPENSE_CATEGORIES[0],
    description: "",
    date: format(new Date(), "yyyy-MM-dd")
  });

  const createMutation = useCreateFinance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/finance'] });
        queryClient.invalidateQueries({ queryKey: ['/api/finance/summary'] });
        onClose();
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        type: type as CreateFinanceRequestType,
        amount: parseInt(formData.amount, 10),
        category: formData.category,
        description: formData.description,
        date: formData.date
      }
    });
  };

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">내역 추가</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
          <button
            onClick={() => { setType("expense"); setFormData(prev => ({...prev, category: EXPENSE_CATEGORIES[0]})) }}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold transition-all",
              type === "expense" ? "bg-white text-destructive shadow-sm" : "text-slate-400"
            )}
          >
            지출
          </button>
          <button
            onClick={() => { setType("income"); setFormData(prev => ({...prev, category: INCOME_CATEGORIES[0]})) }}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold transition-all",
              type === "income" ? "bg-white text-green-600 shadow-sm" : "text-slate-400"
            )}
          >
            수입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">금액 *</label>
            <div className="relative">
              <input 
                type="number" required min="1"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-slate-50 focus:bg-white focus:border-primary border border-slate-200 pl-4 pr-10 py-4 text-2xl font-bold rounded-xl transition-all outline-none" 
                placeholder="0" 
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">원</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-2">카테고리 *</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat })}
                  className={cn(
                    "px-4 py-2 rounded-xl font-bold text-sm transition-all border",
                    formData.category === cat 
                      ? (type === "income" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700")
                      : "bg-transparent border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">날짜 *</label>
              <input 
                type="date" required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-50 focus:bg-white focus:border-primary border border-slate-200 px-4 py-3 rounded-xl transition-all outline-none text-sm" 
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">내용</label>
              <input 
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 focus:bg-white focus:border-primary border border-slate-200 px-4 py-3 rounded-xl transition-all outline-none text-sm" 
                placeholder="간단한 메모"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={createMutation.isPending || !formData.amount}
            className="w-full mt-6 bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
          >
            {createMutation.isPending ? "저장 중..." : "저장하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
