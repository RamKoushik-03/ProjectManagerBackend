const mongoose = require('mongoose');
 require('../models/User'); // Assuming you have a User model
 require('../models/Task'); // Assuming you have a Task model
const { Schema } = mongoose;
const noticeSchema = new Schema(
  {
    team: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    text: { type: String },
    task: { type: Schema.Types.ObjectId, ref: 'Task' },
    notiType: { type: String, default: 'alert', enum: ['alert', 'message','task_update'] },
    isRead: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notice', noticeSchema);
