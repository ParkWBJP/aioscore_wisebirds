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
    const { domain, industry, mainService } = req.body;
    
    if (!domain || !industry || !mainService) {
      console.log('필수 파라미터 누락:', { domain, industry, mainService });
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    console.log('파라미터 확인:', { domain, industry, mainService });

    // 간단한 응답으로 테스트
    const questions = [
      `${industry}에서 ${mainService} 추천해주세요`,
      `${mainService} 잘하는 곳 어디인가요?`,
      `${industry} 업계에서 ${mainService} TOP5 알려주세요`,
      `${mainService} 가격대비 만족도 높은 곳 추천해주세요`,
      `${industry}에서 ${mainService} 후기가 좋은 곳 5곳 알려주세요`
    ];

    console.log('생성된 질문:', questions);
    res.json({ 
      questions, 
      siteInfo: { title: '테스트', description: '테스트 설명' },
      message: '테스트 모드로 실행됨'
    });
  } catch (error) {
    console.error('질문 생성 오류:', error);
    res.status(500).json({ 
      error: '질문 생성에 실패했습니다.',
      details: error.message 
    });
  }
} 