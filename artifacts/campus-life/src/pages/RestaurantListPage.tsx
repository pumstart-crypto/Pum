import { useState } from "react";
import { Link } from "wouter";
import { Star, BadgePercent, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useGetRestaurants } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["전체", "한식", "중식", "일식", "양식", "분식", "카페", "기타"];

export function RestaurantListPage() {
  const [category, setCategory] = useState("전체");
  const [affiliated, setAffiliated] = useState(false);

  // When '전체' is selected, don't pass the category parameter
  const params = {
    ...(category !== "전체" && { category }),
    ...(affiliated && { affiliated })
  };

  const { data: restaurants = [], isLoading } = useGetRestaurants(params);

  return (
    <Layout>
      <div className="bg-card pt-10 pb-4 sticky top-0 z-10 border-b border-border shadow-sm">
        <div className="px-6 mb-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground">주변 <span className="text-primary">맛집</span></h1>
        </div>

        {/* Filter Scroll */}
        <div className="px-6 pb-2 overflow-x-auto whitespace-nowrap flex gap-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-5 py-2.5 rounded-full font-bold text-sm transition-all border shrink-0",
                category === cat 
                  ? "bg-foreground text-background border-foreground shadow-md" 
                  : "bg-card text-muted-foreground border-border hover:bg-secondary"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Affiliated Toggle */}
        <div className="px-6 mt-4 flex items-center">
          <label className="flex items-center cursor-pointer group">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={affiliated}
                onChange={(e) => setAffiliated(e.target.checked)}
              />
              <div className={cn(
                "block w-14 h-8 rounded-full transition-colors",
                affiliated ? "bg-accent" : "bg-muted"
              )}></div>
              <div className={cn(
                "dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform",
                affiliated ? "transform translate-x-6" : ""
              )}></div>
            </div>
            <div className="ml-3 font-bold text-sm text-foreground flex items-center gap-1 group-hover:text-accent transition-colors">
              <BadgePercent className="w-4 h-4 text-accent" />
              학생회 제휴 업체만 보기
            </div>
          </label>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-border shadow-sm flex gap-4 animate-pulse">
                <div className="w-24 h-24 bg-muted rounded-2xl shrink-0"></div>
                <div className="flex-1 py-2">
                  <div className="h-5 bg-muted rounded w-1/2 mb-3"></div>
                  <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Search className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium">조건에 맞는 맛집이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {restaurants.map((restaurant) => (
              <Link key={restaurant.id} href={`/restaurants/${restaurant.id}`} className="block">
                <div className="bg-card rounded-3xl p-3 border border-border/80 shadow-sm hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 flex gap-4 group">
                  <div className="w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-muted relative">
                    {restaurant.imageUrl ? (
                      <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">No Image</div>
                    )}
                    {restaurant.isAffiliated && (
                      <div className="absolute top-2 left-2 bg-accent text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center backdrop-blur-sm bg-accent/90">
                        <BadgePercent className="w-3 h-3 mr-0.5" />
                        제휴
                      </div>
                    )}
                  </div>
                  <div className="flex-1 py-2 pr-2">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg leading-tight text-foreground group-hover:text-primary transition-colors">
                        {restaurant.name}
                      </h3>
                      <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-lg">
                        {restaurant.category}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold text-sm">{restaurant.averageRating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({restaurant.reviewCount})</span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {restaurant.description || restaurant.address}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
