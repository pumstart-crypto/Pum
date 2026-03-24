import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Star, MapPin, Phone, MessageSquare, BadgePercent, PenSquare, Trash2, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { 
  useGetRestaurant, 
  useGetRestaurantReviews, 
  useCreateReview,
  useDeleteReview,
  type Review
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function RestaurantDetailPage() {
  const [, params] = useRoute("/restaurants/:id");
  const id = parseInt(params?.id || "0", 10);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const { data: restaurant, isLoading: resLoading } = useGetRestaurant(id);
  const { data: reviews = [], isLoading: revLoading } = useGetRestaurantReviews(id);

  if (resLoading) return <Layout><div className="flex justify-center pt-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></Layout>;
  if (!restaurant) return <Layout><div className="p-8 text-center text-muted-foreground">맛집 정보를 찾을 수 없습니다.</div></Layout>;

  return (
    <Layout>
      {/* Header Image & Back Button */}
      <div className="relative h-72 bg-muted">
        {restaurant.imageUrl ? (
           <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
        ) : (
           <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
             <UtensilsCrossed className="w-16 h-16 text-primary/40" />
           </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        <Link href="/restaurants" className="absolute top-6 left-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>

        {restaurant.isAffiliated && (
          <div className="absolute top-6 right-4 bg-accent/90 backdrop-blur-md text-white font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center">
            <BadgePercent className="w-4 h-4 mr-1" />
            학생회 제휴 업체
          </div>
        )}

        <div className="absolute bottom-6 left-6 right-6 text-white">
          <span className="bg-primary/90 text-xs font-bold px-2 py-1 rounded-lg mb-2 inline-block backdrop-blur-md">
            {restaurant.category}
          </span>
          <h1 className="text-3xl font-bold font-display">{restaurant.name}</h1>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-6 bg-card rounded-t-3xl -mt-6 relative z-10 space-y-6">
        <div className="flex divide-x divide-border/50 bg-secondary/50 rounded-2xl p-4">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="flex items-center text-yellow-500 mb-1">
              <Star className="w-5 h-5 fill-current mr-1" />
              <span className="text-xl font-bold text-foreground">{restaurant.averageRating.toFixed(1)}</span>
            </div>
            <span className="text-xs text-muted-foreground">리뷰 {restaurant.reviewCount}개</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary mb-1" />
            <span className="text-sm font-bold text-foreground">소통 활발</span>
          </div>
        </div>

        <div className="space-y-4">
          {restaurant.address && (
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-muted-foreground mr-3 shrink-0 mt-0.5" />
              <span className="text-sm font-medium leading-relaxed">{restaurant.address}</span>
            </div>
          )}
          {restaurant.phone && (
            <div className="flex items-center">
              <Phone className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
              <span className="text-sm font-medium">{restaurant.phone}</span>
            </div>
          )}
          {restaurant.description && (
            <p className="text-sm text-muted-foreground bg-secondary/30 p-4 rounded-2xl leading-relaxed">
              {restaurant.description}
            </p>
          )}
          {restaurant.discountInfo && restaurant.isAffiliated && (
            <div className="bg-accent/10 border border-accent/20 p-4 rounded-2xl">
              <h4 className="font-bold text-accent mb-1 flex items-center">
                <BadgePercent className="w-4 h-4 mr-1" /> 제휴 혜택
              </h4>
              <p className="text-sm text-accent/90">{restaurant.discountInfo}</p>
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* Reviews */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">생생한 후기</h3>
            <button 
              onClick={() => setIsReviewOpen(true)}
              className="text-sm font-bold text-primary flex items-center bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors"
            >
              <PenSquare className="w-4 h-4 mr-1.5" /> 작성하기
            </button>
          </div>

          {revLoading ? (
            <div className="py-8 text-center text-muted-foreground">불러오는 중...</div>
          ) : reviews.length === 0 ? (
            <div className="py-12 bg-secondary/30 rounded-2xl text-center text-muted-foreground flex flex-col items-center">
              <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
              첫 번째 후기를 남겨주세요!
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <ReviewItem key={review.id} review={review} restaurantId={id} />
              ))}
            </div>
          )}
        </div>
      </div>

      {isReviewOpen && <AddReviewDialog restaurantId={id} onClose={() => setIsReviewOpen(false)} />}
    </Layout>
  );
}

function ReviewItem({ review, restaurantId }: { review: Review, restaurantId: number }) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/restaurant/${restaurantId}/review`] });
        queryClient.invalidateQueries({ queryKey: [`/api/restaurant/${restaurantId}`] });
      }
    }
  });

  return (
    <div className="bg-white border border-border rounded-2xl p-4 shadow-sm group">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-bold text-sm mb-0.5">{review.nickname}</div>
          <div className="flex text-yellow-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn("w-3.5 h-3.5", i < review.rating ? "fill-current" : "text-muted opacity-30")} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            {new Date(review.createdAt).toLocaleDateString('ko-KR')}
          </span>
          <button 
            onClick={() => deleteMutation.mutate({ id: review.id })}
            disabled={deleteMutation.isPending}
            className="text-muted-foreground/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed mt-3 whitespace-pre-wrap">{review.content}</p>
    </div>
  );
}

function AddReviewDialog({ restaurantId, onClose }: { restaurantId: number, onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nickname: "",
    rating: 5,
    content: "",
  });

  const createMutation = useCreateReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/restaurant/${restaurantId}/review`] });
        queryClient.invalidateQueries({ queryKey: [`/api/restaurant/${restaurantId}`] });
        onClose();
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      restaurantId,
      data: formData
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">후기 작성</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex justify-center mb-2">
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: i + 1 })}
                  className="focus:outline-none hover:scale-110 transition-transform"
                >
                  <Star className={cn("w-10 h-10", i < formData.rating ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-muted fill-muted")} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">닉네임 *</label>
            <input 
              required
              value={formData.nickname}
              onChange={e => setFormData({ ...formData, nickname: e.target.value })}
              className="w-full bg-secondary/50 focus:bg-white focus:border-primary border border-transparent px-4 py-3 rounded-xl transition-all outline-none" 
              placeholder="익명" 
            />
          </div>

          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">내용 *</label>
            <textarea 
              required rows={4}
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              className="w-full bg-secondary/50 focus:bg-white focus:border-primary border border-transparent px-4 py-3 rounded-xl transition-all outline-none resize-none" 
              placeholder="음식의 맛, 분위기, 서비스 등 경험을 솔직하게 남겨주세요." 
            />
          </div>

          <button 
            type="submit"
            disabled={createMutation.isPending || !formData.content || !formData.nickname}
            className="w-full mt-2 bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
          >
            {createMutation.isPending ? "등록 중..." : "리뷰 등록하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

import { UtensilsCrossed } from "lucide-react"; // Import inside component block for fallback icon
