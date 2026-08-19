import express from "express";
import { listBanks } from "../controllers/onlineWithdrawController.js";

const router = express.Router();

router.get("/banks", listBanks);

export default router;
