import React, { useState } from 'react';
import '../styles/main.css';
import { generateQuestions } from '../api/gptGenerateQuestions';
import { useNavigate } from 'react-router-dom';

const industries = [
  { id: 'restaurant', name: '음식점' },
  { id: 'retail', name: '소매업' },
  { id: 'service', name: '서비스업' },
  { id: 'education', name: '교육' },
  { id: 'healthcare', name: '의료/건강' },
  { id: 'tech', name: '기술/IT' },
  { id: 'medical', name: '의료/건강 서비스' },
  { id: 'law', name: '법률/컨설팅' },
  { id: 'online-edu', name: '교육/온라인 강의' },
  { id: 'realestate', name: '부동산/임대' },
  { id: 'tour', name: '관광/여행' },
  { id: 'ecommerce', name: '전자상거래' },
  { id: 'finance', name: '금융/투자' },
  { id: 'software', name: '소프트웨어/IT 서비스' },
  { id: 'hotel', name: '호텔/숙박' },
  { id: 'restaurant2', name: '레스토랑/외식' },
  { id: 'auto', name: '자동차/모빌리티' },
  { id: 'distribution', name: '유통/물류' },
  { id: 'entertainment', name: '엔터테인먼트/미디어' },
  { id: 'manufacturing', name: '제조/산업 장비' },
  { id: 'sports', name: '스포츠/피트니스' },
  { id: 'marketing', name: '광고/마케팅' },
];

const Home = () => {
  const [domain, setDomain] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [mainService, setMainService] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validateDomain = (domain) => {
    // http://, https://, www. 포함 다양한 도메인 허용
    const domainRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
    return domainRegex.test(domain);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!domain) {
      setError('도메인을 입력해주세요.');
      return;
    }

    if (!validateDomain(domain)) {
      setError('유효한 도메인을 입력해주세요. (예: example.com)');
      return;
    }

    if (!selectedIndustry) {
      setError('업종을 선택해주세요.');
      return;
    }

    if (!mainService) {
      setError('주요 서비스 또는 제품을 입력해주세요.');
      return;
    }

    try {
      navigate('/loading', { state: { domain, industry: selectedIndustry, mainService } });
      const { questions, siteInfo } = await generateQuestions(domain, selectedIndustry, mainService);
      navigate('/result', { state: { domain, industry: selectedIndustry, mainService, questions, siteInfo } });
    } catch (err) {
      setError('질문 생성에 실패했습니다.');
    }
  };

  return (
    <div className="home-container">
      <h1>Wisebirds AI Optimization</h1>
      <p className="subtitle">당신의 브랜드가 AI에 얼마나 노출되는지 확인하세요</p>

      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-group">
          <label htmlFor="domain">도메인 주소</label>
          <input
            type="text"
            id="domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className={error && !domain ? 'error' : ''}
          />
        </div>

        <div className="input-group">
          <label htmlFor="industry">업종 선택</label>
          <select
            id="industry"
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className={error && !selectedIndustry ? 'error' : ''}
          >
            <option value="">업종을 선택하세요</option>
            {industries.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {industry.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label htmlFor="mainService">주요 서비스 또는 제품 <span style={{color:'#ff6b6b'}}>*</span></label>
          <input
            type="text"
            id="mainService"
            value={mainService}
            onChange={(e) => setMainService(e.target.value)}
            placeholder="예: AI 마케팅 솔루션, 온라인 영어 강의 등"
            className={error && !mainService ? 'error' : ''}
          />
        </div>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" className="submit-button">
          분석 시작하기
        </button>
      </form>
    </div>
  );
};

export default Home; 