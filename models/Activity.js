const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
    {
        assignmentId: {
            type: Number,
            required: true
        },

        action: {
            type: String,
            required: true
        },

        description: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Activity", activitySchema);