require('dotenv').config({path:'../../.env'});

export const CONSTANTS = {
  DB_HOST: process.env['DB_HOST'] || '127.0.0.1',
  DB_PORT: parseInt(''+process.env['DB_PORT']) || 5432,
  DB_NAME: process.env['DB_NAME'] || 'next_project',
  DB_USER: process.env['DB_USER'] || 'sergey',
  DB_PASSWORD: process.env['DB_PASSWORD'] || 'sergey',
};
