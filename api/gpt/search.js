import OpenAI from 'openai';

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Assistant ID를 재사용하기 위해 전역 변수로 설정
let ASSISTANT_ID = null;

// Assistant 생성 또는 가져오기
async function getAssistant() {
  if (ASSISTANT_ID) return ASSISTANT_ID;

  const assistant = await openai.beta.assistants.create({
    name: "한국 기업 추천 어시스턴트",
    model: "gpt-4o",
    instructions: `당신은 한국 기업 추천 전문가입니다. 
다음 규칙을 엄격히 따라주세요:

1. 실제 존재하는 한국 회사만 추천하세요
2. 허구 브랜드나 존재하지 않는 도메인은 절대 포함하지 마세요
3. 반드시 다음 JSON 형식으로만 응답하세요:

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
}

4. JSON 형식 외의 다른 텍스트는 포함하지 마세요
5. 모르는 정보는 빈 문자열("")로 남기세요`
  });

  ASSISTANT_ID = assistant.id;
  return ASSISTANT_ID;
}

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

    // Assistant ID 가져오기
    const assistantId = await getAssistant();

    // Thread 생성
    const thread = await openai.beta.threads.create();

    // 메시지 추가
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `업종: ${industry}
서비스: ${mainService}
질문: ${question}

위 질문에 대해 실제 존재하는 한국 회사 5곳을 추천해주세요.
반드시 JSON 형식으로만 응답해주세요.`
    });

    // Run 생성 및 완료 대기
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    // Run 상태 확인 (최대 10초)
    let runStatus = run;
    const startTime = Date.now();
    while (runStatus.status !== 'completed' && Date.now() - startTime < 10000) {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status !== 'completed') {
      throw new Error('응답 시간 초과');
    }

    // 응답 메시지 가져오기
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    // 응답 파싱
    try {
      let content = lastMessage.content[0].text.value.trim();
      console.log('원본 응답:', content);
      
      // 코드 블록 제거
      content = content.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
      console.log('코드 블록 제거 후:', content);
      
      // JSON 부분만 추출
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      
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
      console.error('파싱 시도한 내용:', content);
      
      // fallback: 텍스트에서 회사명 추출 시도
      try {
        const fallbackCompanies = [];
        const lines = lastMessage.content[0].text.value.split('\n');
        let rank = 1;
        
        for (const line of lines) {
          if (rank > 5) break;
          
          // 회사명 패턴 찾기 (숫자. 회사명 형태)
          const match = line.match(/^\d+\.\s*(.+)/);
          if (match && match[1].trim()) {
            fallbackCompanies.push({
              rank: rank++,
              name: match[1].trim(),
              domain: "",
              strength: "정보 없음",
              features: "정보 없음", 
              reason: "AI 응답에서 추출",
              serviceType: industry
            });
          }
        }
        
        if (fallbackCompanies.length > 0) {
          console.log('Fallback 추천 기업:', fallbackCompanies);
          return res.json({ companies: fallbackCompanies });
        }
      } catch (fallbackError) {
        console.error('Fallback 처리 실패:', fallbackError);
      }
      
      return res.json({
        companies: [
          {
            rank: 1,
            name: "응답 파싱 실패",
            domain: "error.com",
            strength: "JSON 형식 오류",
            features: "GPT가 JSON 형식으로 응답하지 않음",
            reason: "AI 응답을 JSON으로 파싱할 수 없습니다",
            serviceType: "오류"
          }
        ]
      });
    }
  } catch (error) {
    console.error('GPT 검색 오류:', error);
    res.status(500).json({ 
      error: 'GPT 검색에 실패했습니다.',
      details: error.message 
    });
  }
} 