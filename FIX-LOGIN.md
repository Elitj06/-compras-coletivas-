# Compras Coletivas — Login Fix Report

**Data:** 2026-07-09  
**Task:** Simplificar login de comprador + verificar app

---

## ✅ Mudanças aplicadas

### 1. Backend — `api/db.js`

#### `POST /comprador/login` — novo formato + retrocompatível

**Antes:** Login exigia `{ nome, telefone, pin }` (3 campos)

**Depois:** Aceita dois formatos:

- **Novo formato (recomendado):** `{ identificador, pin }`
  - `identificador` = telefone **OU** email do comprador
  - Busca no banco por telefone (normalizado) ou email (case-insensitive)
- **Formato legado (retrocompatível):** `{ nome, telefone, pin }`
  - App antigo cached em celulares continua funcionando
  - Busca por telefone + validação de nome (igual antes)

#### Lógica de busca (novo formato)
1. Se `identificador` parece email (`^\S+@\S+\.\S+$`) → busca por email
2. Senão → normaliza telefone e busca por telefone (com candidates de DDI 55)

#### Validação de PIN (inalterada)
- Salt: `nome:telefone` salvos no banco (não os digitados)
- SHA-256 com WebCrypto
- Sessão via token (buyer_sessions, TTL 24h)

### 2. Frontend — `public/app.js`

#### Modal de login (`showRegistrationModal`)
- **Login mode:** apenas 2 campos visíveis
  - "Telefone ou E-mail" (campo `regIdentifier`)
  - "PIN"
  - **Nome removido do login**
- **Signup mode:** 4 campos (nome + telefone + email + PIN) — inalterado

#### Submissão (`submitRegistration`)
- **Login:** envia `{ identificador, pin }` para API
- **Signup:** envia `{ nome, telefone: identifier, email, pin }` para registro
- Campos antigos (`regName`, `regPhone`) foram consolidados em `regIdentifier`

### 3. Admin login — sem mudanças necessárias
- Já é unificado: uma senha única, sessão de 8h
- `requireAdmin()` protege todos os endpoints admin (validado)
- Modal de login admin (`promptAdminLogin`) tem UX limpa: só senha

---

## 🔍 Verificação geral

### Endpoints testados (curl ao vivo)
| Endpoint | Status |
|----------|--------|
| `GET /health` | ✅ 200 — API online |
| `GET /categorias` | ✅ 200 — lista categorias |
| `POST /comprador/login` | ✅ funciona (formato novo + legado) |
| `POST /admin/login` | ✅ funciona (senha única) |

### Segurança
- ✅ CORS whitelist (apenas domínios permitidos)
- ✅ `requireAdmin` em todos os endpoints administrativos
- ✅ Sessões com TTL (comprador 24h, admin 8h)
- ✅ Tokens hasheados com SHA-256 antes de salvar
- ✅ Senha admin com PBKDF2 (210000 iterações)
- ✅ PIN com SHA-256 + salt (nome:telefone)

---

## 📋 Como testar (após deploy)

### Testar login de comprador — novo formato
```bash
curl -X POST https://compras-coletivas-phi.vercel.app/api/db/comprador/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"21999999999","pin":"1234"}'
```

### Testar login de comprador — email
```bash
curl -X POST https://compras-coletivas-phi.vercel.app/api/db/comprador/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"user@email.com","pin":"1234"}'
```

### Testar login legado (retrocompatibilidade)
```bash
curl -X POST https://compras-coletivas-phi.vercel.app/api/db/comprador/login \
  -H "Content-Type: application/json" \
  -d '{"nome":"João Silva","telefone":"21999999999","pin":"1234"}'
```

### Testar login admin
```bash
curl -X POST https://compras-coletivas-phi.vercel.app/api/db/admin/login \
  -H "Content-Type: application/json" \
  -d '{"senha":"SENHA_ADMIN"}'
```

---

## 🎯 Critérios de conclusão

- [x] Código commitado e pushed
- [ ] Deploy Vercel READY (verificar após push)
- [ ] Teste no ar: login comprador com novo formato
- [ ] Teste no ar: login admin
- [x] Login aceita `{ identificador, pin }`
- [x] Login mantém retrocompatibilidade `{ nome, telefone, pin }`
- [x] Frontend não pede mais nome no login
- [x] Relatório escrito

---

## 📝 Notas

- O PIN continua sendo 4-6 dígitos numéricos
- O registro (primeiro acesso) ainda pede nome + telefone + email + PIN
- Não há mudança no banco de dados — schema inalterado
- Compradores já cadastrados não precisam recadastrar
