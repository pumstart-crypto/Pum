import { useState, useRef, useEffect, useCallback } from "react";

/* ───── Data ───── */
const LIBRARIES = {
  "새벽별도서관": {
    rooms: [
      "새벽누리-열람존", "새벽누리-미디어존", "새벽별당[24h]-A", "새벽별당[24h]-B",
      "1열람실", "2열람실-A", "2열람실-B", "2열람실-C", "2열람실-D",
      "3열람실-A", "3열람실-B", "3열람실-C", "3열람실-D",
      "노트북열람실-A", "노트북열람실-B", "대학원캐럴실"
    ]
  },
  "미리내열람실": {
    rooms: ["숲열람실", "나무열람실", "아카데미아-열람실", "아카데미아-캐럴실-A", "아카데미아-캐럴실-B"]
  },
  "나노생명과학도서관": {
    rooms: ["미르마루", "집중열람실"]
  },
  "의생명과학도서관": {
    rooms: ["행림별당"]
  },
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "10", "20", "30", "40", "50"];

/* ───── Scroll Picker ───── */
function DrumPicker({ items, selected, onChange, label }) {
  const ref = useRef(null);
  const H = 48;
  const settling = useRef(false);

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (ref.current && idx >= 0 && !settling.current) {
      ref.current.scrollTop = idx * H;
    }
  }, [selected, items]);

  const onScroll = useCallback(() => {
    settling.current = true;
    clearTimeout(ref.current?._t);
    ref.current._t = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / H);
      const c = Math.max(0, Math.min(idx, items.length - 1));
      ref.current.scrollTo({ top: c * H, behavior: "smooth" });
      onChange(items[c]);
      setTimeout(() => { settling.current = false; }, 120);
    }, 60);
  }, [items, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <span style={{ fontSize: 11, color: "#8a8fa0", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>{label}</span>
      <div style={{ position: "relative", height: H * 3, overflow: "hidden", width: "100%" }}>
        {/* highlight band */}
        <div style={{
          position: "absolute", top: H, left: 4, right: 4, height: H,
          background: "#f0f2ff", borderRadius: 12, pointerEvents: "none", zIndex: 0,
        }} />
        <div
          ref={ref}
          onScroll={onScroll}
          style={{
            height: H * 3, overflowY: "auto", scrollSnapType: "y mandatory",
            position: "relative", zIndex: 1,
            scrollbarWidth: "none", msOverflowStyle: "none",
          }}
        >
          <style>{`.drum::-webkit-scrollbar{display:none}`}</style>
          <div className="drum" style={{ display: "contents" }} ref={(el) => { if (el) el.parentElement.classList.add("drum"); }}>
            <div style={{ height: H }} />
            {items.map((item) => {
              const active = item === selected;
              return (
                <div
                  key={item}
                  onClick={() => {
                    onChange(item);
                    const i = items.indexOf(item);
                    ref.current?.scrollTo({ top: i * H, behavior: "smooth" });
                  }}
                  style={{
                    height: H, display: "flex", alignItems: "center", justifyContent: "center",
                    scrollSnapAlign: "start",
                    fontSize: active ? 22 : 15,
                    fontWeight: active ? 700 : 400,
                    color: active ? "#2d3282" : "#bbb",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontFamily: "'Fira Code', 'SF Mono', monospace",
                  }}
                >
                  {item}
                </div>
              );
            })}
            <div style={{ height: H }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───── Main App ───── */
export default function LibrarySeatApp() {
  const [selectedLib, setSelectedLib] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [seatNum, setSeatNum] = useState("");
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState("");

  const allRooms = selectedLib ? LIBRARIES[selectedLib].rooms : [];
  const filtered = search
    ? allRooms.filter((r) => r.toLowerCase().includes(search.toLowerCase()))
    : allRooms;

  const validate = () => {
    const e = {};
    if (!selectedRoom) e.room = true;
    if (!seatNum.trim() || isNaN(seatNum)) e.seat = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) setSubmitted(true);
  };

  const reset = () => {
    setSubmitted(false);
    setSelectedLib(null);
    setSelectedRoom(null);
    setSeatNum("");
    setHour("09");
    setMinute("00");
    setName("");
    setSearch("");
    setErrors({});
  };

  /* ───── Success ───── */
  if (submitted) {
    return (
      <div style={styles.page}>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Fira+Code:wght@400;500;700&display=swap" rel="stylesheet" />
        <div style={{ ...styles.card, textAlign: "center", animation: "popIn 0.5s cubic-bezier(.175,.885,.32,1.275)" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto 20px",
            background: "linear-gradient(135deg, #4f5bd5, #962fbf)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, boxShadow: "0 8px 32px rgba(79,91,213,0.3)",
          }}>📚</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1d3b", margin: "0 0 6px" }}>등록 완료!</h2>
          <p style={{ color: "#8a8fa0", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
            {selectedRoom} · {seatNum}번 좌석<br />
            {hour}:{minute} 부터 이용
          </p>
          <button onClick={reset} style={styles.primaryBtn}>새로 등록하기</button>
        </div>
        <style>{animations}</style>
      </div>
    );
  }

  /* ───── Form ───── */
  return (
    <div style={styles.page}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Fira+Code:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#f0f2ff", borderRadius: 30, padding: "6px 16px", marginBottom: 14,
        }}>
          <span style={{ fontSize: 16 }}>🏛️</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#4f5bd5", letterSpacing: 1.5 }}>LIBRARY</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1a1d3b", margin: "0 0 4px" }}>내 자리 등록</h1>
        <p style={{ fontSize: 13, color: "#8a8fa0", margin: 0 }}>예약 후 열람실과 좌석 번호를 등록해두세요</p>
      </div>

      <div style={styles.card}>

        {/* 이름 (선택) */}
        <div style={styles.field}>
          <div style={styles.labelRow}>
            <span style={styles.label}>이름</span>
            <span style={styles.optBadge}>선택</span>
          </div>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="입력하지 않으면 익명으로 등록돼요"
            style={styles.input}
          />
        </div>

        {/* 열람실 */}
        <div style={styles.field}>
          <div style={styles.labelRow}>
            <span style={styles.label}>열람실</span>
            <span style={styles.reqDot}>*</span>
          </div>

          {/* Library tabs */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
            {Object.keys(LIBRARIES).map((lib) => {
              const active = selectedLib === lib;
              return (
                <button
                  key={lib}
                  onClick={() => { setSelectedLib(lib); setSelectedRoom(null); setSearch(""); }}
                  style={{
                    flexShrink: 0, padding: "8px 14px", borderRadius: 10, border: "none",
                    fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                    background: active ? "#4f5bd5" : "#f3f4f8",
                    color: active ? "#fff" : "#666",
                    transition: "all 0.2s",
                    boxShadow: active ? "0 2px 12px rgba(79,91,213,0.25)" : "none",
                  }}
                >
                  {lib}
                </button>
              );
            })}
          </div>

          {selectedLib && (
            <>
              {/* Search within rooms */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#bbb" }}>🔍</span>
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="열람실 검색..."
                  style={{ ...styles.input, paddingLeft: 34, fontSize: 13, padding: "10px 12px 10px 34px" }}
                />
              </div>

              {/* Room chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {filtered.map((room) => {
                  const active = selectedRoom === room;
                  const is24h = room.includes("24h");
                  return (
                    <button
                      key={room}
                      onClick={() => { setSelectedRoom(room); if (errors.room) setErrors((p) => ({ ...p, room: false })); }}
                      style={{
                        padding: "9px 14px", borderRadius: 10,
                        border: active ? "2px solid #4f5bd5" : "1.5px solid #e8e9f0",
                        background: active ? "#f0f2ff" : "#fff",
                        color: active ? "#4f5bd5" : "#555",
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                        transition: "all 0.15s",
                        position: "relative",
                      }}
                    >
                      {room}
                      {is24h && <span style={{ fontSize: 9, marginLeft: 4, color: "#e67e22", fontWeight: 700 }}>24H</span>}
                    </button>
                  );
                })}
              </div>
              {errors.room && <p style={styles.errMsg}>열람실을 선택해주세요</p>}
            </>
          )}

          {!selectedLib && (
            <p style={{ fontSize: 13, color: "#aaa", margin: "8px 0 0", fontStyle: "italic" }}>
              도서관을 먼저 선택해주세요
            </p>
          )}
        </div>

        {/* 좌석 번호 */}
        <div style={styles.field}>
          <div style={styles.labelRow}>
            <span style={styles.label}>좌석 번호</span>
            <span style={styles.reqDot}>*</span>
          </div>
          <input
            value={seatNum}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setSeatNum(v);
              if (errors.seat) setErrors((p) => ({ ...p, seat: false }));
            }}
            placeholder="숫자만 입력 (예: 42)"
            inputMode="numeric"
            style={{
              ...styles.input,
              fontFamily: "'Fira Code', monospace",
              fontSize: 16,
              letterSpacing: 2,
              borderColor: errors.seat ? "#e74c6f" : "#e8e9f0",
            }}
          />
          {errors.seat && <p style={styles.errMsg}>좌석 번호를 입력해주세요</p>}
        </div>

        {/* 이용 시작 시간 */}
        <div style={styles.field}>
          <div style={styles.labelRow}>
            <span style={styles.label}>이용 시작 시간</span>
          </div>
          <div style={{
            display: "flex", gap: 0, background: "#fafbfe",
            borderRadius: 16, border: "1.5px solid #e8e9f0", padding: "12px 8px 8px",
          }}>
            <DrumPicker items={HOURS} selected={hour} onChange={setHour} label="시" />
            <div style={{
              display: "flex", alignItems: "center", paddingTop: 20,
              fontSize: 28, fontWeight: 700, color: "#2d3282",
              fontFamily: "'Fira Code', monospace",
            }}>:</div>
            <DrumPicker items={MINUTES} selected={minute} onChange={setMinute} label="분" />
          </div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} style={{ ...styles.primaryBtn, marginTop: 8 }}>
          등록하기
        </button>
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "#bbb", marginTop: 20 }}>
        등록된 정보는 퇴실 시 자동으로 삭제됩니다
      </p>

      <style>{animations}</style>
    </div>
  );
}

/* ───── Styles ───── */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f5f6fc 0%, #eceef8 100%)",
    fontFamily: "'Noto Sans KR', sans-serif",
    padding: "36px 16px 40px",
    maxWidth: 520,
    margin: "0 auto",
  },
  card: {
    background: "#fff",
    borderRadius: 24,
    padding: "28px 22px",
    boxShadow: "0 2px 24px rgba(30,35,90,0.06), 0 0 0 1px rgba(30,35,90,0.03)",
  },
  field: {
    marginBottom: 24,
  },
  labelRow: {
    display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
  },
  label: {
    fontSize: 14, fontWeight: 600, color: "#2a2d4a",
  },
  reqDot: {
    color: "#e74c6f", fontSize: 14, fontWeight: 700,
  },
  optBadge: {
    fontSize: 10, color: "#4f5bd5", background: "#f0f2ff",
    padding: "2px 8px", borderRadius: 6, fontWeight: 600,
  },
  input: {
    width: "100%", padding: "13px 16px", borderRadius: 12,
    border: "1.5px solid #e8e9f0", background: "#fafbfe",
    color: "#1a1d3b", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif",
    outline: "none", transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  errMsg: {
    color: "#e74c6f", fontSize: 12, margin: "6px 0 0", fontWeight: 500,
  },
  primaryBtn: {
    width: "100%", padding: "15px 0", border: "none", borderRadius: 14,
    background: "linear-gradient(135deg, #4f5bd5, #6366f1)",
    color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
    fontFamily: "'Noto Sans KR', sans-serif",
    boxShadow: "0 4px 20px rgba(79,91,213,0.3)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
};

const animations = `
  @keyframes popIn { from { opacity:0; transform:scale(0.95) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  input:focus { border-color: #4f5bd5 !important; box-shadow: 0 0 0 3px rgba(79,91,213,0.1); }
  button:active { transform: scale(0.98); }
  * { box-sizing: border-box; }
  div::-webkit-scrollbar { display: none; }
`;
