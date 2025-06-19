import { GoogleGenerativeAI } from '@google/generative-ai';

// Google Generative AI 설정
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  console.log('Gemini Search API 호출:', req.method, req.url);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    console.log('잘못된 메소드:', req.method);
    return res.status(405).json({ error: '허용되지 않은 메소드입니다.' });
  }

  try {
    // API 키 확인
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY가 설정되지 않음');
      return res.status(500).json({ error: '서버 설정 오류입니다.' });
    }

    // 요청 바디 파싱
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      console.error('요청 바디 파싱 실패:', e);
      return res.status(400).json({ error: '잘못된 요청 형식입니다.' });
    }

    console.log('요청 바디:', body);

    const { question, domain, industry, mainService } = body;
    
    if (!question || !domain || !industry || !mainService) {
      console.log('필수 파라미터 누락:', { question, domain, industry, mainService });
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    console.log('Gemini 검색 시작:', { question, domain, industry, mainService });

    const prompt = `다음 질문에 대한 답변으로 실제 존재하는 한국 기업 5개를 추천해주세요.

질문: ${question}

[요구사항]
1. 실제 존재하는 한국 기업만 추천해주세요
2. 각 기업의 이름, 도메인, 간단한 설명을 포함해주세요
3. JSON 배열 형태로 출력해주세요
4. 모르는 경우 빈 문자열("")로 남겨주세요

[출력 형식]
[
  {
    "name": "기업명",
    "domain": "도메인주소",
    "description": "간단한 설명"
  }
]`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini API 응답 받음');

    let companies = [];
    try {
      let content = text.trim();
      content = content.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        companies = parsed.filter(company => company.name && company.name.trim() !== '');
      }
    } catch (parseError) {
      console.log('JSON 파싱 실패, 빈 배열 반환');
      companies = [];
    }

    console.log('추천 기업:', companies);
    res.json({ companies });
  } catch (error) {
    console.error('Gemini 검색 오류:', error);
    res.status(500).json({ 
      error: 'Gemini 검색에 실패했습니다.',
      details: error.message 
    });
  }
} 