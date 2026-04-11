import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { id: "all", label: "전체", icon: "grid" },
  { id: "dept", label: "내 학과", icon: "school" },
  { id: "qa", label: "수업 Q&A", icon: "help" },
  { id: "trade", label: "중고거래", icon: "swap" },
  { id: "club", label: "동아리", icon: "people" },
  { id: "lost", label: "분실물", icon: "search" },
  { id: "tip", label: "꿀팁", icon: "bulb" },
  { id: "food", label: "맛집", icon: "food" },
];

const IDENTITY_COLORS = {
  anon: { bg: "#E8EDF3", text: "#1B3A5C", avatar: "#C5D3E3" },
  dept: { bg: "#E1F5EE", text: "#0A4D3A", avatar: "#9FE1CB" },
  year: { bg: "#EEEDFE", text: "#3C3489", avatar: "#CECBF6" },
};

const POSTS = [
  {
    id: 1, cat: "dept", identity: "year", identityLabel: "정컴 22학번",
    avatarText: "22", title: "4학년인데 취준 관련 질문 받습니다",
    body: "삼성 SW 역량테스트, 카카오 코테 후기 공유해요. 궁금한 거 편하게 물어보세요.",
    time: "3시간 전", likes: 67, comments: 15, tags: ["멘토링"],
    catLabel: "내 학과",
  },
  {
    id: 2, cat: "qa", identity: "anon", identityLabel: "익명 1",
    avatarText: "익1", title: "중간고사 시험 범위 7장까지 맞나요?",
    body: "교수님이 6장까지라고 하신 것 같은데 조교님은 7장도 포함이라고 하셔서 혼란스럽습니다...",
    time: "1시간 전", likes: 5, comments: 3, tags: ["데이터구조및알고리즘"],
    catLabel: "수업 Q&A", solved: true,
  },
  {
    id: 3, cat: "trade", identity: "dept", identityLabel: "정보컴퓨터공학부",
    avatarText: "정컴", title: "데이터구조 교재 (거의 새것)",
    body: null, time: "30분 전", likes: 2, comments: 4,
    catLabel: "중고거래", price: "12,000원", location: "금정회관 근처",
    tradeImage: true,
  },
  {
    id: 4, cat: "dept", identity: "dept", identityLabel: "정보컴퓨터공학부",
    avatarText: "정컴", title: "알고리즘 스터디 같이 하실 분!",
    body: "주 2회 화·목 저녁 7시, 새벽벌도서관 스터디룸. 백준 골드 이상 목표.",
    time: "5시간 전", likes: 12, comments: 4, tags: ["스터디", "모집"],
    catLabel: "내 학과", recruit: { current: 2, total: 5 },
  },
  {
    id: 5, cat: "tip", identity: "anon", identityLabel: "익명 3",
    avatarText: "익3", title: "부산대 근처 프린트 싸게 하는 곳 정리",
    body: "정문 앞 OO복사 흑백 30원, 컬러 100원. 후문 XX프린트는 양면 50원...",
    time: "어제", likes: 128, comments: 8, tags: ["정보"],
    catLabel: "꿀팁", pinned: true,
  },
  {
    id: 6, cat: "trade", identity: "anon", identityLabel: "익명 7",
    avatarText: "익7", title: "아이패드 에어 5세대 + 애플펜슬 2세대",
    body: null, time: "3시간 전", likes: 8, comments: 12,
    catLabel: "중고거래", price: "450,000원", location: "부산대역 1번 출구",
    tradeImage: true,
  },
  {
    id: 7, cat: "club", identity: "dept", identityLabel: "컴퓨터공학과",
    avatarText: "정컴", title: "코딩 동아리 PULSE 26-1학기 신규 부원 모집",
    body: "웹/앱 개발에 관심 있는 분이면 누구나 환영합니다. 매주 수요일 활동.",
    time: "1일 전", likes: 34, comments: 9, tags: ["동아리", "개발"],
    catLabel: "동아리", recruit: { current: 12, total: 20 },
  },
];

const CatIcon = ({ type, size = 18, color = "currentColor" }) => {
  const icons = {
    grid: <><rect x="2" y="2" width="7" height="7" rx="1.5" fill={color} opacity=".8"/><rect x="11" y="2" width="7" height="7" rx="1.5" fill={color} opacity=".5"/><rect x="2" y="11" width="7" height="7" rx="1.5" fill={color} opacity=".5"/><rect x="11" y="11" width="7" height="7" rx="1.5" fill={color} opacity=".3"/></>,
    school: <><path d="M10 2L2 7l8 5 8-5-8-5z" stroke={color} strokeWidth="1.3" fill="none"/><path d="M5 9v4c0 1.5 2.2 3 5 3s5-1.5 5-3V9" stroke={color} strokeWidth="1.3" fill="none"/></>,
    help: <><circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.3" fill="none"/><path d="M7.5 7.5a2.5 2.5 0 014.5 1.5c0 1.5-2 2-2 3.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none"/><circle cx="10" cy="15" r=".8" fill={color}/></>,
    swap: <><path d="M5 3v14l-3-3M15 17V3l3 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    people: <><circle cx="7" cy="7" r="3" stroke={color} strokeWidth="1.3" fill="none"/><circle cx="14" cy="7" r="2.5" stroke={color} strokeWidth="1.3" fill="none"/><path d="M1 17c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" stroke={color} strokeWidth="1.3" fill="none"/><path d="M13 11.5c2.2 0 4.5 1.5 4.5 4" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round"/></>,
    search: <><circle cx="9" cy="9" r="5.5" stroke={color} strokeWidth="1.3" fill="none"/><path d="M13.5 13.5L18 18" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></>,
    bulb: <><path d="M10 2a5.5 5.5 0 00-2 10.6V15a2 2 0 004 0v-2.4A5.5 5.5 0 0010 2z" stroke={color} strokeWidth="1.3" fill="none"/><path d="M8 16h4M8.5 18h3" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></>,
    food: <><path d="M3 3v6a4 4 0 004 4h0v5" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none"/><path d="M3 7h4" stroke={color} strokeWidth="1.2"/><path d="M15 3c0 3-1.5 5-3 6h0v8.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none"/><path d="M15 3c1 0 2.5 1 2.5 4s-1 3.5-2.5 3.5" stroke={color} strokeWidth="1.3" fill="none"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none">{icons[type]}</svg>;
};

const HeartIcon = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M10 17s-7-4.35-7-8.5A3.5 3.5 0 0110 5.97 3.5 3.5 0 0117 8.5C17 12.65 10 17 10 17z"
      fill={filled ? "#E24B4A" : "none"} stroke={filled ? "#E24B4A" : "currentColor"} strokeWidth="1.3"/>
  </svg>
);

const CommentIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M3 15.5V5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H7l-4 3.5z"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

const BookmarkIcon = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M5 3h10a1 1 0 011 1v14l-5.5-3.5L5 18V4a1 1 0 011-1z"
      fill={filled ? "#185FA5" : "none"} stroke={filled ? "#185FA5" : "currentColor"} strokeWidth="1.3"/>
  </svg>
);

const PostCard = ({ post, style: cardStyle }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);
  const idColor = IDENTITY_COLORS[post.identity];

  const isTrade = post.cat === "trade";

  return (
    <div style={{
      padding: isTrade ? "16px 20px" : "18px 20px",
      borderBottom: "1px solid rgba(0,0,0,0.04)",
      cursor: "pointer",
      transition: "background 0.15s",
      ...cardStyle,
    }}
    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.015)"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: idColor.avatar, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 600, color: idColor.text,
          flexShrink: 0, letterSpacing: "-0.3px",
        }}>
          {post.avatarText}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
              {post.identityLabel}
            </span>
            <span style={{ fontSize: 11, color: "#999" }}>{post.time}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
            <span style={{
              fontSize: 11, padding: "1px 7px", borderRadius: 4,
              background: "rgba(26,58,92,0.07)", color: "#1B3A5C",
              fontWeight: 500,
            }}>
              {post.catLabel}
            </span>
            {post.solved && (
              <span style={{
                fontSize: 11, padding: "1px 7px", borderRadius: 4,
                background: "#E1F5EE", color: "#0A4D3A", fontWeight: 500,
              }}>해결</span>
            )}
            {post.pinned && (
              <span style={{
                fontSize: 11, padding: "1px 7px", borderRadius: 4,
                background: "#FFF3E0", color: "#8D5E0F", fontWeight: 500,
              }}>고정</span>
            )}
          </div>

          {isTrade ? (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{
                width: 80, height: 80, borderRadius: 10,
                background: "linear-gradient(135deg, #f0f2f5 0%, #e4e7eb 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="2" width="16" height="20" rx="2.5" stroke="#bbb" strokeWidth="1.3"/>
                  <path d="M8 6h8M8 10h5" stroke="#bbb" strokeWidth="1"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>
                  {post.title}
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#1B3A5C", margin: "0 0 4px" }}>
                  {post.price}
                </p>
                <p style={{ fontSize: 12, color: "#999", margin: 0 }}>
                  {post.location}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px", lineHeight: 1.4 }}>
                {post.title}
              </p>
              {post.body && (
                <p style={{
                  fontSize: 13, color: "#666", margin: "0 0 8px",
                  lineHeight: 1.55, display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {post.body}
                </p>
              )}
            </>
          )}

          {post.tags && !isTrade && (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
              {post.tags.map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "rgba(0,0,0,0.04)", color: "#777",
                }}>
                  {t}
                </span>
              ))}
              {post.recruit && (
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "#E6F1FB", color: "#185FA5", fontWeight: 500,
                }}>
                  {post.recruit.current}/{post.recruit.total}명
                </span>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: isTrade ? "10px" : "4px" }}>
            <button
              onClick={e => { e.stopPropagation(); setLiked(!liked); setLikeCount(c => liked ? c - 1 : c + 1); }}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                fontSize: 12, color: liked ? "#E24B4A" : "#999",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                transition: "color 0.15s, transform 0.15s",
                transform: liked ? "scale(1.05)" : "scale(1)",
              }}
            >
              <HeartIcon filled={liked} size={15}/> {likeCount}
            </button>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: 12, color: "#999" }}>
              <CommentIcon size={15}/> {post.comments}
            </span>
            <div style={{ flex: 1 }}/>
            <button
              onClick={e => { e.stopPropagation(); setSaved(!saved); }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: saved ? "#185FA5" : "#ccc", transition: "color 0.15s",
              }}
            >
              <BookmarkIcon filled={saved} size={16}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PumCampus() {
  const [activeCat, setActiveCat] = useState("all");
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState("dept");
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 100);
  }, []);

  const filteredPosts = activeCat === "all"
    ? POSTS
    : POSTS.filter(p => p.cat === activeCat);

  const identityOptions = [
    { id: "anon", label: "익명", desc: "번호만 표시", preview: "익명 1" },
    { id: "dept", label: "학과", desc: "소속 학과 표시", preview: "정보컴퓨터공학부" },
    { id: "year", label: "학번", desc: "학과 + 입학연도", preview: "정컴 22학번" },
  ];

  return (
    <div style={{
      maxWidth: 440, margin: "0 auto", fontFamily: "'Pretendard Variable', -apple-system, sans-serif",
      background: "#FAFBFC", minHeight: "100vh", position: "relative",
      borderRadius: 20, overflow: "hidden",
      border: "1px solid rgba(0,0,0,0.06)",
    }}>
      <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" rel="stylesheet" />

      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: scrolled ? "rgba(250,251,252,0.92)" : "#FAFBFC",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        transition: "all 0.3s ease",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.05)" : "1px solid transparent",
      }}>
        <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{
              fontSize: 26, fontWeight: 700, color: "#0F1A2A", margin: 0,
              letterSpacing: "-0.5px", lineHeight: 1.2,
              opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(8px)",
              transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
            }}>
              캠퍼스
            </h1>
            <p style={{
              fontSize: 13, color: "#8899AA", margin: "2px 0 0", fontWeight: 400,
              opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(8px)",
              transition: "all 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s",
            }}>
              부산대학교 · 실명인증 기반
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="#555" strokeWidth="1.4"/>
                <path d="M13 13l5 5" stroke="#555" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
            <button style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 2a6 6 0 00-6 6v3.5L2 14v1h16v-1l-2-2.5V8a6 6 0 00-6-6z" stroke="#555" strokeWidth="1.4" fill="none"/>
                <path d="M8 16a2 2 0 004 0" stroke="#555" strokeWidth="1.4"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{
          display: "flex", gap: "6px", padding: "14px 20px 12px",
          overflowX: "auto", scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}>
          {CATEGORIES.map((cat, i) => {
            const isActive = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: 20,
                  border: isActive ? "none" : "1px solid rgba(0,0,0,0.08)",
                  background: isActive ? "#1B3A5C" : "#fff",
                  color: isActive ? "#fff" : "#666",
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                  transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                  opacity: animateIn ? 1 : 0,
                  transitionDelay: `${i * 0.03}s`,
                }}
              >
                <CatIcon type={cat.icon} size={15} color={isActive ? "#fff" : "#999"}/>
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={e => setScrolled(e.target.scrollTop > 10)}
        style={{
          background: "#fff", borderRadius: "16px 16px 0 0",
          boxShadow: "0 -1px 0 rgba(0,0,0,0.03)",
          minHeight: 500,
        }}
      >
        {filteredPosts.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            style={{
              opacity: animateIn ? 1 : 0,
              transform: animateIn ? "translateY(0)" : "translateY(12px)",
              transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.05}s`,
            }}
          />
        ))}

        {filteredPosts.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#999" strokeWidth="1.5"/>
                <path d="M8 15s1.5 2 4 2 4-2 4-2" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="9" cy="10" r="1" fill="#999"/>
                <circle cx="15" cy="10" r="1" fill="#999"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, color: "#999", margin: 0 }}>아직 게시글이 없어요</p>
            <p style={{ fontSize: 12, color: "#bbb", margin: "4px 0 0" }}>첫 번째 글을 작성해보세요</p>
          </div>
        )}
      </div>

      {showCompose && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end",
        }}
        onClick={() => setShowCompose(false)}
        >
          <div
            style={{
              background: "#fff", width: "100%",
              borderRadius: "20px 20px 0 0", padding: "8px 0 24px",
              maxHeight: "85%", overflow: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#ddd", margin: "4px auto 16px" }}/>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 20px 16px" }}>
              <button onClick={() => setShowCompose(false)} style={{ background: "none", border: "none", fontSize: 15, color: "#999", cursor: "pointer" }}>취소</button>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>글쓰기</span>
              <button style={{ background: "none", border: "none", fontSize: 15, color: "#185FA5", fontWeight: 600, cursor: "pointer" }}>등록</button>
            </div>

            <div style={{ padding: "0 20px 16px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#999", margin: "0 0 8px", letterSpacing: "0.3px" }}>작성자 표시</p>
              <div style={{ display: "flex", gap: "8px" }}>
                {identityOptions.map(opt => {
                  const isSelected = selectedIdentity === opt.id;
                  const clr = IDENTITY_COLORS[opt.id];
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedIdentity(opt.id)}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 12,
                        border: isSelected ? `2px solid ${clr.text}` : "1px solid rgba(0,0,0,0.08)",
                        background: isSelected ? clr.bg : "#fff",
                        cursor: "pointer", textAlign: "center",
                        transition: "all 0.2s ease",
                        transform: isSelected ? "scale(1.02)" : "scale(1)",
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: clr.avatar, margin: "0 auto 6px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 600, color: clr.text,
                      }}>
                        {opt.id === "anon" ? "익1" : opt.id === "dept" ? "정컴" : "22"}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", margin: "0 0 2px" }}>{opt.label}</p>
                      <p style={{ fontSize: 10, color: "#999", margin: 0 }}>{opt.preview}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(0,0,0,0.05)", margin: "0 20px" }}/>

            <div style={{ padding: "16px 20px" }}>
              <input
                placeholder="제목을 입력하세요"
                style={{
                  width: "100%", border: "none", fontSize: 17, fontWeight: 600,
                  color: "#1a1a1a", outline: "none", padding: "0 0 12px",
                  fontFamily: "inherit", background: "transparent",
                }}
              />
              <textarea
                placeholder="부산대 학우들과 나누고 싶은 이야기를 작성해주세요."
                rows={5}
                style={{
                  width: "100%", border: "none", fontSize: 14, color: "#444",
                  outline: "none", resize: "none", fontFamily: "inherit",
                  lineHeight: 1.6, background: "transparent",
                }}
              />
            </div>

            <div style={{
              display: "flex", gap: "12px", padding: "12px 20px",
              borderTop: "1px solid rgba(0,0,0,0.05)", alignItems: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" style={{ cursor: "pointer" }}>
                <rect x="2" y="2" width="16" height="16" rx="3" stroke="#999" strokeWidth="1.2"/>
                <circle cx="7" cy="8" r="1.5" fill="#999"/>
                <path d="M2 14l4-4 3 3 4-5 5 6" stroke="#999" strokeWidth="1.2"/>
              </svg>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" style={{ cursor: "pointer" }}>
                <path d="M15.5 2H4.5A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11a2.5 2.5 0 002.5-2.5v-11A2.5 2.5 0 0015.5 2z" stroke="#999" strokeWidth="1.2" fill="none"/>
                <path d="M6 10h8M10 6v8" stroke="#999" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" style={{ cursor: "pointer" }}>
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" stroke="#999" strokeWidth="1.2"/>
                <path d="M7 12.5s1 1.5 3 1.5 3-1.5 3-1.5" stroke="#999" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="7.5" cy="8.5" r=".8" fill="#999"/>
                <circle cx="12.5" cy="8.5" r=".8" fill="#999"/>
              </svg>
              <div style={{ flex: 1 }}/>
              <select style={{
                fontSize: 12, padding: "4px 8px", borderRadius: 6,
                border: "1px solid rgba(0,0,0,0.1)", background: "#f8f9fa",
                color: "#555", fontFamily: "inherit", cursor: "pointer",
              }}>
                <option>내 학과</option>
                <option>수업 Q&A</option>
                <option>중고거래</option>
                <option>동아리</option>
                <option>꿀팁</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowCompose(true)}
        style={{
          position: "sticky", bottom: 20, float: "right", marginRight: 20,
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #1B3A5C 0%, #2C5A8A 100%)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(27,58,92,0.35)",
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
          transform: animateIn ? "scale(1)" : "scale(0)",
          transitionDelay: "0.3s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = "0 6px 24px rgba(27,58,92,0.45)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(27,58,92,0.35)";
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      </button>

      <div style={{
        position: "sticky", bottom: 0,
        display: "flex", background: "#fff",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        padding: "6px 0 20px", clear: "both",
      }}>
        {[
          { label: "홈", icon: <path d="M3 9l7-5 7 5v8a1 1 0 01-1 1H4a1 1 0 01-1-1V9z" stroke="currentColor" strokeWidth="1.3" fill="none"/> },
          { label: "공지", icon: <><path d="M10 2a6 6 0 00-6 6v3.5L2 14v1h16v-1l-2-2.5V8a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 16a2 2 0 004 0" stroke="currentColor" strokeWidth="1.3"/></> },
          { label: "시간표", icon: <><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M3 7h14M7 3v4M13 3v4" stroke="currentColor" strokeWidth="1.3"/></> },
          { label: "캠퍼스", active: true, icon: <><circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/><circle cx="13" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M2 17c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5M8 17c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke="currentColor" strokeWidth="1.3" fill="none"/></> },
          { label: "설정", icon: <><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.9 3.9l1.4 1.4M14.7 14.7l1.4 1.4M16.1 3.9l-1.4 1.4M5.3 14.7l-1.4 1.4" stroke="currentColor" strokeWidth="1.3"/></> },
        ].map(tab => (
          <div
            key={tab.label}
            style={{
              flex: 1, textAlign: "center", cursor: "pointer",
              color: tab.active ? "#185FA5" : "#aaa",
              transition: "color 0.15s",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" style={{ margin: "0 auto 2px", display: "block" }}>
              {tab.icon}
            </svg>
            <span style={{ fontSize: 10, fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
