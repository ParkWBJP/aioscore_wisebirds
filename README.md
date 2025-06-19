# AI Score - AI 기업 추천 시스템

AI 모델(GPT, Gemini, Claude)을 활용하여 사용자 질문에 맞는 한국 기업을 추천하는 웹 애플리케이션입니다.

## 🚀 주요 기능

- **다중 AI 모델 지원**: GPT-4o, Gemini, Claude
- **실시간 기업 추천**: 사용자 질문에 맞는 한국 기업 5곳 추천
- **도메인 유효성 검사**: 추천된 기업의 웹사이트 유효성 자동 검증
- **질문 자동 생성**: 업종과 서비스 정보를 바탕으로 질문 자동 생성
- **현대적인 UI**: React와 Framer Motion을 활용한 반응형 디자인

## 🛠️ 기술 스택

### Frontend
- React 18
- Vite
- Framer Motion
- Chart.js
- React Router

### Backend
- Node.js
- Express
- OpenAI API (GPT-4o)
- Google Gemini API
- Anthropic Claude API

## 📦 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/aioscore2.git
cd aioscore2
```

### 2. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Anthropic Claude API
ANTHROPIC_API_KEY=your_claude_api_key
```

### 3. 의존성 설치
```bash
# 루트 디렉토리 (프론트엔드)
npm install

# 서버 디렉토리
cd server
npm install
cd ..
```

### 4. 개발 서버 실행
```bash
# 프론트엔드와 백엔드 동시 실행
npm run dev

# 또는 개별 실행
npm run dev:client  # 프론트엔드만 (포트 5173)
npm run dev:server  # 백엔드만 (포트 3002)
```

## 🌐 배포

### Vercel 배포 (권장)

1. [Vercel](https://vercel.com)에 가입
2. GitHub 저장소 연결
3. 환경 변수 설정 (Vercel 대시보드에서)
4. 자동 배포 완료

### Netlify 배포

1. [Netlify](https://netlify.com)에 가입
2. GitHub 저장소 연결
3. 빌드 설정:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 환경 변수 설정
5. 배포 완료

## 📁 프로젝트 구조

```
aioscore2/
├── src/                    # React 프론트엔드
│   ├── components/         # 재사용 가능한 컴포넌트
│   ├── pages/             # 페이지 컴포넌트
│   ├── api/               # API 호출 함수
│   └── styles/            # CSS 스타일
├── server/                # Node.js 백엔드
│   └── index.js           # Express 서버
├── public/                # 정적 파일
└── package.json           # 프로젝트 설정
```

## 🔧 API 엔드포인트

- `POST /api/gpt/search` - GPT 기반 기업 추천
- `POST /api/gemini/search` - Gemini 기반 기업 추천
- `POST /api/claude/search` - Claude 기반 기업 추천
- `POST /api/generate-questions` - 질문 자동 생성

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요. 