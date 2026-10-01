Support Ticket Service

Backend built for the AI support ticket service.

Tech Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- Zod
- OpenAI
- Vitest
- Docker Compose

Setup

Install Node.js 20 or later and Docker Desktop.

Docker is used to run PostgreSQL instead of requiring a separate PostgreSQL installation. This keeps the database setup consistent and avoids requiring the evaluator to install and configure PostgreSQL manually.

Make sure Docker Desktop is running, then install the dependencies:

npm install

Start PostgreSQL:

docker compose up -d

Generate the Prisma client:

npm run db:generate

Run the database migration:

npx prisma migrate dev

Environment Variables

Create a .env file using .env.example as a template.

Set:

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/support_tickets"
OPENAI_API_KEY="actual api key"
PORT=3000
AI_TIMEOUT_MS=150

OPENAI_API_KEY is required when running the application with the real AI provider.

Load Test Data

After starting PostgreSQL and running the migration, load the assignment test data:

npm run db:seed

Run the Application

Start the development server:

npm run dev

The API will run on:

http://localhost:3000

Run Tests

The tests use a fake AI and do not call the real AI service or require OpenAI credits.

The application server does not need to be running separately for the tests.

Run:

npm test -- --run

The tests use the PostgreSQL database configured through DATABASE_URL.

TypeScript Check

npx tsc --noEmit