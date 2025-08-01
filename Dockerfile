FROM node:20-alpine AS base

# Install Python 3, build tools, and other dependencies
RUN apk add --no-cache python3 py3-pip make g++ libc6-compat

# Ensure python3 is available as 'python'
RUN ln -sf python3 /usr/bin/python
# Verify Python installation
RUN python --version && pip3 --version

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN apk update && apk add --no-cache curl bash busybox-suid
#COPY check_batch.sh /usr/local/bin/check_batch.sh
# RUN #chmod +rx /usr/local/bin/check_batch.sh

# RUN echo "*/5 * * * * /usr/local/bin/check_batch.sh" > /etc/crontabs/root

ENV NODE_ENV=production
ENV PORT=3000

# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs
# Set the correct permission for prerender cache
RUN mkdir .next
# RUN chown nextjs:nodejs .next

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
#COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
#COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/types ./.next/types

RUN ls -la && ls -la .next/static


EXPOSE 3000


# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
# CMD crond && \
#    HOSTNAME="0.0.0.0" node server.js
#CMD ["sh", "-c", "crond && HOSTNAME=0.0.0.0 node server.js"]
CMD ["sh", "-c", "cd /app && HOSTNAME=0.0.0.0 node server.js"]
#CMD ["sh", "-c", "cd /app/.next/standalone && HOSTNAME=0.0.0.0 node server.js"]
#CMD ["node", "server.js"]
