import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false,
  },

  colors: {
    brand: {
      100: "#ffe4cf",
      200: "#ffc897",
      300: "#ffab60",
      400: "#ff8a3d",
      500: "#e8782d",
    },
    accent: {
      200: "#6cefe2",
      300: "#3be6d6",
      400: "#23d7c6",
    },

    // 🔥 Darker true background for separation
    bg: {
      900: "#070c14",
      850: "#0c1420",
      800: "#111c2a",
    },

    // 🔥 Clearer surface contrast
    surface: {
      950: "#162535",
      900: "#1b2c3f",
      850: "#213347",
      800: "#27405a",
      700: "#2e4a66",
      650: "#355372",
      600: "#3c5c7e",
      550: "#44658a",
    },

    fg: {
      DEFAULT: "#e8eff9",
      soft: "#f7fbff",
      muted: "#9aa8bd",
      dim: "#76839a",
    },

    danger: {
      300: "#ff6d8d",
      200: "#ffd6e0",
    },
  },

  // 🔥 Stronger depth shadow
  shadows: {
    card:
      "0 30px 80px rgba(0,0,0,0.55), 0 0 120px rgba(255,138,61,0.08)",
    soft:
      "0 16px 34px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.35)",
    float:
      "0 24px 48px rgba(0,0,0,0.5)",
  },

  components: {
    Button: {
      baseStyle: {
        borderWidth: 0,
        boxShadow: "none",
        transition:
          "transform 160ms cubic-bezier(0.22,1,0.36,1), filter 160ms cubic-bezier(0.22,1,0.36,1), background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease",
        willChange: "transform",
        _hover: {
          transform: "translateY(-1px)",
          filter: "brightness(1.05)",
        },
        _active: {
          transform: "translateY(0) scale(0.98)",
          filter: "brightness(0.95)",
        },
      },
    },

    Input: {
      variants: {
        outline: {
          field: {
            borderWidth: "1px",
            borderColor: "rgba(255,255,255,0.18)",
            bg: "rgba(27,44,63,0.75)",
            borderRadius: "14px",
            _hover: {
              borderColor: "rgba(255,138,61,0.7)",
            },
            _focusVisible: {
              borderColor: "rgba(35,215,198,0.85)",
              boxShadow: "0 0 0 1px rgba(35,215,198,0.45)",
              bg: "rgba(30,48,68,0.9)",
            },
          },
        },
      },
    },

    Select: {
      variants: {
        outline: {
          field: {
            borderWidth: "1px",
            borderColor: "rgba(255,255,255,0.18)",
            bg: "rgba(27,44,63,0.75)",
            borderRadius: "14px",
            _hover: {
              borderColor: "rgba(255,138,61,0.7)",
            },
            _focusVisible: {
              borderColor: "rgba(35,215,198,0.85)",
              boxShadow: "0 0 0 1px rgba(35,215,198,0.45)",
              bg: "rgba(30,48,68,0.9)",
            },
          },
        },
      },
    },

    Textarea: {
      variants: {
        outline: {
          borderWidth: "1px",
          borderColor: "rgba(255,255,255,0.18)",
          bg: "rgba(27,44,63,0.75)",
          borderRadius: "14px",
          _hover: {
            borderColor: "rgba(255,138,61,0.7)",
          },
          _focusVisible: {
            borderColor: "rgba(35,215,198,0.85)",
            boxShadow: "0 0 0 1px rgba(35,215,198,0.45)",
            bg: "rgba(30,48,68,0.9)",
          },
        },
      },
    },

    Modal: {
      baseStyle: {
        dialog: {
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.6), 0 0 100px rgba(255,138,61,0.06)",
        },
      },
    },

    Drawer: {
      baseStyle: {
        dialog: {
          borderWidth: "1px",
          borderColor: "rgba(255,255,255,0.08)",
          bg: "#1b2c3f",
          boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
        },
      },
    },
  },

  styles: {
    global: {
      "html, body, #root": {
        margin: 0,
        minHeight: "100%",
        backgroundColor: "bg.900",
      },

      body: {
        fontFamily:
          "'Manrope', 'Segoe UI', system-ui, -apple-system, sans-serif",
        lineHeight: 1.5,
        color: "fg.DEFAULT",
        backgroundColor: "bg.900",

        // 🔥 Centered visible glow
        backgroundImage:
          "radial-gradient(1000px 600px at 50% -20%, rgba(255,138,61,0.22), transparent 60%), radial-gradient(900px 520px at 100% -10%, rgba(35,215,198,0.18), transparent 65%)",
      },

      "*, *::before, *::after": {
        boxSizing: "border-box",
      },

      "*::-webkit-scrollbar": {
        width: "8px",
        height: "8px",
      },

      "*::-webkit-scrollbar-track": {
        background: "#0c1420",
      },

      "*::-webkit-scrollbar-thumb": {
        borderRadius: "999px",
        background: "rgba(255,138,61,0.78)",
      },

      "*::-webkit-scrollbar-thumb:hover": {
        background: "rgba(35,215,198,0.9)",
      },
    },
  },
});

export default theme;
