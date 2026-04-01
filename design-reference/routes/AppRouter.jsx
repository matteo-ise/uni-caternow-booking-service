import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home.jsx";
import ContactWizard from "../pages/ContactWizard.jsx";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/contact", element: <ContactWizard /> },
]);

export default router;
