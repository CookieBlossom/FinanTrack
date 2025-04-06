const express = require('express');
const cors = require('cors'); 
const dotenv = require('dotenv');
const pool = require('./config/database.js');
const userRoutes = require('./routes/userRoutes.js');
const errorHandler = require('./middlewares/errorHandler.js');
dotenv.config();
const app = express();
const port = process.env.APP_PORT || 3000;

// Middlewares
app.use(cors({ origin: 'http://localhost:4200' })); // Cambia al dominio de producción
app.use(express.json());

// Rutas
app.use('/api', userRoutes); // Rutas de usuario
// Error handling middleware
app.use(errorHandler);
// app.use('/api', financeRoutes);

// Server
app.get('/', async(req, res) => {
  const result = await pool.query('SELECT current_database()');
  res.send(`Base de datos: ${result.rows[0].current_database}`);
});
app.listen(port, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${port}`);
});
