export default function handler(req, res) {
  console.log('Test API 호출:', req.method, req.url);
  
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

  try {
    res.status(200).json({ 
      message: 'Test API 작동 중',
      method: req.method,
      url: req.url,
      body: req.body,
      env: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY
      }
    });
  } catch (error) {
    console.error('Test API 오류:', error);
    res.status(500).json({ error: 'Test API 오류', details: error.message });
  }
} 