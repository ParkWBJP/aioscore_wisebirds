import React, { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import '../styles/main.css';
import { useNavigate, useLocation } from 'react-router-dom';

const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { domain, industry, mainService, questions: initialQuestions, siteInfo } = location.state || {};
  const [questions, setQuestions] = useState(initialQuestions || Array(5).fill(''));
  const [error, setError] = useState('');

  // 필수 파라미터 검증
  useEffect(() => {
    if (!domain || !industry || !mainService || !initialQuestions) {
      setError('필수 데이터가 누락되었습니다.');
      // 3초 후 홈으로 리다이렉트
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [domain, industry, mainService, initialQuestions, navigate]);

  const handleQuestionChange = (idx, value) => {
    const newQuestions = [...questions];
    newQuestions[idx] = value;
    setQuestions(newQuestions);
  };

  const handleStartAnalysis = () => {
    // 모든 질문이 입력되었는지 확인
    if (questions.some(q => !q.trim())) {
      setError('모든 질문을 입력해주세요.');
      return;
    }

    // 필수 데이터 검증
    if (!domain || !industry || !mainService) {
      console.error('Analysis로 이동 실패 - 필수 데이터 누락:', {
        domain,
        industry,
        mainService
      });
      setError('필수 데이터가 누락되었습니다. 처음부터 다시 시작해주세요.');
      return;
    }

    // 데이터 전달 전 로깅
    console.log('Analysis 페이지로 전달할 데이터:', {
      domain,
      industry,
      mainService,
      questions,
      siteInfo
    });

    navigate('/analysis', { 
      state: { 
        domain, 
        industry, 
        mainService, 
        questions: questions.map(q => q.trim()), // 공백 제거
        siteInfo 
      },
      replace: true // 뒤로가기 방지
    });
  };

  if (error) {
    return (
      <div className="result-page">
        <header className="result-header">
          <Logo />
        </header>
        <div className="error-container">
          <p className="error-message">{error}</p>
          <p>홈으로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="result-page">
      <header className="result-header">
        <Logo />
      </header>
      <div className="result-content">
        <div className="result-info">
          <div className="result-domain-industry">
            <span className="result-domain">도메인: <b>{domain}</b></span>
            <span className="result-industry">업종: <b>{industry}</b></span>
          </div>
          <div className="result-site-summary">
            {siteInfo ? (
              typeof siteInfo === 'object' ? (
                <div>
                  {siteInfo.title && <div><b>제목:</b> {siteInfo.title}</div>}
                  {siteInfo.description && <div><b>설명:</b> {siteInfo.description}</div>}
                  {siteInfo.mainKeywords && <div><b>주요 서비스:</b> {siteInfo.mainKeywords}</div>}
                </div>
              ) : (
                <p>{siteInfo}</p>
              )
            ) : (
              <p className="result-site-summary-fallback">크롤링 데이터 수집이 완료되지 않아 업종과 도메인 분석을 기준으로 질문을 작성하였습니다.</p>
            )}
          </div>
          {siteInfo && typeof siteInfo === 'object' && (
            <div className="result-site-summary-guide">
              # 위 내용은 AI(ChatGPT)가 실제 웹페이지를 크롤링하여 추출된 키워드 및 정보로 작성되었습니다.
            </div>
          )}
        </div>
        <h2 className="result-title">고객이 당신의 브랜드 또는 서비스를 찾기위해<br/>AI에게 어떻게 질문 할까요?</h2>
        <div className="result-questions">
          {questions.map((q, idx) => (
            <input
              key={idx}
              type="text"
              className="result-question-input"
              value={q}
              onChange={e => handleQuestionChange(idx, e.target.value)}
              placeholder={`질문 ${idx + 1}`}
              maxLength={100}
            />
          ))}
          <p className="result-questions-guide">
            * AI가 임의 생성한 질문이 어색하시다면 직접 질문을 입력하거나 수정하실 수 있습니다.
          </p>
        </div>
        <button 
          className="result-analyze-btn" 
          onClick={handleStartAnalysis}
          disabled={questions.some(q => !q.trim())}
        >
          AI 검색 분석 시작
        </button>
      </div>
    </div>
  );
};

export default Result; 