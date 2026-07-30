import pg from "pg";

const client = new pg.Client({
  connectionString: "postgresql://postgres:postgres@localhost:5432/predictionmarket",
});

await client.connect();
const result = await client.query('SELECT * FROM "Market" LIMIT 5');
console.log(JSON.stringify(result.rows, null, 2));
await client.end();
