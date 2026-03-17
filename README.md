# WhatsApp Business Chatbot - Nexus Center

Chatbot inteligente para WhatsApp focado em triagem de leads, gestão de horários e persistência em nuvem.

## 🚀 Funcionalidades

- **Múltiplas Frentes**: Fluxos otimizados para **Nexus Gate**, **Camba** e **Nexus Build**.
- **Human-Like Interaction**: Delay de resposta e status de "digitando..." para uma conversa mais natural.
- **Gestão de Horário**: Respostas automáticas para atendimentos fora do horário comercial (08h às 18h).
- **Follow-up Automático**: Lembretes de inatividade para não perder leads.
- **Auto-Silence**: O bot para de responder automaticamente quando identifica que um humano assumiu a conversa.
- **🛡️ Persistência Cloud**: Sessões e Leads salvos no **Supabase** com segurança RLS.
- **🚀 Handoff Inteligente**: Transferência automática para humano após 3 erros seguidos no menu.
- **Comando de Reset**: Use `/fim` para encerrar um atendimento, enviar uma despedida profissional e resetar o bot para o próximo contato.

## 🛠️ Tecnologias

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - Cliente WhatsApp para Node.js.
- [Supabase](https://supabase.com/) - Banco de Dados PostgreSQL na nuvem.
- [Pino](https://github.com/pinojs/pino) - Logger de alta performance.
- [Dotenv](https://github.com/motdotla/dotenv) - Gestão de variáveis de ambiente.

## 📦 Instalação

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` com base no `.env.example`.
4. Inicie o bot:
   ```bash
   npm start
   ```

## ⚙️ Configuração (Supabase)

Para habilitar a persistência em nuvem, crie as tabelas `sessions` e `leads` no seu projeto Supabase usando o SQL Editor:

```sql
create table public.sessions (
  id text primary key,
  state text not null default 'main',
  data jsonb not null default '{}'::jsonb,
  retry_count int not null default 0,
  updated_at timestamp with time zone default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_phone text not null,
  department text not null,
  description text not null,
  created_at timestamp with time zone default now()
);

alter table public.sessions enable row level security;
alter table public.leads enable row level security;
```

---
Nexus Center - Todos os direitos reservados.
