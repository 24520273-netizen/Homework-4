
require("dotenv").config();
const cors = require("cors");
const express = require("express");
const db = require("./db");
const connectMongoDB = require("./mongo");
const Note = require("./models/Note");
const Activity = require("./models/Activity");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
connectMongoDB();
app.get("/", (req, res) => {
    res.send("Study Planner API is running!");
});

app.get("/api/assignments", (req, res) => {
    const sql = `
        SELECT assignments.*, subjects.name AS subject_name
        FROM assignments
        LEFT JOIN subjects
        ON assignments.subject_id = subjects.id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        res.json(results);
    });
});

  app.post("/api/assignments", (req, res) => {
    const {
        title,
        description,
        deadline,
        priority,
        status,
        subject_id
    } = req.body;

    const sql = `
        INSERT INTO assignments
        (title, description, deadline, priority, status, subject_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title,
            description,
            deadline,
            priority,
            status || "Pending",
            subject_id
        ],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Database error"
                });
            }

            const assignmentId = result.insertId;

            Activity.create({
                assignmentId: assignmentId,
                action: "CREATE",
                description: `Created assignment: ${title}`
            }).catch(err =>
                console.error("Activity log error:", err)
            );

            res.status(201).json({
                message: "Assignment created successfully",
                id: assignmentId
            });
        }
    );
});
app.put("/api/assignments/:id", (req, res) => {
    const { id } = req.params;

    const {
        title,
        description,
        deadline,
        priority,
        status,
        subject_id
    } = req.body;

    const sql = `
        UPDATE assignments
        SET title = ?,
            description = ?,
            deadline = ?,
            priority = ?,
            status = ?,
            subject_id = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            title,
            description,
            deadline,
            priority,
            status,
            subject_id,
            id
        ],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Database error"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Assignment not found"
                });
            }
            Activity.create({
    assignmentId: Number(id),
    action: "UPDATE",
    description: `Updated assignment: ${title}`
}).catch(err => console.error("Activity log error:", err));

            res.json({
                message: "Assignment updated successfully"
            });
        }
    );
});
app.delete("/api/assignments/:id", (req, res) => {
    const { id } = req.params;

    const sql = `
        DELETE FROM assignments
        WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Assignment not found"
            });
        }
Activity.create({
    assignmentId: Number(id),
    action: "DELETE",
    description: `Deleted assignment #${id}`
}).catch(err => console.error("Activity log error:", err));
        res.json({
            message: "Assignment deleted successfully"
        });
    });
});

// =========================
// SUBJECTS
// =========================

// GET all subjects
app.get("/api/subjects", (req, res) => {
    const sql = "SELECT * FROM subjects";

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        res.json(results);
    });
});

// POST new subject
app.post("/api/subjects", (req, res) => {
    const { name, description } = req.body;

    const sql = `
        INSERT INTO subjects (name, description)
        VALUES (?, ?)
    `;

    db.query(sql, [name, description], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        res.status(201).json({
            message: "Subject created successfully",
            id: result.insertId
        });
    });
});

// PUT update subject
app.put("/api/subjects/:id", (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    const sql = `
        UPDATE subjects
        SET name = ?, description = ?
        WHERE id = ?
    `;

    db.query(sql, [name, description, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Subject not found"
            });
        }

        res.json({
            message: "Subject updated successfully"
        });
    });
});

// DELETE subject
app.delete("/api/subjects/:id", (req, res) => {
    const { id } = req.params;

    const sql = `
        DELETE FROM subjects
        WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Subject not found"
            });
        }

        res.json({
            message: "Subject deleted successfully"
        });
    });
});

app.post("/api/assignments/:id/notes", async (req, res) => {
    try {
        const assignmentId = Number(req.params.id);
        const { content } = req.body;

        const note = new Note({
            assignmentId,
            content
        });

        await note.save();

        res.status(201).json({
            message: "Note created successfully",
            note
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "MongoDB error"
        });
    }
});

app.get("/api/assignments/:id/notes", async (req, res) => {
    try {
        const assignmentId = Number(req.params.id);

        const notes = await Note.find({
            assignmentId: assignmentId
        });

        res.json(notes);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "MongoDB error"
        });
    }
});
app.delete("/api/assignments/:id/notes/:noteId", async (req, res) => {
    try {
        const assignmentId = Number(req.params.id);
        const noteId = req.params.noteId;

        const note = await Note.findOneAndDelete({
            _id: noteId,
            assignmentId: assignmentId
        });

        if (!note) {
            return res.status(404).json({
                message: "Note not found"
            });
        }

        res.json({
            message: "Note deleted successfully"
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "MongoDB error"
        });
    }
});

app.get("/api/activities", async (req, res) => {
    try {
        const activities = await Activity.find()
            .sort({ createdAt: -1 });

        res.json(activities);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "MongoDB error"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});