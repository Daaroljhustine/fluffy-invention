import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';

// Load environment variables
dotenv.config();

const app = express();

// Configure CORS to allow requests from your React app
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

// Middleware to parse JSON request bodies
app.use(express.json());
app.use(express.static('public')); // Ensure 'public' folder exists and serves static files

// MySQL Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test',
  port: process.env.DB_PORT || 3306,
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the MySQL database');
});

// Routes for Categories
app.get('/category', (req, res) => {
  const sql = 'SELECT * FROM category';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ Status: false, Error: 'Query Error' });
    }
    res.status(200).json(result);
  });
});

app.post('/add-category', (req, res) => {
  const { category } = req.body;
  if (!category) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  const sql = 'INSERT INTO category (name) VALUES (?)';
  db.query(sql, [category], (err) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ Status: false, Error: 'Query Error' });
    }
    res.status(200).json({ Status: true, message: 'Category added successfully.' });
  });
});

// Image Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Employee Routes
app.post('/add_employee', upload.single('image'), (req, res) => {
  const { name, email, password, address, salary, category_id } = req.body;
  const image = req.file ? req.file.filename : '';

  if (!name || !email || !password || !category_id) {
    return res.status(400).json({ message: 'Missing required fields: name, email, password, category_id.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const sql = `
    INSERT INTO employee (name, email, password, address, salary, image, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [name, email, hashedPassword, address || '', salary || 0, image, category_id], (err) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ message: 'An error occurred while adding the employee' });
    }
    res.status(200).json({ message: 'Employee added successfully.' });
  });
});

app.put('/employee/:id', upload.single('image'), (req, res) => {
  const id = req.params.id;
  const { name, email, password, address, salary, category_id } = req.body;
  const image = req.file ? req.file.filename : null;

  const updates = [];
  const values = [];

  if (name) updates.push('name = ?'), values.push(name);
  if (email) updates.push('email = ?'), values.push(email);
  if (password) updates.push('password = ?'), values.push(bcrypt.hashSync(password, 10));
  if (address) updates.push('address = ?'), values.push(address);
  if (salary) updates.push('salary = ?'), values.push(salary);
  if (category_id) updates.push('category_id = ?'), values.push(category_id);
  if (image) updates.push('image = ?'), values.push(image);

  if (updates.length === 0) {
    return res.status(400).json({ Status: false, message: 'No fields to update.' });
  }

  const sql = `UPDATE employee SET ${updates.join(', ')} WHERE id = ?`;
  values.push(id);

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ Status: false, Error: 'Query Error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ Status: false, message: 'Employee not found.' });
    }
    res.status(200).json({ Status: true, message: 'Employee updated successfully.' });
  });
});

// Additional Routes
app.get('/auth/employee', (req, res) => {
  const sql = 'SELECT * FROM employee';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ Status: false, Error: 'Query Error' });
    }
    res.status(200).json(result);
  });
});

app.delete('/employee/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM employee WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ Status: false, Error: 'Query Error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ Status: false, message: 'Employee not found.' });
    }
    res.status(200).json({ Status: true, message: 'Employee deleted successfully.' });
  });
});

// Summary Routes
app.get('/auth/employee-count', (req, res) => {
  const sql = 'SELECT COUNT(*) AS total_employees FROM employee';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ Status: false, Error: 'Query Error' });
    }
    res.status(200).json({ total_employees: result[0].total_employees });
  });
});

app.get('/auth/total-salary', (req, res) => {
  const sql = 'SELECT SUM(salary) AS total_salary FROM employee';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error executing query:', err.message);
      return res.status(500).json({ Status: false, Error: 'Query Error' });
    }
    res.status(200).json({ total_salary: result[0].total_salary });
  });
});

// Logout Route
app.get('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ Status: true, message: 'Logged out successfully' });
});

// Start the Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
