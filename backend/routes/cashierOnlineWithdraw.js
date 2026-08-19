import express from "express";
import {
  completeCashierRequest,
  getCashierProfile,
  listCashierRequests,
  patchCashierProfile,
  rejectCashierRequest,
} from "../controllers/onlineWithdrawController.js";
import { authorizePermission } from "../middleware/auth.js";

const router = express.Router();
const process = authorizePermission("online-withdraw:process");

router.get("/profile", process, getCashierProfile);
router.patch("/profile", process, patchCashierProfile);
router.get("/", process, listCashierRequests);
router.post("/:id/complete", process, completeCashierRequest);
router.post("/:id/reject", process, rejectCashierRequest);

export default router;
