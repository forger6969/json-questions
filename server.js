const express = require("express");
const cors = require("cors");
const fs = require("fs");
const app = express();

app.use(cors());
app.use(express.json());

// ====== HELPERS ======
const loadDB = () => {
  const data = fs.readFileSync("./db.json", "utf-8");
  return JSON.parse(data);
};

const saveDB = (data) => {
  fs.writeFileSync("./db.json", JSON.stringify(data, null, 2));
};

// ====== ТЕСТЫ ======

// Получить список всех тестов (без вопросов)
app.get("/tests", (req, res) => {
  const db = loadDB();
  const testList = db.tests.map(test => ({
    id: test.id,
    name: test.name,
    description: test.description,
    maxScore: test.maxScore,
    questionCount: test.questions.length
  }));
  res.json(testList);
});

// Получить конкретный тест по ID (со всеми вопросами)
app.get("/tests/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const test = db.tests.find(t => t.id === id);
  
  if (!test) {
    return res.status(404).json({ message: "Тест не найден" });
  }
  
  res.json(test);
});

// Создать новый тест (для администратора)
app.post("/tests", (req, res) => {
  const { name, description, questions } = req.body;
  const db = loadDB();
  
  const maxScore = questions.reduce((sum, q) => sum + q.score, 0);
  
  const newTest = {
    id: Date.now().toString(36),
    name,
    description,
    maxScore,
    questions
  };
  
  db.tests.push(newTest);
  saveDB(db);
  
  res.json({ message: "Тест создан", test: newTest });
});

// Удалить тест
app.delete("/tests/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  
  const index = db.tests.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Тест не найден" });
  }
  
  db.tests.splice(index, 1);
  saveDB(db);
  
  res.json({ message: "Тест удален" });
});

// ====== ПОЛЬЗОВАТЕЛИ (СТУДЕНТЫ) ======

// Получить всех студентов
app.get("/users", (req, res) => {
  const db = loadDB();
  res.json(db.users);
});

// Получить студента по ID
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const user = db.users.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ message: "Студент не найден" });
  }
  
  res.json(user);
});

// Создать нового студента
app.post("/users", (req, res) => {
  const { firstName, lastName, login, password } = req.body;
  const db = loadDB();
  
  // Проверка на существующий логин
  const exists = db.users.find(u => u.login === login);
  if (exists) {
    return res.status(400).json({ message: "Логин уже занят" });
  }
  
  const newUser = {
    id: Date.now().toString(36),
    firstName,
    lastName,
    login,
    password,
    totalScore: 0
  };
  
  db.users.push(newUser);
  saveDB(db);
  
  res.json({ message: "Студент создан", user: newUser });
});

// Обновить общий балл студента
app.patch("/users/:id/score", (req, res) => {
  const { id } = req.params;
  const { scoreToAdd } = req.body;
  const db = loadDB();
  
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ message: "Студент не найден" });
  }
  
  user.totalScore += scoreToAdd;
  saveDB(db);
  
  res.json({ message: "Балл обновлен", newTotal: user.totalScore });
});

// Удалить студента
app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Студент не найден" });
  }
  
  db.users.splice(index, 1);
  saveDB(db);
  
  res.json({ message: "Студент удален" });
});

// ====== МЕНТОРЫ ======

// Получить всех менторов
app.get("/mentors", (req, res) => {
  const db = loadDB();
  res.json(db.mentors);
});

// Получить ментора по ID
app.get("/mentors/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const mentor = db.mentors.find(m => m.id === id);
  
  if (!mentor) {
    return res.status(404).json({ message: "Ментор не найден" });
  }
  
  res.json(mentor);
});

// Создать нового ментора
app.post("/mentors", (req, res) => {
  const { firstName, lastName, login, password } = req.body;
  const db = loadDB();
  
  const exists = db.mentors.find(m => m.login === login);
  if (exists) {
    return res.status(400).json({ message: "Логин уже занят" });
  }
  
  const newMentor = {
    id: Date.now().toString(36),
    firstName,
    lastName,
    login,
    password
  };
  
  db.mentors.push(newMentor);
  saveDB(db);
  
  res.json({ message: "Ментор создан", mentor: newMentor });
});

// ====== АВТОРИЗАЦИЯ ======

// Логин студента
app.post("/login/user", (req, res) => {
  const { login, password } = req.body;
  const db = loadDB();
  
  const user = db.users.find(
    u => u.login === login && u.password == password
  );
  
  if (!user) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }
  
  res.json({ 
    message: "success", 
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      login: user.login,
      totalScore: user.totalScore
    }
  });
});

// Логин ментора
app.post("/login/mentor", (req, res) => {
  const { login, password } = req.body;
  const db = loadDB();
  
  const mentor = db.mentors.find(
    m => m.login === login && m.password == password
  );
  
  if (!mentor) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }
  
  res.json({ 
    message: "success", 
    mentor: {
      id: mentor.id,
      firstName: mentor.firstName,
      lastName: mentor.lastName,
      login: mentor.login
    }
  });
});

// ====== РЕЗУЛЬТАТЫ ТЕСТОВ ======

// Получить все результаты
app.get("/results", (req, res) => {
  const db = loadDB();
  res.json(db.test_results);
});

// Получить результаты студента
app.get("/results/student/:studentId", (req, res) => {
  const { studentId } = req.params;
  const db = loadDB();
  
  const results = db.test_results.filter(r => r.student_id === studentId);
  
  // Добавляем информацию о тестах
  const enrichedResults = results.map(result => {
    const test = db.tests.find(t => t.id === result.test_id);
    return {
      ...result,
      test_name: test ? test.name : "Неизвестный тест"
    };
  });
  
  res.json(enrichedResults);
});

// Получить результаты по конкретному тесту
app.get("/results/test/:testId", (req, res) => {
  const { testId } = req.params;
  const db = loadDB();
  
  const results = db.test_results.filter(r => r.test_id === testId);
  
  // Добавляем информацию о студентах
  const enrichedResults = results.map(result => {
    const student = db.users.find(u => u.id === result.student_id);
    return {
      ...result,
      student_name: student ? `${student.firstName} ${student.lastName}` : "Неизвестный"
    };
  });
  
  res.json(enrichedResults);
});

// Добавить результат теста
app.post("/results", (req, res) => {
  const { student_id, mentor_id, test_id, test_score, test_max_score } = req.body;
  const db = loadDB();
  
  // Проверяем существование студента
  const student = db.users.find(u => u.id === student_id);
  if (!student) {
    return res.status(404).json({ message: "Студент не найден" });
  }
  
  // Проверяем существование теста
  const test = db.tests.find(t => t.id === test_id);
  if (!test) {
    return res.status(404).json({ message: "Тест не найден" });
  }
  
  const percentage = Math.round((test_score / test_max_score) * 100);
  
  const newResult = {
    id: Date.now().toString(36),
    student_id,
    mentor_id,
    test_id,
    test_score,
    test_max_score,
    test_date: new Date().toISOString(),
    percentage
  };
  
  db.test_results.push(newResult);
  saveDB(db);
  
  res.json({ 
    message: "Результат сохранен", 
    result: newResult 
  });
});

// Удалить результат
app.delete("/results/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  
  const index = db.test_results.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Результат не найден" });
  }
  
  db.test_results.splice(index, 1);
  saveDB(db);
  
  res.json({ message: "Результат удален" });
});

// ====== СТАТИСТИКА ======

// Статистика студента
app.get("/stats/student/:studentId", (req, res) => {
  const { studentId } = req.params;
  const db = loadDB();
  
  const student = db.users.find(u => u.id === studentId);
  if (!student) {
    return res.status(404).json({ message: "Студент не найден" });
  }
  
  const results = db.test_results.filter(r => r.student_id === studentId);
  
  const stats = {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      totalScore: student.totalScore
    },
    testsCompleted: results.length,
    averagePercentage: results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
      : 0,
    results: results.map(r => {
      const test = db.tests.find(t => t.id === r.test_id);
      return {
        test_name: test ? test.name : "Неизвестный тест",
        score: r.test_score,
        max_score: r.test_max_score,
        percentage: r.percentage,
        date: r.test_date
      };
    })
  };
  
  res.json(stats);
});

// Статистика по тесту
app.get("/stats/test/:testId", (req, res) => {
  const { testId } = req.params;
  const db = loadDB();
  
  const test = db.tests.find(t => t.id === testId);
  if (!test) {
    return res.status(404).json({ message: "Тест не найден" });
  }
  
  const results = db.test_results.filter(r => r.test_id === testId);
  
  const stats = {
    test: {
      id: test.id,
      name: test.name,
      maxScore: test.maxScore,
      questionCount: test.questions.length
    },
    completedBy: results.length,
    averageScore: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.test_score, 0) / results.length)
      : 0,
    averagePercentage: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
      : 0,
    topStudents: results
      .map(r => {
        const student = db.users.find(u => u.id === r.student_id);
        return {
          name: student ? `${student.firstName} ${student.lastName}` : "Неизвестный",
          score: r.test_score,
          percentage: r.percentage,
          date: r.test_date
        };
      })
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10)
  };
  
  res.json(stats);
});

// ====== ОБЩАЯ СТАТИСТИКА ======
app.get("/stats/general", (req, res) => {
  const db = loadDB();
  
  const stats = {
    totalStudents: db.users.length,
    totalMentors: db.mentors.length,
    totalTests: db.tests.length,
    totalResults: db.test_results.length,
    averagePercentage: db.test_results.length > 0
      ? Math.round(db.test_results.reduce((sum, r) => sum + r.percentage, 0) / db.test_results.length)
      : 0
  };
  
  res.json(stats);
});

// ====== ЗАПУСК СЕРВЕРА ======
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📚 API endpoints:`);
  console.log(`   GET    /tests - Список всех тестов`);
  console.log(`   GET    /tests/:id - Конкретный тест`);
  console.log(`   GET    /users - Все студенты`);
  console.log(`   GET    /mentors - Все менторы`);
  console.log(`   POST   /login/user - Логин студента`);
  console.log(`   POST   /login/mentor - Логин ментора`);
  console.log(`   GET    /results - Все результаты`);
  console.log(`   POST   /results - Добавить результат`);
  console.log(`   GET    /stats/student/:id - Статистика студента`);
  console.log(`   GET    /stats/test/:id - Статистика теста`);
  console.log(`   GET    /stats/general - Общая статистика`);
});