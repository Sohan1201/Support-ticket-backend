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

Install the dependencies:

npm install

Start PostgreSQL:

docker compose up -d

Generate the Prisma client:

npm run db:generate

Run the database migration:

npx prisma migrate dev

Environment Variables

Create a .env file with:

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/support_tickets"
OPENAI_API_KEY="your_api_key_here"
PORT=3000
AI_TIMEOUT_MS=150

Load Test Data

Run:

npm run db:seed

Run Tests

Run the test suite:

npm test -- --run

Tests use a fake AI and do not call the real AI service.