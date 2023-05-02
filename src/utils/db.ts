// #vercel-disable-blocks
import ws from 'ws'
// #vercel-end
import { Pool, neonConfig } from '@neondatabase/serverless'

// #vercel-disable-blocks
neonConfig.webSocketConstructor = ws
// #vercel-end

const URL = import.meta.env.NEON_DATABASE_URL
if (URL === '')
  throw new Error('Missing neon credentials')

// export const config = { runtime: 'edge' }
const pool = new Pool({ connectionString: URL })
export default pool
