# 使用公网 npm 源，避免内网 nexus 导致部署失败
FROM node:20-alpine

WORKDIR /app

# 只用公网 registry
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/

# 先装根依赖
COPY package.json ./
RUN npm install --ignore-scripts

# 再装前端依赖（便于利用 Docker 层缓存）
COPY frontend/package.json frontend/
RUN cd frontend && npm install --ignore-scripts

COPY . .
# 在镜像内直接构建前端，不依赖根目录的 npm run build（避免平台误用 npm ci 导致缺 package-lock 报错）
RUN cd frontend && npm run build

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server/index.js"]
