const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// ==================== MONGO CONNECT ====================
mongoose
  .connect(process.env.MONGO_URL || "mongodb+srv://admin:yourPassword123@cluster0.mongodb.net/mytests")
  .then(() => console.log("📦 MongoDB connected"))
  .catch(err => console.error("Mongo error:", err));


// ==================== MODELS ====================
const User = mongoose.model("User", new mongoose.Schema({
  firstName: String,
  lastName: String,
  login: String,
  password: String,
  totalScore: { type: Number, default: 0 }
}));

const Mentor = mongoose.model("Mentor", new mongoose.Schema({
  firstName: String,
  lastName: String,
  login: String,
  password: String
}));

const QuestionSchema = new mongoose.Schema({
  text: String,
  options: [String],
  correctIndex: Number,
  score: Number
});

const Test = mongoose.model("Test", new mongoose.Schema({
  name: String,
  description: String,
  maxScore: Number,
  questions: [QuestionSchema]
}));

const Result = mongoose.model("Result", new mongoose.Schema({
  student_id: String,
  mentor_id: String,
  test_id: String,
  test_score: Number,
  test_max_score: Number,
  test_type: String,
  test_date: String,
  percentage: Number
}));


// ========================= TESTS =========================
app.get("/tests", async (req, res) => {
  const tests = await Test.find();
  res.json(tests.map(t => ({
    id: t._id,
    name: t.name,
    description: t.description,
    maxScore: t.maxScore,
    questionCount: t.questions.length
  })));
});

app.get("/tests/:id", async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) return res.status(404).json({ message: "Тест не найден" });
  res.json(test);
});

app.post("/tests", async (req, res) => {
  const { name, description, questions } = req.body;
  const maxScore = questions.reduce((s, q) => s + q.score, 0);

  const test = await Test.create({ name, description, questions, maxScore });

  res.json({ message: "Тест создан", test });
});

app.delete("/tests/:id", async (req, res) => {
  await Test.findByIdAndDelete(req.params.id);
  res.json({ message: "Тест удален" });
});


// ======================== USERS ========================
app.post("/users", async (req, res) => {
  const { firstName, lastName, login, password } = req.body;

  const exists = await User.findOne({ login });
  if (exists) return res.status(400).json({ message: "Логин занят" });

  const user = await User.create({ firstName, lastName, login, password });

  res.json({ message: "Студент создан", user });
});

app.get("/users", async (req, res) => {
  res.json(await User.find());
});

app.get("/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Студент не найден" });
  res.json(user);
});

app.patch("/users/:id/score", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Студент не найден" });

  user.totalScore += req.body.scoreToAdd;
  await user.save();

  res.json({ message: "Балл обновлен", newTotal: user.totalScore });
});

app.delete("/users/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "Студент удален" });
});


// ======================== MENTORS ========================
app.post("/mentors", async (req, res) => {
  const { firstName, lastName, login, password } = req.body;

  const exists = await Mentor.findOne({ login });
  if (exists) return res.status(400).json({ message: "Логин занят" });

  const mentor = await Mentor.create({ firstName, lastName, login, password });

  res.json({ message: "Ментор создан", mentor });
});

app.get("/mentors", async (req, res) => {
  res.json(await Mentor.find());
});

app.get("/mentors/:id", async (req, res) => {
  const mentor = await Mentor.findById(req.params.id);
  if (!mentor) return res.status(404).json({ message: "Ментор не найден" });
  res.json(mentor);
});


// ======================== LOGIN ========================
app.post("/login/user", async (req, res) => {
  const { login, password } = req.body;

  const user = await User.findOne({ login, password });
  if (!user) return res.status(401).json({ message: "Неверный логин или пароль" });

  res.json({ message: "success", user });
});

app.post("/login/mentor", async (req, res) => {
  const { login, password } = req.body;

  const mentor = await Mentor.findOne({ login, password });
  if (!mentor) return res.status(401).json({ message: "Неверный логин или пароль" });

  res.json({ message: "success", mentor });
});


// ======================== RESULTS ========================
app.post("/results", async (req, res) => {
  const { student_id, mentor_id, test_id, test_score, test_max_score, test_type } = req.body;

  const percentage = Math.round((test_score / test_max_score) * 100);

  const result = await Result.create({
    student_id,
    mentor_id,
    test_id,
    test_score,
    test_max_score,
    test_type,
    test_date: new Date().toISOString(),
    percentage
  });

  res.json({ message: "Результат сохранен", result });
});

app.get("/results", async (req, res) => {
  res.json(await Result.find());
});


// ======================== STATS ========================
app.get("/stats/general", async (req, res) => {
  const totalStudents = await User.countDocuments();
  const totalMentors = await Mentor.countDocuments();
  const totalTests = await Test.countDocuments();
  const results = await Result.find();

  const avgPercentage = results.length
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0;

  res.json({
    totalStudents,
    totalMentors,
    totalTests,
    totalResults: results.length,
    averagePercentage: avgPercentage
  });
});


// ======================== SERVER START ========================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
