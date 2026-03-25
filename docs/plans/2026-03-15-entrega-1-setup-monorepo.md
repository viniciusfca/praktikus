# Entrega 1: Setup do Monorepo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar a estrutura base do monorepo Practicus com NestJS backend, React+MUI frontend, PostgreSQL, Redis e Docker Compose para desenvolvimento local funcionando com `docker-compose up`.

**Architecture:** Monorepo com pnpm workspaces contendo `apps/backend` (NestJS + TypeORM), `apps/frontend` (React + Vite + MUI) e `packages/shared` (tipos TypeScript compartilhados). Docker Compose orquestra todos os serviços. Dark theme MUI como padrão com toggle para light.

**Tech Stack:** pnpm 8+, Node 20, NestJS 10, TypeORM 0.3, PostgreSQL 15, Redis 7, React 18, Vite 5, MUI v5, React Router v6, TypeScript 5, Docker + Docker Compose v2.

---

## Task 1: Inicializar o Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Inicializar git no diretório do projeto**

```bash
cd c:/Users/vinic/OneDrive/Projetos/practicus
git init
```

Expected: `Initialized empty Git repository in .../practicus/.git/`

**Step 2: Criar `package.json` raiz**

```json
{
  "name": "practicus",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "docker-compose up",
    "dev:backend": "pnpm --filter backend dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

**Step 3: Criar `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Step 4: Criar `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 5: Criar `.gitignore`**

```
node_modules/
dist/
build/
.env
.env.local
.env*.local
*.log
.DS_Store
coverage/
.pnpm-store/
```

**Step 6: Criar `.nvmrc`**

```
20
```

**Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize pnpm monorepo structure"
```

---

## Task 2: Criar o Pacote Compartilhado (shared)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/enums/roles.enum.ts`
- Create: `packages/shared/src/enums/tenant-status.enum.ts`

**Step 1: Criar estrutura de diretórios**

```bash
mkdir -p packages/shared/src/enums
```

**Step 2: Criar `packages/shared/package.json`**

```json
{
  "name": "@practicus/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**Step 3: Criar `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "target": "ES2020"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Criar `packages/shared/src/enums/roles.enum.ts`**

```typescript
export enum Role {
  OWNER = 'OWNER',
  EMPLOYEE = 'EMPLOYEE',
}
```

**Step 5: Criar `packages/shared/src/enums/tenant-status.enum.ts`**

```typescript
export enum TenantStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  OVERDUE = 'OVERDUE',
  SUSPENDED = 'SUSPENDED',
}
```

**Step 6: Criar `packages/shared/src/index.ts`**

```typescript
export * from './enums/roles.enum';
export * from './enums/tenant-status.enum';
```

**Step 7: Build do pacote compartilhado**

```bash
cd packages/shared
pnpm install
pnpm build
```

Expected: diretório `packages/shared/dist/` criado com arquivos `.js` e `.d.ts`.

**Step 8: Commit**

```bash
cd ../../
git add packages/
git commit -m "chore: add shared package with base enums"
```

---

## Task 3: Criar o Backend NestJS

**Files:**
- Create: `apps/backend/` (scaffold via Nest CLI)
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/tsconfig.json`
- Create: `apps/backend/src/health/health.controller.ts`
- Create: `apps/backend/src/health/health.controller.spec.ts`

**Step 1: Criar o app NestJS via CLI**

```bash
cd apps
npx @nestjs/cli new backend --package-manager pnpm --skip-git --strict
```

Expected: diretório `apps/backend/` criado com estrutura NestJS padrão.

**Step 2: Adicionar dependência do pacote shared**

Editar `apps/backend/package.json`, adicionar em `dependencies`:

```json
"@practicus/shared": "workspace:*"
```

**Step 3: Atualizar `apps/backend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@practicus/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Step 4: Escrever o teste do health check ANTES de implementar**

Criar `apps/backend/src/health/health.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return status ok', () => {
    const result = controller.check();
    expect(result).toEqual({ status: 'ok', timestamp: expect.any(String) });
  });
});
```

**Step 5: Rodar o teste para confirmar que FALHA**

```bash
cd apps/backend
pnpm test -- --testPathPattern=health.controller.spec
```

Expected: FAIL — `Cannot find module './health.controller'`

**Step 6: Implementar o HealthController**

Criar `apps/backend/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
```

**Step 7: Registrar o controller no AppModule**

Editar `apps/backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
```

**Step 8: Rodar o teste para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=health.controller.spec
```

Expected: PASS — `✓ should return status ok`

**Step 9: Criar `apps/backend/.env.example`**

```env
# App
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=practicus
DB_PASS=practicus_dev
DB_NAME=practicus

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=change_me_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

**Step 10: Commit**

```bash
cd ../../
git add apps/backend/
git commit -m "feat(backend): scaffold NestJS app with health check endpoint"
```

---

## Task 4: Configurar Variáveis de Ambiente no Backend

**Files:**
- Modify: `apps/backend/package.json` (adicionar `@nestjs/config`)
- Modify: `apps/backend/src/app.module.ts`
- Create: `apps/backend/.env` (não commitado)

**Step 1: Instalar dependências de configuração**

```bash
cd apps/backend
pnpm add @nestjs/config
```

**Step 2: Criar `apps/backend/.env` local (não commitado)**

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=practicus
DB_PASS=practicus_dev
DB_NAME=practicus
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev_secret_change_in_prod
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

**Step 3: Adicionar ConfigModule ao AppModule**

Editar `apps/backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
```

**Step 4: Atualizar `apps/backend/src/main.ts` para usar PORT do .env**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
```

**Step 5: Rodar todos os testes do backend**

```bash
pnpm test
```

Expected: PASS — todos os testes existentes passam.

**Step 6: Commit**

```bash
cd ../../
git add apps/backend/src/ apps/backend/.env.example
git commit -m "feat(backend): add ConfigModule and environment setup"
```

---

## Task 5: Configurar TypeORM e Conexão com PostgreSQL

**Files:**
- Modify: `apps/backend/package.json`
- Create: `apps/backend/src/database/database.module.ts`
- Create: `apps/backend/src/database/database.module.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

**Step 1: Instalar dependências do TypeORM**

```bash
cd apps/backend
pnpm add @nestjs/typeorm typeorm pg
```

**Step 2: Escrever teste de integração para conexão ANTES de implementar**

Criar `apps/backend/src/database/database.module.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

describe('Database Connection', () => {
  it('should connect to PostgreSQL successfully', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ envFilePath: '.env' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'practicus',
          password: process.env.DB_PASS ?? 'practicus_dev',
          database: process.env.DB_NAME ?? 'practicus',
          entities: [],
          synchronize: false,
        }),
      ],
    }).compile();

    const dataSource = module.get('DATA_SOURCE' as any);
    expect(module).toBeDefined();
    await module.close();
  });
});
```

> **Nota:** Este teste requer PostgreSQL rodando. Execute-o após o Docker Compose estar de pé na Task 7.

**Step 3: Criar `apps/backend/src/database/database.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
```

**Step 4: Adicionar DatabaseModule ao AppModule**

Editar `apps/backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
```

**Step 5: Commit**

```bash
cd ../../
git add apps/backend/src/database/ apps/backend/src/app.module.ts
git commit -m "feat(backend): add TypeORM DatabaseModule with async config"
```

---

## Task 6: Criar o Frontend React + MUI

**Files:**
- Create: `apps/frontend/` (scaffold via Vite)
- Create: `apps/frontend/src/theme/theme.ts`
- Create: `apps/frontend/src/theme/ThemeProvider.tsx`
- Create: `apps/frontend/src/App.tsx`
- Create: `apps/frontend/src/App.test.tsx`

**Step 1: Criar o app React via Vite**

```bash
cd apps
pnpm create vite frontend --template react-ts
cd frontend
pnpm install
```

**Step 2: Adicionar dependências MUI e React Router**

```bash
pnpm add @mui/material @emotion/react @emotion/styled @mui/icons-material
pnpm add react-router-dom
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom @vitejs/plugin-react
```

**Step 3: Adicionar dependência do pacote shared**

Editar `apps/frontend/package.json`, adicionar em `dependencies`:

```json
"@practicus/shared": "workspace:*"
```

**Step 4: Configurar Vitest em `apps/frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 5: Criar `apps/frontend/src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

**Step 6: Escrever teste do App ANTES de implementar**

Criar `apps/frontend/src/App.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(document.body).toBeDefined();
  });

  it('renders the landing page on root route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText(/Practicus/i)).toBeInTheDocument();
  });
});
```

**Step 7: Rodar o teste para confirmar que FALHA**

```bash
pnpm test
```

Expected: FAIL — `Cannot find module './App'` ou erro de render.

**Step 8: Criar o tema MUI em `apps/frontend/src/theme/theme.ts`**

```typescript
import { createTheme, PaletteMode } from '@mui/material';

export const getTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#0F1117',
              paper: '#1A1D27',
            },
            primary: {
              main: '#4F6EF7',
            },
            secondary: {
              main: '#00D97E',
            },
          }
        : {
            background: {
              default: '#F5F7FA',
              paper: '#FFFFFF',
            },
            primary: {
              main: '#4F6EF7',
            },
            secondary: {
              main: '#00D97E',
            },
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 10,
    },
  });
```

**Step 9: Criar `apps/frontend/src/theme/ThemeProvider.tsx`**

```typescript
import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { PaletteMode } from '@mui/material';
import { getTheme } from './theme';

interface ThemeContextType {
  mode: PaletteMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const stored = localStorage.getItem('theme-mode') as PaletteMode | null;
  const [mode, setMode] = useState<PaletteMode>(stored ?? 'dark');

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  };

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
```

**Step 10: Criar `apps/frontend/src/pages/LandingPage.tsx`**

```typescript
import { Box, Typography, Button, Container, Grid, Card, CardContent, CardActions, Chip } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';

const segments = [
  {
    icon: <BuildIcon sx={{ fontSize: 48 }} />,
    title: 'Oficina Mecânica',
    description: 'Gestão completa de OS, agendamentos e clientes para oficinas e auto centers.',
    available: true,
  },
  {
    icon: <LocalHospitalIcon sx={{ fontSize: 48 }} />,
    title: 'Clínica Médica',
    description: 'Prontuários, agendamentos e gestão de pacientes.',
    available: false,
  },
  {
    icon: <LocalHospitalIcon sx={{ fontSize: 48 }} />,
    title: 'Odontologia',
    description: 'Gestão de consultas, orçamentos e histórico odontológico.',
    available: false,
  },
];

export function LandingPage() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ px: 4, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          Practicus
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="text" href="/login">Entrar</Button>
          <Button variant="contained" href="/register">Começar grátis</Button>
        </Box>
      </Box>

      {/* Hero */}
      <Container maxWidth="md" sx={{ textAlign: 'center', py: 10 }}>
        <Typography variant="h2" fontWeight="bold" gutterBottom>
          Gerencie seu negócio com inteligência
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          30 dias grátis, sem cartão de crédito. Depois, apenas R$69,90/mês.
        </Typography>
        <Button variant="contained" size="large" href="/register" sx={{ px: 6, py: 1.5 }}>
          Começar gratuitamente
        </Button>
      </Container>

      {/* Cards de segmentos */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight="bold" textAlign="center" gutterBottom>
          Escolha seu segmento
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }} justifyContent="center">
          {segments.map((seg) => (
            <Grid item xs={12} sm={6} md={4} key={seg.title}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {!seg.available && (
                  <Chip
                    label="Em breve"
                    color="default"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12 }}
                  />
                )}
                <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                  <Box color="primary.main">{seg.icon}</Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                    {seg.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {seg.description}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  {seg.available ? (
                    <Button variant="contained" href="/register">
                      Começar grátis
                    </Button>
                  ) : (
                    <Button variant="outlined" disabled>
                      Em breve
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
```

**Step 11: Criar `apps/frontend/src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppThemeProvider } from './theme/ThemeProvider';
import { LandingPage } from './pages/LandingPage';

function App() {
  return (
    <AppThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  );
}

export default App;
```

**Step 12: Atualizar `apps/frontend/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**Step 13: Atualizar `apps/frontend/package.json` scripts**

Adicionar em `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 14: Rodar os testes do frontend**

```bash
pnpm test
```

Expected: PASS — `✓ renders without crashing`, `✓ renders the landing page on root route`

**Step 15: Commit**

```bash
cd ../../
git add apps/frontend/
git commit -m "feat(frontend): scaffold React app with MUI dark theme and landing page"
```

---

## Task 7: Criar Dockerfiles

**Files:**
- Create: `apps/backend/Dockerfile`
- Create: `apps/backend/.dockerignore`
- Create: `apps/frontend/Dockerfile`
- Create: `apps/frontend/.dockerignore`
- Create: `apps/frontend/nginx.conf`

**Step 1: Criar `apps/backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
COPY tsconfig.base.json ./
RUN pnpm --filter @practicus/shared build
RUN pnpm --filter backend build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/package.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

**Step 2: Criar `apps/backend/.dockerignore`**

```
node_modules
dist
.env
.env.local
coverage
*.log
```

**Step 3: Criar `apps/frontend/nginx.conf`**

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

**Step 4: Criar `apps/frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend
COPY tsconfig.base.json ./
RUN pnpm --filter @practicus/shared build
RUN pnpm --filter frontend build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Step 5: Criar `apps/frontend/.dockerignore`**

```
node_modules
dist
.env
*.log
```

**Step 6: Commit**

```bash
cd ../../
git add apps/backend/Dockerfile apps/backend/.dockerignore
git add apps/frontend/Dockerfile apps/frontend/.dockerignore apps/frontend/nginx.conf
git commit -m "chore: add Dockerfiles for backend and frontend"
```

---

## Task 8: Criar Docker Compose para Desenvolvimento Local

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Create: `.env.example`

**Step 1: Criar `.env.example` raiz**

```env
# PostgreSQL
POSTGRES_USER=practicus
POSTGRES_PASSWORD=practicus_dev
POSTGRES_DB=practicus

# Redis
REDIS_PORT=6379

# Backend
PORT=3000
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USER=practicus
DB_PASS=practicus_dev
DB_NAME=practicus
REDIS_HOST=redis
JWT_SECRET=dev_secret_change_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Frontend
VITE_API_URL=http://localhost:3000/api
```

**Step 2: Copiar `.env.example` para `.env`**

```bash
cp .env.example .env
```

**Step 3: Criar `docker-compose.yml`**

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: practicus_postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: practicus_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    container_name: practicus_backend
    ports:
      - '3000:3000'
    env_file:
      - .env
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/backend/src:/app/src

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    container_name: practicus_frontend
    ports:
      - '80:80'
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

**Step 4: Criar `docker-compose.prod.yml`** (para referência futura)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: always

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
      target: runner
    env_file:
      - .env.prod
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: always

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
      target: runner
    ports:
      - '80:80'
      - '443:443'
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
  redis_data:
```

**Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.prod.yml .env.example
git commit -m "chore: add Docker Compose for local development"
```

---

## Task 9: Validação Final — Subir tudo e testar

**Step 1: Instalar todas as dependências do monorepo**

```bash
cd c:/Users/vinic/OneDrive/Projetos/practicus
pnpm install
```

Expected: Todas as dependências instaladas sem erros.

**Step 2: Subir os serviços com Docker Compose**

```bash
docker-compose up --build
```

Expected: Logs mostrando:
- `practicus_postgres` — `database system is ready to accept connections`
- `practicus_redis` — `Ready to accept connections`
- `practicus_backend` — `Backend running on http://localhost:3000`
- `practicus_frontend` — `nginx` iniciando

**Step 3: Testar o health check do backend**

```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{"status":"ok","timestamp":"2026-03-15T..."}
```

**Step 4: Acessar o frontend**

Abrir no browser: `http://localhost:80`

Expected: Landing page da Practicus com dark theme, cards de segmentos visíveis.

**Step 5: Testar o banco de dados com o backend rodando**

```bash
cd apps/backend
pnpm test -- --testPathPattern=database.module.spec
```

Expected: PASS — conexão com PostgreSQL confirmada.

**Step 6: Rodar todos os testes**

```bash
cd ../../
pnpm test
```

Expected: Todos os testes passando (backend + frontend).

**Step 7: Commit final**

```bash
git add .
git commit -m "chore: entrega 1 completa — monorepo, Docker, backend NestJS e frontend React+MUI funcionando"
```

---

## Checklist de Validação da Entrega 1

- [ ] `pnpm install` roda sem erros
- [ ] `docker-compose up --build` sobe todos os 4 serviços
- [ ] `GET http://localhost:3000/api/health` retorna `{"status":"ok"}`
- [ ] `http://localhost:80` exibe a landing page com dark theme
- [ ] Cards "Oficina Mecânica" (ativo) e "Clínica Médica" / "Odontologia" (Em breve) visíveis
- [ ] Todos os testes passam com `pnpm test`
- [ ] Toggle de tema funciona e persiste no localStorage
