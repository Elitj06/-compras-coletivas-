/* Recuperacao, troca autenticada e fallback administrativo de PIN. */

Object.assign(app, {
  openPinRecoveryRequest(blocking = false) {
    document.getElementById("registrationModal")?.remove();
    showAuthModal(`
      <div class="modal-header"><h2>Recuperar PIN</h2>
        <p>Informe seu telefone ou e-mail. A resposta é sempre a mesma para proteger sua conta.</p></div>
      <div class="modal-body"><div class="form-group">
        <label for="recoveryIdentifier">Telefone ou e-mail</label>
        <input id="recoveryIdentifier" autocomplete="username" placeholder="(00) 00000-0000 ou seu@email.com" />
      </div></div>
      <div class="modal-footer auth-actions">
        <button class="btn btn-ghost" onclick="app.returnToLogin(${blocking})">Voltar</button>
        <button class="btn btn-primary" onclick="app.submitPinRecoveryRequest(${blocking})">Enviar código</button>
      </div>
      <button class="btn btn-link btn-block" onclick="app.openPinRecoveryComplete('',${blocking})">Tenho um código do administrador</button>`, blocking);
  },

  // SECTION: Nunca mantenha o modal de recuperação atrás do modal de login.
  returnToLogin(blocking = false) {
    closeAuthModal();
    this.showRegistrationModal(blocking, "login");
  },

  async submitPinRecoveryRequest(blocking = false) {
    const identifier = document.getElementById("recoveryIdentifier")?.value?.trim() || "";
    if (!identifier) return this.toast("Informe telefone ou e-mail", "error");
    const response = await fetch("/api/pin-recovery-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identificador: identifier }),
    });
    const result = await response.json().catch(() => null);
    if (!result?.challenge_id) return this.toast("Não foi possível iniciar a recuperação", "error");
    sessionStorage.setItem("pinRecoveryChallenge", result.challenge_id);
    this.toast(result.message, "success");
    this.openPinRecoveryComplete(result.challenge_id, blocking);
  },

  openPinRecoveryComplete(challengeId = "", blocking = false) {
    const saved = challengeId || sessionStorage.getItem("pinRecoveryChallenge") || "";
    showAuthModal(`
      <div class="modal-header"><h2>Definir novo PIN</h2>
        <p>Digite o código recebido por e-mail ou fornecido pelo administrador.</p></div>
      <div class="modal-body">
        <div class="form-group"><label for="recoveryChallenge">Identificador do atendimento</label>
          <input id="recoveryChallenge" value="${fmt.escape(saved)}" autocomplete="off" /></div>
        <div class="form-group"><label for="recoveryCode">Código de 6 dígitos</label>
          <input id="recoveryCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" /></div>
        <div class="form-group"><label for="recoveryNewPin">Novo PIN</label>
          <input id="recoveryNewPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" /></div>
        <div class="form-group"><label for="recoveryConfirmPin">Confirmar novo PIN</label>
          <input id="recoveryConfirmPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" /></div>
        <p class="auth-help">Não recebeu o e-mail? Peça ao administrador uma validação por WhatsApp, telefone ou presencial.</p>
      </div>
      <div class="modal-footer auth-actions">
        <button class="btn btn-ghost" onclick="app.openPinRecoveryRequest(${blocking})">Voltar</button>
        <button class="btn btn-primary" onclick="app.submitPinRecoveryComplete(${blocking})">Redefinir PIN</button>
      </div>`, blocking);
  },

  async submitPinRecoveryComplete(blocking = false) {
    const challenge_id = document.getElementById("recoveryChallenge")?.value?.trim() || "";
    const code = digits("recoveryCode");
    const new_pin = digits("recoveryNewPin");
    const confirmation = digits("recoveryConfirmPin");
    if (code.length !== 6 || !/^\d{4,6}$/.test(new_pin) || new_pin !== confirmation) {
      return this.toast("Confira o código e a confirmação do novo PIN", "error");
    }
    const result = await this.api("comprador/pin-recovery/complete", "POST", { challenge_id, code, new_pin });
    if (!result?.success) return this.toast(result?.error || "Código inválido ou expirado", "error");
    sessionStorage.removeItem("pinRecoveryChallenge");
    history.replaceState({}, "", location.pathname);
    this.clearBuyerSession(false);
    this.returnToLogin(blocking);
    this.toast("PIN redefinido. Entre agora com seu telefone ou e-mail e o novo PIN.", "success");
  },

  renderAuthSecurityAction() {
    const wrap = document.getElementById("headerUser");
    if (!wrap || document.getElementById("headerSecurityBtn")) return;
    const button = document.createElement("button");
    button.id = "headerSecurityBtn";
    button.className = "header-security-btn";
    button.title = "Alterar PIN";
    button.textContent = "PIN";
    button.onclick = () => this.openChangePin();
    wrap.insertBefore(button, wrap.querySelector(".header-logout-btn"));
  },

  openChangePin() {
    showAuthModal(`
      <div class="modal-header"><h2>Alterar PIN</h2><p>Confirme seu PIN atual e escolha um novo.</p></div>
      <div class="modal-body">
        <div class="form-group"><label for="currentPin">PIN atual</label><input id="currentPin" type="password" inputmode="numeric" maxlength="6" /></div>
        <div class="form-group"><label for="newPin">Novo PIN</label><input id="newPin" type="password" inputmode="numeric" maxlength="6" /></div>
        <div class="form-group"><label for="confirmPin">Confirmar novo PIN</label><input id="confirmPin" type="password" inputmode="numeric" maxlength="6" /></div>
      </div>
      <div class="modal-footer auth-actions"><button class="btn btn-ghost" onclick="closeAuthModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="app.submitChangePin()">Alterar PIN</button></div>`);
  },

  async submitChangePin() {
    const current_pin = digits("currentPin");
    const new_pin = digits("newPin");
    if (!/^\d{4,6}$/.test(current_pin) || !/^\d{4,6}$/.test(new_pin) || new_pin !== digits("confirmPin")) {
      return this.toast("Confira o PIN atual e a confirmação", "error");
    }
    const result = await this.api("comprador/pin", "PUT", { current_pin, new_pin });
    if (!result?.success) return this.toast(result?.error || "Não foi possível alterar", "error");
    this.state.buyerToken = result.token;
    writePersistedToken(BUYER_TOKEN_KEY, result.token);
    closeAuthModal();
    this.toast("PIN alterado e sessão protegida", "success");
  },

  async openAdminPinRecovery() {
    const result = await this.api("compradores/lista");
    const buyers = result?.data || [];
    if (!buyers.length) return this.toast("Nenhum comprador disponível", "error");
    const options = buyers.map((buyer) =>
      `<option value="${buyer.id}">${fmt.escape(buyer.nome)} · ${fmt.escape(buyer.telefone || buyer.email || "")}</option>`
    ).join("");
    showAuthModal(`
      <div class="modal-header"><h2>Recuperação assistida</h2><p>Valide a identidade antes de gerar o código temporário.</p></div>
      <div class="modal-body">
        <div class="form-group"><label for="adminRecoveryBuyer">Comprador</label><select id="adminRecoveryBuyer">${options}</select></div>
        <div class="form-group"><label for="verificationMethod">Método de validação</label><select id="verificationMethod"><option>WhatsApp</option><option>Telefone</option><option>Presencial</option></select></div>
        <div class="form-group"><label for="verificationNote">Nota de validação</label><textarea id="verificationNote" maxlength="500" placeholder="Descreva como a identidade foi confirmada"></textarea></div>
      </div>
      <div class="modal-footer auth-actions"><button class="btn btn-ghost" onclick="closeAuthModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="app.submitAdminPinRecovery()">Gerar código</button></div>`);
  },

  async submitAdminPinRecovery() {
    const buyerId = document.getElementById("adminRecoveryBuyer")?.value;
    const verification_method = document.getElementById("verificationMethod")?.value;
    const verification_note = document.getElementById("verificationNote")?.value?.trim() || "";
    if (verification_note.length < 10) return this.toast("Registre uma nota de validação", "error");
    const result = await this.api(`admin/compradores/${buyerId}/pin-recovery`, "POST", {
      verification_method, verification_note,
    });
    if (!result?.success) return this.toast(result?.error || "Falha ao gerar código", "error");
    const packageText = `${result.challenge_id}\n${result.code}`;
    this._adminRecoveryPackage = packageText;
    showAuthModal(`
      <div class="modal-header"><h2>Código temporário gerado</h2><p>Compartilhe os dois campos uma única vez com o comprador validado.</p></div>
      <div class="modal-body auth-code-result"><small>Identificador do atendimento</small><code>${fmt.escape(result.challenge_id)}</code>
        <small>Código de 6 dígitos</small><strong>${fmt.escape(result.code)}</strong>
        <small>Expira em ${new Date(result.expires_at).toLocaleString("pt-BR")}</small></div>
      <div class="modal-footer auth-actions"><button class="btn btn-ghost" onclick="closeAuthModal()">Fechar</button>
        <button class="btn btn-primary" onclick="app.copyAdminRecoveryPackage()">Copiar dados</button></div>`);
  },

  async copyAdminRecoveryPackage() {
    const packageText = this._adminRecoveryPackage || "";
    if (!packageText) return this.toast("O código já foi limpo", "error");
    try {
      await navigator.clipboard.writeText(packageText);
      this._adminRecoveryPackage = null;
      this.toast("Dados copiados e memória limpa", "success");
    } catch {
      this.toast("Não foi possível copiar. Selecione os dados manualmente.", "error");
    }
  },
});

function showAuthModal(content, blocking = false) {
  document.getElementById("authRecoveryModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "authRecoveryModal";
  modal.className = "modal-wrap";
  modal.innerHTML = `<div class="modal-overlay${blocking ? " modal-blocking" : ""}"><div class="modal-content auth-modal">${content}</div></div>`;
  document.body.appendChild(modal);
}

function closeAuthModal() {
  app._adminRecoveryPackage = null;
  document.getElementById("authRecoveryModal")?.remove();
}

function digits(id) {
  return (document.getElementById(id)?.value || "").replace(/\D/g, "");
}

document.addEventListener("DOMContentLoaded", () => {
  const challenge = new URLSearchParams(location.search).get("recover");
  if (challenge) app.openPinRecoveryComplete(challenge, true);
});
