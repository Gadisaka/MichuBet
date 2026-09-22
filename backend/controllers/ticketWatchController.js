/**
 * Ticket watch endpoints for the admin and cashier dashboards.
 *
 * @module controllers/ticketWatchController
 */
import { prisma } from "../Config/db.js";
import {
  ADMIN_TICKET_WATCH_VIEWS,
  CASHIER_TICKET_WATCH_VIEWS,
  TicketWatchQueryError,
  parseTicketWatchQuery,
} from "../lib/ticketWatchQuery.js";
import { listTicketWatch } from "../services/ticketWatchService.js";

const CASHIER_PROFILE_MISSING_MESSAGE =
  "Cashier profile not found. Ask admin to create this cashier in Agents & Cashiers.";

/**
 * GET /api/admin/insights/ticket-watch
 */
export async function getAdminTicketWatch(req, res) {
  try {
    const filters = parseTicketWatchQuery(req.query, {
      allowedViews: ADMIN_TICKET_WATCH_VIEWS,
    });
    const payload = await listTicketWatch(filters);
    return res.json(payload);
  } catch (error) {
    if (error instanceof TicketWatchQueryError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("getAdminTicketWatch error:", error);
    return res.status(500).json({ message: "Failed to load ticket watch" });
  }
}

/**
 * GET /api/cashier/wallet/ticket-watch
 * Cashier only. Ignores a client-supplied cashier id.
 */
export async function getCashierTicketWatch(req, res) {
  try {
    if (req.user.role !== "CASHIER") {
      return res.status(403).json({ message: "Cashier only" });
    }

    const cashier = await prisma.cashier.findUnique({
      where: { user_id: req.user.sub },
      select: { id: true },
    });
    if (!cashier) {
      return res.status(404).json({ message: CASHIER_PROFILE_MISSING_MESSAGE });
    }

    const filters = parseTicketWatchQuery(req.query, {
      allowedViews: CASHIER_TICKET_WATCH_VIEWS,
      forceCashierId: cashier.id,
    });
    const payload = await listTicketWatch(filters);
    return res.json(payload);
  } catch (error) {
    if (error instanceof TicketWatchQueryError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("getCashierTicketWatch error:", error);
    return res.status(500).json({ message: "Failed to load ticket watch" });
  }
}
