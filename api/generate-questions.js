import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 사이트 요약 함수
async function getSiteSummary(url) {
  try {
    console.log('사이트 요약 시작:', url);
    const { data: buffer } = await axios.get(url, {
      timeout: 5000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
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
    console.log('사이트 요약 완료:', { title, description: description.substring(0, 100) });
    return { title, description, mainKeywords };
  } catch (e) {
    console.error('사이트 요약 중 오류:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  console.log('Generate Questions API 호출:', req.method, req.url);
  console.log('요청 바디:', req.body);
  
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

    const { domain, industry, mainService } = req.body;
    
    if (!domain || !industry || !mainService) {
      console.log('필수 파라미터 누락:', { domain, industry, mainService });
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    console.log('파라미터 확인:', { domain, industry, mainService });

    // 웹사이트 크롤링
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
- 웹사이트 키워드: ${mainKeywords}
- 웹사이트 설명: ${description}

[질문 작성 가이드라인]
1. 실제 고객이 자주 궁금해할 만한 실용적인 질문을 작성해 주세요
2. 자연스러운 구어체로 작성해 주세요 (예: "~을 추천해주세요", "~한 곳 없나요?", "어디가 좋을까요?")
3. 반드시 5개의 업체나 서비스가 추천될 수 있도록 질문을 구성해 주세요
4. 질문은 실제 소비자가 자주 사용하는 단어와 표현을 사용해 주세요
5. 웹사이트 정보를 참고하여 더 구체적이고 관련성 높은 질문을 작성해 주세요

[질문 예시 - 성형외과의 경우]
- "강남에서 코성형 잘하는 병원 5곳만 추천해주세요"
- "자연스러운 쌍꺼풀 수술 잘하는 곳 어디인가요? 5곳 정도 알려주세요"
- "가격대비 만족도 높은 성형외과 5군데 알려주세요"
- "수술 실력이 검증된 성형외과 TOP5 추천해주세요"
- "후기가 많고 신뢰할 수 있는 성형외과 5곳 알려주세요"

위 예시처럼, '${mainService}'를 찾는 실제 고객의 관점에서 자연스럽고 구체적인 질문 5개를 JSON 배열로만 출력해주세요.
반드시 JSON 배열로만 출력해주세요.`;

    console.log('OpenAI API 호출 시작');
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    });

    console.log('OpenAI API 응답 받음');

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
    } catch (parseError) {
      console.log('JSON 파싱 실패, fallback 사용');
      const fallback = response.choices?.[0]?.message?.content || '';
      questions = fallback
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^"|"$/g, '').trim())
        .slice(0, 5);
    }

    console.log('생성된 질문:', questions);
    res.json({ 
      questions, 
      siteInfo
    });
  } catch (error) {
    console.error('질문 생성 오류:', error);
    res.status(500).json({ 
      error: '질문 생성에 실패했습니다.',
      details: error.message 
    });
  }
} 