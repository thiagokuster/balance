# Saldo

Controle financeiro pessoal no navegador. Contas, cartões, orçamento, metas, investimentos e relatórios ficam salvos só neste computador.

## 🚀 Demo

Ainda não há uma versão publicada. Depois de rodar localmente, abra [http://127.0.0.1:5173](http://127.0.0.1:5173).

## 🛠️ Tecnologias

- TanStack Start
- React
- TypeScript
- Tailwind CSS
- Vite
- Zod

## ✨ Funcionalidades

- Dashboard com saldo, receitas e despesas
- Contas, transferências e lançamentos. Arquivar uma conta ou um cartão tira o item dos lançamentos novos e mantém o histórico nos relatórios
- Cartões, faturas e parcelas, com aviso quando a compra passa do limite
- Orçamento mensal, categorias próprias e limites por categoria
- Metas, reserva de emergência e compras planejadas
- Investimentos manuais, com aporte e resgate para uma conta
- Relatórios em CSV e PDF
- Backup criptografado em JSON, restauração e arquivo vinculado para outro dispositivo
- Calendário financeiro
- Tema claro e escuro
- Senha opcional, de no mínimo 12 caracteres, que criptografa os dados neste navegador

## 📦 Como rodar localmente

```bash
git clone https://github.com/thiagokuster/balance.git
cd balance
bun install
bun run dev
```

## 🧪 Testes

```bash
bun run test
bun run test:e2e
```

O teste de ponta a ponta abre o aplicativo, cria a senha, lança uma despesa, baixa o backup e restaura esse arquivo.

## 🔐 Dados e senha

Sem senha, os lançamentos ficam em texto no `localStorage` deste navegador. Com senha, o Saldo deriva uma chave com PBKDF2-HMAC-SHA-256 (600.000 iterações e sal único) e grava o arquivo com AES-GCM. A senha não sai do computador. Se ela for esquecida, não existe recuperação.

No primeiro uso, o Saldo pede uma senha. Continuar sem senha é uma escolha explícita, com um aviso do risco. Senhas novas têm de 12 a 128 caracteres e pelo menos 6 caracteres diferentes. Sequência, repetição e combinação de palavras comuns são recusadas. Uma senha antiga mais curta ainda abre o cofre, para que você possa trocá-la.

A espera depois de errar a senha fica registrada neste navegador e continua depois de recarregar. Apagar os dados do site zera esse contador. Quem copiar o arquivo ainda pode tentar senhas fora do Saldo. O que dificulta isso é a derivação lenta da chave.

Limpar os dados do site ou abrir o Saldo em outro computador apaga o que estava só no navegador. Em Relatórios, **Backup** baixa um JSON criptografado e **Restaurar** pede a senha para trazer os dados de volta. O arquivo é criptografado mesmo quando o aplicativo está sem senha; nesse caso a senha vale só para o backup. Arquivos maiores que 8 MB são recusados. CSV e PDF saem sem criptografia e ficam legíveis na pasta de Downloads. Se a senha do aplicativo já estiver ativa, o backup usa essa mesma senha.

Para ter os mesmos dados em outro aparelho, guarde esse arquivo numa pasta do Drive, OneDrive ou Dropbox e restaure nele. No Chrome e no Edge, **Vincular arquivo** grava o backup nesse arquivo a cada mudança. Um arquivo mais antigo pede confirmação antes de substituir o que está neste navegador. Não há conta na nuvem do Saldo: os lançamentos não são enviados a um servidor.

Um aporte pode sair de uma conta, e o resgate devolve esse valor para uma conta. Aportes antigos, gravados sem conta de origem, não foram alterados: o dinheiro continua só no investimento e o patrimônio fica maior do que o saldo das contas.

Nada do controle financeiro é enviado a um servidor. As fontes também vêm do próprio aplicativo. Notas escritas nas movimentações ficam no mesmo arquivo local. Os cabeçalhos de segurança, inclusive a política de conteúdo, saem do servidor. A hospedagem precisa executar esse servidor; um site só de arquivos estáticos perde essa política. Um script ou extensão na mesma página enxerga os dados enquanto o cofre está aberto.

## 📄 Licença

[MIT](LICENSE)
