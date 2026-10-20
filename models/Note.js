const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
    {
        assignmentId: {
            type: Number,
            required: true
        },

        content: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Note", noteSchema);