# NestJS Starter Template

A production-ready, feature-rich starter template for building scalable backend applications with NestJS, Prisma ORM, and AWS integration. Includes authentication, real-time chat, file uploads, job queues, and complete Docker deployment setup.


### Core Stack

- **NestJS** - Progressive Node.js framework
- **Prisma ORM** - Type-safe database access with split schema architecture
- **PostgreSQL** - Primary database
- **Redis** - Caching and queue management
- **TypeScript** - Full type safety
- **Docker** - Production and development containers

### Authentication & Security

- JWT-based authentication with refresh tokens
- Email verification via OTP
- Password reset flow
- Role-based access control (SUPER_ADMIN, ADMIN, USER)
- Bcrypt password hashing
- Passport.js integration

### Real-time Features

- WebSocket Gateway with Socket.IO
- Private messaging system
- Conversation management (archive, block, delete)
- WebRTC support with TURN server (coturn)
- Live reload in development

### File Management

- File upload with Multer
- AWS S3 integration
- Configurable upload limits (up to 500MB via Caddy)

### Background Jobs

- BullMQ job queues
- Event-driven architecture with EventEmitter
- Scheduled tasks with @nestjs/schedule

### Developer Experience

- **Commitizen** - Interactive commit generator
- **Commitlint** - Lint commit messages
- **Semantic Release** - Automated versioning and changelogs
- **Lint Staged** - Run linters on staged files
- **ESLint + Prettier** - Automated linting and formatting
- **CI/CD** - GitHub Actions workflow
- **Swagger** - API documentation
- **Split Prisma Schema** - Organized database models


```



### Running Locally

```bash
# Install dependencies
pnpm install

# Setup database (Prisma)
pnpm prisma generate
pnpm db:migrate

# Run app in dev mode
pnpm dev
```

### Full Docker Development

```bash
# Start dev environment
docker compose -f compose.yaml up -d
```

### Production

```bash
# Start production stack
docker compose -f compose.yaml up -d --profiles prod
```



## 🔄 CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci-cd.yml`):

1. **CI Check** (on PR/push to main)
   - Lint check
   - Format check
   - Build validation

2. **Build & Push** (on merge to main)
   - Build Docker image
   - Push to Docker Hub
   - Tag with `latest`, version, and commit SHA

3. **Deploy** (commented out, ready to configure)
   - Transfer files via SCP
   - SSH into VPS
   - Pull and restart containers

4. **Release** (Automated)
   - Analyzes commits via Semantic Release
   - Bumps version (package.json)
   - Generates CHANGELOG.md
   - Publishes GitHub Release

## 🐳 Docker Architecture

### Production (`compose.yaml`)

- **server** - NestJS API (multi-stage build)
- **db** - PostgreSQL 17
- **redis-master** - Redis primary
- **redis-replica** - Redis replica for HA
- **caddy** - Reverse proxy with auto-HTTPS
- **coturn** - TURN server for WebRTC

### Development (`compose.dev.yaml`)

- **app** - NestJS with hot reload
- **db** - PostgreSQL
- **redis-master** - Redis

### Key Features

- Health checks for all services
- Volume persistence
- Network isolation
- Production-ready reverse proxy

## 📝 Code Quality

### Pre-commit Hooks

Husky triggers `lint-staged` and `commitlint` on commit:

- **Lint Staged**: Runs `eslint` and `prettier` on staged files to ensure code quality before it's committed.
- **Commitlint**: Enforces conventional commit message format.

### Commit Guidelines

We use **Conventional Commits**. The easiest way to commit is:

```bash
pnpm commit
```

This triggers an interactive prompt (`commitizen`) to help you create a valid commit message.
Alternatively, ensure your commits follow the format: `type(scope): subject` (e.g., `feat: add new login page`).

### Linting & Formatting

- **ESLint** - TypeScript-ESLint rules
- **Prettier** - Consistent code style
- **Auto-fix** - Both tools auto-fix on commit

## 🔐 Security Features

- JWT with refresh token rotation
- Bcrypt password hashing
- OTP-based email verification
- Role-based access control
- CORS configuration
- Rate limiting ready

## 📚 API Documentation

Swagger UI available at `/docs` when running the server.
