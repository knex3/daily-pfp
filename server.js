const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// folder to store pfps
const uploadDir = path.join(__dirname, "pfps");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer temp storage
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    // temporary name, we rename later
    cb(null, Date.now() + "_" + file.originalname);
  }
});

const upload = multer({ storage });

app.use(express.static(__dirname));
app.use("/pfps", express.static(uploadDir));

/* ===============================
   UPLOAD ROUTE (AUTO PAIR)
   =============================== */
app.post("/upload", upload.array("pfps", 2), (req, res) => {
  const files = req.files;

  // must upload exactly 2 images
  if (!files || files.length !== 2) {
    return res.status(400).send("Upload exactly 2 images.");
  }

  // count existing pairs
  const existingFiles = fs.readdirSync(uploadDir);
  const pairCount = Math.floor(existingFiles.length / 2) + 1;
  const pairId = String(pairCount).padStart(3, "0");

  const ext1 = path.extname(files[0].originalname);
  const ext2 = path.extname(files[1].originalname);

  // rename to locked pair names
  fs.renameSync(
    files[0].path,
    path.join(uploadDir, `pair_${pairId}_a${ext1}`)
  );

  fs.renameSync(
    files[1].path,
    path.join(uploadDir, `pair_${pairId}_b${ext2}`)
  );

  res.redirect("/");
});

/* ===============================
   TODAY'S MATCHING PAIR
   =============================== */
app.get("/today", (req, res) => {
  const files = fs.readdirSync(uploadDir).sort();

  if (files.length < 2) {
    return res.json({ images: [] });
  }

  // group into pairs based on filename
  const pairMap = {};
  files.forEach(file => {
    const match = file.match(/pair_(\d+)_([ab])/);
    if (!match) return;

    const id = match[1];
    if (!pairMap[id]) pairMap[id] = [];
    pairMap[id].push(file);
  });

  const pairs = Object.values(pairMap).filter(p => p.length === 2);
  if (!pairs.length) return res.json({ images: [] });

  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const todayPair = pairs[day % pairs.length];

  res.json({ images: todayPair });
});

const archiver = require("archiver");

app.get("/download", (req, res) => {
  const files = fs.readdirSync(uploadDir).sort();

  if (files.length < 2) {
    return res.status(400).send("No pairs available");
  }

  // group files into pairs
  const pairMap = {};
  files.forEach(file => {
    const match = file.match(/pair_(\d+)_([ab])/);
    if (!match) return;
    const id = match[1];
    if (!pairMap[id]) pairMap[id] = [];
    pairMap[id].push(file);
  });

  const pairs = Object.values(pairMap).filter(p => p.length === 2);
  if (!pairs.length) return res.status(400).send("No pairs found");

  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const todayPair = pairs[day % pairs.length];

  const today = new Date().toISOString().split("T")[0];
  res.setHeader("Content-Disposition", `attachment; filename=matching_pfps_${today}.zip`);

  const archive = archiver("zip");
  archive.pipe(res);

  todayPair.forEach(file => {
    archive.file(path.join(uploadDir, file), { name: file });
  });

  archive.finalize();
});

app.listen(PORT, () => {
  console.log("const PORT = process.env.PORT || 3000;");
});

