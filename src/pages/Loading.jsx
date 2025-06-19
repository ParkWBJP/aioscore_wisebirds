import React from 'react';
import '../styles/main.css';

const Loading = () => {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-spinner-wrapper">
          <div className="loading-spinner"></div>
          <div className="loading-spinner-inner"></div>
        </div>
        <div className="loading-text-wrapper">
          <p className="loading-text">AI가 분석중입니다</p>
          <p className="loading-subtext">사이트 및 도메인/업종을 분석하여<br />실제 고객의 검색 추천 질문을 생성합니다</p>
        </div>
      </div>
    </div>
  );
};

export default Loading; 