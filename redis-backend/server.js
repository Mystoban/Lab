const express = require('express');
const redis = require('redis');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1) Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to Redis
const client = redis.createClient({
  url: 'redis://127.0.0.1:6379'
});
client.connect()
  .then(() => console.log('Connected to Redis'))
  .catch(err => console.error('Redis connection error:', err));

// Dummy middleware for role-based access (admin only)
const checkAdmin = (req, res, next) => {
  if (req.headers['x-role'] === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Admins only.' });
  }
};

// POST: Add a new student
app.post('/students', async (req, res) => {
  console.log('Received request body:', req.body);
  const { studentId, fullName, dob, gender, email, phone, program, major } = req.body;

  if (!studentId || !fullName || !dob || !gender || !email || !phone || !program || !major) {
    return res.status(400).json({ message: 'Missing required field(s)' });
  }

  try {
    // Check if the student already exists
    const exists = await client.exists(`student:${studentId}`);
    if (exists) {
      return res.status(400).json({ message: 'Student id already exists' });
    }
    
    const multi = client.multi();
    multi.hSet(`student:${studentId}`, 'fullName', String(fullName));
    multi.hSet(`student:${studentId}`, 'dob', String(dob));
    multi.hSet(`student:${studentId}`, 'gender', String(gender));
    multi.hSet(`student:${studentId}`, 'email', String(email));
    multi.hSet(`student:${studentId}`, 'phone', String(phone));
    multi.hSet(`student:${studentId}`, 'program', String(program));
    multi.hSet(`student:${studentId}`, 'major', String(major));
    
    await multi.exec();
    
    // Debug: Retrieve and log the stored student data
    const storedStudent = await client.hGetAll(`student:${studentId}`);
    console.log('Stored student data:', storedStudent);

    res.status(201).json({ message: 'Student added successfully' });
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET: Retrieve a specific student by ID
app.get('/students/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const student = await client.hGetAll(`student:${id}`);
    if (Object.keys(student).length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    student.studentId = id;
    res.json(student);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET: Retrieve all students
app.get('/students', async (req, res) => {
  try {
    const keys = await client.keys('student:*');
    const students = await Promise.all(keys.map(async (key) => {
      const student = await client.hGetAll(key);
      student.studentId = key.split(':')[1];
      return student;
    }));
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT: Update an existing student (Admins only)
app.put('/students/:id', checkAdmin, async (req, res) => {
  const id = req.params.id;
  const { fullName, dob, gender, email, phone, program, major } = req.body;
  try {
    const existingStudent = await client.hGetAll(`student:${id}`);
    if (Object.keys(existingStudent).length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const multi = client.multi();
    if (fullName) multi.hSet(`student:${id}`, 'fullName', String(fullName));
    if (dob) multi.hSet(`student:${id}`, 'dob', String(dob));
    if (gender) multi.hSet(`student:${id}`, 'gender', String(gender));
    if (email) multi.hSet(`student:${id}`, 'email', String(email));
    if (phone) multi.hSet(`student:${id}`, 'phone', String(phone));
    if (program) multi.hSet(`student:${id}`, 'program', String(program));
    if (major) multi.hSet(`student:${id}`, 'major', String(major));
    await multi.exec();
    const updatedStudent = await client.hGetAll(`student:${id}`);
    updatedStudent.studentId = id;
    console.log('Updated student data:', updatedStudent);
    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE: Remove a student (Admins only)
app.delete('/students/:id', checkAdmin, async (req, res) => {
  try {
    await client.del(`student:${req.params.id}`);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/students/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  console.log(`🔍 Search triggered for query: "${q}"`);

  try {
    // Ensure Redis connection is active
    if (!client.isOpen) {
      console.log("Redis client not open. Reconnecting...");
      await client.connect();
    }

    // Fetch all student keys from Redis
    const keys = await client.keys('student:*');
    console.log(`📁 Found ${keys.length} student key(s)`);

    if (keys.length === 0) {
      console.log("No student keys found. Returning empty array.");
      return res.json([]);
    }

    // Retrieve all student records
    const students = [];
    for (const key of keys) {
      try {
        const student = await client.hGetAll(key);
        student.studentId = key.split(':')[1]; // Extract ID from key
        students.push(student);
      } catch (err) {
        console.error(`Error retrieving student for key ${key}:`, err);
      }
    }

    console.log("All students retrieved:", students);

    // If no search query is provided, return all students
    if (!q) {
      console.log("Empty query provided. Returning all students.");
      return res.json(students);
    }

    // Filter students: check every field to see if it includes the query string
    const filtered = students.filter(student => {
      return Object.values(student).some(value =>
        String(value).toLowerCase().includes(q)
      );
    });

    console.log(`Found ${filtered.length} match(es):`, filtered);
    return res.json(filtered);

  } catch (error) {
    console.error("Error in search endpoint:", error);
    return res.status(500).json({
      message: 'Error searching students!',
      error: error.toString(),
      stack: error.stack
    });
  }
});

// GET: Get student stats
app.get('/students/stats', async (req, res) => {
  try {
    const keys = await client.keys('student:*');
    console.log("Stats endpoint - Keys found:", keys);
    
    if (!keys || keys.length === 0) {
      console.log("No student keys found in Redis.");
      return res.json({});
    }
    
    const students = [];
    for (const key of keys) {
      const student = await client.hGetAll(key);
      console.log(`Student for key ${key}:`, student);
      students.push(student);
    }
    
    const stats = {};
    students.forEach(student => {
      // Check if 'program' exists and is not empty; fallback to 'Unknown'
      const prog = (student.program && student.program.trim() !== "") ? student.program : 'Unknown';
      stats[prog] = (stats[prog] || 0) + 1;
    });
    
    console.log("Stats endpoint - Computed stats:", stats);
    res.json(stats);
  } catch (error) {
    console.error("Error in /students/stats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// CSV File Upload Endpoint (Admins only)
app.post('/students/upload', checkAdmin, upload.single('file'), (req, res) => {
  // Check if a file was uploaded
  if (!req.file) {
    console.error('No file uploaded.');
    return res.status(400).json({ message: 'No file uploaded. Please attach a CSV file with the field name "file".' });
  }

  const filePath = req.file.path;
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csvParser({ separator: ',' }))
    .on('data', (data) => {
      // Remove BOM and trim keys
      const cleanData = {};
      Object.keys(data).forEach((key) => {
        const cleanKey = key.replace(/^\ufeff/, '').trim();
        cleanData[cleanKey] = data[key];
      });
      console.log('Parsed record:', cleanData); // Debug log
      results.push(cleanData);
    })
    .on('end', async () => {
      try {
        // Process each record from the CSV
        for (const record of results) {
          // Check if required CSV fields are present
          if (!record.studentId || !record.fullName) {
            console.error('CSV record is missing required fields:', record);
            continue; // Optionally, you might skip or handle this record differently
          }
          
          const multi = client.multi();
          multi.hSet(`student:${record.studentId}`, 'fullName',  String(record.fullName));
          multi.hSet(`student:${record.studentId}`, 'dob',       String(record.dob));
          multi.hSet(`student:${record.studentId}`, 'gender',    String(record.gender));
          multi.hSet(`student:${record.studentId}`, 'email',     String(record.email));
          multi.hSet(`student:${record.studentId}`, 'phone',     String(record.phone));
          multi.hSet(`student:${record.studentId}`, 'program',   String(record.program));
          multi.hSet(`student:${record.studentId}`, 'major',     String(record.major));
          await multi.exec();
        }

        // Remove the uploaded file once processing is complete
        fs.unlinkSync(filePath);

        return res.status(201).json({ message: 'CSV data uploaded successfully' });
      } catch (error) {
        console.error('Error adding student:', error.message);
        return res.status(500).json({ message: 'Error uploading CSV data' });
      }
    })
    .on('error', (error) => {
      console.error('Error reading CSV file:', error.message);
      return res.status(500).json({ message: 'Error processing CSV file' });
    });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
