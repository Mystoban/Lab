import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faUpload,
  faEdit,
  faTrash,
  faSortUp,
  faSortDown,
  faMoon,
  faSun
} from '@fortawesome/free-solid-svg-icons';
import './App.css'; // Custom styles for enhanced UI

Chart.register(...registerables);
Chart.defaults.font.family = 'Roboto, sans-serif';
Chart.defaults.font.size = 14;

const API_URL = 'http://localhost:5000/students';

function App() {
  const [formData, setFormData] = useState({
    studentId: '',
    lastName: '',
    firstName: '',
    middleName: '',
    dob: '',
    gender: '',
    email: '',
    phone: '',
    program: '',
    major: ''
  });
  const [students, setStudents] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isDarkMode, setIsDarkMode] = useState(false);

  // On initial load, set dark mode based on saved preference or system preference.
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      setIsDarkMode(savedMode === 'true');
    } else {
      const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(systemPrefersDark);
    }
  }, []);

  // Apply dark mode class to the body and save the preference.
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  // Compute stats based on student data.
  const computedStats = useMemo(() => {
    const stats = {};
    students.forEach((student) => {
      const prog = student.program && student.program.trim() !== '' ? student.program : 'Unknown';
      stats[prog] = (stats[prog] || 0) + 1;
    });
    return stats;
  }, [students]);

  // Define color palettes for the chart.
  const barColors = [
    'rgba(255, 99, 132, 0.7)',
    'rgba(54, 162, 235, 0.7)',
    'rgba(255, 206, 86, 0.7)',
    'rgba(75, 192, 192, 0.7)',
    'rgba(153, 102, 255, 0.7)',
    'rgba(255, 159, 64, 0.7)'
  ];
  const borderColors = [
    'rgba(255, 99, 132, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)'
  ];
  const labels = Object.keys(computedStats);
  const backgroundColors = labels.map((_, index) => barColors[index % barColors.length]);
  const borderColorsArr = labels.map((_, index) => borderColors[index % borderColors.length]);

  const chartData = {
    labels,
    datasets: [
      {
        label: '',
        data: Object.values(computedStats),
        backgroundColor: backgroundColors,
        borderColor: borderColorsArr,
        borderWidth: 1,
        borderRadius: 8
      }
    ]
  };

  const chartOptions = {
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)',
        titleColor: isDarkMode ? '#000' : '#fff',
        bodyColor: isDarkMode ? '#000' : '#fff',
        cornerRadius: 8,
        padding: 10
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        ticks: { color: isDarkMode ? '#fff' : '#333' }
      },
      x: {
        grid: { display: true, color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        ticks: { color: isDarkMode ? '#fff' : '#333' }
      }
    }
  };

  // Helper to parse fullName into parts.
  const parseFullName = (fullName) => {
    if (!fullName) return { lastName: '', firstName: '', middleName: '' };
    if (fullName.includes(',')) {
      const parts = fullName.split(',');
      const lastName = parts[0].trim();
      const names = parts[1].trim().split(/\s+/);
      return { lastName, firstName: names[0] || '', middleName: names.slice(1).join(' ') || '' };
    } else {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length === 1) return { lastName: '', firstName: parts[0], middleName: '' };
      return {
        firstName: parts[0],
        lastName: parts[parts.length - 1],
        middleName: parts.slice(1, parts.length - 1).join(' ')
      };
    }
  };

  // Sorting logic.
  const sortedStudents = useMemo(() => {
    let sortableStudents = [...students];
    if (sortConfig.key !== null) {
      sortableStudents.sort((a, b) => {
        let aValue = '';
        let bValue = '';
        if (['lastName', 'firstName', 'middleName'].includes(sortConfig.key)) {
          const aNames = parseFullName(a.fullName);
          const bNames = parseFullName(b.fullName);
          aValue = aNames[sortConfig.key]?.toLowerCase() || '';
          bValue = bNames[sortConfig.key]?.toLowerCase() || '';
        } else {
          aValue = a[sortConfig.key] ? a[sortConfig.key].toString().toLowerCase() : '';
          bValue = b[sortConfig.key] ? b[sortConfig.key].toString().toLowerCase() : '';
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableStudents;
  }, [students, sortConfig]);

  // Client-side filtering.
  const filteredStudents = useMemo(() => {
    if (searchQuery.trim() === '') return sortedStudents;
    const lowerQuery = searchQuery.toLowerCase();
    return sortedStudents.filter((student) =>
      student.studentId.toString().toLowerCase().includes(lowerQuery) ||
      student.fullName.toLowerCase().includes(lowerQuery) ||
      (student.gender && student.gender.toLowerCase().includes(lowerQuery)) ||
      (student.program && student.program.toLowerCase().includes(lowerQuery)) ||
      (student.major && student.major.toLowerCase().includes(lowerQuery))
    );
  }, [searchQuery, sortedStudents]);

  // Fetch students.
  const fetchStudents = async () => {
    try {
      const response = await axios.get(API_URL);
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Handle form input changes.
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Combine name parts into fullName.
  const combineFullName = () => {
    const last = formData.lastName.trim();
    const first = formData.firstName.trim();
    const middle = formData.middleName.trim();
    return middle ? `${last}, ${first} ${middle}` : `${last}, ${first}`;
  };

  // Add Student (POST)
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const fullName = combineFullName();
    const payload = {
      studentId: formData.studentId,
      fullName,
      dob: formData.dob,
      gender: formData.gender,
      email: formData.email,
      phone: formData.phone,
      program: formData.program,
      major: formData.major
    };

    try {
      await axios.post(API_URL, payload);
      toast.success('Student added successfully!');
      fetchStudents();
      setFormData({
        studentId: '',
        lastName: '',
        firstName: '',
        middleName: '',
        dob: '',
        gender: '',
        email: '',
        phone: '',
        program: '',
        major: ''
      });
    } catch (error) {
      if (error.response) {
        if (
          error.response.status === 409 ||
          (error.response.data.message &&
            (error.response.data.message.toLowerCase().includes('email') ||
             error.response.data.message.toLowerCase().includes('id')))
        ) {
          toast.error(
            error.response.data.message ||
            'Student ID or email is already in use!'
          );
        } else {
          toast.error(error.response.data.message || 'Error adding student!');
        }
      } else {
        toast.error('Error adding student!');
      }
    }
  };

  // Update Student (PUT)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const fullName = combineFullName();
    const payload = {
      fullName,
      dob: formData.dob,
      gender: formData.gender,
      email: formData.email,
      phone: formData.phone,
      program: formData.program,
      major: formData.major
    };
    try {
      await axios.put(`${API_URL}/${formData.studentId}`, payload, {
        headers: { 'x-role': 'admin' }
      });
      toast.success('Student updated successfully!');
      fetchStudents();
      setFormData({
        studentId: '',
        lastName: '',
        firstName: '',
        middleName: '',
        dob: '',
        gender: '',
        email: '',
        phone: '',
        program: '',
        major: ''
      });
      setIsEditing(false);
    } catch (error) {
      toast.error('Error updating student!');
    }
  };

  // Delete Student (DELETE)
  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`, { headers: { 'x-role': 'admin' } });
      toast.success('Student deleted!');
      fetchStudents();
    } catch (error) {
      toast.error('Error deleting student!');
    }
  };

  // Populate form for editing.
  const handleEdit = (student) => {
    const { lastName, firstName, middleName } = parseFullName(student.fullName);
    setFormData({
      studentId: student.studentId,
      lastName,
      firstName,
      middleName,
      dob: student.dob,
      gender: student.gender,
      email: student.email,
      phone: student.phone,
      program: student.program,
      major: student.major
    });
    setIsEditing(true);
  };

  // Toggle Admin Mode.
  const toggleAdmin = () => {
    setIsAdmin(!isAdmin);
  };

  // Toggle Dark Mode.
  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  return (
    <div className={`container mt-5 ${isDarkMode ? 'dark-mode' : ''}`}>
      {/* Header */}
      <header className="app-header rounded mb-5 p-4 d-flex justify-content-between align-items-center shadow">
        <div>
          <h1 className="mb-0 header-title">Student Management System</h1>
          <p className="header-subtitle">Manage your student data seamlessly</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline-light me-2" onClick={toggleDarkMode}>
            <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} size="lg" />
          </button>
          <button className="btn btn-outline-light" onClick={toggleAdmin}>
            {isAdmin ? 'Logout Admin' : 'Login as Admin'}
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="search-bar mb-4">
        <div className="input-group search-group">
          <input
            type="text"
            className="form-control search-input"
            placeholder="Search by Student ID, Name, Gender, Program or Major..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn btn-primary search-btn">
            <FontAwesomeIcon icon={faSearch} /> Search
          </button>
        </div>
      </div>

      {/* Form Section */}
      <div className="card form-card mb-5 shadow-sm">
        <div className="card-body">
          <h4 className="card-title mb-4">{isEditing ? 'Update Student' : 'Add New Student'}</h4>
          <form onSubmit={isEditing ? handleEditSubmit : handleAddSubmit}>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Student ID</label>
                <input
                  type="text"
                  className="form-control"
                  name="studentId"
                  placeholder="Enter Student ID"
                  value={formData.studentId}
                  onChange={handleChange}
                  required
                  disabled={isEditing}
                />
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="lastName"
                  placeholder="Enter Last Name"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="firstName"
                  placeholder="Enter First Name"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Middle Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="middleName"
                  placeholder="(Optional)"
                  value={formData.middleName}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-control"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Gender</label>
                <select
                  className="form-select"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  name="email"
                  placeholder="Enter Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-control"
                  name="phone"
                  placeholder="Enter Phone Number"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Program</label>
                <input
                  type="text"
                  className="form-control"
                  name="program"
                  placeholder="Enter Program"
                  value={formData.program}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Major</label>
                <input
                  type="text"
                  className="form-control"
                  name="major"
                  placeholder="Enter Major"
                  value={formData.major}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-3">
              {isEditing ? 'Update Student' : 'Add Student'}
            </button>
          </form>
        </div>
      </div>

      {/* Admin-Only Features */}
      {isAdmin && (
        <>
          <div className="card mb-5 shadow-sm">
            <div className="card-body">
              <h4 className="card-title mb-3">Upload CSV Data</h4>
              <div className="mb-3">
                <input
                  type="file"
                  className="form-control"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                />
              </div>
              <button
                className="btn btn-success"
                onClick={async () => {
                  if (!csvFile) {
                    toast.error('Please select a CSV file.');
                    return;
                  }
                  const formDataUpload = new FormData();
                  formDataUpload.append('file', csvFile);
                  try {
                    await axios.post(`${API_URL}/upload`, formDataUpload, {
                      headers: { 'Content-Type': 'multipart/form-data', 'x-role': 'admin' }
                    });
                    toast.success('CSV uploaded successfully!');
                    fetchStudents();
                  } catch (error) {
                    toast.error('Error uploading CSV file.');
                  }
                }}
              >
                <FontAwesomeIcon icon={faUpload} /> Upload CSV
              </button>
            </div>
          </div>

          <div className="card mb-5 shadow-sm">
            <div className="card-body">
              <h4 className="card-title mb-3">Student Distribution by Program</h4>
              <div className="chart-container">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Student List */}
      <h2 className="mb-4">Student List</h2>
      <div className="table-responsive shadow-sm">
        <table className="table table-hover table-striped">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('studentId')} className="sortable">
                Student ID {sortConfig.key === 'studentId' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('lastName')} className="sortable">
                Last Name {sortConfig.key === 'lastName' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('firstName')} className="sortable">
                First Name {sortConfig.key === 'firstName' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('middleName')} className="sortable">
                Middle Name {sortConfig.key === 'middleName' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('dob')} className="sortable">
                DOB {sortConfig.key === 'dob' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('gender')} className="sortable">
                Gender {sortConfig.key === 'gender' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('email')} className="sortable">
                Email {sortConfig.key === 'email' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('phone')} className="sortable">
                Phone {sortConfig.key === 'phone' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('program')} className="sortable">
                Program {sortConfig.key === 'program' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              <th onClick={() => requestSort('major')} className="sortable">
                Major {sortConfig.key === 'major' && (<FontAwesomeIcon icon={sortConfig.direction === 'asc' ? faSortUp : faSortDown} />)}
              </th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s) => {
              const { lastName, firstName, middleName } = parseFullName(s.fullName);
              return (
                <tr key={s.studentId}>
                  <td>{s.studentId}</td>
                  <td>{lastName}</td>
                  <td>{firstName}</td>
                  <td>{middleName}</td>
                  <td>{s.dob}</td>
                  <td>{s.gender}</td>
                  <td>{s.email}</td>
                  <td>{s.phone}</td>
                  <td>{s.program}</td>
                  <td>{s.major}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-warning btn-sm me-2" onClick={() => handleEdit(s)}>
                        <FontAwesomeIcon icon={faEdit} /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.studentId)}>
                        <FontAwesomeIcon icon={faTrash} /> Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
