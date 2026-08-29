# Static, fully self-contained ffmpeg/ffprobe binaries — avoids `apk add ffmpeg`,
# which now drags in the entire Vulkan/GPU stack (vulkan-loader, shaderc,
# glslang, libplacebo…) that a CPU-only libx264 transcoder never uses.
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM node:22-alpine AS base

WORKDIR /app

# Only the ffmpeg binary is needed — this pipeline sets codecs/size explicitly
# and never probes input metadata, so ffprobe (another ~135 MB) is omitted.
# If you later use fluent-ffmpeg features that require probing, add it back:
#   COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe
COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg

COPY package*.json ./
# --mount caches the npm store across rebuilds; `npm ci --omit=dev` is
# deterministic (uses the lockfile) and installs prod deps only.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY . .

CMD ["npm", "start"]
