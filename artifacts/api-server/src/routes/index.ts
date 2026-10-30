import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shoppingListsRouter from "./shopping-lists";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shoppingListsRouter);

export default router;
