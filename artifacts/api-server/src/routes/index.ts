import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scheduleRouter from "./schedule";
import financeRouter from "./finance";
import restaurantRouter from "./restaurant";
import coursesRouter from "./courses";
import mealsRouter from "./meals";
import todosRouter from "./todos";
import gradesRouter from "./grades";
import noticesRouter from "./notices";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scheduleRouter);
router.use(financeRouter);
router.use(restaurantRouter);
router.use(coursesRouter);
router.use(mealsRouter);
router.use(todosRouter);
router.use(gradesRouter);
router.use(noticesRouter);

export default router;
