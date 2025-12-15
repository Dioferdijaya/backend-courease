// server.js
require('dotenv').config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

// Import logger dan middleware
const logger = require("./logger");
const { requestLogger, logRequest } = require("./middleware/requestLogger");

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://your-vercel-app.vercel.app', // Ganti dengan URL Vercel Anda
  process.env.FRONTEND_URL
].filter(Boolean);

// Socket.io CORS configuration
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// CORS configuration for Express
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Length", "X-Request-Id"]
}));

app.use(express.json());

// Add logging middleware
app.use(logger.addRequestId);
app.use(requestLogger);
app.use(logRequest);

// Koneksi ke Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error("❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
logger.info("🚀 Supabase client initialized");

// Konfigurasi Mayar.id
const MAYAR_API_KEY = process.env.MAYAR_API_KEY;
const MAYAR_BASE_URL = 'https://api.mayar.id/ks/v1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ===== Middleware Admin =====
const adminMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: "Login dulu!" });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || "secretkey", (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token invalid" });
    if (decoded.role !== "admin") return res.status(403).json({ message: "Hanya admin!" });
    req.user = decoded;
    next();
  });
};

// ===== ROUTES =====

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Backend Courease API is running",
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: allowedOrigins,
      currentOrigin: req.headers.origin
    }
  });
});

// Register user
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const { data, error } = await supabase
    .from('users')
    .insert([{ name, email, password: hashedPassword, role: 'user' }])
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "User registered successfully!" });
});

// Register admin
app.post("/register-admin", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const { data, error } = await supabase
    .from('users')
    .insert([{ name, email, password: hashedPassword, role: 'admin' }])
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Admin registered successfully!" });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  const { data: results, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);
  
  if (error) return res.status(500).json({ message: "Server error" });
  if (!results || results.length === 0) return res.status(401).json({ message: "Email atau password salah" });

  const user = results[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Email atau password salah" });

  // Buat JWT
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: "1h" }
  );

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, token });
});

// Ambil semua lapangan
app.get("/fields", async (req, res) => {
  const { data, error } = await supabase
    .from('fields')
    .select('*');
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Tambah booking
app.post("/book", async (req, res) => {
  const { user_id, field_id, date, start_time, end_time } = req.body;
  
  try {
    // Ambil informasi lapangan untuk menghitung total harga
    const { data: fieldData, error: fieldError } = await supabase
      .from('fields')
      .select('price_per_hour')
      .eq('id', field_id)
      .single();
    
    if (fieldError) throw fieldError;
    
    // Hitung durasi dan total harga
    const start = new Date(`2000-01-01 ${start_time}`);
    const end = new Date(`2000-01-01 ${end_time}`);
    const durationHours = (end - start) / (1000 * 60 * 60);
    const totalPrice = durationHours * fieldData.price_per_hour;
    
    // Insert booking dengan payment status unpaid
    // Status 'pending' akan berubah menjadi 'confirmed' setelah pembayaran
    const { data, error } = await supabase
      .from('bookings')
      .insert([{ 
        user_id, 
        field_id, 
        date, 
        start_time, 
        end_time,
        total_price: totalPrice,
        payment_status: 'unpaid',
        status: 'pending'
      }])
      .select();
    
    if (error) throw error;
    
    res.json({ 
      message: "Booking berhasil dibuat!", 
      booking: data[0],
      total_price: totalPrice 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PAYMENT ENDPOINTS - MAYAR.ID =====

// Membuat payment link Mayar.id
app.post("/payment/create", async (req, res) => {
  const { booking_id, user_email, user_name } = req.body;
  
  try {
    // Ambil data booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, date, start_time, end_time, total_price,
        fields (name, type)
      `)
      .eq('id', booking_id)
      .single();
    
    if (bookingError) throw bookingError;
    
    // Buat payment request ke Mayar.id
    const paymentData = {
      name: `Booking ${booking.fields.name}`,
      description: `Booking lapangan ${booking.fields.name} (${booking.fields.type}) pada ${booking.date} jam ${booking.start_time}-${booking.end_time}`,
      amount: Math.round(booking.total_price), // Mayar.id menggunakan integer (dalam Rupiah)
      customer: {
        name: user_name,
        email: user_email
      },
      return_url: `${FRONTEND_URL}/payment/success?booking_id=${booking_id}`,
      callback_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/payment/callback`,
      metadata: {
        booking_id: booking_id.toString()
      }
    };
    
    const response = await axios.post(
      `${MAYAR_BASE_URL}/payment-links`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${MAYAR_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Update booking dengan payment info
    await supabase
      .from('bookings')
      .update({
        payment_id: response.data.data.id,
        payment_url: response.data.data.link,
        payment_status: 'pending'
      })
      .eq('id', booking_id);
    
    res.json({
      success: true,
      payment_url: response.data.data.link,
      payment_id: response.data.data.id
    });
    
  } catch (err) {
    console.error('Payment creation error:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Gagal membuat payment link',
      details: err.response?.data?.message || err.message 
    });
  }
});

// Callback dari Mayar.id setelah pembayaran
app.post("/payment/callback", async (req, res) => {
  try {
    const { status, payment_link_id, metadata } = req.body;
    
    if (status === 'paid') {
      // Update booking status
      await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          status: 'confirmed'
        })
        .eq('payment_id', payment_link_id);
      
      logger.info('Payment successful', { bookingId: metadata?.booking_id, paymentStatus: payment_status });
    } else if (status === 'expired') {
      await supabase
        .from('bookings')
        .update({ payment_status: 'expired' })
        .eq('payment_id', payment_link_id);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cek status pembayaran
app.get("/payment/status/:booking_id", async (req, res) => {
  const { booking_id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('payment_status, payment_url, total_price, paid_at')
      .eq('id', booking_id)
      .single();
    
    if (error) throw error;
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== END PAYMENT ENDPOINTS =====

// Ambil booking user
app.get("/bookings", async (req, res) => {
  const { user_id } = req.query;
  
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, date, start_time, end_time, status,
      fields (name, type, price_per_hour),
      users (name, email)
    `)
    .eq('user_id', user_id)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true });
  
  if (error) return res.status(500).json({ message: "Gagal ambil booking" });
  
  // Transform data to match expected format
  const transformedData = data.map(booking => ({
    id: booking.id,
    date: booking.date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    status: booking.status,
    field_name: booking.fields?.name,
    field_type: booking.fields?.type,
    price_per_hour: booking.fields?.price_per_hour,
    user_name: booking.users?.name,
    user_email: booking.users?.email
  }));
  
  res.json(transformedData);
});

// Ambil semua booking untuk admin
app.get("/admin/bookings", adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, date, start_time, end_time, status,
      fields (name, type, price_per_hour),
      users (name, email)
    `)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true });
  
  if (error) return res.status(500).json({ message: error.message });
  
  // Transform data to match expected format
  const transformedData = data.map(booking => ({
    id: booking.id,
    date: booking.date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    status: booking.status,
    field_name: booking.fields?.name,
    field_type: booking.fields?.type,
    price_per_hour: booking.fields?.price_per_hour,
    user_name: booking.users?.name,
    user_email: booking.users?.email
  }));
  
  res.json(transformedData);
});

// Update status booking admin (hanya untuk booking yang sudah dibayar)
app.patch("/admin/bookings/:id", adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    // Cek status pembayaran terlebih dahulu
    const { data: booking, error: checkError } = await supabase
      .from('bookings')
      .select('payment_status, status')
      .eq('id', id)
      .single();
    
    if (checkError) throw checkError;
    
    // Validasi: Admin hanya bisa update booking yang sudah dibayar
    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ 
        message: 'Booking belum dibayar! User harus membayar terlebih dahulu.' 
      });
    }
    
    // Jika sudah bayar, admin bisa update status (misal: completed, cancelled)
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);
    
    if (error) throw error;
    res.json({ message: `Booking ${status}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user profile
app.put("/user/:id", async (req, res) => {
  const { id } = req.params;
  const { name, username, phone, currentPassword, newPassword } = req.body;

  try {
    // Get current user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError) return res.status(500).json({ message: "User not found" });

    // Prepare update data
    const updateData = { name, username, phone };

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password required" });
      }

      const match = await bcrypt.compare(currentPassword, userData.password);
      if (!match) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Update user
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ message: error.message });

    // Return updated user (without password)
    const { password, ...userWithoutPassword } = data;
    res.json({ message: "Profile updated successfully", user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 5000;

// ===== SOCKET.IO - REAL-TIME CHAT =====
io.on('connection', (socket) => {
  logger.info('Socket connected', { socketId: socket.id });

  // Join room berdasarkan booking_id
  socket.on('join_chat', (booking_id) => {
    socket.join(`booking_${booking_id}`);
    logger.info('User joined chat room', { bookingId: booking_id, socketId: socket.id });
  });

  // Admin join room untuk semua chat
  socket.on('admin_join', () => {
    socket.join('admin_room');
    logger.info('Admin joined admin room', { socketId: socket.id });
  });

  // Kirim pesan
  socket.on('send_message', async (data) => {
    const { booking_id, sender_id, sender_role, message } = data;
    
    try {
      // Simpan ke database
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert([{
          booking_id,
          sender_id,
          sender_role,
          message,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Broadcast ke room booking
      io.to(`booking_${booking_id}`).emit('receive_message', newMessage);
      
      // Notify admin room jika pengirim adalah user
      if (sender_role === 'user') {
        io.to('admin_room').emit('new_user_message', {
          booking_id,
          message: newMessage
        });
      }

      logger.info('Message sent', { bookingId: booking_id, senderId: sender_id, messageId: newMessage[0].id });
    } catch (err) {
      console.error('Error sending message:', err);
      socket.emit('message_error', { error: err.message });
    }
  });

  // Mark messages as read
  socket.on('mark_read', async (data) => {
    const { booking_id, user_id } = data;
    
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('booking_id', booking_id)
        .neq('sender_id', user_id);
      
      io.to(`booking_${booking_id}`).emit('messages_read', { booking_id });
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected', { socketId: socket.id });
  });
});

// ===== CHAT API ENDPOINTS =====

// Get messages untuk booking tertentu
app.get("/messages/:booking_id", async (req, res) => {
  const { booking_id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id, booking_id, sender_id, sender_role, message, created_at, is_read,
        users (name)
      `)
      .eq('booking_id', booking_id)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    const transformedData = data.map(msg => ({
      ...msg,
      sender_name: msg.users?.name
    }));
    
    res.json(transformedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all chats untuk admin
app.get("/admin/chats", adminMiddleware, async (req, res) => {
  try {
    // Get distinct booking_ids yang ada pesan
    const { data: bookings, error } = await supabase
      .from('messages')
      .select('booking_id')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Get unique booking_ids
    const uniqueBookingIds = [...new Set(bookings.map(b => b.booking_id))];
    
    // Get booking details with latest message
    const chatList = [];
    for (const booking_id of uniqueBookingIds) {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id, date, start_time, status,
          fields (name),
          users (id, name, email)
        `)
        .eq('id', booking_id)
        .single();
      
      if (bookingError) continue;
      
      // Get latest message
      const { data: latestMsg } = await supabase
        .from('messages')
        .select('message, created_at, sender_role')
        .eq('booking_id', booking_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Count unread messages
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('booking_id', booking_id)
        .eq('sender_role', 'user')
        .eq('is_read', false);
      
      chatList.push({
        booking_id: booking.id,
        user_id: booking.users.id,
        user_name: booking.users.name,
        user_email: booking.users.email,
        field_name: booking.fields.name,
        booking_date: booking.date,
        booking_time: booking.start_time,
        status: booking.status,
        latest_message: latestMsg?.message || '',
        latest_message_time: latestMsg?.created_at || '',
        latest_sender: latestMsg?.sender_role || '',
        unread_count: count || 0
      });
    }
    
    res.json(chatList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message via API (alternative to socket)
app.post("/messages", async (req, res) => {
  const { booking_id, sender_id, sender_role, message } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        booking_id,
        sender_id,
        sender_role,
        message
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Emit via socket
    io.to(`booking_${booking_id}`).emit('receive_message', data);
    
    res.json({ message: "Pesan terkirim", data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`, { port: PORT, environment: process.env.NODE_ENV || 'development' }));
