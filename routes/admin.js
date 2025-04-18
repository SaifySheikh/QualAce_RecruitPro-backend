const express = require("express");
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const AssignedLead = require("../models/AssignedLead");
const Lead=require("../models/Lead");
const User=require("../models/User");

const router = express.Router();


// POST /api/admin/send-task
router.post("/send-task", async (req, res) => {
  const { recruiterId, leadId } = req.body;

  if (!recruiterId || !leadId) {
    return res.status(400).json({ success: false, message: "Missing recruiterId or leadId" });
  }

  try {
    const user = await User.findOne({ recruiterId });

    if (!user) return res.status(404).json({ success: false, message: "Recruiter not found" });

    const lead = await Lead.findOne({ lead_id: leadId });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    if (user.adminAssignedTasks.includes(lead._id)) {
      return res.status(409).json({ success: false, message: "Lead already assigned to this recruiter" });
    }

    user.adminAssignedTasks.push(lead._id);
    user.assignedLeads.push(lead._id);
    user.inActiveLeads.push(lead._id);
    await user.save();

    lead.assigned_to = recruiterId;
    // Move lead to assigned_leads schema
    const assignedLead = new AssignedLead(lead.toObject());
    await assignedLead.save();

    // Remove the lead from the leads collection
    await Lead.deleteOne({ _id: lead._id });


    res.status(200).json({ success: true, message: "Task assigned to recruiter" });
  } catch (error) {
    console.error("Send task error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// POST /api/admin/search-leads
router.post("/search-leads", async (req, res) => {
  const { searchCriteria, searchValue } = req.body;

  if (!searchCriteria || !searchValue) {
    return res.status(400).json({ message: "Missing search criteria or value" });
  }

  try {
    let query = {};

    // Handle boolean fields
    if (["is_interested", "is_onboarded"].includes(searchCriteria)) {
      query[searchCriteria] = searchValue.toLowerCase() === "yes";
    }
    // Regex for partial matches
    else if (["candidate_name", "email", "job_city", "company_name", "category"].includes(searchCriteria)) {
      query[searchCriteria] = { $regex: searchValue, $options: "i" };
    }
    // Exact match for others
    else {
      query[searchCriteria] = searchValue;
    }

    // Search in both AssignedLead and Lead
    const [assignedLeads, pendingLeads] = await Promise.all([
      AssignedLead.find(query),
      Lead.find(query)
    ]);

    const combinedResults = [...assignedLeads, ...pendingLeads];

    res.status(200).json(combinedResults);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    res.status(200).json({ message: "✅Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating password" });
  }
});

module.exports = router;
