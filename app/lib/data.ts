

import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
  InvoiceCount,
  CustomersCount,
  InvoiceSumm,
  AgregateDataInvoicesCustomers,
  User
} from './definitions';
import { formatCurrency, messageCreator } from './utils';
const pg = require("pg");
const { CONSTANTS } = require("./config");

const pool = new pg.Pool({
  host: CONSTANTS.DB_HOST,
  port: CONSTANTS.DB_PORT,
  database: CONSTANTS.DB_NAME,
  user: CONSTANTS.DB_USER,
  password: CONSTANTS.DB_PASSWORD,
});

export async function sql<O>(query: string):Promise<{rows:O[]}> {
  return pool.query(query);
}


export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue>(`SELECT * FROM revenue`);

    console.log('Data fetch completed after 3 seconds.');


    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw>(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`);
      
    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql<{count:number}>(`SELECT COUNT(*) FROM invoices`);
    const customerCountPromise = sql<{count:number}>(`SELECT COUNT(*) FROM customers`);
    const invoiceStatusPromise = sql<{paid:number,pending:number}>(`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`);

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable>(`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE '%${query}%' OR
        customers.email ILIKE '%${query}%' OR
        invoices.amount::text ILIKE '%${query}%' OR
        invoices.date::text ILIKE '%${query}%' OR
        invoices.status ILIKE '%${query}%'
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `);
  

    return invoices.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await sql<{count:number}>(`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE '%${query}%' OR
      customers.email ILIKE '%${query}%' OR
      invoices.amount::text ILIKE '%${query}%' OR
      invoices.date::text ILIKE '%${query}%' OR
      invoices.status ILIKE '%${query}%'
  `);

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm>(`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = '${id}';
    `);

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const data = await sql<CustomerField>(`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `);

    const customers = data.rows;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>(`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `);

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function fetchTotalPaidInvoices() {
  try {
    const data = await sql<InvoiceSumm>(`
      SELECT SUM(amount) AS summ_invoices FROM invoices
      WHERE status = 'paid'
    `);
   
    const sum = data.rows[0].summ_invoices;

    return sum;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch invoices count.');
  }
}


export async function fetchCustomersCount() {
  try {
    const data = await sql<CustomersCount>(`
      SELECT COUNT(*) AS count_customers FROM customers
    `);
    
    const count = data.rows[0].count_customers;

    return count;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch invoices count.');
  }
}
export async function fetchTotalPendingInvoices() {
  try {
    const data = await sql<InvoiceSumm>(`
      SELECT SUM(amount) AS summ_invoices FROM invoices
      WHERE status = 'pending'
    `);
    
    const sum = data.rows[0].summ_invoices;

    return sum;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch invoices count.');
  }
}
export async function fetchNumberOfInvoices() {
  try {
    const data = await sql<InvoiceCount>(`
      SELECT COUNT(*) AS count_invoices FROM invoices
    `);
    
    const count = data.rows[0].count_invoices;

    return count;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch invoices count.');
  }
}
export async function fetchNumericData() {
  try {
    const data = await sql<AgregateDataInvoicesCustomers>(`
      SELECT COUNT(*) AS all_invoices, 
      (SELECT SUM(amount) AS pending_invoices FROM invoices WHERE status = 'pending') AS pending_invoices,
      (SELECT COUNT(*) AS all_customers FROM customers) as all_customers, 
      (SELECT SUM(amount) AS paid_invoices FROM invoices WHERE status = 'paid') AS paid_invoices  FROM invoices
    `);
    
    const aggdata = data.rows[0];

    return aggdata;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch invoices count.');
  }
}

export async function createInvoices(data:InvoiceForm & {date:string}) {
  try {
    const result = await sql<any>(`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES ('${data.customer_id}', '${data.amount}', '${data.status}', '${data.date}')
    `);
    return messageCreator('Invoice created');
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to create invoices.');
  }
}

export async function updateInvoices(data:InvoiceForm) {
  try {
    const result = await sql<any>(`
    UPDATE invoices
    SET amount = '${data.amount}', status = '${data.status}'
    WHERE id='${data.id}'
    `);
    return messageCreator('Invoice updated');
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failad to Invoice update');
  }
}

export async function deleteInvoices(id:string){
  try {
    const result = await sql<any>(`
    DELETE FROM invoices
    WHERE id='${id}'
    `);
    return messageCreator('Invoice deleted');
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Error Invoice deleted');
  }
}

export async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User>(`SELECT * FROM users WHERE email='${email}'`);
    return user.rows[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}