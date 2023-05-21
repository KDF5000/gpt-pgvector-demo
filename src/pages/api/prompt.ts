
import pool from '@/utils/db'
import type { APIRoute } from 'astro'

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const { name } = body
  if (!name) {
    return new Response(JSON.stringify({
      error: {
        message: 'Name not specified.',
      },
    }), { status: 400 })
  }

  const t0 = Date.now()
  const stm = `SELECT * FROM prompt where name = '${name}'`
  const { rows: [prompt] } = await pool.query(stm)
  const t1 = Date.now()
  console.log('get promopt cost ', t1 - t0)

  return {
    body: JSON.stringify({
      prompt,
    }),
  }
}
