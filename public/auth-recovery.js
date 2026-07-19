/* Recuperacao simples de PIN, troca autenticada e fallback administrativo. */

Object.assign(app, {
  openPinRecoveryRequest(blocking = false) {
    document.getElementById("registrationModal")?.remove();
    showAuthModal(`
      <div class="modal-header"><h2>Recuperar acesso</h2>
        <p>Informe seus dados e escolha um novo PIN. Depois, entre normalmente no app.</p></div>
      <div class="modal-body">
      <div class="form-group">
        <label for="recoveryIdentifier">Telefone ou e-mail</label>
        <input id="recoveryIdentifier" autocomplete="username" placeholder="(00) 00000-0000 ou seu@email.com" />
      </div>
      <div class="form-group">
        <label for="simpleRecoveryPin">Novo PIN</label>
        <input id="simpleRecoveryPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="4 a 6 dígitos" />
      </div>
      <div class="form-group">
        <label for="simpleRecoveryConfirmPin">Confirmar novo PIN</label>
        <input id="simpleRecoveryConfirmPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="Repita o PIN" />
      </div>
      <p class="auth-help">O PIN antigo deixa de funcionar imediatamente.</p>
      </div>
      <div class="modal-footer auth-actions">
        <button class="btn btn-ghost" onclick="app.returnToLogin(${blocking})">Voltar</button>
        <button class="btn btn-primary" onclick="app.submitPinRecoveryRequest(${blocking}, this)">Salvar novo PIN</button>
      </div>
      `, blocking);
  },

  // SECTION: Nunca mantenha o modal de recuperação atrás do modal de login.
  returnToLogin(blocking = false) {
    closeAuthModal();
    this.showRegistrationModal(blocking, "login");
  },

  async submitPinRecoveryRequest(blocking = false, submitButton = null) {
    const identifier = document.getElementById("recoveryIdentifier")?.value?.trim() || "";
    const new_pin = digits("simpleRecoveryPin");
    const confirmation = digits("simpleRecoveryConfirmPin");
    if (!identifier) return this.toast("Informe telefone ou e-mail", "error");
    if (!/^\d{4,6}$/.test(new_pin) || new_pin !== confirmation) {
      return this.toast("Confira o novo PIN e a confirmação", "error");
    }
    return this.runAuthSubmission(submitButton, "Salvando...", async () => {
      const result = await this.api("comprador/pin-recovery/simple", "POST", { identificador: identifier, new_pin });
      if (!result?.success) {
        this.toast(result?.error || "Cadastro não encontrado. Confira o telefone ou e-mail.", "error");
        return;
      }
      this.clearBuyerSession(false);
      this.returnToLogin(blocking);
      const loginIdentifier = document.getElementById("regIdentifier");
      if (loginIdentifier) loginIdentifier.value = identifier;
      this.toast("PIN redefinido. Entre agora com o novo PIN.", "success");
    });
  },

  /** Explica os próximos passos sem transformar uma resposta neutra em confirmação de entrega. */
  showPinRecoveryInstructions(challengeId, blocking = false) {
    showAuthModal(`
      <div class="modal-header"><h2>Confira seu e-mail</h2>
        <p>Se houver um cadastro compatível, as instruções chegam em instantes. Confira também a caixa de spam.</p></div>
      <div class="modal-body"><p class="auth-help">É seu primeiro acesso? Crie seu cadastro. Se já tem cadastro e não receber o código, peça ajuda ao administrador para validação.</p></div>
      <div class="modal-footer auth-actions">
        <button class="btn btn-ghost" onclick="app.showRegistrationModal(${blocking}, 'signup')">Criar cadastro</button>
        <button class="btn btn-primary" onclick="app.openPinRecoveryComplete('${challengeId}',${blocking})">Já tenho o código</button>
      </div>`, blocking);
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
        <button class="btn btn-primary" onclick="app.submitPinRecoveryComplete(${blocking}, this)">Redefinir PIN</button>
      </div>`, blocking);
  },

  async submitPinRecoveryComplete(blocking = false, submitButton = null) {
    const challenge_id = document.getElementById("recoveryChallenge")?.value?.trim() || "";
    const code = digits("recoveryCode");
    const new_pin = digits("recoveryNewPin");
    const confirmation = digits("recoveryConfirmPin");
    if (code.length !== 6 || !/^\d{4,6}$/.test(new_pin) || new_pin !== confirmation) {
      return this.toast("Confira o código e a confirmação do novo PIN", "error");
    }
    return this.runAuthSubmission(submitButton, "Redefinindo...", async () => {
      const result = await this.api("comprador/pin-recovery/complete", "POST", { challenge_id, code, new_pin });
      if (!result?.success) return this.toast(result?.error || "Código inválido ou expirado", "error");
      sessionStorage.removeItem("pinRecoveryChallenge");
      history.replaceState({}, "", location.pathname);
      this.clearBuyerSession(false);
      this.returnToLogin(blocking);
      this.toast("PIN redefinido. Entre agora com seu telefone ou e-mail e o novo PIN.", "success");
    });
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
      <div class="modal-header"><h2>Redefinir acesso</h2><p>Escolha o comprador. O novo PIN passa a funcionar imediatamente.</p></div>
      <div class="modal-body">
        <div class="form-group"><label for="adminRecoveryBuyer">Comprador</label><select id="adminRecoveryBuyer">${options}</select></div>
        <div class="form-group"><label for="adminRecoveryPin">Novo PIN (opcional)</label><input id="adminRecoveryPin" type="text" inputmode="numeric" maxlength="6" placeholder="Deixe vazio para gerar automaticamente" /></div>
        <p class="auth-help">O comprador deverá entrar usando telefone ou e-mail e este PIN. As sessões antigas serão encerradas.</p>
      </div>
      <div class="modal-footer auth-actions"><button class="btn btn-ghost" onclick="closeAuthModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="app.submitAdminPinRecovery(this)">Definir novo PIN</button></div>`);
  },

  async submitAdminPinRecovery(submitButton = null) {
    const buyerId = document.getElementById("adminRecoveryBuyer")?.value;
    const pin = digits("adminRecoveryPin");
    if (pin && !/^\d{4,6}$/.test(pin)) return this.toast("O PIN deve ter de 4 a 6 dígitos", "error");
    return this.runAuthSubmission(submitButton, "Gerando...", async () => {
      const result = await this.api(`admin/compradores/${buyerId}/pin-reset`, "POST", pin ? { pin } : {});
      if (!result?.success) return this.toast(result?.error || "Falha ao definir PIN", "error");
      const buyer = result.buyer || {};
      const identifier = buyer.telefone || buyer.email || "";
      const packageText = `${identifier}\n${result.pin}`;
      this._adminRecoveryPackage = packageText;
      showAuthModal(`
        <div class="modal-header"><h2>Acesso redefinido</h2><p>O comprador já pode entrar no app com os dados abaixo.</p></div>
        <div class="modal-body auth-code-result"><small>Telefone ou e-mail</small><code>${fmt.escape(identifier)}</code>
          <small>Novo PIN</small><strong>${fmt.escape(result.pin)}</strong>
          <p class="auth-help">O PIN anterior e as sessões anteriores foram invalidados.</p></div>
        <div class="modal-footer auth-actions"><button class="btn btn-ghost" onclick="closeAuthModal()">Fechar</button>
          <button class="btn btn-primary" onclick="app.copyAdminRecoveryPackage()">Copiar acesso</button></div>`);
    });
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
