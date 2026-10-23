# 🔑 Credenciais e Acessos de Teste — SinalizeGO (Ambiente Local)

Este documento centraliza todas as contas, perfis, credenciais e rotas criadas no banco de dados local após o reset.

---

## 🔒 Senha Padrão
> **Senha única para todas as contas:** `senha123`

---

## 👥 Tabela de Usuários e Perfis

| Perfil / Papel | E-mail de Login | Senha | Nome Cadastrado | Permissões & Finalidade de Teste |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@sinalizego.com` | `senha123` | Gabriel Super Admin | Gestão global da plataforma, auditorias, liberações |
| **Dono (Barbearia Retrô Club)** | `barbeiro@teste.com` | `senha123` | Carlos Barbeiro | Gestão completa do estabelecimento (`/painel`), serviços, funcionários, agenda, financeiro |
| **Dona (Studio Bella Estética)** | `salao@teste.com` | `senha123` | Mariana Designer | Teste de isolamento Multi-Tenancy (garantir que empresa A não vê dados da empresa B) |
| **Funcionário** | `funcionario@teste.com` | `senha123` | João Navalha (Funcionário) | Visualização de agenda e atendimentos vinculados ao profissional |
| **Cliente Principal** | `cliente@teste.com` | `senha123` | Lucas Mendes (Cliente) | Agendamento de serviços, checkout Pix, meus agendamentos (`/meus-agendamentos`), créditos |
| **Cliente Secundário** | `cliente2@teste.com` | `senha123` | Fernanda Souza (Cliente) | Testes de múltiplos clientes, avaliações e concorrência de horários |

---

## 🏢 Empresas e Vitrines Criadas

### 1. Barbearia Retrô Club
- **Slug**: `barbearia-retro`
- **URL da Vitrine Pública**: [http://localhost:5173/empresa/barbearia-retro](http://localhost:5173/empresa/barbearia-retro) (ou `/b/barbearia-retro`)
- **Painel do Dono**: [http://localhost:5173/painel](http://localhost:5173/painel) (logar com `barbeiro@teste.com`)
- **Profissionais Cadastrados**:
  - `João Navalha Master` (Barbeiro Master) — vinculado a Corte, Barba, Combos e VIP
  - `Marcos Silva` (Especialista em Degradê & Fade) — vinculado a Corte e Sobrancelha Express
- **Serviços Disponíveis**:
  - `Corte Degradê / Social`: R$ 45,00 (30 min - Sinal de 50% = R$ 22,50)
  - `Barba Terapia com Toalha Quente`: R$ 35,00 (30 min - Sinal de 50% = R$ 17,50)
  - `Sobrancelha Express na Navalha`: R$ 12,00 (15 min - Sinal de 100% compulsório = R$ 12,00 [Regra N1])
  - `Combo Completo (Cabelo + Barba)`: R$ 75,00 (60 min - Sinal de 50% = R$ 37,50)
  - `Dia do Noivo VIP`: R$ 450,00 (180 min - Sinal flexível 30% = R$ 135,00 [Regra N3])
- **Horário de Funcionamento**:
  - Segunda a Sexta: 09:00 às 19:00 (Almoço 12:00 - 13:00)
  - Sábado: 09:00 às 18:00 (Almoço 12:00 - 13:00)
  - Domingo: Fechado

### 2. Studio Bella Estética
- **Slug**: `studio-bella`
- **URL da Vitrine Pública**: [http://localhost:5173/empresa/studio-bella](http://localhost:5173/empresa/studio-bella) (ou `/b/studio-bella`)
- **Painel da Dona**: [http://localhost:5173/painel](http://localhost:5173/painel) (logar com `salao@teste.com`)
- **Serviços Disponíveis**:
  - `Manicure & Pedicure Spa`: R$ 65,00 (50 min - Sinal de 50% = R$ 32,50)

---

## 🚀 Como Testar no Navegador

1. **Frontend**: [http://localhost:5173](http://localhost:5173)
2. **Página de Login**: [http://localhost:5173/login](http://localhost:5173/login)
3. **Explorar Estabelecimentos**: [http://localhost:5173/barbearias](http://localhost:5173/barbearias)
4. **Agendamentos do Cliente**: [http://localhost:5173/meus-agendamentos](http://localhost:5173/meus-agendamentos) (logado como `cliente@teste.com`)
5. **Painel do Estabelecimento**: [http://localhost:5173/painel](http://localhost:5173/painel) (logado como `barbeiro@teste.com`)
   - Abas disponíveis:
     - `/painel` (Visão Geral / Métricas)
     - `/painel/appointments` (Agendamentos)
     - `/painel/services` (Serviços)
     - `/painel/employees` (Equipe & Funcionários)
     - `/painel/schedule` (Horários de Funcionamento)
     - `/painel/financial` (Financeiro & Saldo)
     - `/painel/settings` (Configurações da Empresa)

---

## 🛠️ Como Resetar Novamente no Futuro

No terminal do backend (`api-sinalizego`):
```bash
npx prisma db push --force-reset
npm run db:seed
```
Ou simplesmente:
```bash
npm run db:seed
```
(O seed usa `upsert` e não gera duplicatas caso executado múltiplas vezes).
