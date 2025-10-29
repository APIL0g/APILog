# ---------- Build ----------
FROM node:20-alpine AS builder
WORKDIR /app

ENV CI=1 \
    NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .

# --- 중요: next.config.* 에 output:'export' 가 있어도 무력화 (SSR로 강제) ---
# ESM(.mjs)와 CJS(.js) 모두 대응
RUN if [ -f next.config.mjs ]; then \
      mv next.config.mjs next.config.orig.mjs && \
      printf "import cfg from './next.config.orig.mjs';\ndelete cfg.output;\nexport default cfg;\n" > next.config.mjs; \
    elif [ -f next.config.js ]; then \
      mv next.config.js next.config.orig.js && \
      printf "const cfg = require('./next.config.orig.js');\ndelete cfg.output;\nmodule.exports = cfg;\n" > next.config.js; \
    fi

RUN npm run build

# 런타임 최소화를 위해 dev 의존성 제거
RUN npm prune --omit=dev

# ---------- Run ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# 헬스체크용 curl
RUN apk add --no-cache curl

COPY --from=builder /app /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ || exit 1

# package.json에 "start": "next start -p 3000" 가정
CMD ["npm", "start"]
