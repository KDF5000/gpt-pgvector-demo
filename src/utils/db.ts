import ws from 'ws'

import { Pool, neonConfig } from '@neondatabase/serverless'
neonConfig.webSocketConstructor = ws

const URL = import.meta.env.NEON_DATABASE_URL
if (URL === '')
  throw new Error('Missing neon credentials')

// export const config = { runtime: 'edge' }
const pool = new Pool({ connectionString: URL })
export default pool
