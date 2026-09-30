import { Router } from "express";
import {
  createTicketController,
  claimTicketController,
  updateTicketStatusController,
  updateTicketTriageController,
  listTicketsController,
  getStatsController,
} from "../controllers/tickets.controller";

const router = Router();

router.post("/tickets", createTicketController);
router.post("/tickets/:id/claim", claimTicketController);
router.patch("/tickets/:id/status", updateTicketStatusController);
router.patch("/tickets/:id/triage", updateTicketTriageController);
router.get("/tickets", listTicketsController);
router.get("/stats", getStatsController);



export default router;