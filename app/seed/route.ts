import bcrypt from 'bcrypt';
import { Client } from 'pg';
import { invoices, customers, revenue, users } from '@/app/lib/placeholder-data';
import {CONSTANTS} from "../lib/config";


const client = new Client({
  //connectionString: process.env.DATABASE_URL,
  user: CONSTANTS.DB_USER,
  host: CONSTANTS.DB_HOST,
  database: CONSTANTS.DB_NAME,
  password: CONSTANTS.DB_PASSWORD,
  port: CONSTANTS.DB_PORT,
});
await client.connect();


async function seedUsers() {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      console.log(`VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})`);
      return client.query(`
        INSERT INTO users (id, name, email, password)
        VALUES ('${user.id}', '${user.name}', '${user.email}', '${hashedPassword}')
        ON CONFLICT (id) DO NOTHING;
      `);
    }),
  );

  return insertedUsers;
}

async function seedInvoices() {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `);

  const insertedInvoices = await Promise.all(
    invoices.map(
      (invoice) => client.query(`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES ('${invoice.customer_id}', '${invoice.amount}', '${invoice.status}', '${invoice.date}')
        ON CONFLICT (id) DO NOTHING;
      `),
    ),
  );

  return insertedInvoices;
}

async function seedCustomers() {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `);

  const insertedCustomers = await Promise.all(
    customers.map(
      (customer) => client.query(`
        INSERT INTO customers (id, name, email, image_url)
        VALUES ('${customer.id}', '${customer.name}', '${customer.email}', '${customer.image_url}')
        ON CONFLICT (id) DO NOTHING;
      `),
    ),
  );

  return insertedCustomers;
}

async function seedRevenue() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `);

  const insertedRevenue = await Promise.all(
    revenue.map(
      (rev) => client.query(`
        INSERT INTO revenue (month, revenue)
        VALUES ('${rev.month}', '${rev.revenue}')
        ON CONFLICT (month) DO NOTHING;
      `),
    ),
  );

  return insertedRevenue;
}

export async function GET() {

  try {
    await client.query(`BEGIN`);
    await seedUsers();
    await seedCustomers();
    await seedInvoices();
    await seedRevenue();
    await client.query(`COMMIT`);

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.log(error);
    await client.query(`ROLLBACK`);
    return Response.json({ error }, { status: 500 });
  }
}
