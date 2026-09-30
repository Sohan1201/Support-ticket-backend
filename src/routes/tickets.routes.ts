import { Router } from "express";
import { createTicketController } from "../controllers/tickets.controller";

const router = Router();

router.post("/tickets", createTicketController);

export default router;