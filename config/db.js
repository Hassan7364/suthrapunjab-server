import dns from "node:dns";
import mongoose from "mongoose";

const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers?.length) dns.setServers(dnsServers);

const connectDatabase = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");
};

export default connectDatabase;
