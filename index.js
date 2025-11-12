const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Basic config
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schema definitions
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
});

const exerciseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// Models
const User = mongoose.model("User", userSchema);
const Exercise = mongoose.model("Exercise", exerciseSchema);

// Principal endpoint
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// 1. POST /api/users - Create a new user
app.post("/api/users", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.json({ error: "Username is required" });
    }

    const newUser = new User({ username });
    const savedUser = await newUser.save();

    res.json({
      username: savedUser.username,
      _id: savedUser._id,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.json({ error: "Username already exists" });
    } else {
      res.json({ error: "Server error" });
    }
  }
});

// 2. GET /api/users - List all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "username _id");
    res.json(users);
  } catch (error) {
    res.json({ error: "Server error" });
  }
});

// 3. POST /api/users/:_id/exercises - Add an exercise
app.post("/api/users/:_id/exercises", async (req, res) => {
  try {
    const userId = req.params._id;
    const { description, duration, date } = req.body;

    // Verify that the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: "User not found" });
    }

    // Validate required fields
    if (!description || !duration) {
      return res.json({ error: "Description and duration are required" });
    }

    // Parse date
    let exerciseDate;
    if (date) {
      exerciseDate = new Date(date);
    } else {
      exerciseDate = new Date();
    }

    // Create and save the exercise
    const newExercise = new Exercise({
      userId: userId,
      description: description,
      duration: parseInt(duration),
      date: exerciseDate,
    });

    const savedExercise = await newExercise.save();

    // Response with the required format
    res.json({
      _id: user._id,
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(),
    });
  } catch (error) {
    res.json({ error: "Server error" });
  }
});

// 4. GET /api/users/:_id/logs - Get a user's exercise log
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;

    // Verify that the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: "User not found" });
    }

    // Build date filter
    let dateFilter = {};
    if (from) {
      dateFilter.$gte = new Date(from);
    }
    if (to) {
      dateFilter.$lte = new Date(to);
    }

    // Build query
    let query = { userId: userId };
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter;
    }

    // Execute query with optional limit
    let exerciseQuery = Exercise.find(query).sort({ date: 1 });
    if (limit) {
      exerciseQuery = exerciseQuery.limit(parseInt(limit));
    }

    const exercises = await exerciseQuery;

    // Format log
    const log = exercises.map((exercise) => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
    }));

    // Response with the required format
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log: log,
    });
  } catch (error) {
    res.json({ error: "Server error" });
  }
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});