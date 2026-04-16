# SONORA

Plataforma social voltada para musica, descoberta de artistas e interacao entre comunidades, desenvolvida com React, Vite e Supabase.

## Visao geral

O SONORA combina elementos de rede social, comunidade musical e plataforma de descoberta. O aplicativo concentra feed social, mensagens diretas, comunidades tematicas, playlists, eventos, anuncios e uma area chamada `Ascensao`, focada em destaque de talentos e conteudo musical.

## Principais recursos

- autenticacao e perfis de usuario
- feed com posts, comentarios e curtidas
- mensagens diretas entre usuarios
- busca unificada por usuarios, comunidades, eventos, anuncios e playlists
- comunidades publicas e privadas com cargos, solicitacoes e moderacao
- compartilhamento de links do Spotify e YouTube
- playlists e vitrine de conteudo musical
- area de eventos e marketplace musical
- notificacoes em tempo real e web push
- perfil com `Capsula do Tempo Spotify`
- aba `Ascensao` para talentos e posts em destaque

## Stack

- React 19
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React
- Supabase
- Spotify Web API
- Service Worker para notificacoes push

## Estrutura do projeto

```text
.
|-- src/
|   |-- App.jsx                             # aplicacao principal
|   |-- CommunitiesHub.jsx                  # hub de comunidades
|   |-- pushClient.js                       # registro e disparo de push no cliente
|   |-- index.css                           # estilos globais
|   `-- ...
|-- public/
|   `-- sw.js                               # service worker de notificacoes
|-- supabase/
|   |-- full_schema.sql                     # schema completo do banco
|   `-- functions/send-web-push/index.ts   # edge function de web push
|-- package.json
|-- vite.config.js
`-- tailwind.config.js
```

## Areas da aplicacao

- `Feed`: publicacoes sociais com midia e embeds musicais
- `Direct`: conversas privadas entre usuarios
- `Busca`: busca centralizada em varias entidades do app
- `Comunidades`: espacos publicos e privados com membros, cargos e posts
- `Playlists`: compartilhamento e descoberta de listas musicais
- `Shopping`: anuncios e ofertas dentro da plataforma
- `Eventos`: divulgacao de eventos musicais
- `Notifications`: central de notificacoes com suporte a push
- `Ascensao`: espaco para talentos, destaque e descoberta
- `Perfil`: pagina publica com posts, playlists, comunidades e integracao Spotify

## Banco de dados

O projeto inclui um schema completo em `supabase/full_schema.sql`, com tabelas centrais como:

- `profiles`
- `posts`
- `post_likes`
- `comments`
- `messages`
- `communities`
- `community_members`
- `community_posts`
- `notifications`
- `push_subscriptions`
- `playlists`
- `music_events`
- `marketplace_listings`
- `marketplace_favorites`
- `marketplace_chat_messages`
- `event_rsvps`
- `event_artist_applications`
- `ascensao_posts`
- `user_follows`
- `user_blocks`
- `moderation_reports`

## Integracoes

### Supabase

O SONORA usa Supabase para:

- autenticacao
- banco relacional
- realtime
- storage de midia
- edge functions

### Spotify

A aplicacao suporta conexao com Spotify para:

- sincronizar a `Capsula do Tempo Spotify`
- buscar top artistas e top faixas
- exibir embeds de links do Spotify

### Web Push

O projeto possui:

- `public/sw.js` para recebimento de notificacoes no navegador
- `src/pushClient.js` para registrar subscriptions
- `supabase/functions/send-web-push/index.ts` para envio de push via edge function

## Como rodar localmente

1. Clone o repositorio:

```bash
git clone https://github.com/Bielexe01/SONORA.git
cd SONORA
```

2. Instale as dependencias:

```bash
npm install
```

3. Configure um arquivo `.env` com as variaveis necessarias.

4. Rode o ambiente de desenvolvimento:

```bash
npm run dev
```

5. Para gerar a build:

```bash
npm run build
```

## Variaveis de ambiente do front-end

Estas variaveis sao lidas no cliente:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SPOTIFY_CLIENT_ID=
VITE_SPOTIFY_REDIRECT_URI=
VITE_WEB_PUSH_PUBLIC_KEY=
```

## Variaveis da edge function

Para `supabase/functions/send-web-push`, o ambiente precisa de:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=
```

## Scripts disponiveis

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Observacoes importantes

- o repositório ainda possui fallback de `Supabase URL` e `anon key` em partes do front-end, então vale centralizar tudo em variaveis de ambiente
- a integracao com Spotify depende de `VITE_SPOTIFY_CLIENT_ID` e URI de redirecionamento correta
- web push depende tanto do `service worker` quanto da edge function configurada no Supabase
- algumas experiencias do app possuem fallback local com `localStorage` quando o backend nao responde ou ainda nao esta completo

## Melhorias futuras

- criar `.env.example` com todas as variaveis documentadas
- centralizar a instancia do Supabase em um unico modulo
- remover chaves hardcoded de componentes secundarios
- dividir `App.jsx` em modulos menores
- adicionar testes para fluxos principais
- documentar deployment do front e das edge functions

## Autor

Projeto publicado por [Bielexe01](https://github.com/Bielexe01).
