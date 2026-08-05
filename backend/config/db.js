const mongoose = require("mongoose");
const dns = require("dns");

const connectDB = async () => {
  // Public resolvers make Atlas SRV discovery work on restrictive networks.
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

module.exports = connectDB;
