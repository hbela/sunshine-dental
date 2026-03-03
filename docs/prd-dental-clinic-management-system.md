# PRD — Dental Clinic Management System
**Monorepo: Fastify API + React Web App**

> Version: 1.1
> Date: 2026-03-02
> Status: Draft
> Context: Backend API for the Retell AI + n8n Dental Voice Agent system

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Scope](#2-goals--scope)
3. [Tech Stack](#3-tech-stack)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Database Schema — Prisma](#5-database-schema--prisma)
6. [Authentication & Authorization — better-auth](#6-authentication--authorization--better-auth)
7. [API Design — Fastify](#7-api-design--fastify)
8. [Frontend — React + shadcn](#8-frontend--react--shadcn)
9. [Calendar Module — react-big-calendar](#9-calendar-module--react-big-calendar)
10. [Role-Based Feature Matrix](#10-role-based-feature-matrix)
11. [n8n / Retell AI Integration](#11-n8n--retell-ai-integration)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Environment Variables](#13-environment-variables)
14. [Development Phases](#14-development-phases)

---

## 1. Overview

The **Dental Clinic Management System** is a full-stack monorepo application that serves as the data and scheduling backbone for **Sunshine Dental Clinic**. It exposes a secured REST API consumed by two clients:

1. **The React calendar web app** — used by Doctors and Assistants to manage schedules, patients, and call history
2. **The n8n voice agent workflows** — used internally by the Retell AI phone system during and after live calls

This system replaces Google Sheets, Google Calendar, and all hardcoded availability logic from the existing n8n workflows.

---

## 2. Goals & Scope

### Goals
- **Replace Google Sheets** with a proper PostgreSQL database (via Prisma)
- **Replace Google Calendar** with a custom in-app calendar powered by `react-big-calendar`
- **Secure all API endpoints** with `better-auth` using role-based access control
- **Enable multi-doctor management** with dynamic availability patterns and delegation
- **Provide a clean admin UI** for Doctors and Assistants to manage the clinic
- **Auto-generate OpenAPI documentation** from Zod schemas, always in sync with the API

### In Scope
- User authentication and authorization (email/password)
- Role-based access: `DOCTOR`, `ASSISTANT`
- Doctor profile & availability management
- Appointment booking, cancellation, and history
- Patient registry
- Call log viewer
- Calendar delegation between users
- REST API consumed by n8n workflows (API key secured)
- Auto-generated OpenAPI 3.x specification served via Swagger UI

### Out of Scope
- Patient-facing portal
- Online booking for patients
- Billing / payments
- Mobile app
- Multi-clinic / multi-location support (Phase 2)

---

## 3. Tech Stack

### Monorepo
| Tool | Purpose |
|------|---------|
| `pnpm` + workspaces | Package manager and monorepo orchestration |
| `TypeScript` | All packages and apps |
| `ESLint` + `Prettier` | Linting and formatting |
| `tsx` / `ts-node` | TypeScript execution in development |

### Backend (`apps/api`)
| Tool | Version | Purpose |
|------|---------|---------|
| `Fastify` | v5 | HTTP server framework |
| `@node-openapi/fastify` | latest | Zod type provider + OpenAPI 3.x spec generation |
| `@fastify/swagger` | latest | Serves the generated OpenAPI spec (JSON/YAML) |
| `@fastify/swagger-ui` | latest | Swagger UI at `/documentation` |
| `@fastify/cors` | latest | CORS handling |
| `@fastify/helmet` | latest | Security headers |
| `@fastify/sensible` | latest | HTTP error helpers |
| `better-auth` | latest | Authentication + session management |
| `@better-auth/prisma-adapter` | latest | Prisma adapter for better-auth |
| `Prisma` | v6 | ORM + schema management |
| `Zod` | v3 | Runtime validation, OpenAPI schema definitions |
| `nodemailer` | latest | Email delivery (password reset, confirmations) |

### Database
| Tool | Purpose |
|------|---------|
| `PostgreSQL` | Primary database |
| `Prisma Migrate` | Schema migrations |
| `Prisma Studio` | Visual database browser |

### Frontend (`apps/web`)
| Tool | Version | Purpose |
|------|---------|---------|
| `React` | v19 | UI framework |
| `Vite` | v6 | Build tool and dev server |
| `TanStack Router` | v1 | Type-safe, file-based client-side routing |
| `@tanstack/router-vite-plugin` | latest | File-based route generation (Vite plugin) |
| `TanStack Query` | v5 | Server state, caching, mutations |
| `better-auth/react` | latest | Auth client, session hooks |
| `shadcn/ui` | latest | UI component library |
| `Tailwind CSS` | v4 | Utility-first styling |
| `react-big-calendar` | latest | Full-featured calendar component |
| `date-fns` | v3 | Date manipulation (required by react-big-calendar) |
| `Zod` | v3 | Form validation (shared schemas) |
| `react-hook-form` | v7 | Form state management |
| `@hookform/resolvers` | latest | Zod + react-hook-form bridge |
| `Axios` | latest | HTTP client |

### Shared (`packages/shared`)
| Content | Description |
|---------|-------------|
| Zod schemas | Request/response types shared between API and web |
| TypeScript types | Common interfaces (User, Doctor, Appointment, etc.) |
| Constants | Appointment types, durations, roles enum |

---

## 4. Monorepo Structure

```
dental-clinic-monorepo/
├── apps/
│   ├── api/                          ← Fastify backend
│   │   ├── src/
│   │   │   ├── server.ts             ← Fastify instance + plugin registration
│   │   │   ├── app.ts                ← App factory
│   │   │   ├── auth.ts               ← better-auth configuration
│   │   │   ├── plugins/
│   │   │   │   ├── openapi.plugin.ts ← @node-openapi/fastify + @fastify/swagger
│   │   │   │   ├── auth.plugin.ts    ← better-auth Fastify plugin
│   │   │   │   ├── cors.plugin.ts
│   │   │   │   └── sensible.plugin.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts    ← /api/auth/** (better-auth handler)
│   │   │   │   ├── doctors.routes.ts
│   │   │   │   ├── calendar.routes.ts
│   │   │   │   ├── appointments.routes.ts
│   │   │   │   ├── patients.routes.ts
│   │   │   │   └── call-logs.routes.ts
│   │   │   ├── middleware/
│   │   │   │   ├── requireAuth.ts    ← session-based auth guard
│   │   │   │   ├── requireRole.ts    ← role-based guard (DOCTOR | ASSISTANT)
│   │   │   │   └── requireApiKey.ts  ← API key guard for n8n routes
│   │   │   ├── services/
│   │   │   │   ├── calendar.service.ts   ← availability slot calculation
│   │   │   │   ├── appointment.service.ts
│   │   │   │   ├── patient.service.ts
│   │   │   │   └── email.service.ts
│   │   │   └── lib/
│   │   │       ├── prisma.ts         ← Prisma client singleton
│   │   │       └── auth.ts           ← better-auth instance
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          ← React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── auth-client.ts        ← better-auth React client
│       │   ├── routeTree.gen.ts      ← Auto-generated by TanStack Router Vite plugin
│       │   ├── router.ts             ← createRouter() + QueryClient provider setup
│       │   ├── routes/               ← File-based routes (TanStack Router)
│       │   │   ├── __root.tsx        ← Root layout (QueryClientProvider, Toaster)
│       │   │   ├── login.tsx         ← /login (public)
│       │   │   ├── _auth.tsx         ← Auth layout route (session guard)
│       │   │   ├── _auth/
│       │   │   │   ├── index.tsx     ← / → Dashboard
│       │   │   │   ├── calendar/
│       │   │   │   │   ├── index.tsx       ← /calendar
│       │   │   │   │   ├── patterns.tsx    ← /calendar/patterns (DOCTOR only)
│       │   │   │   │   └── delegation.tsx  ← /calendar/delegation (DOCTOR only)
│       │   │   │   ├── appointments/
│       │   │   │   │   └── index.tsx       ← /appointments
│       │   │   │   ├── patients/
│       │   │   │   │   └── index.tsx       ← /patients (ASSISTANT, ADMIN)
│       │   │   │   ├── call-logs/
│       │   │   │   │   └── index.tsx       ← /call-logs (ASSISTANT, ADMIN)
│       │   │   │   ├── settings/
│       │   │   │   │   └── index.tsx       ← /settings
│       │   │   │   └── admin/
│       │   │   │       └── users.tsx       ← /admin/users (ADMIN only)
│       │   ├── components/
│       │   │   ├── ui/               ← shadcn components (auto-generated)
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── Header.tsx
│       │   │   │   └── AppLayout.tsx ← Shared authenticated shell
│       │   │   ├── calendar/
│       │   │   │   ├── DentalCalendar.tsx
│       │   │   │   ├── AvailabilityEditor.tsx
│       │   │   │   ├── AppointmentModal.tsx
│       │   │   │   ├── BlockTimeModal.tsx
│       │   │   │   └── DelegationSettings.tsx
│       │   │   ├── appointments/
│       │   │   │   ├── AppointmentList.tsx
│       │   │   │   └── AppointmentStatusBadge.tsx
│       │   │   └── patients/
│       │   │       ├── PatientList.tsx
│       │   │       └── PatientCard.tsx
│       │   ├── hooks/
│       │   │   ├── useCalendarSlots.ts
│       │   │   ├── useAppointments.ts
│       │   │   └── useDoctors.ts
│       │   ├── lib/
│       │   │   ├── api.ts            ← Axios instance with auth headers
│       │   │   └── utils.ts
│       │   └── types/
│       │       └── index.ts
│       ├── components.json           ← shadcn config
│       ├── package.json
│       └── vite.config.ts            ← includes TanStack Router Vite plugin
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── schemas/
│       │   │   ├── appointment.schema.ts
│       │   │   ├── patient.schema.ts
│       │   │   ├── doctor.schema.ts
│       │   │   └── call-log.schema.ts
│       │   ├── types/
│       │   │   └── index.ts
│       │   └── constants/
│       │       ├── roles.ts          ← Role enum: DOCTOR, ASSISTANT
│       │       └── appointment-types.ts
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json                      ← root scripts
└── turbo.json                        ← optional Turborepo config
```

---

## 5. Database Schema — Prisma

### 5.1 better-auth Required Models

```prisma
// Required by better-auth — do not rename
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Custom fields
  role          Role      @default(ASSISTANT)

  // Relations
  sessions      Session[]
  accounts      Account[]
  doctorProfile Doctor?
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model Verification {
  id         String    @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime? @default(now())
  updatedAt  DateTime? @updatedAt
}

enum Role {
  DOCTOR
  ASSISTANT
  ADMIN
}
```

### 5.2 Application Models

```prisma
// Doctor profile — one-to-one with User (role = DOCTOR)
model Doctor {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  specialty    String?
  phone        String?
  bio          String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  appointments        Appointment[]
  availabilityPatterns AvailabilityPattern[]
  blockedTimes        BlockedTime[]
  delegationsOwned    CalendarDelegation[] @relation("DelegationOwner")
  delegationsReceived CalendarDelegation[] @relation("DelegationDelegate")
}

// Patient registry (populated by voice agent capture_patient_info)
model Patient {
  id                String    @id @default(cuid())
  name              String
  phone             String?
  email             String?
  reason            String?
  isNewPatient      Boolean   @default(true)
  callbackRequested Boolean   @default(false)
  preferredTime     String?   // 'morning' | 'afternoon' | 'evening'
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  appointments Appointment[]
  callLogs     CallLog[]
}

// Appointments
model Appointment {
  id              String            @id @default(cuid())
  patientId       String?
  patient         Patient?          @relation(fields: [patientId], references: [id])
  patientName     String            // Denormalized for display
  patientPhone    String?
  patientEmail    String?
  doctorId        String
  doctor          Doctor            @relation(fields: [doctorId], references: [id])
  doctorName      String            // Denormalized for display
  appointmentType AppointmentType
  date            DateTime          @db.Date
  startTime       DateTime          @db.Time
  endTime         DateTime          @db.Time
  durationMinutes Int
  status          AppointmentStatus @default(CONFIRMED)
  isNewPatient    Boolean           @default(false)
  notes           String?
  callId          String?           // Retell call_id that triggered booking
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}

enum AppointmentType {
  CLEANING
  NEW_PATIENT_EXAM
  DEEP_CLEANING
  FILLING
  CROWN_PREP
  CONSULTATION
  EMERGENCY
}

enum AppointmentStatus {
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

// Call logs (populated by post-call webhook)
model CallLog {
  id                  String   @id @default(cuid())
  callId              String   @unique  // Retell call_id
  agentId             String?
  patientId           String?
  patient             Patient? @relation(fields: [patientId], references: [id])
  fromNumber          String?
  toNumber            String?
  direction           String   @default("inbound")
  durationSeconds     Int      @default(0)
  status              String?
  disconnectionReason String?
  transcript          String?  @db.Text
  summary             String?  @db.Text
  sentiment           String?  // 'Positive' | 'Neutral' | 'Negative'
  successful          Boolean?
  startTime           DateTime?
  endTime             DateTime?
  createdAt           DateTime @default(now())
}

// Availability patterns — named reusable weekly schedules
model AvailabilityPattern {
  id         String        @id @default(cuid())
  doctorId   String
  doctor     Doctor        @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  name       String        // "Standard Week", "Summer Schedule"
  isActive   Boolean       @default(false)
  validFrom  DateTime?     @db.Date
  validUntil DateTime?     @db.Date
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  rules PatternRule[]
}

// Weekly rules within a pattern
model PatternRule {
  id          String              @id @default(cuid())
  patternId   String
  pattern     AvailabilityPattern @relation(fields: [patternId], references: [id], onDelete: Cascade)
  dayOfWeek   DayOfWeek
  startTime   DateTime            @db.Time
  endTime     DateTime            @db.Time
  breakStart  DateTime?           @db.Time
  breakEnd    DateTime?           @db.Time
  isAvailable Boolean             @default(true)
}

enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

// One-off blocked times (vacations, admin time)
model BlockedTime {
  id          String   @id @default(cuid())
  doctorId    String
  doctor      Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  date        DateTime @db.Date
  startTime   DateTime? @db.Time
  endTime     DateTime? @db.Time
  isFullDay   Boolean  @default(false)
  reason      String?  // 'Vacation', 'Conference', 'Admin'
  createdAt   DateTime @default(now())
}

// Calendar delegation
model CalendarDelegation {
  id         String   @id @default(cuid())
  ownerId    String
  owner      Doctor   @relation("DelegationOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  delegateId String
  delegate   Doctor   @relation("DelegationDelegate", fields: [delegateId], references: [id], onDelete: Cascade)
  canView    Boolean  @default(true)
  canEdit    Boolean  @default(false)
  canBook    Boolean  @default(false)
  validFrom  DateTime? @db.Date
  validUntil DateTime? @db.Date
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

## 6. Authentication & Authorization — better-auth

### 6.1 Authentication Strategy

- **Provider:** Email + Password only (no OAuth in Phase 1)
- **Session management:** better-auth handles cookie-based sessions
- **Roles:** `DOCTOR`, `ASSISTANT`, `ADMIN`
- **User creation:** Admin creates user accounts via the API (no self-registration)

### 6.2 better-auth Configuration (`apps/api/src/lib/auth.ts`)

```typescript
// Conceptual configuration — not final code
import { betterAuth } from 'better-auth'
import { prismaAdapter } from '@better-auth/prisma-adapter'
import { roles } from 'better-auth/plugins'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,  // Internal users, no verification needed
  },

  plugins: [
    roles({
      roles: {
        DOCTOR: {
          permissions: [
            'calendar:own:read',
            'calendar:own:write',
            'appointments:own:read',
            'appointments:own:write',
            'patients:read',
            'patterns:own:manage',
            'delegation:own:manage',
          ]
        },
        ASSISTANT: {
          permissions: [
            'calendar:all:read',
            'calendar:delegated:write',
            'appointments:all:read',
            'appointments:all:write',
            'patients:read',
            'patients:write',
            'call-logs:read',
          ]
        },
        ADMIN: {
          permissions: ['*']  // Full access
        }
      }
    })
  ],

  trustedOrigins: ['http://localhost:5173'],  // Vite dev server

  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days
    updateAge: 60 * 60 * 24,       // Refresh if older than 1 day
  }
})
```

### 6.3 Two Auth Layers

The API has **two separate authentication mechanisms**:

| Layer | Method | Used By | Guards |
|-------|--------|---------|--------|
| **Session Auth** | Cookie (better-auth) | React web app | `requireAuth` + `requireRole` middleware |
| **API Key Auth** | `Authorization: Bearer` header | n8n workflows | `requireApiKey` middleware |

```
React App  →  POST /api/auth/sign-in  →  Session cookie set
React App  →  GET  /api/doctors       →  requireAuth + requireRole(['DOCTOR','ASSISTANT'])

n8n        →  GET  /api/calendar/slots →  requireApiKey (env: FASTIFY_API_KEY)
n8n        →  POST /api/appointments   →  requireApiKey
n8n        →  POST /api/call-logs      →  requireApiKey
```

### 6.4 Route Prefixes

```
/api/auth/**          → better-auth handler (public — sign-in, sign-out, session)
/api/admin/**         → requireAuth + requireRole(['ADMIN'])
/api/doctors/**       → requireAuth + requireRole(['DOCTOR','ASSISTANT'])
/api/calendar/**      → requireAuth OR requireApiKey (dual access)
/api/appointments/**  → requireAuth OR requireApiKey (dual access)
/api/patients/**      → requireAuth OR requireApiKey (dual access)
/api/call-logs/**     → requireAuth OR requireApiKey (dual access)
```

### 6.5 Middleware Design

```typescript
// requireAuth — validates better-auth session
async function requireAuth(request, reply) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return reply.status(401).send({ error: 'Unauthorized' })
  request.user = session.user
}

// requireRole — checks user role after requireAuth
function requireRole(roles: Role[]) {
  return async (request, reply) => {
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}

// requireApiKey — for n8n workflow access
async function requireApiKey(request, reply) {
  const key = request.headers.authorization?.replace('Bearer ', '')
  if (key !== process.env.FASTIFY_API_KEY) {
    return reply.status(401).send({ error: 'Invalid API key' })
  }
}
```

---

## 7. API Design — Fastify

### 7.1 OpenAPI Integration — `@node-openapi/fastify`

All routes use the `@node-openapi/fastify` type provider. This gives:
- **Runtime validation** of request params, body, querystring, and responses via Zod
- **Full TypeScript inference** — `request.body`, `request.params`, etc. are typed automatically
- **Auto-generated OpenAPI 3.x spec** collected from every route's `schema` definition
- **Swagger UI** served at `GET /documentation`

#### Plugin registration (`apps/api/src/plugins/openapi.plugin.ts`)

```typescript
import Swagger from '@fastify/swagger'
import SwaggerUI from '@fastify/swagger-ui'
import { openApi } from '@node-openapi/fastify'

export async function openapiPlugin(fastify: FastifyInstance) {
  await fastify.register(Swagger, {
    openapi: {
      info: { title: 'Dental Clinic API', version: '1.0.0' },
      components: {
        securitySchemes: {
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    },
  })
  await fastify.register(SwaggerUI, { routePrefix: '/documentation' })
  await fastify.register(openApi)
}
```

#### Route pattern with Zod schemas

```typescript
import { z } from 'zod'

const AppointmentSchema = z.object({
  id: z.string().openapi({ description: 'Appointment ID', example: 'clx...' }),
  patientName: z.string().openapi({ example: 'Jane Doe' }),
  date: z.string().openapi({ example: '2026-03-15' }),
  // ...
})

fastify.route({
  method: 'GET',
  url: '/api/appointments/:id',
  schema: {
    summary: 'Get appointment by ID',
    tags: ['appointments'],
    params: z.object({ id: z.string() }),
    response: { 200: AppointmentSchema },
  },
  preHandler: [requireAuth],
  handler: async (request) => {
    const { id } = request.params  // typed: { id: string }
    return appointmentService.findById(id)
  },
})
```

#### Custom error handler for validation errors

```typescript
fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: error.validation,
    })
  }
  reply.send(error)
})
```

### 7.2 Auth Routes (better-auth handler)

```
POST   /api/auth/sign-in/email         → Login with email + password
POST   /api/auth/sign-out              → Logout
GET    /api/auth/session               → Get current session + user
POST   /api/auth/forget-password       → Send password reset email
POST   /api/auth/reset-password        → Reset password with token
```

### 7.3 Users / Admin Routes

```
POST   /api/admin/users                → Create user (email, name, role, tempPassword)
GET    /api/admin/users                → List all users
PUT    /api/admin/users/:id/role       → Update user role
DELETE /api/admin/users/:id            → Deactivate user
```

### 7.4 Doctor Routes

```
GET    /api/doctors                    → List active doctors (name, specialty, id)
GET    /api/doctors/:id                → Get doctor profile
PUT    /api/doctors/me                 → Update own profile (DOCTOR only)
```

### 7.5 Calendar Routes (Dual Access: Session OR API Key)

```
GET    /api/calendar/slots
       ?doctor_id=&date=&appointment_type=
       → Available slots for a given date
       → Response: { slots: ["09:00","09:30"], duration: 30, doctor_name: "Dr. Smith" }

GET    /api/calendar/:doctor_id/events
       ?from=&to=
       → All events (appointments + blocked times) in a date range
       → Used by react-big-calendar

POST   /api/calendar/:doctor_id/block  → Block a time slot (ASSISTANT or owner DOCTOR)
DELETE /api/calendar/block/:id         → Remove a block
```

### 7.6 Availability Patterns Routes

```
GET    /api/patterns/:doctor_id        → List doctor's patterns
POST   /api/patterns/:doctor_id        → Create pattern
PUT    /api/patterns/:id               → Update pattern rules
PUT    /api/patterns/:id/activate      → Set as active pattern (deactivates others)
DELETE /api/patterns/:id               → Delete pattern
```

### 7.7 Delegation Routes

```
GET    /api/delegations/me             → My delegations (given + received)
POST   /api/delegations                → Create delegation
PUT    /api/delegations/:id            → Update permissions / extend dates
DELETE /api/delegations/:id            → Revoke delegation
```

### 7.8 Appointments Routes (Dual Access)

```
GET    /api/appointments               → List (filter: date, doctor_id, status, patient_name)
GET    /api/appointments/:id           → Get single appointment
POST   /api/appointments               → Book appointment (n8n or ASSISTANT)
PUT    /api/appointments/:id/cancel    → Cancel appointment
PUT    /api/appointments/:id/complete  → Mark as completed (DOCTOR only)
GET    /api/appointments/patient/:patient_id → Patient appointment history
```

**POST /api/appointments — Request Body:**
```typescript
{
  patient_name:     string    // required
  phone:            string?
  email:            string?
  appointment_type: AppointmentType  // required
  date:             string    // YYYY-MM-DD, required
  time:             string    // HH:MM, required
  doctor_name:      string?   // if omitted, first available doctor assigned
  is_new_patient:   boolean
  notes:            string?
  call_id:          string?   // Retell call_id
}
```

**PUT /api/appointments/cancel — Request Body:**
```typescript
{
  patient_name: string   // required
  date:         string   // required
  time:         string?  // optional — narrows search
  reason:       string?
}
// Response: { found: boolean, appointment?: Appointment }
```

### 7.9 Patients Routes (Dual Access)

```
GET    /api/patients                   → List patients (search by name/phone)
GET    /api/patients/:id               → Get patient details + appointment history
POST   /api/patients                   → Create patient record (n8n voice agent)
PUT    /api/patients/:id               → Update patient info
```

**POST /api/patients — Request Body:**
```typescript
{
  name:               string    // required
  phone:              string?
  email:              string?
  reason:             string?
  is_new_patient:     boolean
  callback_requested: boolean
  preferred_time:     string?   // 'morning' | 'afternoon' | 'evening'
  call_id:            string?
}
```

### 7.10 Call Logs Routes (Dual Access)

```
POST   /api/call-logs                  → Create call log (n8n post-call webhook)
GET    /api/call-logs                  → List calls (filter: date range, sentiment, successful)
GET    /api/call-logs/:call_id         → Get single call log + transcript
GET    /api/call-logs/stats            → Aggregated stats (sentiment counts, call volumes)
```

**GET /api/call-logs/stats — Response:**
```typescript
{
  totalCalls:     number
  successful:     number
  bysentiment: {
    positive:   number
    neutral:    number
    negative:   number
  }
  avgDurationSeconds: number
  callsToday:     number
  callsThisWeek:  number
}
```

---

## 8. Frontend — React + shadcn

### 8.1 shadcn Components Used

| Component | Used In |
|-----------|---------|
| `Button` | Forms, modals, actions |
| `Input` / `Label` | Auth forms, patient form |
| `Form` | Login, patient capture, pattern editor |
| `Card` / `CardHeader` | Dashboard stats, patient card |
| `Badge` | Appointment status, role indicator |
| `Dialog` | Appointment modal, block time modal |
| `Sheet` | Delegation settings panel |
| `Table` | Patient list, appointment list, call logs |
| `Tabs` | Calendar views, settings sections |
| `Select` | Appointment type, doctor selector, day picker |
| `Sidebar` | App navigation |
| `DropdownMenu` | User menu (profile, logout) |
| `Avatar` | Doctor avatars |
| `Separator` | Layout |
| `Toast` / `Sonner` | Success/error notifications |
| `Skeleton` | Loading states |
| `AlertDialog` | Confirm cancel/delete |
| `Calendar` (shadcn) | Date picker in forms |
| `Popover` | Date picker wrapper |
| `ScrollArea` | Transcript viewer in call logs |

### 8.2 Routing — TanStack Router

TanStack Router v1 is used with the **file-based routing** approach via `@tanstack/router-vite-plugin`. The plugin auto-generates `src/routeTree.gen.ts` from the `src/routes/` directory.

**Vite plugin setup (`vite.config.ts`):**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
})
```

**Router instance (`src/router.ts`):**
```typescript
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
```

**Route file map:**
```
src/routes/
  __root.tsx          → Root layout: QueryClientProvider, Toaster, RouterDevtools
  login.tsx           → /login (public)
  _auth.tsx           → Auth layout route: session check, redirects to /login
  _auth/
    index.tsx         → / (Dashboard)
    calendar/
      index.tsx       → /calendar
      patterns.tsx    → /calendar/patterns  (DOCTOR only — role guard in beforeLoad)
      delegation.tsx  → /calendar/delegation (DOCTOR only)
    appointments/
      index.tsx       → /appointments
    patients/
      index.tsx       → /patients (ASSISTANT, ADMIN)
    call-logs/
      index.tsx       → /call-logs (ASSISTANT, ADMIN)
    settings/
      index.tsx       → /settings
    admin/
      users.tsx       → /admin/users (ADMIN only)
```

**Auth layout route (`src/routes/_auth.tsx`):**
```typescript
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { authClient } from '../auth-client'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  component: () => <AppLayout><Outlet /></AppLayout>,
})
```

**Role-guarded route example (`src/routes/_auth/calendar/patterns.tsx`):**
```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '../../../auth-client'

export const Route = createFileRoute('/_auth/calendar/patterns')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (session?.user.role !== 'DOCTOR') throw redirect({ to: '/' })
  },
  component: AvailabilityPatternsPage,
})
```

### 8.3 Pages & Routes

```
/login                     → login.tsx           (public)
/                          → _auth/index.tsx     (Dashboard)
/calendar                  → _auth/calendar/index.tsx
/calendar/patterns         → _auth/calendar/patterns.tsx    (DOCTOR only)
/calendar/delegation       → _auth/calendar/delegation.tsx  (DOCTOR only)
/appointments              → _auth/appointments/index.tsx
/patients                  → _auth/patients/index.tsx       (ASSISTANT, ADMIN)
/call-logs                 → _auth/call-logs/index.tsx      (ASSISTANT, ADMIN)
/settings                  → _auth/settings/index.tsx
/admin/users               → _auth/admin/users.tsx          (ADMIN only)
```

### 8.4 better-auth React Client (`apps/web/src/auth-client.ts`)

```typescript
// Conceptual — not final code
import { createAuthClient } from 'better-auth/react'
import { rolesClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [rolesClient()]
})

// Hooks available throughout the app:
// const { data: session } = authClient.useSession()
// authClient.signIn.email({ email, password })
// authClient.signOut()
```

### 8.5 Dashboard — Stats Cards

The dashboard shows at-a-glance metrics using `Card` components:
- Today's appointments (count)
- Pending callbacks (patients with `callback_requested = true`)
- Calls this week (from call logs)
- Sentiment breakdown (positive % from call logs)

---

## 9. Calendar Module — react-big-calendar

### 9.1 Calendar Views

| View | Description | Available To |
|------|-------------|-------------|
| **Week** | Default view — appointments + availability blocks | All |
| **Day** | Single doctor detail view | All |
| **Month** | Overview, shows appointment count per day | All |
| **Agenda** | List view of upcoming appointments | All |
| **Multi-resource** | All doctors side-by-side (week view) | ASSISTANT, ADMIN |

### 9.2 Event Types & Colors

| Event Type | Color | Description |
|-----------|-------|-------------|
| `appointment:confirmed` | Blue | Booked appointment |
| `appointment:cancelled` | Red/strikethrough | Cancelled |
| `appointment:completed` | Green | Completed visit |
| `available` | Light green | Available slot (from pattern) |
| `blocked` | Gray | Manually blocked time |
| `break` | Light yellow | Lunch/break from pattern |

### 9.3 Interactions by Role

**DOCTOR (own calendar only):**
- Click available slot → Book appointment (or Block time)
- Click appointment → View details / Mark complete
- Drag appointment → Reschedule (calls PUT /api/appointments/:id)
- Drag to resize → Change duration
- Click blocked slot → Remove block

**ASSISTANT (all doctors + delegated):**
- Switch doctor view via dropdown
- Multi-resource view to see all doctors simultaneously
- Book / cancel appointments for any doctor
- Block/unblock time on delegated calendars

### 9.4 Availability Pattern Editor

A separate page (`/calendar/patterns`) with a weekly grid editor:
- 7-column grid (Mon–Sun), rows = time slots
- Click/drag to define `startTime → endTime`
- Set `breakStart → breakEnd` (lunch)
- Toggle day ON/OFF
- Name the pattern, set valid date range
- Activate button → sets `isActive = true` on this pattern, `false` on others

### 9.5 Data Flow

```
react-big-calendar renders events
         ↑
TanStack Query fetches:
  GET /api/calendar/:doctor_id/events?from=&to=
         ↑
Fastify calendar.service.ts:
  1. Fetch active pattern rules for this doctor
  2. Fetch blocked times in range
  3. Fetch appointments in range
  4. Merge into unified event array
  5. Return to client
```

---

## 10. Role-Based Feature Matrix

| Feature | DOCTOR | ASSISTANT | ADMIN |
|---------|--------|-----------|-------|
| Login / logout | ✅ | ✅ | ✅ |
| View own calendar | ✅ | — | ✅ |
| View all doctors' calendars | ❌ | ✅ | ✅ |
| Edit own availability pattern | ✅ | ❌ | ✅ |
| Block own time slots | ✅ | ❌ (unless delegated) | ✅ |
| Book appointment (own patients) | ✅ | ✅ | ✅ |
| Cancel appointment | ✅ | ✅ | ✅ |
| Mark appointment as completed | ✅ | ❌ | ✅ |
| Manage delegation (grant access) | ✅ | ❌ | ✅ |
| Receive delegation (manage delegated calendar) | — | ✅ | ✅ |
| View patient list | ❌ | ✅ | ✅ |
| Edit patient record | ❌ | ✅ | ✅ |
| View call logs | ❌ | ✅ | ✅ |
| View call stats dashboard | ❌ | ✅ | ✅ |
| Create / manage users | ❌ | ❌ | ✅ |
| Change own password | ✅ | ✅ | ✅ |

---

## 11. n8n / Retell AI Integration

The n8n workflows (`retell-custom-function-router-v2` and `post-call-processing-v2`) communicate with this API exclusively via **API Key authentication**.

### 11.1 Endpoints Called by n8n

| Workflow | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| Router | `/api/calendar/slots` | GET | Check available appointment slots |
| Router | `/api/appointments` | POST | Book an appointment |
| Router | `/api/appointments/cancel` | PUT | Cancel an appointment |
| Router | `/api/patients` | POST | Capture patient info |
| Post-Call | `/api/call-logs` | POST | Log completed call data |

### 11.2 API Key Security

- The API key is a long random string stored in n8n as environment variable `FASTIFY_API_KEY`
- The same key is configured in the Fastify API as `process.env.FASTIFY_API_KEY`
- n8n routes bypass session auth entirely — no browser cookie involved
- Consider rotating the key periodically

### 11.3 `GET /api/calendar/slots` — Availability Logic

This is the **most critical endpoint** — replaces the old `Calculate Available Slots` Code node and Google Calendar entirely.

**Business logic (in `calendar.service.ts`):**
1. Look up doctor by `doctor_name` (or return error if not found)
2. Get active `AvailabilityPattern` for that doctor
3. Get `PatternRule` for the requested day of week
4. If no rule or `isAvailable = false` → return `{ slots: [] }`
5. Check `BlockedTime` for that specific date
6. Fetch `Appointment` records for that date and doctor
7. Generate 30-minute slots between `startTime` and `endTime`
8. Skip slots during `breakStart → breakEnd`
9. Skip slots conflicting with existing appointments or blocked times
10. Filter: slot end must be ≤ `endTime`
11. Return `{ slots: [...], duration: N, doctor_name: "..." }`

---

## 12. Non-Functional Requirements

### Security
- All session cookies: `httpOnly`, `secure`, `sameSite: lax`
- Passwords: hashed by better-auth (bcrypt)
- API keys: stored in env vars, never in database or code
- CORS: restricted to known origins (`VITE_API_URL`)
- Helmet: all standard security headers enabled
- Rate limiting: 100 req/min per IP on auth routes

### Performance
- Prisma queries: use `select` to avoid over-fetching
- TanStack Query: 30-second cache for calendar slots, 5-minute cache for patient lists
- `GET /api/calendar/slots` target response: < 200ms
- Pagination: all list endpoints support `?page=&limit=` (default limit: 50)

### Error Handling
- All Fastify routes return standard error shape: `{ error: string, code?: string }`
- Zod validation errors (via `@node-openapi/fastify`): `400 Bad Request` with field-level `details` array
- Auth errors: `401 Unauthorized` or `403 Forbidden`
- Not found: `404 Not Found`

### API Documentation
- OpenAPI 3.x spec auto-generated from route schemas — always in sync with implementation
- Swagger UI available at `GET /documentation` (development only)
- Raw spec at `GET /documentation/json`

### Logging
- Fastify built-in Pino logger (JSON format)
- Log levels: `error`, `warn`, `info` in production; `debug` in development

---

## 13. Environment Variables

### `apps/api/.env`
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dental_clinic"

# Server
PORT=3000
NODE_ENV=development

# better-auth
BETTER_AUTH_SECRET="your-long-random-secret-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

# API Key for n8n workflows
FASTIFY_API_KEY="your-n8n-api-key-here"

# Email (password reset, appointment confirmations)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="clinic@gmail.com"
SMTP_PASS="app-password"
EMAIL_FROM="Sunshine Dental Clinic <clinic@gmail.com>"
```

### `apps/web/.env`
```env
VITE_API_URL="http://localhost:3000"
```

---

## 14. Development Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Monorepo setup (pnpm workspaces, TypeScript, ESLint)
- [ ] Prisma schema + initial migration
- [ ] better-auth integration (email/password + roles)
- [ ] Fastify server with `@node-openapi/fastify` + `@fastify/swagger` + `@fastify/swagger-ui`
- [ ] `requireAuth`, `requireRole`, `requireApiKey` middleware
- [ ] Admin: create initial users (1 ADMIN, 1 DOCTOR, 1 ASSISTANT)
- [ ] React app scaffold (Vite + TanStack Router + TanStack Query)
- [ ] TanStack Router file-based route setup (`__root.tsx`, `_auth.tsx`, `login.tsx`)
- [ ] shadcn setup + LoginPage with session-based redirect

### Phase 2 — Core API (Week 3–4)
- [ ] Doctor CRUD routes (with Zod schemas + OpenAPI tags)
- [ ] Availability Patterns CRUD
- [ ] `GET /api/calendar/slots` — full availability logic
- [ ] `GET /api/calendar/:id/events` — for react-big-calendar
- [ ] Appointments CRUD (book, cancel, complete)
- [ ] Patients CRUD
- [ ] Call Logs (create + list)
- [ ] Integration test with n8n v2 workflows

### Phase 3 — Calendar UI (Week 5–6)
- [ ] react-big-calendar integration (week + day + month views)
- [ ] Appointment modal (create / view / cancel)
- [ ] Block time modal
- [ ] Availability pattern editor page
- [ ] Multi-resource view (ASSISTANT role)

### Phase 4 — Advanced Features (Week 7–8)
- [ ] Calendar delegation (UI + API)
- [ ] Patient list page (with search)
- [ ] Call log viewer (transcript + stats)
- [ ] Dashboard (stats cards)
- [ ] Password change (settings page)
- [ ] Admin user management page

### Phase 5 — Polish & Production (Week 9+)
- [ ] Rate limiting on auth routes
- [ ] Email notifications (appointment confirmation, password reset)
- [ ] Docker Compose setup (API + PostgreSQL)
- [ ] CI/CD pipeline
- [ ] Disable Swagger UI in production (or restrict behind auth)
- [ ] Production deployment

---

## Appendix A — Appointment Type Durations

| Appointment Type | Duration |
|-----------------|---------|
| `CLEANING` | 30 min |
| `NEW_PATIENT_EXAM` | 60 min |
| `DEEP_CLEANING` | 60 min |
| `FILLING` | 45 min |
| `CROWN_PREP` | 90 min |
| `CONSULTATION` | 30 min |
| `EMERGENCY` | 30 min |

## Appendix B — Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth library | `better-auth` | TypeScript-first, Prisma adapter, roles plugin, no vendor lock-in |
| UI components | `shadcn/ui` | Copy-paste ownership, Tailwind v4 compatible, accessible |
| Calendar | `react-big-calendar` | Most mature React calendar, supports drag-and-drop, multi-resource |
| ORM | `Prisma` | Already in monorepo stack, type-safe, great migration tooling |
| Session storage | Cookie (better-auth) | Simpler than JWT for web app, automatic refresh |
| n8n auth | API Key | Stateless, simple, no OAuth complexity needed for server-to-server |
| Doctor profile | Separate table from User | Separation of concerns — auth vs. business data |
| Client router | `TanStack Router` | End-to-end type safety, file-based routing via Vite plugin, `beforeLoad` for auth guards, no runtime routing errors |
| API type provider | `@node-openapi/fastify` | Zod validates requests + infers TypeScript types + generates OpenAPI spec from one source of truth |
| API docs | `@fastify/swagger` + `@fastify/swagger-ui` | Auto-generated, always in sync, Swagger UI for development exploration |
