import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { subjects, departments } from "../db/schema";
import { db } from "../db";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 10),
      100
    ); // Max 100 records per page

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    // if subjects query exists filter by subject name of code
    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`)
        )
      );
    }

    // If department filter exists, match department name
    if (department) {
      const deptPattern = `%${String(department).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(departments.name, deptPattern));
    }

    // combine all filters if any
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(departments.id, subjects.departmentId))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const subjectList = await db
      .select({
        ...getTableColumns(subjects),
        department: { ...getTableColumns(departments) },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    return res.status(200).json({
      subjectList,
      total: totalCount,
      page: currentPage,
      limit: limitPerPage,
      totalPages: Math.ceil(totalCount / limitPerPage),
    });
  } catch (error) {
    console.log(`GET /subjects error: ${error}`);
    res.status(500).json({ error: "Failed to get fetch subjects" });
  }
});

export default router;
