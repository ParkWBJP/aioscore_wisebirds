import apiClient from './config.js';

/**
 * 백엔드 API를 통해 도메인, 업종, 주요 서비스/제품에 대한 예상 질문 5개를 생성합니다.
 * @param {string} domain - 분석할 도메인 주소
 * @param {string} industry - 업종 정보
 * @param {string} mainService - 주요 서비스/제품
 * @returns {Promise<{questions: string[], siteInfo: string|null}>} 예상 질문 5개와 사이트 요약
 */
export const generateQuestions = async (domain, industry, mainService) => {
  try {
    const response = await apiClient.post('/api/generate-questions', {
      domain,
      industry,
      mainService
    });

    return {
      questions: response.data.questions,
      siteInfo: response.data.siteInfo,
    };
  } catch (error) {
    console.error('질문 생성 중 오류 발생:', error);
    throw new Error('질문 생성에 실패했습니다. 다시 시도해주세요.');
  }
}; 