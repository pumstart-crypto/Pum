import { Router, type IRouter } from "express";
import { db, restaurantsTable, reviewsTable, insertRestaurantSchema, insertReviewSchema } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/restaurant", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const affiliated = req.query.affiliated as string | undefined;

    let restaurants = await db.select().from(restaurantsTable).orderBy(restaurantsTable.name);

    if (category && category !== "전체") {
      restaurants = restaurants.filter(r => r.category === category);
    }
    if (affiliated === "true") {
      restaurants = restaurants.filter(r => r.isAffiliated);
    }

    const reviewStats = await db
      .select({
        restaurantId: reviewsTable.restaurantId,
        avgRating: sql<number>`avg(${reviewsTable.rating})::numeric(3,1)`,
        count: sql<number>`count(*)`,
      })
      .from(reviewsTable)
      .groupBy(reviewsTable.restaurantId);

    const statsMap = new Map(reviewStats.map(s => [s.restaurantId, s]));

    const result = restaurants.map(r => ({
      ...r,
      averageRating: parseFloat(String(statsMap.get(r.id)?.avgRating ?? 0)),
      reviewCount: Number(statsMap.get(r.id)?.count ?? 0),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get restaurants");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/restaurant/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    if (!restaurant) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const [stats] = await db
      .select({
        avgRating: sql<number>`avg(${reviewsTable.rating})::numeric(3,1)`,
        count: sql<number>`count(*)`,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.restaurantId, id));

    res.json({
      ...restaurant,
      averageRating: parseFloat(String(stats?.avgRating ?? 0)),
      reviewCount: Number(stats?.count ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get restaurant");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/restaurant", async (req, res) => {
  try {
    const data = insertRestaurantSchema.parse(req.body);
    const [restaurant] = await db.insert(restaurantsTable).values(data).returning();
    res.status(201).json({ ...restaurant, averageRating: 0, reviewCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create restaurant");
    res.status(400).json({ message: "Invalid request" });
  }
});

router.get("/restaurant/:restaurantId/review", async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.restaurantId, restaurantId))
      .orderBy(sql`${reviewsTable.createdAt} desc`);
    res.json(reviews);
  } catch (err) {
    req.log.error({ err }, "Failed to get reviews");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/restaurant/:restaurantId/review", async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const data = insertReviewSchema.parse({ ...req.body, restaurantId });
    const [review] = await db.insert(reviewsTable).values(data).returning();
    res.status(201).json(review);
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    res.status(400).json({ message: "Invalid request" });
  }
});

router.delete("/review/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete review");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
