const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "pfps");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.static(__dirname));
app.use("/pfps", express.static(uploadDir));
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  }
});
const upload = multer({ storage });

/* ===============================
   UPLOAD FOR A DATE
   =============================== */
app.post("/upload", upload.array("pfps", 2), (req, res) => {
  const date = req.body.date;
  const files = req.files;

  if (!date || files.length !== 2) {
    return res.status(400).send("Date + exactly 2 images required");
  }

  // delete existing for that date (overwrite)
  fs.readdirSync(uploadDir).forEach(f => {
    if (f.startsWith(date)) {
      fs.unlinkSync(path.join(uploadDir, f));
    }
  });

  files.forEach((file, i) => {
    const ext = path.extname(file.originalname);
    const suffix = i === 0 ? "a" : "b";
    fs.renameSync(
      file.path,
      path.join(uploadDir, `${date}_${suffix}${ext}`)
    );
  });

  res.redirect("/");
});

/* ===============================
   GET TODAY
   =============================== */
app.get("/today", (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const files = fs.readdirSync(uploadDir)
    .filter(f => f.startsWith(today));

  if (files.length !== 2) {
    return res.json({ images: [] });
  }

  res.json({ images: files });
});

/* ===============================
   GET ALL DATES
   =============================== */
app.get("/dates", (req, res) => {
  const dates = new Set();

  fs.readdirSync(uploadDir).forEach(f => {
    const match = f.match(/^(\d{4}-\d{2}-\d{2})_/);
    if (match) dates.add(match[1]);
  });

  res.json([...dates].sort());
});

/* ===============================
   DELETE DATE
   =============================== */
app.post("/delete", (req, res) => {
  const date = req.body.date;

  fs.readdirSync(uploadDir).forEach(f => {
    if (f.startsWith(date)) {
      fs.unlinkSync(path.join(uploadDir, f));
    }
  });

  res.redirect("/");
});

const archiver = require("archiver");

/* ===============================
   DOWNLOAD FOR A DATE
   =============================== */
app.get("/download/:date", (req, res) => {
  const date = req.params.date;

  const files = fs.readdirSync(uploadDir)
    .filter(f => f.startsWith(date + "_"));

  if (files.length !== 2) {
    return res.status(400).send("No PFPs for this date");
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=pfps_${date}.zip`
  );

  const archive = archiver("zip");
  archive.pipe(res);

  files.forEach(file => {
    archive.file(path.join(uploadDir, file), { name: file });
  });

  archive.finalize();
});

app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
});
