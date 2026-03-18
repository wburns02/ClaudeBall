import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainMenuPage } from '@/pages/MainMenuPage.tsx';
import { TestHarnessPage } from '@/pages/TestHarnessPage.tsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/test" element={<TestHarnessPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
