// server/index.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// .env 파일 로드 (server/.env와 루트 .env 모두 확인)
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'OK' : 'MISSING');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'OK' : 'MISSING');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'OK' : 'MISSING');

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY가 .env 파일에 설정되지 않았습니다.');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Assistant ID 저장 변수 (재사용)
let assistantId = null;

// Assistant 생성 함수
async function createOrGetAssistant() {
  if (assistantId) {
    return assistantId;
  }

  try {
    const assistant = await openai.beta.assistants.create({
      name: "한국 기업 추천 어시스턴트",
      instructions: `실제 존재하는 한국 회사만 추천해 주세요.  
모르면 빈 문자열("")로 남기세요.  
JSON 형식으로만 출력하세요.`,
      model: "gpt-4o",
    });
    
    assistantId = assistant.id;
    console.log('Assistant 생성 완료:', assistantId);
    return assistantId;
  } catch (error) {
    console.error('Assistant 생성 실패:', error);
    throw error;
  }
}

// 도메인 유효성 검사 함수
async function validateDomain(domain) {
  if (!domain) return false;
  try {
    const res = await axios.get(`https://${domain}`, { timeout: 3000 });
    return res.status < 400;
  } catch {
    return false;
  }
}

// 결과 후처리 함수
async function postProcessResults(companies) {
  if (!Array.isArray(companies)) return companies;
  
  return await Promise.all(
    companies.map(async (company) => {
      const isValid = await validateDomain(company.domain);
      return { ...company, validDomain: isValid };
    })
  );
}

// 사이트 요약 함수
async function getSiteSummary(url) {
  try {
    const { data: buffer } = await axios.get(url, {
      timeout: 5000,
      responseType: 'arraybuffer'
    });

    let encoding = 'utf-8';
    const htmlSnippet = buffer.toString('ascii');
    const charsetMatch = htmlSnippet.match(/<meta[^>]*charset=['"]?([^'"\s/>]+)/i);
    if (charsetMatch && charsetMatch[1]) {
      encoding = charsetMatch[1].toLowerCase();
    }

    let html;
    try {
      html = iconv.decode(buffer, encoding);
    } catch (e) {
      html = buffer.toString('utf-8');
    }

    const $ = cheerio.load(html);
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content')?.trim() || '';
    const keywords = [];
    $('h1, h2, h3, strong, li').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 8 && text.length < 50) keywords.push(text);
    });
    const mainKeywords = keywords.slice(0, 5).join(', ');
    return { title, description, mainKeywords };
  } catch (e) {
    console.error('사이트 요약 중 오류:', e.message);
    return null;
  }
}

// Vercel 서버리스 함수로 변경
module.exports = async (req, res) => {
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

  // API 라우팅
  if (req.method === 'POST') {
    if (req.url === '/api/generate-questions') {
      try {
        const { domain, industry, mainService } = req.body;
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        const siteInfo = await getSiteSummary(url);
        const mainKeywords = siteInfo?.mainKeywords || '없음';
        const description = siteInfo?.description || '없음';

        const prompt = `당신은 '${industry}' 업계에서 '${mainService}' 관련 서비스를 찾고 있는 실제 소비자입니다.  
                    아래 정보를 참고하여, 실제 사용자가 자연스럽게 물어볼 만한 현실적인 질문 5개를 작성해 주세요.
                    꼭 5개 업체나 서비스가 추천될 수 있도록 구성해주세요.

[참고 정보]
- 업종: ${industry}
- 주요 서비스: ${mainService}

[질문 작성 가이드라인]
1. 실제 고객이 자주 궁금해할 만한 실용적인 질문을 작성해 주세요
2. 자연스러운 구어체로 작성해 주세요 (예: "~을 추천해주세요", "~한 곳 없나요?", "어디가 좋을까요?")
3. 반드시 5개의 업체나 서비스가 추천될 수 있도록 질문을 구성해 주세요
4. 질문은 실제 소비자가 자주 사용하는 단어와 표현을 사용해 주세요

[질문 예시 - 성형외과의 경우]
- "강남에서 코성형 잘하는 병원 5곳만 추천해주세요"
- "자연스러운 쌍꺼풀 수술 잘하는 곳 어디인가요? 5곳 정도 알려주세요"
- "가격대비 만족도 높은 성형외과 5군데 알려주세요"
- "수술 실력이 검증된 성형외과 TOP5 추천해주세요"
- "후기가 많고 신뢰할 수 있는 성형외과 5곳 알려주세요"

위 예시처럼, '${mainService}'를 찾는 실제 고객의 관점에서 자연스럽고 구체적인 질문 5개를 JSON 배열로만 출력해주세요.
반드시 JSON 배열로만 출력해주세요.`;

        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        });

        let questions = [];
        try {
          let content = response.choices?.[0]?.message?.content.trim();
          content = content.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (typeof parsed[0] === 'object' && parsed[0]?.question) {
              questions = parsed.map(q => q.question);
            } else {
              questions = parsed;
            }
          }
        } catch {
          const fallback = response.choices?.[0]?.message?.content || '';
          questions = fallback
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.replace(/^\d+\.\s*/, '').replace(/^"|"$/g, '').trim())
            .slice(0, 5);
        }

        res.json({ questions, siteInfo });
      } catch (error) {
        console.error('질문 생성 오류:', error);
        res.status(500).json({ error: '질문 생성에 실패했습니다.' });
      }
    } else if (req.url === '/api/gpt/search') {
      // 기존 검색 API 로직...
    } else {
      res.status(404).json({ error: '잘못된 API 경로입니다.' });
    }
  } else {
    res.status(405).json({ error: '허용되지 않은 메소드입니다.' });
  }
};

// 검색 결과 추천 API
app.post('/api/gpt/search', async (req, res) => {
  const { question, domain, industry, mainService } = req.body;
  console.log('[GPT] mainService:', mainService);
  console.log('[API 호출]', req.method, req.originalUrl, '바디:', req.body);
  console.log('🌐 [GPT] 요청 시작');
  console.log('· 요청 바디:', req.body);
  
  try {
    console.log('요청 받은 데이터:', { question, domain, industry, mainService });

    // Assistant 생성 또는 가져오기
    const assistantId = await createOrGetAssistant();

    // Thread 생성
    const thread = await openai.beta.threads.create();

    // Message 생성
    const message = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `업종: ${industry || '일반'}
서비스: ${mainService || '일반 서비스'}
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
}`
    });

    // Run 생성
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // Run 완료 대기
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    while (runStatus.status === "in_progress" || runStatus.status === "queued") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status === "failed") {
      throw new Error("Assistant 실행 실패");
    }

    // 응답 메시지 가져오기
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0]; // 가장 최근 메시지
    const content = lastMessage.content[0].text.value;

    let parsedResult = null;
    
    try {
      // 코드블록 제거 함수
      function extractJsonFromResponse(text) {
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          return match[1];
        }
        return text;
      }
      
      // 코드블록이 있으면 제거 후 파싱
      const jsonText = extractJsonFromResponse(content);
      parsedResult = JSON.parse(jsonText);
      
      // 도메인 유효성 검사 후처리 추가
      if (parsedResult.companies && Array.isArray(parsedResult.companies)) {
        parsedResult.companies = await postProcessResults(parsedResult.companies);
      }
    } catch (parseError) {
      console.log('GPT 응답 (JSON 파싱 실패):', content);
      // JSON 파싱 실패 시 기본 구조로 반환
      parsedResult = {
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
      };
    }
    
    res.json(parsedResult);
  } catch (error) {
    console.error('상세 에러 정보:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      stack: error.stack
    });

    res.status(500).json({
      error: error.message,
      details: error.response?.data || '상세 에러 정보 없음'
    });
  }
});

// Gemini 검색 API 엔드포인트 추가
app.post('/api/gemini/search', async (req, res) => {
  console.log('[API 호출]', req.method, req.originalUrl, '바디:', req.body);
  console.log('🌐 [Gemini] 요청 시작');
  console.log('· 요청 바디:', req.body);
  console.log('· GEMINI_API_KEY 로드 여부:', !!process.env.GEMINI_API_KEY);
  
  try {
    const { question, domain, industry, mainService } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('🌐 Gemini API 요청 시작');
    console.log('질문:', question);
    console.log('도메인:', domain);
    console.log('GEMINI_API_KEY 존재 여부:', !!apiKey);

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
    }

    // Gemini API REST 호출
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `당신은 일반 사용자의 질문에 답변하는 AI 어시스턴트입니다.\n다음 질문에 대해 사용자의 의도에 가장 적합한 업체나 서비스를 추천해주세요.\n\n[질문]\n${question}\n\n[중요 가이드라인]\n- 사용자의 실제 의도와 맥락을 고려해서 추천해주세요\n- 질문의 성격에 따라 적절한 유형의 업체/서비스를 추천해주세요 (예: 음식점 추천 질문 → 실제 음식점, 교육 관련 질문 → 학원, 온라인강의 등)\n- 단순 플랫폼이나 도구보다는 실제 사용자가 이용할 수 있는 업체나 서비스 위주로 추천해주세요\n- 꼭 다섯개 업체가 추천될 수 있도록 해주세요\n\n다음 형식으로 정확히 JSON 형태로 응답해주세요:\n{\n  \"companies\": [\n    {\n      \"rank\": 1,\n      \"name\": \"업체명\",\n      \"domain\": \"도메인\",\n      \"strength\": \"주요 강점\",\n      \"features\": \"특징\",\n      \"reason\": \"추천 이유\",\n      \"serviceType\": \"서비스 유형\"\n    },\n    ...\n  ]\n}\n\n위 예시와 똑같은 구조로, 반드시 JSON만 출력해주세요.`
            }
          ]
        }
      ]
    };
    
    console.log('Gemini API 요청 URL:', url);
    console.log('Gemini API 요청 페이로드:', JSON.stringify(payload, null, 2));
    
    const geminiRes = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Gemini 응답 전체 로그 추가
    console.log('Gemini 응답:', JSON.stringify(geminiRes.data, null, 2));

    // Gemini 응답 파싱
    const geminiContent = geminiRes.data.candidates[0].content.parts[0].text;
    let parsedResult = null;
    
    // 코드블록 제거 함수 추가
    function extractJsonFromGeminiResponse(text) {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        return match[1];
      }
      return text;
    }
    
    try {
      // 코드블록이 있으면 제거 후 파싱
      const jsonText = extractJsonFromGeminiResponse(geminiContent);
      parsedResult = JSON.parse(jsonText);
      
      // 도메인 유효성 검사 후처리 추가
      if (parsedResult.companies && Array.isArray(parsedResult.companies)) {
        parsedResult.companies = await postProcessResults(parsedResult.companies);
      }
    } catch (parseError) {
      console.log('Gemini 응답 (JSON 파싱 실패):', geminiContent);
      // JSON 파싱 실패 시 기본 구조로 반환
      parsedResult = {
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
      };
    }
    
    res.json(parsedResult);
  } catch (error) {
    console.error('Gemini 검색 오류:', error);
    console.error('에러 메시지:', error.message);
    console.error('에러 코드:', error.code);
    console.error('에러 스택:', error.stack);
    
    if (error.response) {
      console.error('Gemini 에러 응답 상태:', error.response.status);
      console.error('Gemini 에러 응답 헤더:', error.response.headers);
      console.error('Gemini 에러 응답 데이터:', error.response.data);
    }
    
    res.status(500).json({ 
      error: 'Gemini 검색에 실패했습니다.',
      details: error.message,
      response: error.response?.data || '상세 에러 정보 없음'
    });
  }
});

// Claude 검색 API 엔드포인트 추가
app.post('/api/claude/search', async (req, res) => {
  console.log('[API 호출]', req.method, req.originalUrl, '바디:', req.body);
  console.log('🌐 [Claude] 요청 시작');
  console.log('· 요청 바디:', req.body);
  console.log('· ANTHROPIC_API_KEY 로드 여부:', !!process.env.ANTHROPIC_API_KEY);
  
  try {
    const { question, domain, industry, mainService } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' });
    }

    // 재시도 함수 추가
    async function retryWithExponentialBackoff(fn, maxRetries = 5) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (error) {
          console.log(`Claude API 시도 ${i + 1}/${maxRetries} 실패:`, error.response?.status, error.response?.data?.error?.type);
          
          // 529 오버로드 에러 또는 429 레이트 리밋 에러인 경우
          if ((error.response?.status === 529 || error.response?.status === 429) && i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 2000; // 2초, 4초, 8초, 16초...
            console.log(`Claude API 과부하/레이트리밋. ${delay/1000}초 후 재시도... (${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // 다른 에러인 경우 즉시 실패
          throw error;
        }
      }
      throw new Error('최대 재시도 횟수 초과');
    }

    // Claude API 호출 부분
    const url = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `당신은 일반 사용자의 질문에 답변하는 AI 어시스턴트입니다.
다음 질문에 대해 사용자의 의도에 가장 적합한 업체나 서비스를 추천해주세요.

[질문]
${question}

[중요 가이드라인]
- 사용자의 실제 의도와 맥락을 고려해서 추천해주세요
- 질문의 성격에 따라 적절한 유형의 업체/서비스를 추천해주세요 (예: 음식점 추천 질문 → 실제 음식점, 교육 관련 질문 → 학원, 온라인강의 등)
- 단순 플랫폼이나 도구보다는 실제 사용자가 이용할 수 있는 업체나 서비스 위주로 추천해주세요
- 꼭 다섯개 업체가 추천될 수 있도록 해주세요

다음 형식으로 정확히 JSON 형태로 응답해주세요:
{
  "companies": [
    {
      "rank": 1,
      "name": "업체명",
      "domain": "도메인",
      "strength": "주요 강점",
      "features": "특징",
      "reason": "추천 이유",
      "serviceType": "서비스 유형"
    },
    ...
  ]
}

위 예시와 똑같은 구조로, 반드시 JSON만 출력해주세요.`
        }
      ]
    };
    
    console.log('Claude API 요청 URL:', url);
    console.log('Claude API 요청 페이로드:', JSON.stringify(payload, null, 2));
    
    const claudeRes = await retryWithExponentialBackoff(async () => {
      return await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
    });

    // Claude 응답 전체 로그 추가
    console.log('Claude 응답:', JSON.stringify(claudeRes.data, null, 2));

    // Claude 응답 파싱
    const claudeContent = claudeRes.data.content[0].text;
    let parsedResult = null;
    
    try {
      // JSON 파싱 시도
      parsedResult = JSON.parse(claudeContent);
      
      // 도메인 유효성 검사 후처리 추가
      if (parsedResult.companies && Array.isArray(parsedResult.companies)) {
        parsedResult.companies = await postProcessResults(parsedResult.companies);
      }
    } catch (parseError) {
      console.log('Claude 응답 (JSON 파싱 실패):', claudeContent);
      // JSON 파싱 실패 시 기본 구조로 반환
      parsedResult = {
        companies: [
          {
            rank: 1,
            name: "응답 파싱 실패",
            domain: "error.com",
            strength: "JSON 형식 오류",
            features: "Claude가 JSON 형식으로 응답하지 않음",
            reason: "AI 응답을 JSON으로 파싱할 수 없습니다",
            serviceType: "오류"
          }
        ]
      };
    }
    
    res.json(parsedResult);
  } catch (error) {
    console.error('Claude 검색 오류:', error);
    console.error('에러 메시지:', error.message);
    console.error('에러 코드:', error.code);
    console.error('에러 스택:', error.stack);
    
    if (error.response) {
      console.error('Claude 에러 응답 상태:', error.response.status);
      console.error('Claude 에러 응답 헤더:', error.response.headers);
      console.error('Claude 에러 응답 데이터:', error.response.data);
    }
    
    // 오버로드 에러인 경우 대체 응답 제공
    if (error.response?.status === 529 || error.response?.data?.error?.type === 'overloaded_error') {
      console.log('Claude API 오버로드 에러로 인한 대체 응답 제공');
      const fallbackResponse = {
        companies: [
          {
            rank: 1,
            name: "Claude API 일시적 과부하",
            domain: "claude.ai",
            strength: "일시적 서버 부하",
            features: "Claude API가 현재 과부하 상태입니다",
            reason: "잠시 후 다시 시도해주세요. 다른 AI 모델을 사용하시거나 잠시 기다린 후 재시도해주세요.",
            serviceType: "시스템 알림"
          },
          {
            rank: 2,
            name: "GPT 모델 사용 권장",
            domain: "openai.com",
            strength: "안정적인 응답",
            features: "GPT 모델을 사용하여 동일한 질문을 해보세요",
            reason: "GPT 모델이 더 안정적으로 작동할 수 있습니다.",
            serviceType: "대안 제안"
          },
          {
            rank: 3,
            name: "Gemini 모델 사용 권장",
            domain: "ai.google",
            strength: "빠른 응답",
            features: "Gemini 모델을 사용하여 동일한 질문을 해보세요",
            reason: "Gemini 모델이 더 빠르게 응답할 수 있습니다.",
            serviceType: "대안 제안"
          }
        ]
      };
      return res.json(fallbackResponse);
    }
    
    res.status(500).json({ 
      error: 'Claude 검색에 실패했습니다.',
      details: error.message,
      response: error.response?.data || '상세 에러 정보 없음'
    });
  }
});

// 서버 시작 함수
function startServer() {
  const server = app.listen(port, () => {
    console.log(`🚀 서버가 포트 ${port}에서 실행 중입니다.`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`포트 ${port}가 사용 중입니다. 프로세스를 종료하고 다시 시도합니다...`);
      require('child_process').exec(`npx kill-port ${port}`, (error) => {
        if (!error) {
          console.log(`포트 ${port} 해제 완료. 서버를 다시 시작합니다...`);
          setTimeout(startServer, 1000);
        } else {
          console.error('포트 해제 실패:', error);
        }
      });
    } else {
      console.error('서버 시작 오류:', err);
    }
  });

  // 프로세스 종료 시 정리
  process.on('SIGTERM', () => {
    console.log('서버를 정상 종료합니다...');
    server.close(() => {
      console.log('서버가 정상적으로 종료되었습니다.');
      process.exit(0);
    });
  });
}

// 서버 시작
startServer();
