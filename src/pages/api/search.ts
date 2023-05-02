import pool from '@/utils/db'
import type { APIRoute } from 'astro'

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const { embedding, similarity, limit } = body
  if (!embedding) {
    return new Response(JSON.stringify({
      error: {
        message: 'No input text.',
      },
    }), { status: 400 })
  }

  const stm = `SELECT * FROM match_documents('${JSON.stringify(embedding)}', ${similarity}, ${limit})`
  // const documents = await sql`SELECT * FROM match_documents(${JSON.stringify(embedding)}, ${similarity}, ${limit})`;
  const { rows: documents } = await pool.query(stm)
  //   const documents = await sql`SELECT * FROM match_documents(${JSON.stringify(embedding)}, ${similarity}, ${limit})`
  return {
    body: JSON.stringify({
      documents,
    }),
  }
}
