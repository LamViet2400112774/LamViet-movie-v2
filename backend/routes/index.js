const express = require("express");
const axios = require("axios");
const router = express.Router();

const BASE = "https://phimapi.com";

router.get("/latest", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const { data } = await axios.get(`${BASE}/danh-sach/phim-moi-cap-nhat-v3?page=${page}`);
    res.json(data);
  } catch (err) {
    console.error("Error fetching latest:", err.message);
    res.status(500).json({ error: "Failed to fetch latest movies" });
  }
});

router.get("/movie/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { data } = await axios.get(`${BASE}/phim/${slug}`);
    res.json(data);
  } catch (err) {
    console.error("Error fetching movie:", err.message);
    res.status(500).json({ error: "Failed to fetch movie" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { keyword, page = 1 } = req.query;
    const { data } = await axios.get(`${BASE}/v1/api/tim-kiem?keyword=${keyword}&page=${page}`);
    res.json(data);
  } catch (err) {
    console.error("Error searching:", err.message);
    res.status(500).json({ error: "Failed to search movies" });
  }
});

// Proxy cho danh sách thể loại
router.get("/the-loai", async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE}/the-loai`);
    res.json(data);
  } catch (err) {
    console.error("Error fetching categories:", err.message);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Proxy cho phim theo thể loại
router.get("/the-loai/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${BASE}/v1/api/the-loai/${slug}${queryString ? '?' + queryString : ''}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    console.error("Error fetching by category:", err.message);
    res.status(500).json({ error: "Failed to fetch movies by category" });
  }
});

// Proxy cho danh sách quốc gia
router.get("/quoc-gia", async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE}/quoc-gia`);
    res.json(data);
  } catch (err) {
    console.error("Error fetching countries:", err.message);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

// Proxy cho phim theo quốc gia
router.get("/quoc-gia/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${BASE}/v1/api/quoc-gia/${slug}${queryString ? '?' + queryString : ''}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    console.error("Error fetching by country:", err.message);
    res.status(500).json({ error: "Failed to fetch movies by country" });
  }
});

// Proxy cho phim theo năm
router.get("/danh-sach/nam/:year", async (req, res) => {
  try {
    const { year } = req.params;
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${BASE}/v1/api/nam/${year}${queryString ? '?' + queryString : ''}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    console.error("Error fetching by year:", err.message);
    res.status(500).json({ error: "Failed to fetch movies by year" });
  }
});

// Proxy cho danh sách phim theo loại (phim-le, phim-bo, etc.)
router.get("/danh-sach/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${BASE}/v1/api/danh-sach/${type}${queryString ? '?' + queryString : ''}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    console.error("Error fetching list:", err.message);
    res.status(500).json({ error: "Failed to fetch movie list" });
  }
});

module.exports = router;