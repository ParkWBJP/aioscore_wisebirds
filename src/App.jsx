import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Loading from './pages/Loading';
import Result from './pages/Result';
import Analysis from './pages/Analysis';
import './styles/main.css';

function ResultWithState() {
  const location = useLocation();
  const { domain, industry, questions, siteInfo } = location.state || {};
  return <Result domain={domain} industry={industry} questions={questions} siteInfo={siteInfo} />;
}

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/result" element={<ResultWithState />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 