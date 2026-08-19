import express from "express";
import {
  executeOwnTicketCashout,
  quoteOwnTicketCashout,
} from "../controllers/cashoutController.js";
import { verifyOnlineDeposit } from "../controllers/onlineDepositController.js";
import {
  createShopWithdraw,
  getOwnTicket as getOwnPlayerTicket,
  getWallet,
  getWalletHistory,
  cancelOwnPlayerTicket,
  listOwnTickets,
} from "../controllers/playerController.js";
import {
  createPlayerRequest,
  getPlayerConfig,
  listPlayerCashiers,
  listPlayerRequests,
} from "../controllers/onlineWithdrawController.js";
import { generateSsoToken } from "../controllers/playerSsoController.js";
import { authorizePermission } from "../middleware/auth.js";

const router = express.Router();

// MRX Instant Games SSO — PLAYER role enforced in controller.
router.post("/generate-sso-token", generateSsoToken);

router.get("/wallet", authorizePermission("wallet:history"), getWallet);
router.get("/wallet/history", authorizePermission("wallet:history"), getWalletHistory);
router.post("/wallet/online-deposit", authorizePermission("wallet:deposit"), verifyOnlineDeposit);
router.post("/wallet/shop-withdraw", authorizePermission("wallet:withdraw"), createShopWithdraw);

router.get("/online-withdraw/config", authorizePermission("wallet:withdraw"), getPlayerConfig);
router.get("/online-withdraw/cashiers", authorizePermission("wallet:withdraw"), listPlayerCashiers);
router.get("/online-withdraw", authorizePermission("wallet:withdraw"), listPlayerRequests);
router.post("/online-withdraw", authorizePermission("wallet:withdraw"), createPlayerRequest);

router.get("/tickets", authorizePermission("tickets:read_own"), listOwnTickets);
router.get("/tickets/:id", authorizePermission("tickets:read_own"), getOwnPlayerTicket);
router.get(
  "/tickets/:id/cashout-quote",
  authorizePermission("tickets:cashout_own"),
  quoteOwnTicketCashout,
);
router.post(
  "/tickets/:id/cashout",
  authorizePermission("tickets:cashout_own"),
  executeOwnTicketCashout,
);

router.patch(
  "/tickets/:id/cancel",
  authorizePermission("tickets:cancel_own"),
  cancelOwnPlayerTicket,
);

export default router;
