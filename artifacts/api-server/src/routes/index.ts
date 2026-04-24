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
import authRouter from "./auth";
import academicCalendarRouter from "./academic-calendar";
import libraryRouter from "./library";
import notificationsRouter from "./notifications";

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
router.use(authRouter);
router.use(academicCalendarRouter);
router.use(libraryRouter);
router.use(notificationsRouter);

export default router;
