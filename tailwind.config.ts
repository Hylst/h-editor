import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        editor: {
          background: "hsl(var(--editor-background))",
          sidebar: "hsl(var(--editor-sidebar))",
          "tab-active": "hsl(var(--editor-tab-active))",
          "tab-inactive": "hsl(var(--editor-tab-inactive))",
          "tab-hover": "hsl(var(--editor-tab-hover))",
          border: "hsl(var(--editor-border))",
          highlight: "hsl(var(--editor-highlight))",
          text: "hsl(var(--editor-text))",
          "text-muted": "hsl(var(--editor-text-muted))",
        },
        search: {
          "match-bg": "hsl(var(--search-match-bg) / 0.3)",
          "match-text": "hsl(var(--search-match-text))",
        },
        lang: {
          markdown: "hsl(var(--lang-markdown))",
          javascript: "hsl(var(--lang-javascript))",
          typescript: "hsl(var(--lang-typescript))",
          python: "hsl(var(--lang-python))",
          java: "hsl(var(--lang-java))",
          go: "hsl(var(--lang-go))",
          rust: "hsl(var(--lang-rust))",
          ruby: "hsl(var(--lang-ruby))",
          php: "hsl(var(--lang-php))",
          html: "hsl(var(--lang-html))",
          css: "hsl(var(--lang-css))",
          json: "hsl(var(--lang-json))",
          folder: "hsl(var(--lang-folder))",
        },
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-accent": "var(--gradient-accent)",
      },
      boxShadow: {
        "sm": "var(--shadow-sm)",
        "md": "var(--shadow-md)",
        "lg": "var(--shadow-lg)",
      },
      transitionProperty: {
        "fast": "var(--transition-fast)",
        "normal": "var(--transition-normal)",
        "slow": "var(--transition-slow)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      typography: {
        DEFAULT: {
          css: {
            // Par défaut le plugin encadre le code inline de backticks : bruit inutile
            // dans un aperçu Markdown affiché à côté du code source.
            "code::before": { content: '""' },
            "code::after": { content: '""' },
            code: {
              backgroundColor: "hsl(var(--muted))",
              padding: "0.15em 0.35em",
              borderRadius: "0.25rem",
              fontWeight: "500",
            },
            "pre code": { backgroundColor: "transparent", padding: "0" },
          },
        },
      },
    },
  },
  plugins: [animate, typography],
} satisfies Config;
