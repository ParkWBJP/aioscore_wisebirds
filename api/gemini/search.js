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
      console.error('GEMINI_API_KEY가 설정되지 않음 - 기본 응답 반환');
      return res.json({
        companies: [
          {
            rank: 1,
            name: "Gemini API 키 미설정",
            domain: "gemini.google.com",
            strength: "API 키 설정 필요",
            features: "Vercel 환경 변수에 GEMINI_API_KEY를 설정해주세요",
            reason: "Gemini API를 사용하려면 API 키가 필요합니다",
            serviceType: "시스템 알림"
          }
        ]
      });
    }

    // 요청 바디 파싱
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log('요청 바디:', body);

    const { question, domain, industry, mainService } = body;
    
    if (!question || !domain || !industry || !mainService) {
      console.log('필수 파라미터 누락:', { question, domain, industry, mainService });
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    console.log('Gemini 검색 시작:', { question, domain, industry, mainService });

    const prompt = `업종: ${industry}
서비스: ${mainService}
질문: ${question}

위 질문에 대해 실제 존재하는 한국 회사 5곳을 추천해주세요.

다음 형식으로 JSON 응답해주세요:
{
  "companies": [
    {
      "rank": 1,
      "name": "회사명",
      "domain": "도메인",
      "strength": "주요 강점",
      "features": "특징",
      "reason": "추천 이유",
      "serviceType": "서비스 유형"
    }
  ]
}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    console.log('Gemini API 응답 받음');
    console.log('Gemini 응답 내용:', text);

    try {
      const content = text.trim().replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
      console.log('파싱할 내용:', content);
      
      const parsed = JSON.parse(content);
      const companies = parsed.companies?.filter(company => company.name && company.name.trim() !== '') || [];
      
      if (companies.length === 0) {
        throw new Error('유효한 회사 정보가 없습니다.');
      }

      console.log('추천 기업:', companies);
      return res.json({ companies });
      
    } catch (parseError) {
      console.error('JSON 파싱 실패:', parseError);
      return res.json({
        companies: [
          {
            rank: 1,
            name: "응답 파싱 실패",
            domain: "error.com",
            strength: "JSON 형식 오류",
            features: "Gemini가 JSON 형식으로 응답하지 않음",
            reason: "AI 응답을 JSON으로 파싱할 수 없습니다",
            serviceType: "오류"
          }
        ]
      });
    }
  } catch (error) {
    console.error('Gemini 검색 오류:', error);
    
    // API 키 오류인 경우
    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      return res.json({
        companies: [
          {
            rank: 1,
            name: "Gemini API 인증 오류",
            domain: "gemini.google.com",
            strength: "API 키 문제",
            features: "API 키가 올바르지 않거나 만료되었습니다",
            reason: "Vercel 환경 변수에서 GEMINI_API_KEY를 확인해주세요",
            serviceType: "시스템 알림"
          }
        ]
      });
    }
    
    return res.status(500).json({ 
      error: 'Gemini 검색에 실패했습니다.',
      details: error.message 
    });
  }
} 