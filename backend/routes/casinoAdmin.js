/**
 * Admin casino routes (auth + permission guarded).
 *
 *   GET   /api/admin/casino/games      — full catalog incl. disabled (casino:read)
 *   PATCH /api/admin/casino/games/:id  — toggle enabled / set sort_order (casino:manage)
 *   POST  /api/admin/casino/sync       — re-sync catalog from InOut (casino:manage)
 *
 * @module routes/casinoAdmin
 */
import express from "express";
import { prisma } from "../Config/db.js";
import { authorizePermission } from "../middleware/auth.js";
import syncInoutCatalog from "../jobs/syncInoutCatalog.js";
import { deleteCache } from "../services/cacheService.js";
import { INOUT_GAMES_CACHE_KEY } from "../lib/inoutCatalogCache.js";

const router = express.Router();

router.get("/games", authorizePermission("casino:read"), async (_req, res) => {
  try {
    const games = await prisma.inoutGame.findMany({
      orderBy: [{ sort_order: "asc" }, { title: "asc" }],
    });
    return res.json(games);
  } catch (error) {
    console.error("[casinoAdmin] list games error:", error);
    return res.status(500).json({ message: "Failed to load games" });
  }
});

router.patch(
  "/games/:id",
  authorizePermission("casino:manage"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled, sort_order } = req.body ?? {};

      const data = {};
      if (typeof enabled === "boolean") data.enabled = enabled;
      if (Number.isInteger(sort_order)) data.sort_order = sort_order;

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          message: "Provide at least one of: enabled (boolean), sort_order (int)",
        });
      }

      const existing = await prisma.inoutGame.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ message: "Game not found" });
      }

      const updated = await prisma.inoutGame.update({ where: { id }, data });
      await deleteCache(INOUT_GAMES_CACHE_KEY);
      return res.json(updated);
    } catch (error) {
      console.error("[casinoAdmin] patch game error:", error);
      return res.status(500).json({ message: "Failed to update game" });
    }
  },
);

router.post("/sync", authorizePermission("casino:manage"), async (_req, res) => {
  try {
    const result = await syncInoutCatalog();
    return res.json(result);
  } catch (error) {
    console.error("[casinoAdmin] sync error:", error);
    return res.status(502).json({ message: "Failed to sync catalog from InOut" });
  }
});

export default router;
