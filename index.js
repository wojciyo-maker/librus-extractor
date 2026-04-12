"use strict";
const Librus = require("librus-api");
const fs = require("fs");

// Clear previous results file
fs.writeFileSync("librus-result.md", "# Librus API Results\n\n");

// Helper function to write results to file
function logToFile(label, data) {
  const content = `## ${label}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
  fs.appendFileSync("librus-result.md", content);
}

let client = new Librus();
client.authorize("9301986", "H3l3na_lu81_c0l3").then(function () {
  // Send message to User 648158
  client.inbox.sendMessage(648158, "title", "body").then(
    () => {
      logToFile("Send Message", { status: "success" });
    },
    (error) => {
      logToFile("Send Message Error", { error: error.message });
    }
  );

  // Remove message with id 4534535
  client.inbox.removeMessage(4534535).then(
    () => {
      logToFile("Remove Message", { status: "success" });
    },
    (error) => {
      logToFile("Remove Message Error", { error: error.message });
    }
  );

  // List receivers
  client.inbox.listReceivers("nauczyciel").then((data) => { logToFile("Receivers", data); });

  // List announcements
  client.inbox.listAnnouncements().then((data) => { logToFile("Announcements", data); });

  // List all e-mails in folder(5) in page(2)
  client.inbox.listInbox(5).then((data) => { logToFile("Inbox", data); });

  // Get message with id 2133726 in folder 6
  client.inbox.getMessage(6, 2133726).then((data) => { logToFile("Message", data); });

  // Get attachments from message with id 181186 in folder 5
  client.inbox.getMessage(5, 181186).then((data) => {
    if (data && data.files && Array.isArray(data.files)) {
      for (let f of data.files) {
        client.inbox
          .getFile(f.path)
          .then((response) => response.pipe(fs.createWriteStream(f.name)));
      }
    }
  });

  // List all subjects
  client.homework.listSubjects().then((data) => { logToFile("Subjects", data); });

  // List subject homeworks, -1||undefined all
  client.homework.listHomework(24374).then((list) => { logToFile("Homeworks", list); });

  // Download homework description
  client.homework.getHomework(257478).then((data) => { logToFile("Homework Info", data); });

  // Get all absences
  client.absence.getAbsences().then((data) => { logToFile("Absences", data); });

  // Get info about absence
  client.absence.getAbsence(5068489).then((data) => { logToFile("Absence Info", data); });

  // Get timetable
  client.calendar.getTimetable().then((data) => { logToFile("Timetable", data); });

  // Get calendar
  client.calendar.getCalendar().then((data) => { logToFile("Calendar", data); });

  // Get event
  client.calendar.getEvent(4242342).then((data) => { logToFile("Event", data); });

  // Get grades
  client.info.getGrades().then((data) => { logToFile("Grades", data); });

  // Get grade
  client.info.getGrade(23424234).then((data) => { logToFile("Grade Info", data); });

  // Get scoring grade
  client.info.getPointGrade(234242234).then((data) => { logToFile("Point Grade", data); });

  // Get name, surname and other account info
  client.info.getAccountInfo().then((data) => { logToFile("Account Info", data); }).catch((error) => { logToFile("Account Info Error", { error: error.message }); });

  // Get lucky number
  client.info.getLuckyNumber().then((data) => { logToFile("Lucky Number", data); });

  // Get notifications
  client.info.getNotifications().then((data) => { logToFile("Notifications", data); });
});