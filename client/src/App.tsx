/**
 * App — Root component
 * Design: Deep Space / Data Observatory (dark theme)
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Analytics } from "@vercel/analytics/react";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// the globe pulls in the WebGL map engine; keep it out of the U.S. page bundle
const World = lazy(() => import("./pages/World"));
const China = lazy(() => import("./pages/China"));

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#04060d" }} />}>
          <World />
        </Suspense>
      </Route>
      <Route path={"/us"} component={Home} />
      <Route path={"/cn"}>
        <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#eef5fb" }} />}>
          <China />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "rgba(13,21,38,0.95)",
                border: "1px solid rgba(30,58,95,0.6)",
                color: "#e2e8f0",
                fontFamily: "'JetBrains Mono', monospace",
              },
            }}
          />
          <Router />
          {/* Vercel Web Analytics: page views only; does nothing until enabled in the Vercel project */}
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
