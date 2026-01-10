const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.addCalendarEvent = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const token = functions.config().etta && functions.config().etta.token;
  const provided = req.get("x-etta-token");
  if (!token || provided !== token) {
    res.status(401).send("Unauthorized");
    return;
  }

  const {
    uid,
    title,
    startDate,
    endDate,
    start,
    end,
    notes,
    color,
  } = req.body || {};

  if (!uid || !title || !startDate) {
    res.status(400).send("Missing fields");
    return;
  }

  const id = admin.firestore().collection("_").doc().id;
  await admin
    .firestore()
    .collection("users")
    .doc(uid)
    .collection("events")
    .doc(id)
    .set({
      id,
      title,
      startDate,
      endDate: endDate || startDate,
      start: start || "",
      end: end || "",
      notes: notes || "",
      color: color || "#00b5d9",
      createdAt: Date.now(),
    });

  res.json({ ok: true, id });
});
