const mockResult = {
  success: true,
  testMode: true,
  results: [
    {
      valid: true,
      plan: "Premium Test Account",
      countryOfSignup: "PH",
      message: "Mock result for payment-flow testing only.",
    },
  ],
};

await clearFailures(ip);

return res.status(200).json(mockResult);
