import OpenAI from 'openai';

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  console.log('GPT Search API 호출:', req.method, req.url);
  
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
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY가 설정되지 않음');
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

    console.log('GPT 검색 시작:', { question, domain, industry, mainService });

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

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    });

    console.log('GPT API 응답 받음');

    let companies = [];
    try {
      let content = response.choices?.[0]?.message?.content.trim();
      content = content.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(content);
      if (parsed.companies && Array.isArray(parsed.companies)) {
        companies = parsed.companies.filter(company => company.name && company.name.trim() !== '');
      } else if (Array.isArray(parsed)) {
        // 기존 형식 호환성 유지
        companies = parsed.filter(company => company.name && company.name.trim() !== '')
          .map((company, index) => ({
            rank: index + 1,
            name: company.name,
            domain: company.domain || '',
            strength: company.description || '정보 없음',
            features: company.description || '정보 없음',
            reason: '사용자 질문에 적합한 서비스',
            serviceType: industry
          }));
      }
    } catch (parseError) {
      console.log('JSON 파싱 실패, 기본 응답 생성');
      companies = [
        {
          rank: 1,
          name: "응답 파싱 실패",
          domain: "error.com",
          strength: "JSON 형식 오류",
          features: "GPT가 JSON 형식으로 응답하지 않음",
          reason: "AI 응답을 JSON으로 파싱할 수 없습니다",
          serviceType: "오류"
        }
      ];
    }

    console.log('추천 기업:', companies);
    res.json({ companies });
  } catch (error) {
    console.error('GPT 검색 오류:', error);
    res.status(500).json({ 
      error: 'GPT 검색에 실패했습니다.',
      details: error.message 
    });
  }
} 