// Layout.tsx
import { useEffect, useState } from "react";
import { Navbar1 } from "@/blocks/navbar/navbar1";
import { Footer12 } from "@/blocks/footer/footer12";
import { FaArrowUp } from "react-icons/fa";
import { ThemeProvider } from "@/custom/ThemeProvider";
import "@/styles/globals.css";
import "@/styles/custom.css";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [showButton, setShowButton] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  const handleScroll = () => {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrolled = (scrollTop / (docHeight - winHeight)) * 100;
    setScrollPosition(scrolled);
    setShowButton(window.scrollY > 300);
  };

  useEffect(() => {
    setMounted(true);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!mounted) return null;

  return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Navbar1 />
          <section className="py-16 px-[1.5rem] lg:px-[5rem]">
            <main>{children}</main>
          </section>
          <Toaster />
          <Footer12 />
          {showButton && (
            <Button
              onClick={scrollToTop}
              className="fixed bottom-10 right-10 w-12 h-12 rounded-full shadow-lg focus:outline-none focus:ring-2"
              style={{
                border: `${scrollPosition.toFixed(2)}% solid hsl(var(--primary))`,
                background: `linear-gradient(to right, hsl(var(--primary)) ${scrollPosition.toFixed(
                  2
                )}%, transparent 0)`,
              }}
            >
              <ChevronUp
                className={scrollPosition >= 50 ? "text-popover" : "text-ring"}
              />
            </Button>
          )}
      </ThemeProvider>
  );
};

export default Layout;
