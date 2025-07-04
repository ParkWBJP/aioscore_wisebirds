// API 기본 URL 설정
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

// axios 기본 설정
import axios from 'axios';

const apiClient = axios.create({
  baseURL: window.location.origin,  // Vercel 배포 환경에서는 같은 도메인 사용
  timeout: 60000, // 60초로 증가 (서버 측 30초 + 여유 시간)
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient; 