const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const express = require("express");
const db = require("./db");
const connectMongoDB = require("./mongo");
const Note = require("./models/Note");
const Activity = require("./models/Activity");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: "1mb" }));
connectMongoDB();

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validId = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;
const requiredText = (value, label, max = 255) => {
  if (typeof value !== "string" || !value.trim()) return `${label} is required.`;
  if (value.trim().length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
};
const assignmentError = (body, isUpdate = false) => {
  for (const field of ["title", "deadline", "priority", "subject_id"]) {
    if (body[field] === undefined && isUpdate) continue;
    if (field === "title") { const error = requiredText(body.title, "Title", 150); if (error) return error; }
    if (field === "deadline" && (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline)) || Number.isNaN(Date.parse(body.deadline)))) return "A valid deadline is required (YYYY-MM-DD).";
    if (field === "priority" && !["Low", "Medium", "High"].includes(body.priority)) return "Priority must be Low, Medium, or High.";
    if (field === "subject_id" && !validId(body.subject_id)) return "A valid subject is required.";
  }
  if (body.description !== undefined && typeof body.description !== "string") return "Description must be text.";
  if (body.description?.length > 2000) return "Description must be 2000 characters or fewer.";
  if (body.status !== undefined && !["Pending", "Completed"].includes(body.status)) return "Status must be Pending or Completed.";
  return null;
};
const logActivity = (activity) => Activity.create(activity).catch((error) => console.error("Activity log error:", error.message));

app.get("/", (req, res) => res.send("Study Planner API is running!"));

app.get("/api/assignments", asyncRoute(async (req, res) => {
  const [rows] = await db.promise().query(`
    SELECT assignments.*, subjects.name AS subject_name
    FROM assignments LEFT JOIN subjects ON assignments.subject_id = subjects.id
    ORDER BY assignments.deadline ASC, assignments.id DESC
  `);
  res.json(rows);
}));

app.post("/api/assignments", asyncRoute(async (req, res) => {
  const error = assignmentError(req.body);
  if (error) return res.status(400).json({ message: error });
  const { title, description = "", deadline, priority, status = "Pending", subject_id } = req.body;
  const [result] = await db.promise().query(
    "INSERT INTO assignments (title, description, deadline, priority, status, subject_id) VALUES (?, ?, ?, ?, ?, ?)",
    [title.trim(), description.trim(), deadline, priority, status, Number(subject_id)]
  );
  logActivity({ assignmentId: result.insertId, action: "CREATE", description: `Created assignment: ${title.trim()}` });
  res.status(201).json({ message: "Assignment created successfully", id: result.insertId });
}));

app.put("/api/assignments/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assignment id." });
  const error = assignmentError(req.body, true);
  if (error) return res.status(400).json({ message: error });
  const { title, description = "", deadline, priority, status, subject_id } = req.body;
  const [result] = await db.promise().query(
    "UPDATE assignments SET title = ?, description = ?, deadline = ?, priority = ?, status = ?, subject_id = ? WHERE id = ?",
    [title.trim(), description.trim(), deadline, priority, status || "Pending", Number(subject_id), Number(req.params.id)]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Assignment not found." });
  logActivity({ assignmentId: Number(req.params.id), action: "UPDATE", description: `Updated assignment: ${title.trim()}` });
  res.json({ message: "Assignment updated successfully" });
}));

app.delete("/api/assignments/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assignment id." });
  const [result] = await db.promise().query("DELETE FROM assignments WHERE id = ?", [Number(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ message: "Assignment not found." });
  logActivity({ assignmentId: Number(req.params.id), action: "DELETE", description: `Deleted assignment #${req.params.id}` });
  res.json({ message: "Assignment deleted successfully" });
}));

app.get("/api/subjects", asyncRoute(async (req, res) => {
  const [rows] = await db.promise().query("SELECT * FROM subjects ORDER BY name ASC");
  res.json(rows);
}));

app.post("/api/subjects", asyncRoute(async (req, res) => {
  const error = requiredText(req.body.name, "Subject name", 100);
  if (error) return res.status(400).json({ message: error });
  if (req.body.description !== undefined && typeof req.body.description !== "string") return res.status(400).json({ message: "Description must be text." });
  const description = (req.body.description || "").trim();
  if (description.length > 500) return res.status(400).json({ message: "Description must be 500 characters or fewer." });
  const [result] = await db.promise().query("INSERT INTO subjects (name, description) VALUES (?, ?)", [req.body.name.trim(), description]);
  res.status(201).json({ message: "Subject created successfully", id: result.insertId });
}));

app.put("/api/subjects/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid subject id." });
  const error = requiredText(req.body.name, "Subject name", 100);
  if (error) return res.status(400).json({ message: error });
  if (req.body.description !== undefined && typeof req.body.description !== "string") return res.status(400).json({ message: "Description must be text." });
  const description = (req.body.description || "").trim();
  if (description.length > 500) return res.status(400).json({ message: "Description must be 500 characters or fewer." });
  const [result] = await db.promise().query("UPDATE subjects SET name = ?, description = ? WHERE id = ?", [req.body.name.trim(), description, Number(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ message: "Subject not found." });
  res.json({ message: "Subject updated successfully" });
}));

app.delete("/api/subjects/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid subject id." });
  const [result] = await db.promise().query("DELETE FROM subjects WHERE id = ?", [Number(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ message: "Subject not found." });
  res.json({ message: "Subject deleted successfully" });
}));

app.post("/api/assignments/:id/notes", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assignment id." });
  const error = requiredText(req.body.content, "Note", 1000);
  if (error) return res.status(400).json({ message: error });
  const note = await Note.create({ assignmentId: Number(req.params.id), content: req.body.content.trim() });
  res.status(201).json({ message: "Note created successfully", note });
}));

app.get("/api/assignments/:id/notes", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assignment id." });
  const notes = await Note.find({ assignmentId: Number(req.params.id) }).sort({ createdAt: -1 });
  res.json(notes);
}));

app.delete("/api/assignments/:id/notes/:noteId", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assignment id." });
  const note = await Note.findOneAndDelete({ _id: req.params.noteId, assignmentId: Number(req.params.id) });
  if (!note) return res.status(404).json({ message: "Note not found." });
  res.json({ message: "Note deleted successfully" });
}));



app.get("/api/activities", asyncRoute(async (req, res) => {
  const activities = await Activity.find().sort({ createdAt: -1 }).limit(100);
  res.json(activities);
}));
app.get("/api/mongo-status", (req, res) => {
  res.json({
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    database: mongoose.connection.name || null
  });
});

app.use((req, res) => res.status(404).json({ message: "Endpoint not found." }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("API error:", error.message);
  if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "That subject does not exist. Refresh subjects and try again." });
  if (error.code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ message: "This subject still has assignments. Move or delete those assignments before deleting the subject." });
  if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "A record with those details already exists." });
  if (error.type === "entity.parse.failed") return res.status(400).json({ message: "Request body must be valid JSON." });
  const mongoUnavailable = error.name === "MongooseServerSelectionError" || error.name === "MongoNetworkError" || error.message?.includes("buffering timed out");
  res.status(mongoUnavailable ? 503 : 500).json({ message: mongoUnavailable ? "Notes and activity storage is unavailable. Check the MongoDB connection." : "Something went wrong while processing the request." });
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
