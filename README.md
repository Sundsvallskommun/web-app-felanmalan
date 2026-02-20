# Sundsvalls Kommun Felanmälan

## APIer som används

Se [backend/src/config/api-config.ts](backend/src/config/api-config.ts) för vilka APIer och versioner som används. Applikationsanvändaren i WSO2 måste prenumerera på dessa.


## Utveckling

### Krav

- Node >= 20 LTS
- Yarn

### Steg för steg

1. Klona ner repot.

```
git clone git@github.com:Sundsvallskommun/web-app-felanmalan.git
```

2. Installera dependencies för både `backend` och `frontend`

```
cd frontend
yarn install

cd backend
yarn install
```

3. Skapa .env-fil för `frontend`

```
cd frontend
cp .env.example .env.local
```

Redigera `.env.local` vid behov.

4. Skapa .env-fil för `backend`

```
cd backend
cp .env.example .env.development.local
```

Redigera `.env.development.local` för behov. URLer, nycklar och cert behöver fyllas i korrekt.

- `CLIENT_KEY` och `CLIENT_SECRET` måste fyllas i för att APIerna ska fungera, du måste ha en applikation från WSO2-portalen som abonnerar på de microtjänster du anropar
