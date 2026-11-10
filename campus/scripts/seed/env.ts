// Carga .env.local para los scripts (Node 22: process.loadEnvFile).
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(__dirname, '../../.env.local')
if (existsSync(file) && !process.env.SUPABASE_SERVICE_ROLE_KEY) process.loadEnvFile(file)
