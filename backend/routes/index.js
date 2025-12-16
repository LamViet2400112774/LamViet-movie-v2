const express = require("express");
const axios = require("axios");
const router = express.Router();

const BASE = "https://phimapi.com";

router.get("/latest", async (req, res) => {
  const page = req.query.page || 1;
  const { data } = await axios.get(`${BASE}/danh-sach/phim-moi-cap-nhat-v3?page=${page}`);
  res.json(data);
});

router.get("/movie/:slug", async (req, res) => {
  const { slug } = req.params;
  const { data } = await axios.get(`${BASE}/phim/${slug}`);
  res.json(data);
});

router.get("/search", async (req, res) => {
  const { keyword, page = 1 } = req.query;
  const { data } = await axios.get(`${BASE}/v1/api/tim-kiem?keyword=${keyword}&page=${page}`);
  res.json(data);
});

module.exports = router;