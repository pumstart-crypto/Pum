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
import deptNoticesRouter from "./dept-notices";
import busRouter from "./bus";
import communityRouter from "./community";

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
router.use(deptNoticesRouter);
router.use(busRouter);
router.use(communityRouter);

export default router;
