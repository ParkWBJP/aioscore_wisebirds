import React, { useState } from 'react';
import Logo from '../components/Logo';
import '../styles/main.css';
import { useNavigate } from 'react-router-dom';

const Result = ({ domain, industry, mainService, siteInfo, questions: initialQuestions }) => {
  const [questions, setQuestions] = useState(initialQuestions || Array(5).fill(''));
  const navigate = useNavigate();

  const handleQuestionChange = (idx, value) => {
    const newQuestions = [...questions];
    newQuestions[idx] = value;
    setQuestions(newQuestions);
  };

  const handleStartAnalysis = () => {
    navigate('/analysis', { 
      state: { 
        domain, 
        industry, 
        mainService, 
        questions, 
        siteInfo 
      } 
    });
  };

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
        <button className="result-analyze-btn" onClick={handleStartAnalysis}>
          AI 검색 분석 시작
        </button>
      </div>
    </div>
  );
};

export default Result; 