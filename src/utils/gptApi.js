const generatePrompt = (question, domain, industry, mainService) => {
  return `당신은 디지털 마케팅 전문가입니다. 
다음 질문에 대해 상위 5개의 추천 업체를 찾아주세요.

[컨텍스트]
- 산업군: ${industry}
- 주요 서비스/제품: ${mainService}
- 도메인: ${domain}

[질문]
${question}

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

응답 시 다음 사항을 준수해주세요:
1. 반드시 실제 존재하는 업체만 추천
2. 각 필드는 간단명료하게 작성
3. 순위는 해당 질문에 대한 적합도 기준
4. domain은 실제 웹사이트 주소 형식으로 작성
5. 모든 필드는 한글로 작성`;
};

export const searchGPT = async (question, domain, industry, mainService) => {
  try {
    const response = await fetch('/api/gpt/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        domain,
        industry,
        mainService
      })
    });

    if (!response.ok) {
      throw new Error('API 요청 실패');
    }

    const data = await response.json();
    return {
      companies: data.companies,
      topCompany: {
        name: data.companies[0].name,
        url: `https://${data.companies[0].domain}`
      }
    };
  } catch (error) {
    console.error('GPT API 오류:', error);
    throw error;
  }
}; 