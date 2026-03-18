import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainMenuPage } from '@/pages/MainMenuPage.tsx';
import { TestHarnessPage } from '@/pages/TestHarnessPage.tsx';
import { LiveGamePage } from '@/pages/LiveGamePage.tsx';
import { FranchiseDashboard } from '@/pages/FranchiseDashboard.tsx';
import { StandingsPage } from '@/pages/StandingsPage.tsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/test" element={<TestHarnessPage />} />
        <Route path="/game/live" element={<LiveGamePage />} />
        <Route path="/franchise" element={<FranchiseDashboard />} />
        <Route path="/franchise/standings" element={<StandingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
