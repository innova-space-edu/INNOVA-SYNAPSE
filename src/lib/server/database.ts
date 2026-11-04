import postgres from 'postgres';

let client: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.SYNAPSE_DATABASE_URL) throw new Error('SYNAPSE_DATABASE_URL no está configurada');
  if (!client) client = postgres(process.env.SYNAPSE_DATABASE_URL, {
    max: 4, idle_timeout: 20, connect_timeout: 5, prepare: true
  });
  return client;
}
