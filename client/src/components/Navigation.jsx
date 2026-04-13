import { Link } from "react-router-dom";
import { Home, Tv, Info } from "lucide-react";

export default function Navigation({ open, setOpen }) {
  return (
    <div className={`fixed top-0 left-0 h-full w-80 bg-[#0d1325] p-6 transition ${open ? "translate-x-0" : "-translate-x-full"}`}>
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-purple-400 tracking-widest">NAVIGATION</h2>
        <button onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="space-y-4">

        <Link to="/" className="flex items-center gap-3 p-4 rounded-xl bg-purple-600/20 border border-purple-500">
          <Home size={20}/>
          Cookie Checker
        </Link>

        <Link to="/tv" className="flex items-center gap-3 p-4 rounded-xl border border-gray-700">
          <Tv size={20}/>
          TV Access
        </Link>

        <Link to="/guide" className="flex items-center gap-3 p-4 rounded-xl border border-gray-700">
          <Info size={20}/>
          Guide
        </Link>

      </div>
    </div>
  );
}
