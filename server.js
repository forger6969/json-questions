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
  totalScore: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 } // процент успеха
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
  time: Number,
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

// НОВАЯ МОДЕЛЬ: Назначенные задания
const Assignment = mongoose.model("Assignment", new mongoose.Schema({
  mentor_id: { type: String, required: true },
  student_id: { type: String, required: true },
  test_id: { type: String, required: true },
  assigned_date: { type: Date, default: Date.now },
  deadline: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'overdue'], 
    default: 'pending' 
  },
  completed_date: Date,
  result_id: String // ссылка на результат после выполнения
}));

// ==================== HELPER FUNCTIONS ====================
// Функция для пересчета процента успеха студента
async function updateStudentSuccessRate(studentId) {
  const results = await Result.find({ student_id: studentId });
  
  if (results.length === 0) {
    await User.findByIdAndUpdate(studentId, { successRate: 0 });
    return 0;
  }

  const totalPercentage = results.reduce((sum, r) => sum + r.percentage, 0);
  const successRate = Math.round(totalPercentage / results.length);
  
  await User.findByIdAndUpdate(studentId, { successRate });
  return successRate;
}

// Функция для обновления статуса заданий
async function updateAssignmentStatuses() {
  const now = new Date();
  await Assignment.updateMany(
    { 
      status: 'pending', 
      deadline: { $lt: now } 
    },
    { status: 'overdue' }
  );
}

// ========================= TESTS =========================
app.get("/tests", async (req, res) => {
  const tests = await Test.find();
  const testList = tests.map(t => ({
    id: t._id,
    name: t.name,
    description: t.description,
    maxScore: t.maxScore,
    questionCount: t.questions.length,
    time: t.time || 25 * 60 * 1000
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
    time: test.time,
    questions: test.questions
  });
});

app.post("/tests", async (req, res) => {
  const { name, description, questions, time } = req.body;
  const maxScore = questions.reduce((s, q) => s + q.score, 0);

  const test = await Test.create({ name, description, questions, maxScore, time });
  res.json({ message: "Тест создан", test: { ...test.toObject(), id: test._id } });
});

app.delete("/tests/:id", async (req, res) => {
  const test = await Test.findByIdAndDelete(req.params.id);
  if (!test) return res.status(404).json({ message: "Тест не найден" });
  res.json({ message: "Тест удален" });
});

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

app.delete("/mentors/password/:password", async (req, res) => {
  const passwordToDelete = req.params.password;

  const mentor = await Mentor.findOneAndDelete({ password: passwordToDelete });
  if (!mentor) return res.status(404).json({ message: "Ментор с таким паролем не найден" });

  res.json({ message: `Ментор с паролем "${passwordToDelete}" удален`, mentor: { ...mentor.toObject(), id: mentor._id } });
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
      totalScore: user.totalScore,
      successRate: user.successRate
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

  const test_max_score = test.maxScore;
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

  // Обновляем totalScore студента
  student.totalScore += test_score;
  await student.save();

  // Пересчитываем процент успеха
  await updateStudentSuccessRate(student_id);

  // Проверяем, было ли это назначенное задание
  const assignment = await Assignment.findOne({
    student_id,
    test_id,
    status: { $in: ['pending', 'overdue'] }
  });

  if (assignment) {
    assignment.status = 'completed';
    assignment.completed_date = new Date();
    assignment.result_id = result._id;
    await assignment.save();
  }

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
      totalScore: student.totalScore,
      successRate: student.successRate
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

// ======================== ASSIGNMENTS (НОВОЕ) ========================

// Создать назначение (ментор назначает тест студенту)
app.post("/assignments", async (req, res) => {
  const { mentor_id, student_id, test_id, deadline } = req.body;

  // Проверки
  const mentor = await Mentor.findById(mentor_id);
  const student = await User.findById(student_id);
  const test = await Test.findById(test_id);

  if (!mentor) return res.status(404).json({ message: "Ментор не найден" });
  if (!student) return res.status(404).json({ message: "Студент не найден" });
  if (!test) return res.status(404).json({ message: "Тест не найден" });

  // ИСПРАВЛЕНО: Проверка только на активные назначения (pending), 
  // просроченные и завершенные можно назначать заново
  const existingAssignment = await Assignment.findOne({
    student_id,
    test_id,
    status: 'pending' // проверяем только pending
  });

  if (existingAssignment) {
    return res.status(400).json({ message: "Этот тест уже назначен данному студенту и ожидает выполнения" });
  }

  const assignment = await Assignment.create({
    mentor_id,
    student_id,
    test_id,
    deadline: new Date(deadline)
  });

  res.json({ 
    message: "Задание назначено", 
    assignment: { ...assignment.toObject(), id: assignment._id } 
  });
});

// Получить все назначения студента
app.get("/assignments/student/:studentId", async (req, res) => {
  await updateAssignmentStatuses(); // обновляем статусы перед выдачей

  const assignments = await Assignment.find({ student_id: req.params.studentId });

  const enrichedAssignments = await Promise.all(assignments.map(async a => {
    const test = await Test.findById(a.test_id);
    const mentor = await Mentor.findById(a.mentor_id);
    
    return {
      ...a.toObject(),
      id: a._id,
      test_name: test ? test.name : "Неизвестный тест",
      test_description: test ? test.description : "",
      test_time: test ? test.time : 0,
      test_max_score: test ? test.maxScore : 0,
      mentor_name: mentor ? `${mentor.firstName} ${mentor.lastName}` : "Неизвестный ментор"
    };
  }));

  res.json(enrichedAssignments);
});

// Получить все назначения ментора
app.get("/assignments/mentor/:mentorId", async (req, res) => {
  await updateAssignmentStatuses();

  const assignments = await Assignment.find({ mentor_id: req.params.mentorId });

  const enrichedAssignments = await Promise.all(assignments.map(async a => {
    const test = await Test.findById(a.test_id);
    const student = await User.findById(a.student_id);
    
    let resultData = null;
    if (a.result_id) {
      const result = await Result.findById(a.result_id);
      if (result) {
        resultData = {
          score: result.test_score,
          max_score: result.test_max_score,
          percentage: result.percentage
        };
      }
    }

    return {
      ...a.toObject(),
      id: a._id,
      test_name: test ? test.name : "Неизвестный тест",
      student_name: student ? `${student.firstName} ${student.lastName}` : "Неизвестный студент",
      student_success_rate: student ? student.successRate : 0,
      result: resultData
    };
  }));

  res.json(enrichedAssignments);
});

// Получить конкретное назначение
app.get("/assignments/:id", async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Назначение не найдено" });

  const test = await Test.findById(assignment.test_id);
  const student = await User.findById(assignment.student_id);
  const mentor = await Mentor.findById(assignment.mentor_id);

  res.json({
    ...assignment.toObject(),
    id: assignment._id,
    test_name: test ? test.name : "Неизвестный тест",
    student_name: student ? `${student.firstName} ${student.lastName}` : "Неизвестный",
    mentor_name: mentor ? `${mentor.firstName} ${mentor.lastName}` : "Неизвестный"
  });
});

// Удалить назначение
app.delete("/assignments/:id", async (req, res) => {
  const assignment = await Assignment.findByIdAndDelete(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Назначение не найдено" });
  res.json({ message: "Назначение удалено" });
});

// НОВОЕ: Переназначить просроченное задание (продлить срок)
app.patch("/assignments/:id/extend", async (req, res) => {
  const { new_deadline } = req.body;
  
  if (!new_deadline) {
    return res.status(400).json({ message: "Укажите новый срок" });
  }

  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Назначение не найдено" });

  // Обновляем дедлайн и сбрасываем статус на pending
  assignment.deadline = new Date(new_deadline);
  assignment.status = 'pending';
  assignment.completed_date = undefined;
  assignment.result_id = undefined;
  
  await assignment.save();

  // Уведомить студента о продлении
  await Notification.create({
    user_id: assignment.student_id,
    user_type: 'student',
    title: "⏰ Срок продлен",
    message: `Срок выполнения задания продлен до ${new Date(new_deadline).toLocaleDateString()}`,
    type: 'deadline',
    related_id: assignment._id
  });

  res.json({ 
    message: "Срок продлен", 
    assignment: { ...assignment.toObject(), id: assignment._id } 
  });
});

// НОВОЕ: Закрыть/отменить просроченное задание без выполнения
app.patch("/assignments/:id/cancel", async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Назначение не найдено" });

  await Assignment.findByIdAndDelete(req.params.id);

  res.json({ message: "Задание отменено и удалено" });
});

// Получить статистику по назначениям для студента
app.get("/assignments/stats/student/:studentId", async (req, res) => {
  await updateAssignmentStatuses();

  const assignments = await Assignment.find({ student_id: req.params.studentId });

  const stats = {
    total: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    overdue: assignments.filter(a => a.status === 'overdue').length,
    completionRate: assignments.length 
      ? Math.round((assignments.filter(a => a.status === 'completed').length / assignments.length) * 100)
      : 0
  };

  res.json(stats);
});

// ======================== NOTIFICATIONS (НОВОЕ) ========================

// НОВАЯ МОДЕЛЬ: Уведомления
const Notification = mongoose.model("Notification", new mongoose.Schema({
  user_id: { type: String, required: true },
  user_type: { type: String, enum: ['student', 'mentor'], required: true },
  title: String,
  message: String,
  type: { 
    type: String, 
    enum: ['assignment', 'result', 'deadline', 'achievement', 'system'], 
    default: 'system' 
  },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  related_id: String // ID связанного объекта (теста, назначения и т.д.)
}));

// Создать уведомление
app.post("/notifications", async (req, res) => {
  const { user_id, user_type, title, message, type, related_id } = req.body;

  const notification = await Notification.create({
    user_id,
    user_type,
    title,
    message,
    type,
    related_id
  });

  res.json({ message: "Уведомление создано", notification: { ...notification.toObject(), id: notification._id } });
});

// Получить все уведомления пользователя
app.get("/notifications/:userType/:userId", async (req, res) => {
  const { userType, userId } = req.params;
  const notifications = await Notification.find({ 
    user_id: userId, 
    user_type: userType 
  }).sort({ created_at: -1 });

  res.json(notifications.map(n => ({ ...n.toObject(), id: n._id })));
});

// Получить непрочитанные уведомления
app.get("/notifications/:userType/:userId/unread", async (req, res) => {
  const { userType, userId } = req.params;
  const notifications = await Notification.find({ 
    user_id: userId, 
    user_type: userType,
    is_read: false 
  }).sort({ created_at: -1 });

  res.json(notifications.map(n => ({ ...n.toObject(), id: n._id })));
});

// Отметить уведомление как прочитанное
app.patch("/notifications/:id/read", async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { is_read: true },
    { new: true }
  );

  if (!notification) return res.status(404).json({ message: "Уведомление не найдено" });
  res.json({ message: "Уведомление прочитано", notification: { ...notification.toObject(), id: notification._id } });
});

// Отметить все уведомления как прочитанные
app.patch("/notifications/:userType/:userId/read-all", async (req, res) => {
  const { userType, userId } = req.params;
  const result = await Notification.updateMany(
    { user_id: userId, user_type: userType, is_read: false },
    { is_read: true }
  );

  res.json({ message: `Прочитано ${result.modifiedCount} уведомлений` });
});

// Удалить уведомление
app.delete("/notifications/:id", async (req, res) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) return res.status(404).json({ message: "Уведомление не найдено" });
  res.json({ message: "Уведомление удалено" });
});

// ======================== ACHIEVEMENTS (НОВОЕ) ========================

// НОВАЯ МОДЕЛЬ: Достижения
const Achievement = mongoose.model("Achievement", new mongoose.Schema({
  name: String,
  description: String,
  icon: String,
  condition_type: { 
    type: String, 
    enum: ['tests_completed', 'total_score', 'success_rate', 'perfect_score', 'streak'], 
    required: true 
  },
  condition_value: Number,
  points: { type: Number, default: 0 }
}));

// НОВАЯ МОДЕЛЬ: Достижения студентов
const StudentAchievement = mongoose.model("StudentAchievement", new mongoose.Schema({
  student_id: { type: String, required: true },
  achievement_id: { type: String, required: true },
  earned_date: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false }
}));

// Создать достижение
app.post("/achievements", async (req, res) => {
  const { name, description, icon, condition_type, condition_value, points } = req.body;

  const achievement = await Achievement.create({
    name,
    description,
    icon,
    condition_type,
    condition_value,
    points
  });

  res.json({ message: "Достижение создано", achievement: { ...achievement.toObject(), id: achievement._id } });
});

// Получить все достижения
app.get("/achievements", async (req, res) => {
  const achievements = await Achievement.find();
  res.json(achievements.map(a => ({ ...a.toObject(), id: a._id })));
});

// Получить достижения студента
app.get("/achievements/student/:studentId", async (req, res) => {
  const studentAchievements = await StudentAchievement.find({ student_id: req.params.studentId });

  const enrichedAchievements = await Promise.all(studentAchievements.map(async sa => {
    const achievement = await Achievement.findById(sa.achievement_id);
    return {
      ...sa.toObject(),
      id: sa._id,
      name: achievement ? achievement.name : "Неизвестное достижение",
      description: achievement ? achievement.description : "",
      icon: achievement ? achievement.icon : "",
      points: achievement ? achievement.points : 0
    };
  }));

  res.json(enrichedAchievements);
});

// Проверить и выдать достижения студенту
app.post("/achievements/check/:studentId", async (req, res) => {
  const studentId = req.params.studentId;
  const student = await User.findById(studentId);
  if (!student) return res.status(404).json({ message: "Студент не найден" });

  const results = await Result.find({ student_id: studentId });
  const achievements = await Achievement.find();
  const studentAchievements = await StudentAchievement.find({ student_id: studentId });

  const earnedAchievementIds = studentAchievements.map(sa => sa.achievement_id.toString());
  const newAchievements = [];

  for (const achievement of achievements) {
    if (earnedAchievementIds.includes(achievement._id.toString())) continue;

    let earned = false;

    switch (achievement.condition_type) {
      case 'tests_completed':
        earned = results.length >= achievement.condition_value;
        break;
      case 'total_score':
        earned = student.totalScore >= achievement.condition_value;
        break;
      case 'success_rate':
        earned = student.successRate >= achievement.condition_value;
        break;
      case 'perfect_score':
        const perfectScores = results.filter(r => r.percentage === 100).length;
        earned = perfectScores >= achievement.condition_value;
        break;
    }

    if (earned) {
      const studentAchievement = await StudentAchievement.create({
        student_id: studentId,
        achievement_id: achievement._id
      });

      // Создать уведомление
      await Notification.create({
        user_id: studentId,
        user_type: 'student',
        title: `🏆 Новое достижение: ${achievement.name}`,
        message: achievement.description,
        type: 'achievement',
        related_id: achievement._id
      });

      newAchievements.push({ ...achievement.toObject(), id: achievement._id });
    }
  }

  res.json({ 
    message: `Проверено достижений: ${newAchievements.length} новых`,
    newAchievements 
  });
});

// Удалить достижение
app.delete("/achievements/:id", async (req, res) => {
  const achievement = await Achievement.findByIdAndDelete(req.params.id);
  if (!achievement) return res.status(404).json({ message: "Достижение не найдено" });
  res.json({ message: "Достижение удалено" });
});

// ======================== COMMENTS & FEEDBACK (НОВОЕ) ========================

// НОВАЯ МОДЕЛЬ: Комментарии к результатам
const Comment = mongoose.model("Comment", new mongoose.Schema({
  result_id: { type: String, required: true },
  mentor_id: { type: String, required: true },
  text: String,
  rating: { type: Number, min: 1, max: 5 },
  created_at: { type: Date, default: Date.now }
}));

// Добавить комментарий к результату
app.post("/comments", async (req, res) => {
  const { result_id, mentor_id, text, rating } = req.body;

  const result = await Result.findById(result_id);
  if (!result) return res.status(404).json({ message: "Результат не найден" });

  const comment = await Comment.create({
    result_id,
    mentor_id,
    text,
    rating
  });

  // Уведомить студента
  await Notification.create({
    user_id: result.student_id,
    user_type: 'student',
    title: "💬 Новый комментарий от ментора",
    message: `Ментор оставил комментарий к вашему результату теста`,
    type: 'result',
    related_id: result_id
  });

  res.json({ message: "Комментарий добавлен", comment: { ...comment.toObject(), id: comment._id } });
});

// Получить комментарии к результату
app.get("/comments/result/:resultId", async (req, res) => {
  const comments = await Comment.find({ result_id: req.params.resultId });

  const enrichedComments = await Promise.all(comments.map(async c => {
    const mentor = await Mentor.findById(c.mentor_id);
    return {
      ...c.toObject(),
      id: c._id,
      mentor_name: mentor ? `${mentor.firstName} ${mentor.lastName}` : "Неизвестный ментор"
    };
  }));

  res.json(enrichedComments);
});

// Получить все комментарии студента
app.get("/comments/student/:studentId", async (req, res) => {
  const results = await Result.find({ student_id: req.params.studentId });
  const resultIds = results.map(r => r._id.toString());

  const comments = await Comment.find({ result_id: { $in: resultIds } });

  const enrichedComments = await Promise.all(comments.map(async c => {
    const mentor = await Mentor.findById(c.mentor_id);
    const result = await Result.findById(c.result_id);
    const test = result ? await Test.findById(result.test_id) : null;

    return {
      ...c.toObject(),
      id: c._id,
      mentor_name: mentor ? `${mentor.firstName} ${mentor.lastName}` : "Неизвестный",
      test_name: test ? test.name : "Неизвестный тест",
      test_score: result ? result.test_score : 0,
      test_percentage: result ? result.percentage : 0
    };
  }));

  res.json(enrichedComments);
});

// Удалить комментарий
app.delete("/comments/:id", async (req, res) => {
  const comment = await Comment.findByIdAndDelete(req.params.id);
  if (!comment) return res.status(404).json({ message: "Комментарий не найден" });
  res.json({ message: "Комментарий удален" });
});

// ======================== LEARNING PATHS (НОВОЕ) ========================

// НОВАЯ МОДЕЛЬ: Учебные пути
const LearningPath = mongoose.model("LearningPath", new mongoose.Schema({
  name: String,
  description: String,
  mentor_id: String,
  tests: [{ 
    test_id: String, 
    order: Number,
    required_score: Number // минимальный процент для прохождения
  }],
  created_at: { type: Date, default: Date.now }
}));

// НОВАЯ МОДЕЛЬ: Прогресс студента по учебному пути
const StudentPathProgress = mongoose.model("StudentPathProgress", new mongoose.Schema({
  student_id: { type: String, required: true },
  path_id: { type: String, required: true },
  current_test_index: { type: Number, default: 0 },
  completed_tests: [String],
  started_at: { type: Date, default: Date.now },
  completed_at: Date
}));

// Создать учебный путь
app.post("/learning-paths", async (req, res) => {
  const { name, description, mentor_id, tests } = req.body;

  const path = await LearningPath.create({
    name,
    description,
    mentor_id,
    tests
  });

  res.json({ message: "Учебный путь создан", path: { ...path.toObject(), id: path._id } });
});

// Получить все учебные пути
app.get("/learning-paths", async (req, res) => {
  const paths = await LearningPath.find();

  const enrichedPaths = await Promise.all(paths.map(async p => {
    const mentor = await Mentor.findById(p.mentor_id);
    return {
      ...p.toObject(),
      id: p._id,
      mentor_name: mentor ? `${mentor.firstName} ${mentor.lastName}` : "Неизвестный",
      total_tests: p.tests.length
    };
  }));

  res.json(enrichedPaths);
});

// Получить учебный путь по ID
app.get("/learning-paths/:id", async (req, res) => {
  const path = await LearningPath.findById(req.params.id);
  if (!path) return res.status(404).json({ message: "Учебный путь не найден" });

  const enrichedTests = await Promise.all(path.tests.map(async t => {
    const test = await Test.findById(t.test_id);
    return {
      ...t,
      test_name: test ? test.name : "Неизвестный тест",
      test_description: test ? test.description : "",
      test_max_score: test ? test.maxScore : 0
    };
  }));

  res.json({
    ...path.toObject(),
    id: path._id,
    tests: enrichedTests
  });
});

// Назначить учебный путь студенту
app.post("/learning-paths/:pathId/assign/:studentId", async (req, res) => {
  const { pathId, studentId } = req.params;

  const path = await LearningPath.findById(pathId);
  const student = await User.findById(studentId);

  if (!path) return res.status(404).json({ message: "Учебный путь не найден" });
  if (!student) return res.status(404).json({ message: "Студент не найден" });

  const existingProgress = await StudentPathProgress.findOne({
    student_id: studentId,
    path_id: pathId
  });

  if (existingProgress) {
    return res.status(400).json({ message: "Студент уже назначен на этот путь" });
  }

  const progress = await StudentPathProgress.create({
    student_id: studentId,
    path_id: pathId
  });

  // Уведомить студента
  await Notification.create({
    user_id: studentId,
    user_type: 'student',
    title: "📚 Новый учебный путь",
    message: `Вам назначен учебный путь: ${path.name}`,
    type: 'assignment',
    related_id: pathId
  });

  res.json({ message: "Учебный путь назначен", progress: { ...progress.toObject(), id: progress._id } });
});

// Получить прогресс студента по учебным путям
app.get("/learning-paths/progress/:studentId", async (req, res) => {
  const progressList = await StudentPathProgress.find({ student_id: req.params.studentId });

  const enrichedProgress = await Promise.all(progressList.map(async p => {
    const path = await LearningPath.findById(p.path_id);
    return {
      ...p.toObject(),
      id: p._id,
      path_name: path ? path.name : "Неизвестный путь",
      path_description: path ? path.description : "",
      total_tests: path ? path.tests.length : 0,
      completion_percentage: path ? Math.round((p.completed_tests.length / path.tests.length) * 100) : 0
    };
  }));

  res.json(enrichedProgress);
});

// Обновить прогресс по учебному пути
app.patch("/learning-paths/progress/:progressId", async (req, res) => {
  const { completed_test_id } = req.body;

  const progress = await StudentPathProgress.findById(req.params.progressId);
  if (!progress) return res.status(404).json({ message: "Прогресс не найден" });

  if (!progress.completed_tests.includes(completed_test_id)) {
    progress.completed_tests.push(completed_test_id);
    progress.current_test_index += 1;
  }

  const path = await LearningPath.findById(progress.path_id);
  if (path && progress.completed_tests.length === path.tests.length) {
    progress.completed_at = new Date();

    // Уведомить о завершении пути
    await Notification.create({
      user_id: progress.student_id,
      user_type: 'student',
      title: "🎉 Учебный путь завершен!",
      message: `Поздравляем! Вы завершили учебный путь: ${path.name}`,
      type: 'achievement',
      related_id: path._id
    });
  }

  await progress.save();

  res.json({ message: "Прогресс обновлен", progress: { ...progress.toObject(), id: progress._id } });
});

// Удалить учебный путь
app.delete("/learning-paths/:id", async (req, res) => {
  const path = await LearningPath.findByIdAndDelete(req.params.id);
  if (!path) return res.status(404).json({ message: "Учебный путь не найден" });
  res.json({ message: "Учебный путь удален" });
});

// ======================== ANALYTICS & REPORTS (НОВОЕ) ========================

// Получить детальную аналитику по студенту
app.get("/analytics/student/:studentId", async (req, res) => {
  const student = await User.findById(req.params.studentId);
  if (!student) return res.status(404).json({ message: "Студент не найден" });

  const results = await Result.find({ student_id: req.params.studentId });
  const assignments = await Assignment.find({ student_id: req.params.studentId });
  const achievements = await StudentAchievement.find({ student_id: req.params.studentId });

  // Анализ по тестам
  const testStats = {};
  for (const result of results) {
    const test = await Test.findById(result.test_id);
    const testName = test ? test.name : "Неизвестный";
    
    if (!testStats[testName]) {
      testStats[testName] = {
        attempts: 0,
        totalScore: 0,
        bestScore: 0,
        averagePercentage: 0,
        percentages: []
      };
    }

    testStats[testName].attempts += 1;
    testStats[testName].totalScore += result.test_score;
    testStats[testName].percentages.push(result.percentage);
    testStats[testName].bestScore = Math.max(testStats[testName].bestScore, result.percentage);
  }

  // Расчет средних значений
  for (const testName in testStats) {
    const stat = testStats[testName];
    stat.averagePercentage = Math.round(
      stat.percentages.reduce((a, b) => a + b, 0) / stat.percentages.length
    );
  }

  // Анализ прогресса по времени
  const sortedResults = results.sort((a, b) => 
    new Date(a.test_date) - new Date(b.test_date)
  );

  const progressOverTime = sortedResults.map(r => ({
    date: r.test_date,
    percentage: r.percentage,
    score: r.test_score
  }));

  // Статистика по назначениям
  const assignmentStats = {
    total: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    overdue: assignments.filter(a => a.status === 'overdue').length,
    onTimeCompletion: assignments.filter(a => 
      a.status === 'completed' && 
      new Date(a.completed_date) <= new Date(a.deadline)
    ).length
  };

  res.json({
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      totalScore: student.totalScore,
      successRate: student.successRate
    },
    summary: {
      testsCompleted: results.length,
      averagePercentage: student.successRate,
      achievementsEarned: achievements.length
    },
    testStats,
    progressOverTime,
    assignmentStats
  });
});

// Получить аналитику по ментору
app.get("/analytics/mentor/:mentorId", async (req, res) => {
  const mentor = await Mentor.findById(req.params.mentorId);
  if (!mentor) return res.status(404).json({ message: "Ментор не найден" });

  const assignments = await Assignment.find({ mentor_id: req.params.mentorId });
  const results = await Result.find({ mentor_id: req.params.mentorId });

  // Статистика по студентам
  const studentIds = [...new Set(assignments.map(a => a.student_id))];
  const studentsStats = await Promise.all(studentIds.map(async sid => {
    const student = await User.findById(sid);
    const studentResults = results.filter(r => r.student_id === sid);
    const studentAssignments = assignments.filter(a => a.student_id === sid);

    return {
      id: sid,
      name: student ? `${student.firstName} ${student.lastName}` : "Неизвестный",
      testsCompleted: studentResults.length,
      averagePercentage: studentResults.length
        ? Math.round(studentResults.reduce((s, r) => s + r.percentage, 0) / studentResults.length)
        : 0,
      assignmentsCompleted: studentAssignments.filter(a => a.status === 'completed').length,
      assignmentsPending: studentAssignments.filter(a => a.status === 'pending').length,
      assignmentsOverdue: studentAssignments.filter(a => a.status === 'overdue').length
    };
  }));

  // Общая статистика
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter(a => a.status === 'completed').length;
  const completionRate = totalAssignments ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  res.json({
    mentor: {
      id: mentor._id,
      name: `${mentor.firstName} ${mentor.lastName}`
    },
    summary: {
      totalStudents: studentIds.length,
      totalAssignments,
      completedAssignments,
      completionRate,
      averageStudentPercentage: studentsStats.length
        ? Math.round(studentsStats.reduce((s, st) => s + st.averagePercentage, 0) / studentsStats.length)
        : 0
    },
    students: studentsStats
  });
});

// Получить общую статистику системы (для администратора)
app.get("/analytics/system", async (req, res) => {
  const totalStudents = await User.countDocuments();
  const totalMentors = await Mentor.countDocuments();
  const totalTests = await Test.countDocuments();
  const totalResults = await Result.countDocuments();
  const totalAssignments = await Assignment.countDocuments();

  const allResults = await Result.find();
  const averageSystemPercentage = allResults.length
    ? Math.round(allResults.reduce((s, r) => s + r.percentage, 0) / allResults.length)
    : 0;

  const topStudents = await User.find().sort({ totalScore: -1 }).limit(10);

  res.json({
    overview: {
      totalStudents,
      totalMentors,
      totalTests,
      totalResults,
      totalAssignments,
      averageSystemPercentage
    },
    topStudents: topStudents.map(s => ({
      id: s._id,
      name: `${s.firstName} ${s.lastName}`,
      totalScore: s.totalScore,
      successRate: s.successRate
    }))
  });
});

// ======================== STUDY MATERIALS (НОВОЕ) ========================

// НОВАЯ МОДЕЛЬ: Учебные материалы
const StudyMaterial = mongoose.model("StudyMaterial", new mongoose.Schema({
  title: String,
  description: String,
  type: { 
    type: String, 
    enum: ['video', 'document', 'link', 'text'], 
    required: true 
  },
  content: String, // URL или текст
  test_id: String, // связанный тест
  mentor_id: String,
  created_at: { type: Date, default: Date.now }
}));

// Создать учебный материал
app.post("/study-materials", async (req, res) => {
  const { title, description, type, content, test_id, mentor_id } = req.body;

  const material = await StudyMaterial.create({
    title,
    description,
    type,
    content,
    test_id,
    mentor_id
  });

  res.json({ message: "Материал создан", material: { ...material.toObject(), id: material._id } });
});

// Получить все материалы
app.get("/study-materials", async (req, res) => {
  const materials = await StudyMaterial.find();
  res.json(materials.map(m => ({ ...m.toObject(), id: m._id })));
});

// Получить материалы по тесту
app.get("/study-materials/test/:testId", async (req, res) => {
  const materials = await StudyMaterial.find({ test_id: req.params.testId });
  res.json(materials.map(m => ({ ...m.toObject(), id: m._id })));
});

// Удалить материал
app.delete("/study-materials/:id", async (req, res) => {
  const material = await StudyMaterial.findByIdAndDelete(req.params.id);
  if (!material) return res.status(404).json({ message: "Материал не найден" });
  res.json({ message: "Материал удален" });
});

// ======================== LEADERBOARD (НОВОЕ) ========================

// Получить таблицу лидеров по общему баллу
app.get("/leaderboard/score", async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const students = await User.find().sort({ totalScore: -1 }).limit(limit);

  const leaderboard = students.map((s, index) => ({
    rank: index + 1,
    id: s._id,
    name: `${s.firstName} ${s.lastName}`,
    totalScore: s.totalScore,
    successRate: s.successRate
  }));

  res.json(leaderboard);
});

// Получить таблицу лидеров по проценту успеха
app.get("/leaderboard/success-rate", async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const students = await User.find().sort({ successRate: -1 }).limit(limit);

  const leaderboard = students.map((s, index) => ({
    rank: index + 1,
    id: s._id,
    name: `${s.firstName} ${s.lastName}`,
    totalScore: s.totalScore,
    successRate: s.successRate
  }));

  res.json(leaderboard);
});

// Получить позицию студента в таблице лидеров
app.get("/leaderboard/position/:studentId", async (req, res) => {
  const student = await User.findById(req.params.studentId);
  if (!student) return res.status(404).json({ message: "Студент не найден" });

  const allStudents = await User.find().sort({ totalScore: -1 });
  const position = allStudents.findIndex(s => s._id.toString() === req.params.studentId) + 1;

  res.json({
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      totalScore: student.totalScore,
      successRate: student.successRate
    },
    position,
    totalStudents: allStudents.length,
    percentile: Math.round(((allStudents.length - position + 1) / allStudents.length) * 100)
  });
});

// ======================== SERVER START ========================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));