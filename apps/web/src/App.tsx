import { Route, Routes } from "react-router";
import { SwapPage } from "./features/swap/SwapPage.js";
import { DesignSystemPage } from "./pages/DesignSystemPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SwapPage />} />
      <Route path="/design-system" element={<DesignSystemPage />} />
    </Routes>
  );
}
