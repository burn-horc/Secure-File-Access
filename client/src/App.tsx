import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";

function Router() {
  return (
    <Switch>
      {/* Add pages below */}
      {/* <Route path="/" component={Home}/> */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {

  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("preview");

    if (preview === "burnpogi") {
      localStorage.setItem("site_bypass", "true");
      setAllowed(true);
      return;
    }

    setAllowed(localStorage.getItem("site_bypass") === "true");
  }, []);

  if (!allowed) {
    return (
      <div style={{
        height:"100vh",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        background:"#0b0b0b",
        color:"white",
        textAlign:"center"
      }}>
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
