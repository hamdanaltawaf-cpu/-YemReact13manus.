FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-noto-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install -g corepack@latest \
  && corepack pnpm install \
  && corepack pnpm run build

ENV NODE_ENV=production
ENV YEMREACT_WATERMARK_FONT=/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf
CMD ["node", "dist/index.js"]
