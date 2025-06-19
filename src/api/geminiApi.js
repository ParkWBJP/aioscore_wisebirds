import apiClient from './config.js';

export const searchGemini = async (question, domain, industry, mainService) => {
  const response = await apiClient.post('/api/gemini/search', {
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
}; 