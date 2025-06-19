import apiClient from './config.js';

export const searchGPT = async (question, domain, industry, mainService) => {
  try {
    const response = await apiClient.post('/api/gpt/search', {
      question,
      domain,
      industry,
      mainService
    });

    return {
      companies: response.data.companies,
      topCompany: {
        name: response.data.companies[0].name,
        url: `https://${response.data.companies[0].domain}`
      }
    };
  } catch (error) {
    console.error('GPT API 오류:', error);
    throw error;
  }
}; 