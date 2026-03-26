import { Layout } from "@/components/Layout";

export function CampusMapPage() {
  return (
    <Layout hideTopBar>
      <div className="pb-32">
        <div className="px-5 pt-14 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1.5">부산대학교</p>
          <h2
            className="text-4xl font-extrabold text-foreground leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
          >
            캠퍼스 지도
          </h2>
        </div>

        <div className="mx-5 rounded-3xl bg-white border border-border/20 shadow-sm flex flex-col items-center justify-center py-20 gap-4">
          <span className="material-symbols-outlined text-6xl text-muted-foreground/20">map</span>
          <p className="text-sm font-semibold text-muted-foreground/50">캠퍼스 지도</p>
          <p className="text-xs text-muted-foreground/30">준비 중입니다</p>
        </div>
      </div>
    </Layout>
  );
}
