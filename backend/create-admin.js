// Script untuk membuat admin dengan password ter-hash
require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createAdmin() {
  const name = "Admin01";
  const email = "admin@gmail.com";
  const password = "admin123";
  
  console.log("Membuat hash password...");
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log("Menghapus user lama jika ada...");
  await supabase.from('users').delete().eq('email', email);
  
  console.log("Membuat admin baru...");
  const { data, error } = await supabase
    .from('users')
    .insert([{ 
      name, 
      email, 
      password: hashedPassword, 
      role: 'admin' 
    }])
    .select();
  
  if (error) {
    console.error("❌ Error:", error);
  } else {
    console.log("✅ Admin berhasil dibuat!");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("\nSekarang Anda bisa login dengan kredensial di atas.");
  }
}

createAdmin();
