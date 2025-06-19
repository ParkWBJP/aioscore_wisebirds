import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { searchGPT } from '../api/gptApi';
import { searchGemini } from '../api/geminiApi';
import { searchClaude } from '../api/claudeApi';
import '../styles/analysis.css';

// 검색 결과 상세 리포트 컴포넌트
const SearchReport = ({ questions, results }) => {
  const [selectedPlatform, setSelectedPlatform] = useState('GPT');
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const platforms = ['GPT', 'Claude', 'Gemini'];

  return (
    <div className="search-report">
      <h3 className="report-title">AI 검색 결과 상세 분석</h3>
      
      <div className="platform-tabs">
        {platforms.map(platform => (
          <button
            key={platform}
            className={`platform-tab ${selectedPlatform === platform ? 'active' : ''}`}
            onClick={() => setSelectedPlatform(platform)}
          >
            {platform}
          </button>
        ))}
      </div>

      <div className="question-tabs">
        {questions.map((question, qIdx) => (
          <button
            key={qIdx}
            className={`question-tab ${selectedQuestion === qIdx ? 'active' : ''}`}
            onClick={() => setSelectedQuestion(qIdx)}
            title={question}
          >
            <span className="question-number">Q{qIdx + 1}.</span>
            <span className="question-preview">
              {question.length > 30 ? `${question.substring(0, 30)}...` : question}
            </span>
          </button>
        ))}
      </div>

      <div className="report-content">
        <div className="question-report">
          <h4 className="question-title">Q{selectedQuestion + 1}. {questions[selectedQuestion]}</h4>
          <table className="results-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>상호</th>
                <th>도메인</th>
                <th>강점</th>
                <th>특징</th>
                <th>추천 이유</th>
                <th>서비스 유형</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(rank => (
                <tr key={rank}>
                  <td>{rank}</td>
                  <td>{results[selectedQuestion]?.[selectedPlatform]?.companies?.[rank-1]?.name || '-'}</td>
                  <td>{results[selectedQuestion]?.[selectedPlatform]?.companies?.[rank-1]?.domain || '-'}</td>
                  <td>{results[selectedQuestion]?.[selectedPlatform]?.companies?.[rank-1]?.strength || '-'}</td>
                  <td>{results[selectedQuestion]?.[selectedPlatform]?.companies?.[rank-1]?.features || '-'}</td>
                  <td>{results[selectedQuestion]?.[selectedPlatform]?.companies?.[rank-1]?.reason || '-'}</td>
                  <td>{results[selectedQuestion]?.[selectedPlatform]?.companies?.[rank-1]?.serviceType || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// [추가] AI별 추천 결과 표 컴포넌트
const AIResultTable = ({ questions, searchResults, searchStatus }) => {
  const platforms = ['GPT', 'Claude', 'Gemini'];
  return (
    <table className="ai-result-table">
      <thead>
        <tr>
          <th>질문</th>
          {platforms.map(p => <th key={p}>{p}</th>)}
        </tr>
      </thead>
      <tbody>
        {questions.map((question, qIdx) => (
          <tr key={qIdx}>
            <td className="ai-question-cell">{question}</td>
            {platforms.map(platform => {
              const status = searchStatus[qIdx]?.[platform];
              const result = searchResults[qIdx]?.[platform];
              if (status === 'searching') {
                return (
                  <td key={platform} className="ai-loading-cell">
                    <div className="loading-indicator">
                      <div className="loading-spinner"></div>
                      <span>분석중</span>
                    </div>
                  </td>
                );
              }
              if (status === 'completed' && result?.companies?.[0]) {
                const topCompany = result.companies[0];
                return (
                  <td key={platform} className="ai-result-cell">
                    <div className="result-content">
                      <div className="company-info">
                        <span className="rank-badge">
                          <span className="trophy-icon">🏆</span>
                          상위노출
                        </span>
                        <strong className="company-name">{topCompany.name}</strong>
                        {topCompany.domain && (
                          <a 
                            href={topCompany.domain.startsWith('http') ? topCompany.domain : `https://${topCompany.domain}`}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="company-link"
                            title={`${topCompany.domain} 바로가기`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"></path>
                              <path d="M20 8v-4h-4"></path>
                              <path d="M14 4l6 6"></path>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                );
              }
              if (status === 'error') {
                return (
                  <td key={platform} className="ai-error-cell">
                    <div className="error-content">
                      <span className="error-icon">❌</span>
                      <span>오류 발생</span>
                    </div>
                  </td>
                );
              }
              return <td key={platform} className="ai-empty-cell">-</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Analysis = () => {
  const location = useLocation();
  const { questions, domain, industry, mainService } = location.state || {};
  const [searchStatus, setSearchStatus] = useState({});
  const [searchResults, setSearchResults] = useState({});
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState(null);
  
  const platforms = ['GPT', 'Claude', 'Gemini'];

  useEffect(() => {
    // 필수 파라미터 검증
    if (!questions || !domain || !industry || !mainService) {
      setError('필수 파라미터가 누락되었습니다. 처음부터 다시 시작해주세요.');
      return;
    }

    // 검색 시작
    startGPTSearch();
    // Claude(실제 API 호출) + Gemini(실제 API 호출)
    questions.forEach((_, qIdx) => {
      // Claude API 호출
      (async () => {
        setSearchStatus(prev => ({
          ...prev,
          [qIdx]: { ...prev[qIdx], Claude: 'searching' }
        }));
        try {
          const result = await searchClaude(
            questions[qIdx],
            domain,
            industry,
            mainService
          );
          setSearchResults(prev => ({
            ...prev,
            [qIdx]: { ...prev[qIdx], Claude: result }
          }));
          setSearchStatus(prev => ({
            ...prev,
            [qIdx]: { ...prev[qIdx], Claude: 'completed' }
          }));
        } catch (error) {
          setSearchStatus(prev => ({
            ...prev,
            [qIdx]: { ...prev[qIdx], Claude: 'error' }
          }));
          setError(`질문 ${qIdx + 1}의 Claude 검색 중 오류가 발생했습니다: ${error.message}`);
        }
      })();

      // Gemini API 호출
      (async () => {
        setSearchStatus(prev => ({
          ...prev,
          [qIdx]: { ...prev[qIdx], Gemini: 'searching' }
        }));
        try {
          const result = await searchGemini(
            questions[qIdx],
            domain,
            industry,
            mainService
          );
          setSearchResults(prev => ({
            ...prev,
            [qIdx]: { ...prev[qIdx], Gemini: result }
          }));
          setSearchStatus(prev => ({
            ...prev,
            [qIdx]: { ...prev[qIdx], Gemini: 'completed' }
          }));
        } catch (error) {
          setSearchStatus(prev => ({
            ...prev,
            [qIdx]: { ...prev[qIdx], Gemini: 'error' }
          }));
          setError(`질문 ${qIdx + 1}의 Gemini 검색 중 오류가 발생했습니다: ${error.message}`);
        }
      })();
    });
  }, []);

  // 검색 완료 여부 체크
  const isAllSearchCompleted = () => {
    return questions.every((_, qIdx) =>
      platforms.every(platform => searchStatus[qIdx]?.[platform] === 'completed')
    );
  };

  useEffect(() => {
    if (isAllSearchCompleted()) {
      const timer = setTimeout(() => {
        setShowReport(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [searchStatus]);

  const startGPTSearch = async () => {
    // 각 질문에 대해 순차적으로 GPT API 호출
    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      try {
        // 상태 업데이트: 검색 중
        setSearchStatus(prev => ({
          ...prev,
          [qIdx]: { ...prev[qIdx], GPT: 'searching' }
        }));

        // GPT API 호출
        const result = await searchGPT(
          questions[qIdx],
          domain,
          industry,
          mainService
        );

        // 검색 결과 저장
        setSearchResults(prev => ({
          ...prev,
          [qIdx]: { ...prev[qIdx], GPT: result }
        }));

        // 상태 업데이트: 검색 완료
        setSearchStatus(prev => ({
          ...prev,
          [qIdx]: { ...prev[qIdx], GPT: 'completed' }
        }));

      } catch (error) {
        console.error(`질문 ${qIdx + 1} GPT 검색 실패:`, error);
        setSearchStatus(prev => ({
          ...prev,
          [qIdx]: { ...prev[qIdx], GPT: 'error' }
        }));
        setError(`질문 ${qIdx + 1}의 GPT 검색 중 오류가 발생했습니다: ${error.message}`);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⚪';
      case 'searching': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⚪';
    }
  };

  return (
    <div className="analysis-container">
      <header className="analysis-header">
        <Logo />
        <h2 className="analysis-title">AI 검색 분석 진행 중</h2>
        <p className="analysis-subtitle">
          입력하신 질문들로 각 AI 플랫폼에서 실시간 검색을 진행하고 있습니다
        </p>
        {error && (
          <p className="error-message">{error}</p>
        )}
      </header>

      {/* [변경] 표 형태로 결과 표시 */}
      <div className="ai-table-wrapper">
        <AIResultTable questions={questions} searchResults={searchResults} searchStatus={searchStatus} />
      </div>

      {showReport && (
        <>
          <SearchReport questions={questions} results={searchResults} />
          <div className="aio-diagnosis">
            <h3>Wisebirds AIO 진단결과</h3>
            <p>진단 결과 내용은 추후 업데이트 예정입니다.</p>
          </div>
        </>
      )}
    </div>
  );
};

export default Analysis; 