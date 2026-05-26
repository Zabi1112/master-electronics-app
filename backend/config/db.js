// For Local PostgreSQL Database
// const { Sequelize } = require("sequelize");

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   String(process.env.DB_PASSWORD),
//   {
//     host: process.env.DB_HOST,
//     port: Number(process.env.DB_PORT),
//     dialect: "postgres",
//     logging: false,
//   }
// );

// const connectDB = async () => {
//   try {
//     console.log("DB_USER:", process.env.DB_USER);
//     console.log("DB_NAME:", process.env.DB_NAME);

//     await sequelize.authenticate();
//     console.log("PostgreSQL Connected");
//   } catch (error) {
//     console.error("PostgreSQL Error:", error.message);
//     process.exit(1);
//   }
// };

// module.exports = { sequelize, connectDB };


// For SupaBase PostgreSQL Database

const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Supabase PostgreSQL Connected");
  } catch (error) {
    console.error("PostgreSQL Error:", error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };