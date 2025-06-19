import Anthropic from '@anthropic-ai/sdk';

// Anthropic 설정
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// 재시도 함수
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Claude API 시도 ${attempt}/${maxRetries} 실패:`, error.message);
      
      // 529 오류(Overloaded) 또는 재시도 가능한 오류인 경우
      if (error.status === 529 || 
          error.message.includes('rate limit') || 
          error.message.includes('overloaded') ||
          error.message.includes('timeout')) {
        
        if (attempt === maxRetries) {
          throw error; // 마지막 시도면 오류 던지기
        }
        
        // 지수 백오프: 1초, 2초, 4초
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`${delay}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 재시도 불가능한 오류면 바로 던지기
      throw error;
    }
  }
}

export default async function handler(req, res) {
  console.log('Claude Search API 호출:', req.method, req.url);
  
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
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY가 설정되지 않음 - 기본 응답 반환');
      const fallbackResponse = {
        companies: [
          {
            rank: 1,
            name: "Claude API 키 미설정",
            domain: "claude.ai",
            strength: "API 키 설정 필요",
            features: "Vercel 환경 변수에 ANTHROPIC_API_KEY를 설정해주세요",
            reason: "Claude API를 사용하려면 API 키가 필요합니다",
            serviceType: "시스템 알림"
          },
          {
            rank: 2,
            name: "GPT 모델 사용 권장",
            domain: "openai.com",
            strength: "현재 작동 중",
            features: "GPT 모델이 정상적으로 작동하고 있습니다",
            reason: "GPT 모델을 사용하여 동일한 질문을 해보세요",
            serviceType: "대안 제안"
          }
        ]
      };
      return res.json(fallbackResponse);
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

    console.log('Claude 검색 시작:', { question, domain, industry, mainService });

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

    const response = await retryWithBackoff(async () => {
      return await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });
    });

    console.log('Claude API 응답 받음');
    console.log('Claude 응답 내용:', response.content[0].text);

    let companies = [];
    try {
      let content = response.content[0].text.trim();
      content = content.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
      console.log('파싱할 내용:', content);
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
      console.error('파싱 에러:', parseError);
      companies = [
        {
          rank: 1,
          name: "응답 파싱 실패",
          domain: "error.com",
          strength: "JSON 형식 오류",
          features: "Claude가 JSON 형식으로 응답하지 않음",
          reason: "AI 응답을 JSON으로 파싱할 수 없습니다",
          serviceType: "오류"
        }
      ];
    }

    console.log('추천 기업:', companies);
    res.json({ companies });
  } catch (error) {
    console.error('Claude 검색 오류:', error);
    
    // 529 오류(Overloaded) 처리
    if (error.status === 529 || error.message.includes('overloaded')) {
      console.log('Claude 서버 과부하, fallback 응답 반환');
      const fallbackResponse = {
        companies: [
          {
            rank: 1,
            name: "Claude 서버 과부하",
            domain: "claude.ai",
            strength: "일시적 서버 문제",
            features: "Claude 서버가 현재 과부하 상태입니다",
            reason: "잠시 후 다시 시도하거나 다른 AI 모델을 사용해보세요",
            serviceType: "시스템 알림"
          },
          {
            rank: 2,
            name: "GPT 모델 사용 권장",
            domain: "openai.com",
            strength: "현재 안정적 동작",
            features: "GPT 모델이 정상적으로 작동하고 있습니다",
            reason: "동일한 질문을 GPT 모델로 시도해보세요",
            serviceType: "대안 제안"
          },
          {
            rank: 3,
            name: "Gemini 모델 사용 권장",
            domain: "google.com",
            strength: "안정적 성능",
            features: "Google의 Gemini 모델도 사용 가능합니다",
            reason: "Gemini 모델로도 동일한 질문을 시도해보세요",
            serviceType: "대안 제안"
          }
        ]
      };
      return res.json(fallbackResponse);
    }
    
    // API 키 오류인 경우 fallback 응답
    if (error.message.includes('API key') || error.message.includes('authentication')) {
      const fallbackResponse = {
        companies: [
          {
            rank: 1,
            name: "Claude API 인증 오류",
            domain: "claude.ai",
            strength: "API 키 문제",
            features: "API 키가 올바르지 않거나 만료되었습니다",
            reason: "Vercel 환경 변수에서 ANTHROPIC_API_KEY를 확인해주세요",
            serviceType: "시스템 알림"
          }
        ]
      };
      return res.json(fallbackResponse);
    }
    
    // 기타 오류에 대한 fallback 응답
    const fallbackResponse = {
      companies: [
        {
          rank: 1,
          name: "Claude API 오류",
          domain: "claude.ai",
          strength: "일시적 문제",
          features: `오류: ${error.message}`,
          reason: "Claude API에서 오류가 발생했습니다",
          serviceType: "시스템 알림"
        },
        {
          rank: 2,
          name: "다른 AI 모델 시도",
          domain: "aioscore.com",
          strength: "대안 제공",
          features: "GPT 또는 Gemini 모델을 사용해보세요",
          reason: "동일한 질문을 다른 AI 모델로 시도해보세요",
          serviceType: "대안 제안"
        }
      ]
    };
    return res.json(fallbackResponse);
  }
} 