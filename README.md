# Nexus Center - WhatsApp Chatbot

Um chatbot profissional para WhatsApp Business, desenvolvido com foco em alta performance, modularidade e experiência do usuário (UX).

## 🚀 Funcionalidades

- **Múltiplas Frentes**: Fluxos otimizados para **Nexus Gate**, **Camba** e **Nexus Build**.
- **Human-Like Interaction**: Delay de resposta e status de "digitando..." para uma conversa mais natural.
- **Gestão de Horário**: Respostas automáticas para atendimentos fora do horário comercial (08h às 18h).
- **Follow-up Automático**: Lembretes de inatividade para não perder leads.
- **Auto-Silence**: O bot para de responder automaticamente quando identifica que um humano assumiu a conversa.
- **Comando de Reset**: Use `/fim` para encerrar um atendimento, enviar uma despedida profissional e resetar o bot para o próximo contato.

## 🛠️ Tecnologias

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - Integração com WhatsApp.
- [Pino](https://github.com/pinojs/pino) - Logging de alta performance.
- [Dotenv](https://github.com/motdotla/dotenv) - Gestão de variáveis de ambiente.
- [ESLint](https://eslint.org/) & [Prettier](https://prettier.io/) - Padronização de código.

## 📦 Como Usar

1.  Instale as dependências:
    ```bash
    npm install
    ```

2.  Configure o arquivo `.env` (use o `.env.example` como base).

3.  Inicie o bot:
    ```bash
    npm start
    ```

4.  Escaneie o QR Code que aparecerá no terminal.

## 📄 Licença

Este projeto é de uso exclusivo da **Nexus Center**.
