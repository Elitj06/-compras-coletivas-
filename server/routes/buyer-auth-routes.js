/**
 * @fileoverview Adaptadores HTTP das jornadas de autenticacao do comprador.
 * @module server/routes/buyer-auth-routes
 */

import {
  BuyerAuthError,
  changeBuyerPin,
  loginBuyer,
  logoutBuyer,
  registerBuyer,
} from '../services/buyer-auth-service.js';
import {
  completePinRecovery,
  createAdminRecovery,
  resetBuyerPinDirect,
} from '../services/buyer-recovery-service.js';

/** Despacha rotas POST de comprador e recuperacao administrativa. */
export async function handleBuyerAuthPost(context) {
  const { path } = context;
  try {
    if (path === 'comprador/registro') return await registerRoute(context);
    if (path === 'comprador/login') return await loginRoute(context);
    if (path === 'comprador/pin-recovery/simple') return await simpleRecoveryRoute(context);
    if (path === 'comprador/pin-recovery/complete') return await completeRecoveryRoute(context);
    if (path === 'comprador/logout') return await logoutRoute(context);
    const adminResetMatch = path.match(/^admin\/compradores\/(\d+)\/pin-reset$/);
    if (adminResetMatch) return await adminResetRoute(context, Number(adminResetMatch[1]));
    const adminMatch = path.match(/^admin\/compradores\/(\d+)\/pin-recovery$/);
    if (adminMatch) return await adminRecoveryRoute(context, Number(adminMatch[1]));
    return null;
  } catch (error) {
    return expectedError(error);
  }
}

/** Despacha troca autenticada de PIN. */
export async function handleBuyerAuthPut(context) {
  if (context.path !== 'comprador/pin') return null;
  try {
    const result = await changeBuyerPin({
      client: context.client,
      req: context.req,
      input: context.body,
      buyerSession: context.buyerSession,
      createBuyerSession: context.createBuyerSession,
      env: context.env,
    });
    return ok({ success: true, token: result.token, expires_in: 86400 });
  } catch (error) {
    return expectedError(error);
  }
}

async function registerRoute(context) {
  const result = await registerBuyer({
    client: context.client,
    req: context.req,
    input: context.body,
    createBuyerSession: context.createBuyerSession,
    env: context.env,
  });
  return ok({
    success: true,
    message: 'Cadastro criado com PIN',
    token: result.token,
    comprador: result.buyer,
    data: { ...result.buyer, token: result.token },
  }, 201);
}

async function loginRoute(context) {
  const result = await loginBuyer({
    client: context.client,
    req: context.req,
    input: context.body,
    createBuyerSession: context.createBuyerSession,
    env: context.env,
  });
  return ok({
    success: true,
    token: result.token,
    comprador: result.buyer,
    data: { ...result.buyer, token: result.token },
  });
}

async function completeRecoveryRoute(context) {
  const result = await completePinRecovery({
    client: context.client, req: context.req, input: context.body, env: context.env,
  });
  return ok(result);
}

async function simpleRecoveryRoute(context) {
  const result = await resetBuyerPinDirect({
    client: context.client,
    req: context.req,
    input: context.body,
    env: context.env,
  });
  return ok(result);
}

async function logoutRoute(context) {
  await logoutBuyer({ client: context.client, buyerSession: context.buyerSession });
  return { status: 204, body: null };
}

async function adminRecoveryRoute(context, buyerId) {
  const result = await createAdminRecovery({
    client: context.client,
    req: context.req,
    buyerId,
    input: context.body,
    adminSession: context.adminSession,
    env: context.env,
  });
  return ok({ success: true, ...result }, 201);
}

async function adminResetRoute(context, buyerId) {
  const result = await resetBuyerPinDirect({
    client: context.client,
    req: context.req,
    buyerId,
    input: context.body,
    adminSession: context.adminSession,
    env: context.env,
  });
  return ok({ success: true, ...result });
}

function expectedError(error) {
  if (!(error instanceof BuyerAuthError)) throw error;
  return {
    status: error.status,
    body: { success: false, error: error.message, code: error.code },
  };
}

function ok(body, status = 200) {
  return { status, body };
}
