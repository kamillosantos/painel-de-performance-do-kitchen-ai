# Operação local — Kitchen AI Global

## Fonte e limites atuais

`data/videos.json` é o manifesto versionado do site. Ele está intencionalmente vazio: o repositório auditado não continha os 89 vídeos nem uma integração com Skillgroove-voiceOS. Não adicionar registros fictícios. Preencher apenas com informação verificável e registrar a URL de evidência em `provenance.evidence_url`.

GitHub Pages publica arquivos estáticos. O site atual não possui backend, base de dados, autenticação administrativa, worker/fila, integração de geração ou endpoint de telemetria; o importador do navegador é somente uma prévia local, sem persistência e sem upload.

## Validar e gerar páginas

- `npm test` — testes unitários e geração em diretório temporário.
- `npm run build:write` — gera/atualiza `sitemap.xml`, `robots.txt` e páginas `video/<slug>/index.html` **somente** para registros `PUBLISHED` com direitos, atribuição, proveniência, thumbnail, fonte e resumo válidos.
- `npm run build:check` — falha se os arquivos gerados não refletirem o manifesto.

Um item inelegível é excluído do sitemap e da publicação. Não se tenta inferir dados ausentes nem contornar as regras dos players oficiais. `VideoObject` só é emitido com dados de reprodução autorizada e data de publicação; não são fabricados Recipe/Article nem métricas.

## Capacidades ainda bloqueadas

A integração Skillgroove-voiceOS não está configurada e não há API oficial/endpoint confirmado nesta sessão. Para automação contínua, fila compartilhada, produção real, autenticação, telemetria, relatórios, sincronização do app e publicação, escolher uma hospedagem/backend e fornecer o acesso oficial ao catálogo e às métricas. O alvo de 1.000 unidades/dia é apenas planejamento; nenhum job de geração foi iniciado nesta execução.
