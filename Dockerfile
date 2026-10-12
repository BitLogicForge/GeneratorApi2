# Replace with your image containing Node.js, Chromium, and its Linux libraries.
ARG RUNTIME_IMAGE=your-registry.example.com/node-chromium:replace-me

FROM ${RUNTIME_IMAGE} AS runtime
ARG RUNTIME_USER=node
USER root
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
# Chromium, its libraries, and PLAYWRIGHT_BROWSERS_PATH come from the base image.
RUN npm ci --omit=dev --no-audit --no-fund

# GitLab builds dist/ before uploading the ACR context. No src/ is copied.
COPY dist/ ./dist/
COPY templates/*.pptx ./templates/

USER ${RUNTIME_USER}

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/internal/ready', { signal: AbortSignal.timeout(4000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["node"]
CMD ["dist/index.js"]
