export interface PnuDept {
  name: string;
  college: string;
}

export const ALL_PNU_DEPTS: PnuDept[] = [
  // 인문대학
  { name: '국어국문학과', college: '인문대학' },
  { name: '중어중문학과', college: '인문대학' },
  { name: '일어일문학과', college: '인문대학' },
  { name: '노어노문학과', college: '인문대학' },
  { name: '언어정보학과', college: '인문대학' },
  { name: '사학과', college: '인문대학' },
  { name: '철학과', college: '인문대학' },

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
  { name: '전자공학전공', college: '전기전자공학부' },
  { name: '전기공학전공', college: '전기전자공학부' },
  { name: '반도체공학전공', college: '전기전자공학부' },
  { name: '조선해양공학과', college: '공과대학' },
  { name: '재료공학부', college: '공과대학' },
  { name: '산업공학과', college: '공과대학' },
  { name: '항공우주공학과', college: '공과대학' },
  { name: '건축공학과', college: '공과대학' },
  { name: '건축학과', college: '공과대학' },
  { name: '도시공학과', college: '공과대학' },
  { name: '사회기반시스템공학과', college: '공과대학' },
  { name: '미래도시건축환경융합전공', college: '공과대학' },
  { name: '스마트시티전공', college: '공과대학' },

  // 사범대학
  { name: '국어교육과', college: '사범대학' },
  { name: '영어교육과', college: '사범대학' },
  { name: '독어교육과', college: '사범대학' },
  { name: '불어교육과', college: '사범대학' },
  { name: '교육학과', college: '사범대학' },
  { name: '유아교육과', college: '사범대학' },
  { name: '특수교육과', college: '사범대학' },
  { name: '일반사회교육과', college: '사범대학' },
  { name: '역사교육과', college: '사범대학' },
  { name: '지리교육과', college: '사범대학' },
  { name: '윤리교육과', college: '사범대학' },
  { name: '수학교육과', college: '사범대학' },
  { name: '물리교육과', college: '사범대학' },
  { name: '화학교육과', college: '사범대학' },
  { name: '생물교육과', college: '사범대학' },
  { name: '지구과학교육과', college: '사범대학' },
  { name: '체육교육과', college: '사범대학' },

  // 경제통상대학
  { name: '무역학부', college: '경제통상대학' },
  { name: '경제학부', college: '경제통상대학' },
  { name: '관광컨벤션학과', college: '경제통상대학' },
  { name: '국제학부', college: '경제통상대학' },
  { name: '공공정책학부', college: '경제통상대학' },

  // 경영대학
  { name: '경영학과', college: '경영대학' },

  // 예술대학
  { name: '음악학과', college: '예술대학' },
  { name: '한국음악학과', college: '예술대학' },
  { name: '미술학과', college: '예술대학' },
  { name: '조형학과', college: '예술대학' },
  { name: '디자인학과', college: '예술대학' },
  { name: '무용학과', college: '예술대학' },
  { name: '예술문화영상학과', college: '예술대학' },

  // 나노과학기술대학
  { name: '나노메카트로닉스공학과', college: '나노과학기술대학' },
  { name: '나노에너지공학과', college: '나노과학기술대학' },
  { name: '광메카트로닉스공학과', college: '나노과학기술대학' },

  // 생명자원과학대학
  { name: '식물생명과학과', college: '생명자원과학대학' },
  { name: '동물생명자원과학과', college: '생명자원과학대학' },
  { name: '식품공학과', college: '생명자원과학대학' },
  { name: '생명환경화학과', college: '생명자원과학대학' },
  { name: '바이오소재과학과', college: '생명자원과학대학' },
  { name: '바이오산업기계공학과', college: '생명자원과학대학' },
  { name: '조경학과', college: '생명자원과학대학' },
  { name: '식품자원경제학과', college: '생명자원과학대학' },
  { name: 'IT응용과학과', college: '생명자원과학대학' },
  { name: '바이오환경에너지학과', college: '생명자원과학대학' },

  // 간호대학
  { name: '간호학과', college: '간호대학' },

  // 의과대학
  { name: '의예과', college: '의과대학' },
  { name: '의학과', college: '의과대학' },

  // 약학대학
  { name: '약학전공', college: '약학대학' },
  { name: '제약학전공', college: '약학대학' },

  // 생활과학대학
  { name: '아동가족학과', college: '생활과학대학' },
  { name: '의류학과', college: '생활과학대학' },
  { name: '식품영양학과', college: '생활과학대학' },
  { name: '실내환경디자인학과', college: '생활과학대학' },
  { name: '스포츠과학과', college: '생활과학대학' },

  // 정보의생명공학대학
  { name: '컴퓨터공학전공', college: '정보의생명공학대학' },
  { name: '인공지능전공', college: '정보의생명공학대학' },
  { name: '디자인테크놀로지전공', college: '정보의생명공학대학' },
  { name: '의생명융합공학부', college: '정보의생명공학대학' },
  { name: '정보의생명공학자율전공', college: '정보의생명공학대학' },

  // 학부대학
  { name: '자유전공학부', college: '학부대학' },
  { name: '글로벌자유전공학부', college: '학부대학' },
  { name: '첨단융합학부 미래에너지전공', college: '학부대학' },
  { name: '첨단융합학부 나노소자첨단제조전공', college: '학부대학' },
  { name: '첨단융합학부 광메카트로닉스공학전공', college: '학부대학' },
  { name: '첨단융합학부 AI융합계산과학전공', college: '학부대학' },
  { name: '응용생명융합학부 그린바이오과학전공', college: '학부대학' },
  { name: '응용생명융합학부 생명자원시스템공학전공', college: '학부대학' },
];
