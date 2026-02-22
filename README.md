# 🛡️ WatchDog – Protótipo de Monitoramento Inteligente de Conectividade (Base do HypeShield, NOC em desenvolvimento e em produção real)

## Visão Geral

O WatchDog é um protótipo de sistema de monitoramento de conectividade orientado a eventos, desenvolvido como base conceitual do projeto HypeShield.

O objetivo principal foi validar uma arquitetura de NOC inteligente capaz de reduzir falsos positivos, flapping e ruído operacional em monitoramento de links e infraestrutura.

Este projeto representa uma abordagem prática de observabilidade com lógica contextual, ao invés de monitoramento reativo tradicional.

---

## Problema que o projeto resolve

Sistemas de monitoramento tradicionais geram:
- Muitos alertas falsos
- Flapping de status (UP/DOWN instável)
- Ruído operacional excessivo
- Decisões ainda dependentes de análise humana

O WatchDog foi criado para:
- Validar mudanças reais de estado
- Reduzir spam de eventos
- Simular uma arquitetura de NOC inteligente

---

## Conceito Central: Golden Logic

A lógica do sistema segue o princípio:

> Um evento só existe quando há uma mudança real de estado validada por contexto, persistência e confiabilidade.

Isso evita:
- Alertas inconsistentes
- Estados “zumbis”
- Painéis operacionais imprecisos

---

## Arquitetura Técnica

- Backend em Node.js / TypeScript
- Banco de dados PostgreSQL
- Docker (ambiente local)
- Processamento orientado a eventos
- Estrutura preparada para API e collectors

O projeto foi construído manualmente em ambiente local (localhost), com foco em validação arquitetural.

---

## Tecnologias Utilizadas

- TypeScript
- Node.js
- PostgreSQL
- Docker
- Arquitetura orientada a eventos

---

## Observação de Segurança

Nesta versão pública:
- APIs estão desativadas
- Integrações externas removidas
- Dados sensíveis não incluídos

Isso foi feito por motivos de confidencialidade e segurança da arquitetura original.

---

## Diferenciais Técnicos

- Debounce lógico de eventos
- Validação de estado anterior vs atual
- Processamento idempotente
- Redução de ruído operacional
- Foco em confiabilidade operacional (NOC / Infra)

---

## Evolução

Este protótipo evoluiu conceitualmente para um sistema mais robusto de proteção operacional (HypeShield), com foco em:
- Observabilidade inteligente
- Self-healing
- Proteção de infraestrutura
- Decisão técnica automatizada

---

## Autor

Arthur Barbosa Sodré  
Desenvolvedor focado em Automação, Monitoramento Inteligente e Engenharia de Infraestrutura.
