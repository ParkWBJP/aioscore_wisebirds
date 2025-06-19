import apiClient from './config.js';

export const searchClaude = async (question, domain, industry, mainService) => {
  try {
    const response = await apiClient.post('/api/claude/search', {
      question,
      domain,
      industry,
      mainService
    });

    return {
      companies: response.data.companies,
      topCompany: response.data.companies && response.data.companies[0]
        ? {
            name: response.data.companies[0].name,
            url: `https://${response.data.companies[0].domain}`
          }
        : { name: '', url: '' }
    };
  } catch (error) {
    console.error('Claude API 오류:', error);
    throw error;
  }
}; 