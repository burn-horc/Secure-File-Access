const express = require("express");
const {
  checkLoginLock,
  recordFailedLogin,
  clearLoginFailures,
} = require("./middleware/rateLimitLogin");

const app = express();

app.use(express.json());

app.set("trust proxy", 1);

app.post("/login", checkLoginLock, async (req, res) => {
  try {
    const { email, password } = req.body;

    // demo login only
    const isValid =
      email === "admin@example.com" &&
      password === "secret123";

    if (!isValid) {
      await recordFailedLogin(req);

      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    await clearLoginFailures(req);

    return res.json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login route error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
