const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// ==================== MONGO CONNECT ====================
mongoose
  .connect(process.env.MONGO_URL || "mongodb+srv://saidazim186_db_user:beHLGtAUmYj8ix2u@cluster0.ktoqipx.mongodb.net/?appName=Cluster0")
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
  question: String,
  variants: [
    {
      key: String,
      text: String
    }
  ],
  correctAnswer: String,
  score: Number
});

const Test = mongoose.model("Test", new mongoose.Schema({
  name: String,
  description: String,
  maxScore: Number,
  time: Number, // время теста в миллисекундах
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
  const testList = tests.map(t => ({
    id: t._id,
    name: t.name,
    description: t.description,
    maxScore: t.maxScore,
    questionCount: t.questions.length,
    time: t.time || 25 * 60 * 1000 // если время не указано, 25 минут по умолчанию
  }));
  res.json(testList);
});


app.get("/tests/:id", async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) return res.status(404).json({ message: "Тест не найден" });
  res.json({
    id: test._id,
    name: test.name,
    description: test.description,
    maxScore: test.maxScore,
    time: test.time, // добавили поле времени
    questions: test.questions
  });

});

app.post("/tests", async (req, res) => {
  const { name, description, questions, time } = req.body; // добавили time
  const maxScore = questions.reduce((s, q) => s + q.score, 0);

  const test = await Test.create({ name, description, questions, maxScore, time });
  res.json({ message: "Тест создан", test: { ...test.toObject(), id: test._id } });
});



app.delete("/tests/:id", async (req, res) => {
  const test = await Test.findByIdAndDelete(req.params.id);
  if (!test) return res.status(404).json({ message: "Тест не найден" });
  res.json({ message: "Тест удален" });
});

// DELETE all tests
app.delete("/tests", async (req, res) => {
  const result = await Test.deleteMany({});
  res.json({ message: `Удалено ${result.deletedCount} тестов` });
});

// ======================== USERS ========================
app.post("/users", async (req, res) => {
  const { firstName, lastName, login, password } = req.body;

  const exists = await User.findOne({ login });
  if (exists) return res.status(400).json({ message: "Логин уже занят" });

  const user = await User.create({ firstName, lastName, login, password });
  res.json({ message: "Студент создан", user: { ...user.toObject(), id: user._id } });
});

app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users.map(u => ({ ...u.toObject(), id: u._id })));
});

app.get("/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Студент не найден" });
  res.json({ ...user.toObject(), id: user._id });
});

app.patch("/users/:id/score", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Студент не найден" });

  user.totalScore += req.body.scoreToAdd;
  await user.save();

  res.json({ message: "Балл обновлен", newTotal: user.totalScore });
});

app.delete("/users/:id", async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "Студент не найден" });
  res.json({ message: "Студент удален" });
});

// ======================== MENTORS ========================
app.post("/mentors", async (req, res) => {
  const { firstName, lastName, login, password } = req.body;

  const exists = await Mentor.findOne({ login });
  if (exists) return res.status(400).json({ message: "Логин уже занят" });

  const mentor = await Mentor.create({ firstName, lastName, login, password });
  res.json({ message: "Ментор создан", mentor: { ...mentor.toObject(), id: mentor._id } });
});

app.get("/mentors", async (req, res) => {
  const mentors = await Mentor.find();
  res.json(mentors.map(m => ({ ...m.toObject(), id: m._id })));
});

app.get("/mentors/:id", async (req, res) => {
  const mentor = await Mentor.findById(req.params.id);
  if (!mentor) return res.status(404).json({ message: "Ментор не найден" });
  res.json({ ...mentor.toObject(), id: mentor._id });
});

// ======================== LOGIN ========================
app.post("/login/user", async (req, res) => {
  const { login, password } = req.body;

  const user = await User.findOne({ login, password });
  if (!user) return res.status(401).json({ message: "Неверный логин или пароль" });

  res.json({
    message: "success",
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      login: user.login,
      totalScore: user.totalScore
    }
  });
});

app.post("/login/mentor", async (req, res) => {
  const { login, password } = req.body;

  const mentor = await Mentor.findOne({ login, password });
  if (!mentor) return res.status(401).json({ message: "Неверный логин или пароль" });

  res.json({
    message: "success",
    mentor: {
      id: mentor._id,
      firstName: mentor.firstName,
      lastName: mentor.lastName,
      login: mentor.login
    }
  });
});

// ======================== RESULTS ========================
app.post("/results", async (req, res) => {
  const { student_id, mentor_id, test_id, test_score, test_type } = req.body;

  const student = await User.findById(student_id);
  const test = await Test.findById(test_id);
  if (!student) return res.status(404).json({ message: "Студент не найден" });
  if (!test) return res.status(404).json({ message: "Тест не найден" });

  const test_max_score = test.maxScore; // максимальный балл берём из теста
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

  // автоматически обновляем totalScore студента
  student.totalScore += test_score;
  await student.save();

  res.json({ message: "Результат сохранен", result: { ...result.toObject(), id: result._id } });
});

app.get("/results", async (req, res) => {
  const results = await Result.find();
  res.json(results.map(r => ({ ...r.toObject(), id: r._id })));
});

app.get("/results/student/:studentId", async (req, res) => {
  const results = await Result.find({ student_id: req.params.studentId });

  const enrichedResults = await Promise.all(results.map(async r => {
    const test = await Test.findById(r.test_id);
    return {
      ...r.toObject(),
      id: r._id,
      test_name: test ? test.name : "Неизвестный тест"
    };
  }));

  res.json(enrichedResults);
});

app.get("/results/test/:testId", async (req, res) => {
  const results = await Result.find({ test_id: req.params.testId });

  const enrichedResults = await Promise.all(results.map(async r => {
    const student = await User.findById(r.student_id);
    return {
      ...r.toObject(),
      id: r._id,
      student_name: student ? `${student.firstName} ${student.lastName}` : "Неизвестный"
    };
  }));

  res.json(enrichedResults);
});

app.delete("/results/:id", async (req, res) => {
  const result = await Result.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ message: "Результат не найден" });
  res.json({ message: "Результат удален" });
});

// ======================== STATS ========================
app.get("/stats/student/:studentId", async (req, res) => {
  const student = await User.findById(req.params.studentId);
  if (!student) return res.status(404).json({ message: "Студент не найден" });

  const results = await Result.find({ student_id: req.params.studentId });

  const stats = {
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      totalScore: student.totalScore
    },
    testsCompleted: results.length,
    averagePercentage: results.length
      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
      : 0,
    results: await Promise.all(results.map(async r => {
      const test = await Test.findById(r.test_id);
      return {
        test_name: test ? test.name : "Неизвестный тест",
        score: r.test_score,
        max_score: r.test_max_score,
        percentage: r.percentage,
        date: r.test_date
      };
    }))
  };

  res.json(stats);
});

// ======================== DELETE MENTOR BY PASSWORD ========================
app.delete("/mentors/password/:password", async (req, res) => {
  const passwordToDelete = req.params.password;

  const mentor = await Mentor.findOneAndDelete({ password: passwordToDelete });
  if (!mentor) return res.status(404).json({ message: "Ментор с таким паролем не найден" });

  res.json({ message: `Ментор с паролем "${passwordToDelete}" удален`, mentor: { ...mentor.toObject(), id: mentor._id } });
});

// ======================== SERVER START ========================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
