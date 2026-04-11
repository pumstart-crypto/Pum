export interface PnuDept {
  name: string;
  college: string;
}

export const ALL_PNU_DEPTS: PnuDept[] = [
  // 인문대학
  { name: '국어국문학과', college: '인문대학' },
  { name: '한문학과', college: '인문대학' },
  { name: '중어중문학과', college: '인문대학' },
  { name: '일어일문학과', college: '인문대학' },
  { name: '영어영문학과', college: '인문대학' },
  { name: '불어불문학과', college: '인문대학' },
  { name: '독어독문학과', college: '인문대학' },
  { name: '노어노문학과', college: '인문대학' },
  { name: '언어정보학과', college: '인문대학' },
  { name: '사학과', college: '인문대학' },
  { name: '철학과', college: '인문대학' },
  { name: '고고학과', college: '인문대학' },

  // 사회과학대학
  { name: '행정학과', college: '사회과학대학' },
  { name: '정치외교학과', college: '사회과학대학' },
  { name: '사회복지학과', college: '사회과학대학' },
  { name: '사회학과', college: '사회과학대학' },
  { name: '심리학과', college: '사회과학대학' },
  { name: '문헌정보학과', college: '사회과학대학' },
  { name: '미디어커뮤니케이션학과', college: '사회과학대학' },

  // 자연과학대학
  { name: '수학과', college: '자연과학대학' },
  { name: '통계학과', college: '자연과학대학' },
  { name: '물리학과', college: '자연과학대학' },
  { name: '화학과', college: '자연과학대학' },
  { name: '생명과학과', college: '자연과학대학' },
  { name: '분자생물학과', college: '자연과학대학' },
  { name: '미생물학과', college: '자연과학대학' },
  { name: '지질환경과학과', college: '자연과학대학' },
  { name: '대기환경과학과', college: '자연과학대학' },
  { name: '해양학과', college: '자연과학대학' },

  // 공과대학
  { name: '기계공학부', college: '공과대학' },
  { name: '고분자공학과', college: '공과대학' },
  { name: '유기소재시스템공학과', college: '공과대학' },
  { name: '화공생명공학과', college: '공과대학' },
  { name: '환경공학과', college: '공과대학' },
  { name: '전자공학전공', college: '공과대학' },
  { name: '전기공학전공', college: '공과대학' },
  { name: '반도체공학전공', college: '공과대학' },
  { name: '조선해양공학과', college: '공과대학' },
  { name: '재료공학부', college: '공과대학' },
  { name: '산업공학과', college: '공과대학' },
  { name: '항공우주공학과', college: '공과대학' },
  { name: '건축공학과', college: '공과대학' },
  { name: '건축학과', college: '공과대학' },
  { name: '도시공학과', college: '공과대학' },
  { name: '사회기반시스템공학과', college: '공과대학' },

  // 경제통상대학
  { name: '경제학부', college: '경제통상대학' },
  { name: '무역학부', college: '경제통상대학' },
  { name: '경영학과', college: '경제통상대학' },
  { name: '관광컨벤션학과', college: '경제통상대학' },
  { name: '회계학과', college: '경제통상대학' },

  // 사범대학
  { name: '교육학과', college: '사범대학' },
  { name: '윤리교육과', college: '사범대학' },
  { name: '국어교육과', college: '사범대학' },
  { name: '영어교육과', college: '사범대학' },
  { name: '일반사회교육과', college: '사범대학' },
  { name: '역사교육과', college: '사범대학' },
  { name: '지리교육과', college: '사범대학' },
  { name: '수학교육과', college: '사범대학' },
  { name: '물리교육과', college: '사범대학' },
  { name: '화학교육과', college: '사범대학' },
  { name: '생물교육과', college: '사범대학' },
  { name: '지구과학교육과', college: '사범대학' },
  { name: '교육공학과', college: '사범대학' },
  { name: '체육교육과', college: '사범대학' },
  { name: '유아교육과', college: '사범대학' },
  { name: '가정교육과', college: '사범대학' },

  // 예술대학
  { name: '예술문화영상학과', college: '예술대학' },
  { name: '조각과', college: '예술대학' },
  { name: '회화과', college: '예술대학' },
  { name: '공예디자인학과', college: '예술대학' },
  { name: '디자인학과', college: '예술대학' },
  { name: '음악학과', college: '예술대학' },

  // 생활환경대학
  { name: '식품영양학과', college: '생활환경대학' },
  { name: '의류학과', college: '생활환경대학' },
  { name: '실내환경디자인학과', college: '생활환경대학' },

  // 의과대학
  { name: '의예과', college: '의과대학' },
  { name: '의학과', college: '의과대학' },

  // 치의학전문대학원
  { name: '치의학과', college: '치의학전문대학원' },

  // 한의학전문대학원
  { name: '한의학과', college: '한의학전문대학원' },

  // 간호대학
  { name: '간호학과', college: '간호대학' },

  // 약학대학
  { name: '약학부', college: '약학대학' },

  // 나노과학기술대학
  { name: '광메카트로닉스공학과', college: '나노과학기술대학' },
  { name: '나노메카트로닉스공학과', college: '나노과학기술대학' },
  { name: '나노에너지공학과', college: '나노과학기술대학' },
  { name: '나노소재공학부', college: '나노과학기술대학' },
  { name: '스마트인포메이션통신공학과', college: '나노과학기술대학' },
  { name: '바이오소재과학과', college: '나노과학기술대학' },

  // 정보의생명공학대학
  { name: '정보컴퓨터공학부', college: '정보의생명공학대학' },
  { name: '전기컴퓨터공학부', college: '정보의생명공학대학' },
  { name: '의생명융합공학부', college: '정보의생명공학대학' },

  // 법학전문대학원
  { name: '법학과', college: '법학전문대학원' },

  // 융합대학 / 자율전공
  { name: '첨단IT자율전공', college: '융합대학' },
  { name: '첨단모빌리티자율전공', college: '융합대학' },
  { name: '첨단소재자율전공', college: '융합대학' },
  { name: '미래도시건축환경융합전공', college: '융합대학' },

  // 기술창업대학원
  { name: '기술창업학과', college: '기술창업대학원' },

  // 대학원 주요 학과
  { name: '융합의생명과학과', college: '융합의생명과학대학원' },
];
