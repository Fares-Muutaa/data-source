import { NextResponse } from "next/server"
import { db } from "@/lib/db/dbpostgres"
import { forecastExecutions } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

export async function GET(request: Request) {
  try {
    // Récupérer toutes les exécutions de forecast, triées par date d'exécution décroissante
    const executions = await db
      .select({
        id: forecastExecutions.id,
        dateExecution: forecastExecutions.dateExecution,
        createdAt: forecastExecutions.createdAt,
      })
      .from(forecastExecutions)
      .orderBy(desc(forecastExecutions.dateExecution))

    return NextResponse.json(executions)
  } catch (error) {
    console.error("Error fetching forecast executions:", error)
    return NextResponse.json({ error: "Failed to fetch forecast executions" }, { status: 500 })
  }
}


