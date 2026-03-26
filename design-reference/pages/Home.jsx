import Navbar from "../components/Navbar.jsx";
import HeroBanner from "../components/HeroBanner.jsx";
import MagicBento from "../components/MagicBento.jsx";
import "./../styles/global.css";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="container">
        <HeroBanner />
        {/* große, schöne Bento-Section bleibt */}
        <MagicBento />
      </main>
    </>
  );
}
