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
- Contas, transferências e lançamentos
- Cartões, faturas e parcelas
- Orçamento mensal e limites por categoria
- Metas, reserva de emergência e compras planejadas
- Investimentos manuais
- Relatórios em CSV e PDF
- Backup criptografado em JSON e restauração
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
```

## 🔐 Dados e senha

Sem senha, os lançamentos ficam em texto no `localStorage` deste navegador. Com senha, o Saldo deriva uma chave com PBKDF2-HMAC-SHA-256 (600.000 iterações e sal único) e grava o arquivo com AES-GCM. A senha não sai do computador. Se ela for esquecida, não existe recuperação.

No primeiro uso, o Saldo pede uma senha. Continuar sem senha é uma escolha explícita, com um aviso do risco. Senhas novas têm de 12 a 128 caracteres e pelo menos 6 caracteres diferentes. Sequência, repetição e combinação de palavras comuns são recusadas. Uma senha antiga mais curta ainda abre o cofre, para que você possa trocá-la.

A espera depois de errar a senha fica registrada neste navegador e continua depois de recarregar. Apagar os dados do site zera esse contador. Quem copiar o arquivo ainda pode tentar senhas fora do Saldo. O que dificulta isso é a derivação lenta da chave.

Limpar os dados do site ou abrir o Saldo em outro computador apaga o que estava só no navegador. Em Relatórios, **Backup** baixa um JSON criptografado e **Restaurar** pede a senha para trazer os dados de volta. O arquivo é criptografado mesmo quando o aplicativo está sem senha; nesse caso a senha vale só para o backup. Arquivos maiores que 8 MB são recusados. CSV e PDF saem sem criptografia e ficam legíveis na pasta de Downloads. Se a senha do aplicativo já estiver ativa, o backup usa essa mesma senha.

Nada do controle financeiro é enviado a um servidor. As fontes também vêm do próprio aplicativo. Notas escritas nas movimentações ficam no mesmo arquivo local. Os cabeçalhos de segurança, inclusive a política de conteúdo, saem do servidor. A hospedagem precisa executar esse servidor; um site só de arquivos estáticos perde essa política. Um script ou extensão na mesma página enxerga os dados enquanto o cofre está aberto.

## 📄 Licença

[MIT](LICENSE)
