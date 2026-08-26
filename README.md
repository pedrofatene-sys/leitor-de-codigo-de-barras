# Lumina Scan — Leitor de Código de Barras & QR Code

Aplicação web **100% estática e client-side** para leitura de QR Codes e códigos de barras,
com design editorial escuro e sofisticado. Toda a decodificação acontece localmente no
navegador — nenhum dado é enviado a servidores.

**Criado e Desenvolvido por Pedro Correia Lopes Filho.**

## Objetivo

Oferecer um leitor de códigos rápido, bonito e privado, sem necessidade de instalação,
cadastro ou conexão com APIs externas de decodificação.

## Funcionalidades implementadas

- **Leitura pela câmera em tempo real** — inicia/para a câmera, alterna entre câmera
  traseira e frontal (ideal para celular), moldura de escaneamento animada com linha
  de varredura e feedback visual (verde) ao detectar.
- **Leitura por upload de imagem** — clique para escolher ou arraste e solte
  (drag & drop) uma imagem PNG/JPG/WEBP contendo o código.
- **Formatos suportados**: QR Code, EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39,
  Code 93, Codabar, ITF, Data Matrix, PDF 417, Aztec.
- **Painel de resultado** com formato identificado, data/hora, botão de copiar,
  botão "Abrir link" (aparece automaticamente quando o conteúdo é uma URL) e opção
  de nova leitura.
- **Histórico local** (até 30 leituras) persistido em `localStorage`, com ações de
  copiar, abrir link, remover item e limpar tudo.
- **Toasts de feedback**, vibração tátil ao detectar (quando suportado) e pausa
  automática da câmera ao trocar de aba.
- **Responsivo** (desktop e mobile) e acessível (ARIA, navegação por teclado,
  `prefers-reduced-motion`).

## Estrutura e URIs

| Caminho        | Descrição                                   |
|----------------|---------------------------------------------|
| `index.html`   | Página única (hero, scanner, histórico)     |
| `css/style.css`| Estilos — tema escuro editorial com âmbar   |
| `js/app.js`    | Lógica do scanner, upload e histórico       |

Âncoras internas: `#scanner-section`, `#how-it-works`, `#history-section`.

## Tecnologias

- HTML5, CSS3, JavaScript (vanilla)
- [ZXing JS](https://github.com/zxing-js/library) via jsDelivr — decodificação local
- Font Awesome (ícones), Google Fonts (Fraunces, Inter, JetBrains Mono)
- `localStorage` para o histórico (sem banco de dados)

## Funcionalidades não implementadas (por limitação de site estático)

- Sem servidor: não há contas de usuário nem sincronização de histórico entre dispositivos.
- A leitura pela câmera exige contexto seguro (HTTPS) e permissão do navegador.

## Próximos passos sugeridos

- Modo de leitura contínua (múltiplos códigos em sequência com contagem).
- Exportação do histórico em CSV/JSON.
- Atalho de lanterna (torch) quando o hardware suportar.
- PWA com manifest e service worker para uso offline.

## Publicação

Para publicar, utilize a aba **Publish** do ambiente. A aplicação não depende de
backend nem de variáveis de ambiente.
