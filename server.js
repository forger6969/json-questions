const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// Загружаем базу
const loadDB = () => {
    const data = fs.readFileSync("./db.json", "utf-8");
    return JSON.parse(data);
};

// Сохраняем базу
const saveDB = (data) => {
    fs.writeFileSync("./db.json", JSON.stringify(data, null, 4));
};

// ====== ROUTES ======

// Получить все React вопросы
app.get("/react-questions", (req, res) => {
    const db = loadDB();
    res.json(db.reactQuests);
});

// Получить все JavaScript вопросы
app.get("/js-questions", (req, res) => {
    const db = loadDB();
    res.json(db.JavaScriptQuestions);
});

// Все студенты
app.get("/users", (req, res) => {
    const db = loadDB();
    res.json(db.users);
});

// Все менторы
app.get("/mentors", (req, res) => {
    const db = loadDB();
    res.json(db.mentors);
});

// Все результаты
app.get("/results", (req, res) => {
    const db = loadDB();
    res.json(db.test_results);
});

// ====== LOGIN USER ======
app.post("/login/user", (req, res) => {
    const { login, password } = req.body;

    const db = loadDB();
    const user = db.users.find(
        u => u.login === login && u.password == password
    );

    if (!user) return res.status(400).json({ message: "User not found" });

    res.json({ message: "success", user });
});

// ====== LOGIN MENTOR ======
app.post("/login/mentor", (req, res) => {
    const { login, password } = req.body;

    const db = loadDB();
    const mentor = db.mentors.find(
        m => m.login === login && m.password == password
    );

    if (!mentor) return res.status(400).json({ message: "Mentor not found" });

    res.json({ message: "success", mentor });
});

// ====== UPDATE USER SCORE ======
app.post("/update-score", (req, res) => {
    const { userId, scoreToAdd } = req.body;

    const db = loadDB();
    const user = db.users.find(u => u.id === userId);

    if (!user) return res.status(400).json({ message: "User not found" });

    user.totalScore += scoreToAdd;

    saveDB(db);

    res.json({ message: "score updated", newTotal: user.totalScore });
});

// ====== ADD TEST RESULT ======
app.post("/add-test-result", (req, res) => {
    const { student_id, mentor_id, test_score, test_max_score } = req.body;

    const db = loadDB();

    const newResult = {
        id: Date.now().toString(36),
        student_id,
        mentor_id,
        test_score,
        test_max_score
    };

    db.test_results.push(newResult);
    saveDB(db);

    res.json({ message: "added", result: newResult });
});

// ====== START SERVER ======
const PORT = 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));