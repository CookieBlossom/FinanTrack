const pkg = require('pg');
const dotenv = require('dotenv');
const { Pool } = pkg;

dotenv.config();
console.log(process.env.DB_USER);
console.log(process.env.DB_HOST);
console.log('Password desde .env:', process.env.DB_PASSWORD);

//se crea una nueva conexion a la bd
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => {
  console.log('Conected to the database');
});
module.exports = pool;