This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Geist.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy com Coolify

Este projeto é deployado via **Coolify** (self-hosted PaaS) usando Docker.

1. No painel Coolify, crie um novo recurso apontando para o repositório GitHub
2. Coolify detectará automaticamente o `Dockerfile` e `docker-compose.yml`
3. Configure as variáveis de ambiente no painel
4. Deploy automático a cada push na branch `main`

Consulte a [documentação do Coolify](https://coolify.io/docs) para mais detalhes.
