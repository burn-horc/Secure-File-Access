import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const allowed = params.get("preview") === "12345secret";

  if (!allowed) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0b",
          color: "white",
          textAlign: "center",
        }}
      >
        <div>
          <h1>🚧 Site Under Maintenance</h1>
          <p>We are updating the website. Please come back later.</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
