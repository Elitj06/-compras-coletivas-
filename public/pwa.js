/* Compras Coletivas — PWA
   - Registra o service worker (cache do app shell).
   - Controla o botão de instalação (Chromium via beforeinstallprompt).
   - Orienta a instalação no iOS/Safari.
   - Mostra status offline e aviso de nova versão. */

(() => {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const isIos =
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  let deferredPrompt = null;
  const installBtn = document.getElementById("installAppBtn");

  function refreshInstallButton() {
    if (!installBtn) return;
    if (standalone) {
      installBtn.hidden = true;
      return;
    }
    installBtn.hidden = !(deferredPrompt || isIos);
  }

  function showIosHint() {
    if (document.getElementById("iosInstallHint")) return;
    const previousFocus = document.activeElement;
    const wrap = document.createElement("div");
    wrap.id = "iosInstallHint";
    wrap.className = "ios-install-hint";
    wrap.innerHTML = `
      <div class="ios-install-card" role="dialog" aria-modal="true" aria-labelledby="iosInstallTitle">
        <button type="button" class="ios-install-close" aria-label="Fechar">×</button>
        <h2 id="iosInstallTitle">Instalar o app</h2>
        <p>No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>
        <button type="button" class="btn btn-primary btn-block ios-install-ok">Entendi</button>
      </div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";

    const close = () => {
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previousFocus?.focus?.();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", onKey);
    wrap.querySelector(".ios-install-close")?.addEventListener("click", close);
    wrap.querySelector(".ios-install-ok")?.addEventListener("click", close);
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) close();
    });
    wrap.querySelector(".ios-install-ok")?.focus();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    refreshInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (installBtn) installBtn.hidden = true;
    showToast("App instalado. Bom proveito!");
  });

  installBtn?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (error) {
        /* ignora cancelamento */
      }
      deferredPrompt = null;
      refreshInstallButton();
      return;
    }
    if (isIos) showIosHint();
  });

  function showToast(message) {
    if (window.app?.toast) {
      window.app.toast(message, "success");
      return;
    }
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast toast-success";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  /* ---------- Offline / online ---------- */
  function ensureConnectivityBanner() {
    let banner = document.getElementById("offlineBanner");
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "offlineBanner";
    banner.className = "offline-banner";
    banner.hidden = true;
    banner.setAttribute("role", "status");
    banner.textContent = "Você está offline. O carrinho continua salvo neste aparelho.";
    document.body.appendChild(banner);
    return banner;
  }

  function refreshConnectivity() {
    const banner = ensureConnectivityBanner();
    banner.hidden = navigator.onLine !== false;
    document.documentElement.classList.toggle("is-offline", navigator.onLine === false);
  }

  window.addEventListener("online", refreshConnectivity);
  window.addEventListener("offline", refreshConnectivity);
  refreshConnectivity();
  refreshInstallButton();

  /* ---------- Service worker ---------- */
  if (!("serviceWorker" in navigator)) return;

  let reloading = false;
  let updateRequested = false;

  function showUpdateBanner(waitingWorker) {
    if (document.getElementById("updateBanner")) return;
    const banner = document.createElement("div");
    banner.id = "updateBanner";
    banner.className = "update-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <span>Nova versão disponível.</span>
      <button type="button" class="btn btn-primary btn-sm">Atualizar</button>`;
    banner.querySelector("button")?.addEventListener("click", () => {
      updateRequested = true;
      waitingWorker?.postMessage("SKIP_WAITING");
      // Fallback: se o worker não assumir o controle, recarrega mesmo assim.
      setTimeout(() => {
        if (updateRequested && !reloading) window.location.reload();
      }, 3000);
    });
    document.body.appendChild(banner);
  }

  function trackWorker(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateBanner(worker);
      }
    });
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Só recarrega quando o usuário aceitou a atualização; a primeira
    // instalação assume o controle sem recarregar a página.
    if (!updateRequested || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      // Worker que já estava esperando (ex.: usuário fechou a aba antes de
      // atualizar) aparece já no próximo acesso.
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration.waiting);
      }

      trackWorker(registration.installing);
      registration.addEventListener("updatefound", () => {
        trackWorker(registration.installing);
      });

      registration.update().catch(() => {});
    } catch (error) {
      /* registro falhou; app continua funcionando online */
    }
  });
})();
