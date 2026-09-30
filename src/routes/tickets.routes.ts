import { Router } from "express";
import {
  createTicketController,
  claimTicketController,
} from "../controllers/tickets.controller";

const router = Router();

router.post("/tickets", createTicketController);
router.post("/tickets/:id/claim", claimTicketController);

export default router;