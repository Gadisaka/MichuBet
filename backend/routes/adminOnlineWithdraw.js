import express from "express";
import {
  forceRejectRequest,
  getAdminSummary,
  listAdminCashiers,
  listAdminRequests,
  patchCashierEligibility,
} from "../controllers/onlineWithdrawController.js";
import { authorizePermission } from "../middleware/auth.js";

const router = express.Router();
const read = authorizePermission("online-withdraw:read");
const manage = authorizePermission("online-withdraw:manage");

router.get("/summary", read, getAdminSummary);
router.get("/requests", read, listAdminRequests);
router.get("/cashiers", read, listAdminCashiers);
router.patch("/cashiers/:id/eligibility", manage, patchCashierEligibility);
router.post("/requests/:id/force-reject", manage, forceRejectRequest);

export default router;
