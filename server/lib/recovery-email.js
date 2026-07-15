/**
 * @fileoverview Entrega transacional de codigos de recuperacao via SMTP do Gmail.
 * @module server/lib/recovery-email
 */

import nodemailer from 'nodemailer';

/** Informa se todas as configuracoes de entrega estao presentes. */
export function isRecoveryEmailConfigured(env) {
  return Boolean(
    env.SMTP_USER && env.SMTP_APP_PASSWORD && env.RECOVERY_FROM_EMAIL && env.APP_BASE_URL
  );
}

/** Envia o codigo sem inclui-lo em URL, log ou retorno publico. */
export async function sendRecoveryEmail({ to, code, challengeId, env, sendMailImpl }) {
  if (!isRecoveryEmailConfigured(env)) return { delivered: false, reason: 'not_configured' };
  const baseUrl = String(env.APP_BASE_URL).replace(/\/$/, '');
  const recoveryUrl = `${baseUrl}/?recover=${encodeURIComponent(challengeId)}`;
  try {
    const transport = sendMailImpl ? null : createGmailTransport(env);
    const send = sendMailImpl || transport.sendMail.bind(transport);
    const result = await send({
      from: env.RECOVERY_FROM_EMAIL,
      to,
      subject: 'Código para redefinir seu PIN',
      text: buildText(code, recoveryUrl),
      html: buildHtml(code, recoveryUrl),
    });
    return Array.isArray(result?.rejected) && result.rejected.length > 0
      ? { delivered: false, reason: 'recipient_rejected' }
      : { delivered: true };
  } catch {
    return { delivered: false, reason: 'network_error' };
  }
}

/** Cria transporte SMTP dedicado para o Gmail remetente. */
function createGmailTransport(env) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_APP_PASSWORD },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

function buildText(code, url) {
  return [
    'Recebemos uma solicitacao para redefinir seu PIN.',
    `Codigo: ${code}`,
    'Ele expira em 10 minutos e funciona uma unica vez.',
    `Abra ${url} para concluir.`,
    'Se nao foi voce, ignore esta mensagem.',
  ].join('\n\n');
}

function buildHtml(code, url) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17211b">
    <h2>Redefinicao de PIN</h2>
    <p>Use o codigo abaixo. Ele expira em 10 minutos e funciona uma unica vez.</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
    <p><a href="${escapeHtml(url)}">Abrir Compras Coletivas</a></p>
    <p style="color:#66736c">Se nao foi voce, ignore esta mensagem.</p>
  </body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
