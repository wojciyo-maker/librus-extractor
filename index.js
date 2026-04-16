"use strict";
const Librus = require("librus-api");
const fs = require("fs");
const { getDb } = require("./server/db");

// Clear previous results file
fs.writeFileSync("data/librus-result.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<LibrusResults>\n');

// Helper function to escape XML special characters
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Helper function to convert a value to XML
function toXml(value, indent) {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return value.map((item) => `${pad}<item>${toXml(item, indent + 1)}${pad}</item>`).join("\n");
  }
  if (typeof value === "object") {
    return "\n" + Object.entries(value).map(([k, v]) => {
      const tag = escapeXml(k);
      const inner = toXml(v, indent + 1);
      const hasChildren = typeof v === "object" && v !== null;
      return hasChildren
        ? `${pad}  <${tag}>${inner}${pad}  </${tag}>`
        : `${pad}  <${tag}>${escapeXml(inner)}</${tag}>`;
    }).join("\n") + "\n";
  }
  return escapeXml(value);
}

// Helper function to write results to file
function logToFile(label, data) {
  const tag = label.replace(/\s+/g, "_");
  const content = `  <${tag}>${toXml(data, 1)}  </${tag}>\n`;
  fs.appendFileSync("data/librus-result.xml", content);
}

// Finalize XML file on process exit
process.on("exit", () => {
  fs.appendFileSync("data/librus-result.xml", "</LibrusResults>\n");
});

const db = getDb();
const cfg = db.prepare("SELECT active_user_id FROM app_config WHERE id = 1").get();
const activeId = cfg && cfg.active_user_id;
const creds = activeId
  ? db.prepare("SELECT username, password FROM secrets WHERE id = ?").get(activeId)
  : db.prepare("SELECT username, password FROM secrets ORDER BY id LIMIT 1").get();
if (!creds) {
  console.error("No credentials found in secrets table.");
  process.exit(1);
}

let client = new Librus();
client.authorize(creds.username, creds.password).then(function () {
  const logError = (label) => (error) => logToFile(label, { error: error.message });

  // Send message and remove must run first (serialized) because they mutate CSRF state
  // on the shared session, which breaks concurrent CSRF-sensitive calls like listReceivers.
  Promise.all([
    client.inbox.sendMessage(648158, "title", "body")
      .then(() => { logToFile("Send Message", { status: "success" }); })
      .catch(logError("Send Message Error")),
    client.inbox.removeMessage(4534535)
      .then(() => { logToFile("Remove Message", { status: "success" }); })
      .catch(logError("Remove Message Error")),
  ]);

  // List receivers
  client.inbox.listReceivers("nauczyciel").then((data) => { logToFile("Receivers", data); }).catch(logError("Receivers Error"));

  // List announcements
  client.inbox.listAnnouncements().then((data) => { logToFile("Announcements", data); }).catch(logError("Announcements Error"));

  // List all e-mails in folder(5) in page(2)
  client.inbox.listInbox(5).then((data) => { logToFile("Inbox", data); }).catch(logError("Inbox Error"));

  // Get message with id 2133726 in folder 6
  client.inbox.getMessage(6, 2133726).then((data) => { logToFile("Message", data); }).catch(logError("Message Error"));

  // Get attachments from message with id 181186 in folder 5
  client.inbox.getMessage(5, 181186).then((data) => {
    if (data && data.files && Array.isArray(data.files)) {
      for (let f of data.files) {
        client.inbox
          .getFile(f.path)
          .then((response) => response.pipe(fs.createWriteStream(f.name)));
      }
    }
  }).catch(logError("Attachments Error"));

  // List all subjects
  client.homework.listSubjects().then((data) => { logToFile("Subjects", data); }).catch(logError("Subjects Error"));

  // List subject homeworks, -1||undefined all
  client.homework.listHomework(24374).then((list) => { logToFile("Homeworks", list); }).catch(logError("Homeworks Error"));

  // Download homework description
  client.homework.getHomework(257478).then((data) => { logToFile("Homework Info", data); }).catch(logError("Homework Info Error"));

  // Get all absences
  client.absence.getAbsences().then((data) => { logToFile("Absences", data); }).catch(logError("Absences Error"));

  // Get info about absence
  client.absence.getAbsence(5068489).then((data) => { logToFile("Absence Info", data); }).catch(logError("Absence Info Error"));

  // Get timetable
  client.calendar.getTimetable().then((data) => { logToFile("Timetable", data); }).catch(logError("Timetable Error"));

  // Get calendar
  client.calendar.getCalendar().then((data) => { logToFile("Calendar", data); }).catch(logError("Calendar Error"));

  // Get event
  client.calendar.getEvent(4242342).then((data) => { logToFile("Event", data); }).catch(logError("Event Error"));

  // Get grades
  client.info.getGrades().then((data) => { logToFile("Grades", data); }).catch(logError("Grades Error"));

  // Get grade
  client.info.getGrade(23424234).then((data) => { logToFile("Grade Info", data); }).catch(logError("Grade Info Error"));

  // Get scoring grade
  client.info.getPointGrade(234242234).then((data) => { logToFile("Point Grade", data); }).catch(logError("Point Grade Error"));

  // Get name, surname and other account info
  client.info.getAccountInfo().then((data) => { logToFile("Account Info", data); }).catch(logError("Account Info Error"));

  // Get lucky number
  client.info.getLuckyNumber().then((data) => { logToFile("Lucky Number", data); }).catch(logError("Lucky Number Error"));

  // Get notifications
  client.info.getNotifications().then((data) => { logToFile("Notifications", data); }).catch(logError("Notifications Error"));
});