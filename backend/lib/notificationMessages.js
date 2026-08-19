function formatEtb(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export function betPlacedNotification({ stake, receiptNumber, potentialWin }) {
  return {
    kind: "BET_PLACED",
    title: "Bet placed",
    body: `Your bet of ${formatEtb(stake)} ETB was placed successfully.${
      receiptNumber ? ` Receipt: ${receiptNumber}.` : ""
    } Potential win: ${formatEtb(potentialWin)} ETB.`,
    metadata: {
      stake: Number(stake),
      receiptNumber: receiptNumber ?? null,
      potentialWin: Number(potentialWin),
    },
  };
}

export function depositNotification({ amount, source }) {
  const src =
    source === "cashier" ? "at the shop" : source === "online" ? "online" : "";
  return {
    kind: "DEPOSIT",
    title: "Deposit successful",
    body: `${formatEtb(amount)} ETB has been credited to your wallet${src ? ` (${src})` : ""}.`,
    metadata: { amount: Number(amount), source: source ?? null },
  };
}

export function withdrawPendingNotification({ amount }) {
  return {
    kind: "WITHDRAW_PENDING",
    title: "Withdrawal pending",
    body: `Your withdrawal request for ${formatEtb(amount)} ETB is pending. Present your code at the cashier to complete it.`,
    metadata: { amount: Number(amount) },
  };
}

export function withdrawCompletedNotification({ amount }) {
  return {
    kind: "WITHDRAW_COMPLETED",
    title: "Withdrawal completed",
    body: `Your withdrawal of ${formatEtb(amount)} ETB has been completed.`,
    metadata: { amount: Number(amount) },
  };
}

export function onlineWithdrawPendingNotification({ amount, netAmount }) {
  return {
    kind: "WITHDRAW_PENDING",
    title: "Online withdrawal requested",
    body: `Your withdrawal of ${formatEtb(amount)} ETB has been deducted. You will receive ${formatEtb(netAmount)} ETB in 24–48 hours.`,
    metadata: {
      amount: Number(amount),
      netAmount: Number(netAmount),
      channel: "online",
    },
  };
}

export function onlineWithdrawRequestNotification({
  amount,
  netAmount,
  playerName,
}) {
  const who = playerName ? ` from ${playerName}` : "";
  return {
    kind: "WITHDRAW_REQUEST",
    title: "New online withdrawal",
    body: `A player requested ${formatEtb(amount)} ETB${who}. Send ${formatEtb(netAmount)} ETB (90% after fee) to their account.`,
    metadata: {
      amount: Number(amount),
      netAmount: Number(netAmount),
    },
  };
}

export function onlineWithdrawCompletedNotification({ amount, netAmount }) {
  return {
    kind: "WITHDRAW_COMPLETED",
    title: "Online withdrawal completed",
    body: `Your online withdrawal of ${formatEtb(amount)} ETB is complete. ${formatEtb(netAmount)} ETB has been sent to your account.`,
    metadata: {
      amount: Number(amount),
      netAmount: Number(netAmount),
      channel: "online",
    },
  };
}

export function onlineWithdrawRejectedNotification({ amount, reason }) {
  const extra = reason ? ` Reason: ${reason}` : "";
  return {
    kind: "WITHDRAW_REJECTED",
    title: "Online withdrawal refunded",
    body: `${formatEtb(amount)} ETB has been returned to your withdrawable balance.${extra}`,
    metadata: {
      amount: Number(amount),
      reason: reason ?? null,
      channel: "online",
    },
  };
}

export function adminMessageNotification({ title, body, batchId }) {
  return {
    kind: "ADMIN_MESSAGE",
    title,
    body,
    metadata: batchId ? { batchId } : undefined,
  };
}

export function deviceApprovalPendingNotification({
  cashierName,
  cashierPhone,
  pendingId,
  ipAddress,
  userAgent,
}) {
  return {
    kind: "DEVICE_APPROVAL_PENDING",
    title: "Cashier device approval required",
    body: `${cashierName} (${cashierPhone || "no phone"}) is requesting access from a new device.`,
    metadata: {
      pendingId,
      cashierName,
      cashierPhone: cashierPhone ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  };
}

export function deviceApprovedNotification({ cashierName }) {
  return {
    kind: "DEVICE_APPROVED",
    title: "Device approved",
    body: `Your new device has been approved. You can sign in again from ${cashierName ? "your cashier account" : "this device"}.`,
    metadata: {},
  };
}

export function deviceRejectedNotification({ cashierName }) {
  return {
    kind: "DEVICE_REJECTED",
    title: "Device request rejected",
    body: `Your login from a new device was rejected. Contact an administrator if you need access${cashierName ? ` (${cashierName})` : ""}.`,
    metadata: {},
  };
}
